/**
 * Notificaciones por correo de las campañas de La Fábrica.
 *
 * SEGURIDAD — el navegador NUNCA manda direcciones de correo: solo dice qué pasó, en qué
 * campaña, sobre qué tareas y qué ROL es responsable. Los correos se resuelven acá contra
 * usuarios_roles con el service_role. Sin eso esto sería un relay abierto: cualquiera con
 * sesión podría mandar correo a cualquier dirección desde el dominio de la Cámara.
 *
 * Igual que admin-usuarios, la autorización se hace a mano (el service_role bypassea toda RLS):
 *   1. Exige un JWT válido en Authorization.
 *   2. Exige que quien llama exista en usuarios_roles (es decir, sea del equipo).
 * No pide rol de gestor: cualquiera del equipo dispara notificaciones al trabajar.
 *
 * TRANSPORTE — Gmail por SMTP, y nada más. No necesita dominio propio: se autentica contra la
 * cuenta de Gmail con una "contraseña de aplicación" y le llega a CUALQUIER destinatario. Como el
 * que envía es Google, el correo sale alineado (SPF/DKIM de gmail.com) y no cae en spam — que es
 * justo lo que no se logra mandando desde un gmail a través de un tercero.
 *
 * Resend se eliminó: sin dominio verificado solo entregaba a la dueña de la cuenta, así que el
 * equipo nunca recibía nada. Si algún día se quiere un remitente del dominio de la Cámara, el
 * camino es verificar el dominio en algún proveedor, no volver a este código.
 *
 * Config (secrets de Supabase):
 *   GMAIL_USER          — la cuenta que envía. Google reescribe el remitente a esta dirección: no
 *                         se puede mandar "a nombre de" otra sin registrarla como alias verificado.
 *   GMAIL_APP_PASSWORD  — contraseña de aplicación (16 caracteres, con o sin espacios). NO es la
 *                         clave de la cuenta. Exige verificación en dos pasos activa. No caduca,
 *                         pero se revoca sola si se cambia la contraseña de la cuenta de Google:
 *                         si el correo deja de salir de golpe, esto es lo primero que hay que ver.
 *   MAIL_FROM_NAME      — opcional, nombre visible del remitente (default 'Tremu').
 *   APP_URL             — base de los enlaces del correo.
 *
 * Sin GMAIL_USER/GMAIL_APP_PASSWORD la función responde 200 sin enviar, para que la app siga
 * funcionando en vez de romperse por una notificación.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const APP_URL = (Deno.env.get('APP_URL') ?? 'https://tremubaq.vercel.app').replace(/\/$/, '');

const GMAIL_USER = Deno.env.get('GMAIL_USER')?.trim() || null;
/** Google la muestra en bloques separados por espacios; los descarta al autenticar, pero el
 *  servidor SMTP no, así que se limpian acá antes que hacerle perder media hora a alguien. */
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')?.replace(/\s+/g, '') || null;
const FROM_NAME = Deno.env.get('MAIL_FROM_NAME')?.trim() || 'Tremu';

type Evento = 'tarea.asignada' | 'tarea.en_revision' | 'tarea.aprobada' | 'tarea.correccion' | 'prueba';

interface Cuerpo {
  evento?: Evento;
  campana?: { nombre?: string; cliente?: string };
  tareas?: string[];
  /** Etiqueta del rol responsable, tal como se guarda en usuarios_roles.rol ('Copywriter'…). */
  rolLabel?: string;
  /** Nombres del grupo de rol en esa campaña. Si viene con gente, manda sobre `rolLabel`. */
  miembros?: string[];
  /** Nombre de la estratega de la campaña — destinataria de 'tarea.en_revision'. */
  estratega?: string;
  /** Comentario de corrección, solo en 'tarea.correccion'. */
  nota?: string;
  /** Fecha de la acción (ISO YYYY-MM-DD), si la tarea la tiene. */
  fecha?: string;
}

interface Persona {
  nombre_completo: string;
  email: string;
  rol: string;
}

const COPY: Record<Exclude<Evento, 'prueba'>, { asunto: (n: number) => string; titulo: string; intro: string; color: string }> = {
  'tarea.asignada': {
    asunto: (n) => (n === 1 ? 'Tienes una tarea nueva' : `Tienes ${n} tareas nuevas`),
    titulo: 'Nueva tarea asignada',
    intro: 'Se asignó trabajo a tu rol en esta campaña:',
    color: '#009CF5',
  },
  'tarea.en_revision': {
    asunto: () => 'Un entregable espera tu revisión',
    titulo: 'Entregable en revisión',
    intro: 'Este entregable se envió a aprobación y espera tu revisión:',
    color: '#B45309',
  },
  'tarea.aprobada': {
    asunto: () => 'Tu entregable fue aprobado',
    titulo: 'Entregable aprobado',
    intro: 'La revisión de este entregable quedó aprobada:',
    color: '#15803D',
  },
  'tarea.correccion': {
    asunto: () => 'Te pidieron correcciones',
    titulo: 'Corrección solicitada',
    intro: 'Este entregable volvió a pendiente con un comentario de corrección:',
    color: '#B91C1C',
  },
};

/** El HTML del correo se arma con los textos del equipo, así que hay que escapar sí o sí. */
const esc = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** 'YYYY-MM-DD' → '20 de julio de 2026'. Se parte a mano: new Date('2026-07-20') es UTC y en
 *  Colombia (UTC-5) mostraría el día anterior. Mismo motivo que parseISOLocal en src/lib/urgencia. */
const formatFecha = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${Number(m[3])} de ${meses[Number(m[2]) - 1]} de ${m[1]}`;
};

/**
 * Plantilla del correo. Reglas del medio, que no son las de una página web:
 *
 *  · **Tablas, no flexbox ni grid.** Outlook renderiza con el motor de Word y no entiende nada
 *    moderno; una tabla anidada es lo único que se comporta igual en todos lados.
 *  · **Estilos en línea.** Gmail borra el `<style>` en algunos clientes (sobre todo en la app
 *    móvil), así que lo que tiene que verse siempre va en el atributo `style`. El `<style>` del
 *    `<head>` se usa SOLO para el `@media`, que es un extra: si se pierde, el correo igual se ve.
 *  · **Responsive de verdad:** la tabla es `width="100%"` con `max-width:600px`, o sea que se
 *    encoge sola aunque el `@media` no llegue. El media query solo aprieta los paddings y sube el
 *    tamaño del texto en pantallas chicas.
 *  · **El logo puede no cargar.** Casi todos los clientes bloquean imágenes remotas por defecto,
 *    así que el diseño no depende de él: va sobre una banda de color que ya da identidad, y lleva
 *    `alt`. Es PNG y no el SVG de la app porque los clientes de correo no renderizan SVG.
 *  · **Preheader**: el texto que el buzón muestra junto al asunto. Sin él, los clientes agarran
 *    la primera frase que encuentren (normalmente "Campaña"), que no dice nada.
 */
const plantilla = (opts: {
  titulo: string;
  color: string;
  intro: string;
  campana: string;
  cliente?: string;
  tareas: string[];
  nota?: string;
  fecha?: string;
  porQuien?: string;
  pie: string;
}) => {
  const preheader = `${opts.campana}${opts.cliente ? ` · ${opts.cliente}` : ''} — ${opts.tareas.length} ${opts.tareas.length === 1 ? 'tarea' : 'tareas'}`;

  // Cada tarea es una fila con un punto de color, no un <li>: los bullets nativos se ven distintos
  // en cada cliente y no se pueden alinear bien.
  const filasTareas = opts.tareas
    .map(
      (t, i) => `
      <tr>
        <td style="padding:${i === 0 ? '0' : '8px'} 0 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="20" valign="top" style="padding-top:7px;">
                <div style="width:7px;height:7px;border-radius:7px;background:${opts.color};"></div>
              </td>
              <td valign="top" style="font-size:15px;line-height:1.5;color:#12141B;font-weight:500;">${esc(t)}</td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(opts.titulo)}</title>
<style>
  /* Solo ajustes finos: si un cliente ignora esto, el correo se sigue viendo bien. */
  @media only screen and (max-width:620px) {
    .contenedor { padding:16px 12px !important; }
    .caja       { border-radius:16px !important; }
    .relleno    { padding:22px 20px !important; }
    .cabecera   { padding:20px !important; }
    .campana    { font-size:19px !important; }
    .boton      { display:block !important; text-align:center !important; }
  }
  /* Los enlaces automáticos de iOS (fechas, direcciones) se pintan azules por su cuenta. */
  a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
</style>
</head>
<body style="margin:0;padding:0;background:#EEF1F7;-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;color:#EEF1F7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF1F7;">
    <tr>
      <td align="center" class="contenedor" style="padding:28px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="caja" style="max-width:600px;background:#FFFFFF;border-radius:22px;overflow:hidden;box-shadow:0 4px 16px rgba(18,20,27,.08);">

          <!-- Cabecera: banda de color del evento + logo -->
          <tr>
            <td class="cabecera" style="background:${opts.color};padding:22px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="44" valign="middle" style="padding-right:14px;">
                    <img src="${APP_URL}/logo-email.png" width="44" height="44" alt="Tremu"
                         style="display:block;width:44px;height:44px;border:0;border-radius:12px;background:#FFFFFF;">
                  </td>
                  <td valign="middle">
                    <p style="margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.75);font-weight:600;">Tremu · La Fábrica</p>
                    <p style="margin:2px 0 0;font-size:18px;font-weight:700;color:#FFFFFF;letter-spacing:-.3px;">${esc(opts.titulo)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="relleno" style="padding:28px;">

              <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#8A90A0;font-weight:600;">Campaña</p>
              <p class="campana" style="margin:0 0 22px;font-size:21px;font-weight:700;color:#12141B;letter-spacing:-.4px;line-height:1.3;">${esc(opts.campana)}${
                opts.cliente ? `<br><span style="font-size:14px;font-weight:400;color:#8A90A0;letter-spacing:0;">${esc(opts.cliente)}</span>` : ''
              }</p>

              <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#3B4150;">${esc(opts.intro)}</p>

              <!-- Tareas -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#F7F8FB;border-radius:14px;margin:0 0 20px;">
                <tr><td style="padding:18px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${filasTareas}</table>
                </td></tr>
              </table>

              ${
                opts.fecha
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
                       <tr><td style="background:#E5F5FE;border-radius:10px;padding:10px 16px;font-size:14px;color:#0079BD;font-weight:600;">
                         Fecha de la acción: ${esc(formatFecha(opts.fecha))}
                       </td></tr>
                     </table>`
                  : ''
              }

              ${
                opts.nota
                  ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
                       <tr>
                         <td width="4" style="background:${opts.color};border-radius:4px 0 0 4px;"></td>
                         <td style="background:#F7F8FB;border-radius:0 12px 12px 0;padding:14px 18px;">
                           <p style="margin:0 0 5px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#8A90A0;font-weight:600;">Comentario</p>
                           <p style="margin:0;font-size:15px;line-height:1.55;color:#12141B;white-space:pre-wrap;">${esc(opts.nota)}</p>
                         </td>
                       </tr>
                     </table>`
                  : ''
              }

              <!-- Botón. El VML es lo único que le da fondo y bordes redondeados en Outlook de
                   escritorio; el resto de clientes lo ignoran y usan el <a> de abajo. -->
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                           href="${APP_URL}/mis-tareas" style="height:46px;v-text-anchor:middle;width:210px;" arcsize="50%" stroke="f" fillcolor="#009CF5">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;">Ver mis tareas</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${APP_URL}/mis-tareas" class="boton"
                 style="display:inline-block;padding:14px 30px;background:#009CF5;color:#FFFFFF;text-decoration:none;border-radius:26px;font-size:15px;font-weight:600;letter-spacing:-.2px;box-shadow:0 3px 10px rgba(0,156,245,.28);">Ver mis tareas</a>
              <!--<![endif]-->

              ${opts.porQuien ? `<p style="margin:22px 0 0;font-size:13px;color:#8A90A0;">Acción registrada por <span style="color:#3B4150;font-weight:500;">${esc(opts.porQuien)}</span>.</p>` : ''}
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #ECEEF3;background:#FCFCFD;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8A90A0;">${esc(opts.pie)}</p>
            </td>
          </tr>
        </table>

        <p style="margin:16px 0 0;font-size:11px;color:#A8AEBC;">Tremu · Cámara de Comercio de Barranquilla</p>
      </td>
    </tr>
  </table>
</body></html>`;
};

/** Correo de muestra, compartido por los eventos `prueba` (lo envía) y `preview` (lo devuelve
 *  para verlo en el navegador). Lleva a propósito los tres bloques opcionales —fecha, comentario
 *  y quién lo hizo— para que al revisar el diseño se vea todo, no la mitad. */
const ejemplo = (nombre: string) =>
  plantilla({
    titulo: 'Prueba de configuración',
    color: '#009CF5',
    intro: 'Si estás leyendo esto, el envío de correos de Tremu quedó bien configurado. Este es el formato que recibirá el equipo:',
    campana: 'Campaña de renovación — Afiliados 2026',
    cliente: 'Cámara de Comercio de Barranquilla',
    tareas: [
      'Redactar copy para Correo — Convocatoria inicial',
      'Diseño de pieza para Instagram — Recordatorio',
      'Configurar envío por WhatsApp',
    ],
    fecha: new Date().toISOString().slice(0, 10),
    nota: 'Este es el aspecto que tendría un comentario de corrección dentro del correo.',
    porQuien: nombre,
    pie: 'Recibes este correo porque estás en el equipo de esta campaña en Tremu.',
  });

// ─── Cliente SMTP mínimo ────────────────────────────────────────────────────
// Escrito a mano en vez de usar denomailer: esa librería **mata el worker** en el runtime de
// Supabase (respuesta 500 sin cuerpo, ni siquiera entra al catch, así que no hay error que
// loguear). Se comprobó que el runtime SÍ permite el socket — `Deno.connectTls` a
// smtp.gmail.com:465 devuelve el saludo `220 smtp.gmail.com ESMTP` sin problema —, o sea que el
// bloqueo era de la librería, no de la plataforma. El diálogo SMTP que se necesita acá son ocho
// comandos, y así no hay dependencia externa que se pudra.

const enc = new TextEncoder();
const dec = new TextDecoder();

/** base64 de una cadena UTF-8. Por bloques: `String.fromCharCode(...bytes)` de un tirón revienta
 *  la pila con cuerpos grandes, y el HTML del correo ronda los 3 KB. */
const b64 = (s: string): string => {
  const bytes = enc.encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};

/** Quita saltos de línea y tabs de cualquier valor que vaya a una cabecera o a un comando SMTP.
 *  Una cabecera se termina con CRLF, así que un `\n` metido en el asunto (que lo arma el cliente)
 *  o en el correo del directorio permitiría inyectar cabeceras propias — un `Bcc:` convertiría
 *  esto en un relay abierto. No basta con confiar en el filtro de `cabecera()`: su regex usa `$`,
 *  que en JS también matchea ANTES de un `\n` final, así que un salto al final se le cuela. */
const unaLinea = (s: string) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim();

/** Cabecera con acentos → palabra codificada RFC 2047. Sin esto un asunto con "ñ" o tildes llega
 *  como basura: las cabeceras SMTP son ASCII. */
const cabecera = (raw: string) => {
  const s = unaLinea(raw);
  return /^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
};

/** ¿Es una dirección que se puede poner en un `RCPT TO:` sin romper el diálogo SMTP? Los correos
 *  salen del directorio (los escriben Estratega/Soporte a mano), no del navegador, pero un
 *  `\n` o un `<` ahí desincronizaría los comandos. Se descarta la dirección, no el envío entero. */
const correoValido = (e: string) => /^[^\s<>@",;:\\]+@[^\s<>@",;:\\]+\.[^\s<>@",;:\\]{2,}$/.test(e);

class SmtpError extends Error {}

class Smtp {
  private pendiente = '';
  constructor(private conn: Deno.TlsConn) {}

  /** Lee hasta el final de una respuesta SMTP. Las multilínea van `250-...` y cierran con
   *  `250 ...` (código + espacio); sin esperar esa línea, el siguiente comando se desincroniza. */
  private async leer(): Promise<string> {
    const limite = Date.now() + 20_000;
    for (;;) {
      const lineas = this.pendiente.split('\r\n');
      const cerrada = lineas.find((l) => /^\d{3} /.test(l));
      if (cerrada) {
        const r = this.pendiente;
        this.pendiente = '';
        return r;
      }
      if (Date.now() > limite) throw new SmtpError('el servidor no respondió a tiempo');
      const buf = new Uint8Array(4096);
      const n = await this.conn.read(buf);
      if (n === null) throw new SmtpError('el servidor cerró la conexión');
      this.pendiente += dec.decode(buf.subarray(0, n));
    }
  }

  /** Envía un comando y exige el código esperado. `secreto` evita que la contraseña, que viaja
   *  como argumento de AUTH, termine en el mensaje de error y de ahí a los logs. */
  async cmd(linea: string, espera: number, secreto = false): Promise<string> {
    await this.conn.write(enc.encode(linea + '\r\n'));
    const res = await this.leer();
    if (!res.startsWith(String(espera))) {
      throw new SmtpError(`${secreto ? '<comando oculto>' : linea.split(' ')[0]} → ${res.trim()}`);
    }
    return res;
  }

  saludo() { return this.leer(); }
  cerrar() { try { this.conn.close(); } catch { /* ya cerrada */ } }
}

/** Gmail por SMTP. Se manda **un correo por destinatario**, no uno con todos en el "Para": así
 *  nadie ve la dirección de los demás (el directorio tiene correos personales) y cada quien ve la
 *  suya. El volumen lo permite de sobra — el sistema agrupa un correo por rol, no por tarea,
 *  contra un tope de ~500 destinatarios/día de una cuenta Gmail gratuita. Se reutiliza una sola
 *  conexión para todos. */
const enviarPorGmail = async (destino: string[], asunto: string, html: string) => {
  let smtp: Smtp | null = null;
  try {
    smtp = new Smtp(await Deno.connectTls({ hostname: 'smtp.gmail.com', port: 465 }));
    await smtp.saludo();                                   // 220
    await smtp.cmd('EHLO tremu', 250);
    // AUTH PLAIN: base64 de \0usuario\0contraseña. Más simple que AUTH LOGIN (un solo viaje).
    await smtp.cmd(`AUTH PLAIN ${b64(`\0${GMAIL_USER}\0${GMAIL_APP_PASSWORD}`)}`, 235, true);

    const de = `${cabecera(FROM_NAME)} <${GMAIL_USER}>`;
    for (const to of destino) {
      await smtp.cmd(`MAIL FROM:<${GMAIL_USER}>`, 250);
      await smtp.cmd(`RCPT TO:<${to}>`, 250);
      await smtp.cmd('DATA', 354);
      // El cuerpo va en base64: así no hay que preocuparse por líneas largas, por el UTF-8, ni
      // por el "dot stuffing" (una línea que empiece con "." termina el mensaje antes de tiempo).
      const mensaje = [
        `From: ${de}`,
        `To: <${to}>`,
        `Subject: ${cabecera(asunto)}`,
        `Date: ${new Date().toUTCString()}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        b64(html).replace(/(.{76})/g, '$1\r\n'),
      ].join('\r\n');
      await smtp.cmd(`${mensaje}\r\n.`, 250);
    }
    try { await smtp.cmd('QUIT', 221); } catch { /* da igual si no contesta */ }
    return { ok: true as const, enviadoA: destino };
  } catch (e) {
    const detalle = String(e instanceof Error ? e.message : e).slice(0, 400);
    console.error('GMAIL_ERROR', detalle);
    // 535 = credenciales rechazadas, y casi siempre es lo mismo: se puso la clave de la cuenta en
    // vez de una contraseña de aplicación, o se revocó al cambiar la contraseña de Google.
    const pista = /535|BadCredentials|Username and Password not accepted/i.test(detalle)
      ? ' — Gmail rechazó las credenciales: GMAIL_APP_PASSWORD tiene que ser una contraseña de aplicación vigente (no la clave de la cuenta) y la verificación en dos pasos debe seguir activa'
      : '';
    return { ok: false as const, motivo: `gmail: ${detalle}${pista}` };
  } finally {
    smtp?.cerrar();
  }
};

const enviar = async (para: string[], asunto: string, html: string) => {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return { ok: false as const, motivo: 'correo sin configurar (faltan GMAIL_USER / GMAIL_APP_PASSWORD)' };
  }
  // Última barrera antes del socket: una dirección con un salto de línea rompería el diálogo SMTP.
  const limpios = para.map((e) => unaLinea(e)).filter(correoValido);
  if (limpios.length === 0) {
    return { ok: false as const, motivo: 'ninguna dirección válida entre los destinatarios' };
  }
  return await enviarPorGmail(limpios, asunto, html);
};

const norm = (s: string) => s.trim().toLowerCase();

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ── 1. ¿Quién llama? ──
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'No autorizado' }, 401);

  const { data: caller, error: callerError } = await admin.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (callerError || !caller?.user) return json({ error: 'Sesión inválida' }, 401);

  const { data: quienLlama } = await admin
    .from('usuarios_roles')
    .select('nombre_completo, email, rol')
    .eq('user_id', caller.user.id)
    .maybeSingle<Persona>();

  if (!quienLlama) return json({ error: 'No estás en el directorio del equipo.' }, 403);

  let body: Cuerpo;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }

  const { evento } = body;
  if (!evento) return json({ error: 'Falta el evento' }, 400);


  // ── 2. Previsualizar la plantilla sin enviar nada. Útil al tocar el diseño del correo:
  //       devuelve el HTML tal cual saldría, para abrirlo en el navegador. ──
  if ((evento as string) === 'preview') {
    return new Response(ejemplo(quienLlama.nombre_completo), {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // ── 3. Prueba de configuración: se manda a quien la pide, a nadie más. ──
  if (evento === 'prueba') {
    const r = await enviar([quienLlama.email], 'Prueba de notificaciones — Tremu', ejemplo(quienLlama.nombre_completo));
    return r.ok
      ? json({ success: true, destinatarios: 1, enviadoA: r.enviadoA })
      : json({ error: `No se pudo enviar: ${r.motivo}` }, 502);
  }

  const copy = COPY[evento as Exclude<Evento, 'prueba'>];
  if (!copy) return json({ error: `Evento desconocido: ${evento}` }, 400);

  const tareas = (body.tareas ?? []).filter((t) => typeof t === 'string' && t.trim()).slice(0, 25);
  if (tareas.length === 0) return json({ error: 'Sin tareas que notificar' }, 400);

  // ── 3. Destinatarios: SIEMPRE resueltos contra el directorio, nunca vienen del cliente. ──
  const { data: equipo } = await admin
    .from('usuarios_roles')
    .select('nombre_completo, email, rol')
    .returns<Persona[]>();

  const directorio = equipo ?? [];
  let destinatarios: Persona[];

  if (evento === 'tarea.en_revision') {
    // La revisión es de la estratega de la campaña; si su nombre no resuelve (texto viejo, o
    // cambió de rol) cae a todas las Estrategas antes que no avisarle a nadie.
    const porNombre = body.estratega
      ? directorio.filter((p) => norm(p.nombre_completo) === norm(body.estratega!))
      : [];
    destinatarios = porNombre.length > 0 ? porNombre : directorio.filter((p) => p.rol === 'Estratega');
  } else {
    // Miembros del grupo de rol en esa campaña; si ese grupo está vacío, todos los del rol.
    // Es la misma regla que usa "Mis tareas" (isTaskOwnedBy), así que el correo coincide con
    // lo que la persona ve en la app.
    const nombres = (body.miembros ?? []).map(norm);
    const porNombre = nombres.length > 0
      ? directorio.filter((p) => nombres.includes(norm(p.nombre_completo)))
      : [];
    destinatarios = porNombre.length > 0
      ? porNombre
      : directorio.filter((p) => !!body.rolLabel && p.rol === body.rolLabel);
  }

  // Nadie se notifica a sí mismo por algo que acaba de hacer.
  const correos = [
    ...new Set(
      destinatarios
        .map((p) => p.email?.trim())
        .filter((e): e is string => !!e && norm(e) !== norm(quienLlama.email))
    ),
  ];

  if (correos.length === 0) {
    // No es un error: un rol sin gente en el directorio (ej. Social Media) es normal.
    console.log('SIN_DESTINATARIOS', JSON.stringify({ evento, rolLabel: body.rolLabel }));
    return json({ success: true, destinatarios: 0, motivo: 'sin destinatarios' });
  }

  const campana = body.campana?.nombre?.trim() || 'Campaña sin nombre';
  const r = await enviar(
    correos,
    `${copy.asunto(tareas.length)} — ${campana}`,
    plantilla({
      titulo: copy.titulo,
      color: copy.color,
      intro: copy.intro,
      campana,
      cliente: body.campana?.cliente,
      tareas,
      nota: body.nota,
      fecha: body.fecha,
      porQuien: quienLlama.nombre_completo,
      pie: 'Recibes este correo porque estás en el equipo de esta campaña en Tremu.',
    })
  );

  if (!r.ok) {
    // Con el correo todavía sin configurar esto NO es un fallo de la app: se registra y ya.
    console.error('ENVIO_FALLIDO', JSON.stringify({ evento, motivo: r.motivo }));
    return json({ success: false, destinatarios: correos.length, motivo: r.motivo });
  }

  console.log('ENVIADO', JSON.stringify({ evento, destinatarios: correos.length }));
  return json({ success: true, destinatarios: correos.length });
});
