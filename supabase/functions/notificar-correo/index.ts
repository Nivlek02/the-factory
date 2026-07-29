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
 * TRANSPORTE — hay dos, y se elige solo según qué secrets estén puestos (ver `enviar`):
 *
 *   1. Gmail por SMTP (preferido). No necesita dominio propio: se autentica contra la cuenta de
 *      Gmail con una "contraseña de aplicación" y le llega a CUALQUIER destinatario. Como el que
 *      envía es Google, el correo sale alineado (SPF/DKIM de gmail.com) y no cae en spam, que es
 *      justo lo que no se puede lograr mandando desde un gmail a través de un tercero.
 *   2. Resend (herencia). Se queda como respaldo para no romper nada mientras se hace el cambio,
 *      pero SIN dominio verificado solo entrega a la dueña de la cuenta — por eso se migró.
 *
 * Config (secrets de Supabase):
 *   GMAIL_USER          — la cuenta que envía (p.ej. tremu.notificaciones@gmail.com). Google
 *                         reescribe el remitente a esta dirección: no se puede mandar "a nombre
 *                         de" otra sin registrarla como alias verificado.
 *   GMAIL_APP_PASSWORD  — contraseña de aplicación (16 caracteres, con o sin espacios). NO es la
 *                         clave de la cuenta. Exige verificación en dos pasos activa. No caduca,
 *                         pero se revoca sola si se cambia la contraseña de la cuenta de Google:
 *                         si el correo deja de salir de golpe, esto es lo primero que hay que ver.
 *   MAIL_FROM_NAME      — opcional, nombre visible del remitente (default 'Tremu').
 *   MAIL_MODO_PRUEBA    — una dirección: TODO se redirige ahí y el correo muestra a quién le
 *   (o RESEND_MODO_PRUEBA) habría llegado. Con Gmail ya NO hace falta (no hay restricción de
 *                         destinatarios); sirve para estrenar el cambio sin exponer al equipo.
 *                         Cuando el envío esté confirmado, BORRAR este secret.
 *   APP_URL             — base de los enlaces del correo.
 *   RESEND_API_KEY      — solo para el transporte viejo. Se ignora si GMAIL_* está puesto.
 *   RESEND_FROM         — idem.
 *
 * Si no hay ni GMAIL_* ni RESEND_API_KEY, la función responde 200 sin enviar: la app sigue
 * funcionando mientras se termina de configurar el correo.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

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
/** Si está puesto, NADA sale a sus destinatarios reales: todo se redirige a esta dirección.
 *  Se acepta el nombre viejo (`RESEND_MODO_PRUEBA`) para no dejar el sistema desprotegido en el
 *  momento del cambio de transporte: si solo estaba ese, sigue valiendo. */
const MODO_PRUEBA =
  (Deno.env.get('MAIL_MODO_PRUEBA') ?? Deno.env.get('RESEND_MODO_PRUEBA'))?.trim() || null;

const GMAIL_USER = Deno.env.get('GMAIL_USER')?.trim() || null;
/** Google la muestra en bloques separados por espacios; los descarta al autenticar, pero el
 *  servidor SMTP no, así que se limpian acá antes que hacerle perder media hora a alguien. */
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')?.replace(/\s+/g, '') || null;
const FROM_NAME = Deno.env.get('MAIL_FROM_NAME')?.trim() || 'Tremu';
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Tremu <onboarding@resend.dev>';

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
}) => `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#EEF1F7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#12141B;">
  <!--AVISO_PRUEBA-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 1px 3px rgba(18,20,27,.06);">
    <tr><td style="background:${opts.color};padding:18px 28px;">
      <p style="margin:0;font-size:16px;font-weight:700;color:#fff;letter-spacing:-.2px;">${esc(opts.titulo)}</p>
    </td></tr>
    <tr><td style="padding:24px 28px;">
      <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8A90A0;">Campaña</p>
      <p style="margin:0 0 20px;font-size:18px;font-weight:600;">${esc(opts.campana)}${
        opts.cliente ? `<span style="font-weight:400;color:#8A90A0;"> · ${esc(opts.cliente)}</span>` : ''
      }</p>

      <p style="margin:0 0 10px;font-size:14px;color:#3B4150;">${esc(opts.intro)}</p>
      <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.7;">
        ${opts.tareas.map((t) => `<li>${esc(t)}</li>`).join('')}
      </ul>

      ${opts.fecha ? `<p style="margin:0 0 20px;font-size:14px;color:#3B4150;"><strong>Fecha de la acción:</strong> ${esc(formatFecha(opts.fecha))}</p>` : ''}

      ${
        opts.nota
          ? `<div style="margin:0 0 20px;padding:14px 16px;background:#F7F8FB;border-left:3px solid ${opts.color};border-radius:10px;">
               <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8A90A0;">Comentario</p>
               <p style="margin:0;font-size:14px;white-space:pre-wrap;">${esc(opts.nota)}</p>
             </div>`
          : ''
      }

      <a href="${APP_URL}/mis-tareas" style="display:inline-block;padding:12px 22px;background:#009CF5;color:#fff;text-decoration:none;border-radius:22px;font-size:14px;font-weight:600;">Ver en Tremu</a>

      ${opts.porQuien ? `<p style="margin:20px 0 0;font-size:12px;color:#8A90A0;">Acción registrada por ${esc(opts.porQuien)}.</p>` : ''}
    </td></tr>
    <tr><td style="padding:14px 28px 22px;border-top:1px solid #ECEEF3;">
      <p style="margin:0;font-size:11px;color:#8A90A0;">${esc(opts.pie)}</p>
    </td></tr>
  </table>
</body></html>`;

/** Banner que reemplaza a <!--AVISO_PRUEBA--> cuando el envío se redirigió. Sin esto, en modo
 *  prueba llegarían correos idénticos a los reales y nadie sabría para quién eran. */
const bannerPrueba = (reales: string[]) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto 12px;background:#FEF3C7;border:1px solid #FCD34D;border-radius:14px;">
    <tr><td style="padding:12px 18px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#92400E;">MODO DE PRUEBA — este correo no llegó a su destinatario real</p>
      <p style="margin:0;font-size:12px;color:#92400E;">En producción se enviaría a: ${reales.map(esc).join(', ')}</p>
    </td></tr>
  </table>`;

/** Gmail por SMTP. Se manda **un correo por destinatario**, no uno con todos en copia: así nadie
 *  ve la dirección de los demás (el directorio tiene correos personales) y cada quien ve la suya
 *  en el "Para". El volumen lo permite de sobra — el sistema agrupa un correo por rol, no por
 *  tarea, y el tope diario de una cuenta Gmail gratuita son ~500 destinatarios. */
const enviarPorGmail = async (destino: string[], asunto: string, html: string) => {
  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465, // TLS implícito: un salto menos que STARTTLS en 587 y menos cosas que fallen
      tls: true,
      auth: { username: GMAIL_USER!, password: GMAIL_APP_PASSWORD! },
    },
  });

  try {
    for (const to of destino) {
      await client.send({
        from: `${FROM_NAME} <${GMAIL_USER}>`,
        to,
        subject: asunto,
        html,
        content: 'auto', // genera la parte de texto plano a partir del HTML
      });
    }
    return { ok: true as const, enviadoA: destino };
  } catch (e) {
    const detalle = String(e).slice(0, 400);
    console.error('GMAIL_ERROR', detalle);
    // 535 = credenciales rechazadas. Es EL error esperable acá, y casi siempre es lo mismo:
    // se pegó la clave de la cuenta en vez de una contraseña de aplicación, o se revocó.
    const pista = /535|username and password not accepted|BadCredentials/i.test(detalle)
      ? ' — Gmail rechazó las credenciales: revisa que GMAIL_APP_PASSWORD sea una contraseña de aplicación vigente (no la clave de la cuenta) y que la verificación en dos pasos siga activa'
      : '';
    return { ok: false as const, motivo: `gmail: ${detalle}${pista}` };
  } finally {
    // Sin esto la conexión queda colgada y la invocación no termina de cerrar.
    await client.close().catch(() => {});
  }
};

/** Transporte viejo. Sin dominio verificado Resend rechaza (403) todo lo que no vaya a la dueña
 *  de la cuenta — por eso se dejó de usar; queda solo como respaldo. */
const enviarPorResend = async (destino: string[], asunto: string, html: string) => {
  const key = Deno.env.get('RESEND_API_KEY')!;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: destino, subject: asunto, html }),
  });

  if (!res.ok) {
    const detalle = (await res.text()).slice(0, 400);
    console.error('RESEND_ERROR', res.status, detalle);
    const pista =
      res.status === 403 && !MODO_PRUEBA
        ? ' — dominio sin verificar en Resend: configura GMAIL_USER/GMAIL_APP_PASSWORD para no depender de eso'
        : '';
    return { ok: false as const, motivo: `resend ${res.status}: ${detalle}${pista}` };
  }
  return { ok: true as const, enviadoA: destino };
};

const enviar = async (para: string[], asunto: string, html: string) => {
  const hayGmail = !!(GMAIL_USER && GMAIL_APP_PASSWORD);
  if (!hayGmail && !Deno.env.get('RESEND_API_KEY')) {
    return { ok: false as const, motivo: 'correo sin configurar (falta GMAIL_USER/GMAIL_APP_PASSWORD)' };
  }

  // El redirect de modo prueba se aplica una sola vez, antes de elegir transporte: así los dos
  // se comportan igual y no hay forma de que uno se salte la protección.
  const destino = MODO_PRUEBA ? [MODO_PRUEBA] : para;
  const cuerpo = MODO_PRUEBA ? html.replace('<!--AVISO_PRUEBA-->', bannerPrueba(para)) : html;
  const titulo = MODO_PRUEBA ? `[PRUEBA] ${asunto}` : asunto;

  return hayGmail
    ? await enviarPorGmail(destino, titulo, cuerpo)
    : await enviarPorResend(destino, titulo, cuerpo);
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

  // ── 2. Prueba de configuración: se manda a quien la pide, a nadie más. ──
  if (evento === 'prueba') {
    const r = await enviar(
      [quienLlama.email],
      'Prueba de notificaciones — Tremu',
      plantilla({
        titulo: 'Prueba de configuración',
        color: '#009CF5',
        intro: 'Si estás leyendo esto, el envío de correos de Tremu quedó bien configurado. Este es el formato que recibirá el equipo:',
        campana: 'Campaña de ejemplo',
        cliente: 'Cámara de Comercio de Barranquilla',
        tareas: ['Redactar copy para Correo — Convocatoria inicial', 'Diseño de pieza para Instagram'],
        fecha: new Date().toISOString().slice(0, 10),
        porQuien: quienLlama.nombre_completo,
        pie: 'Correo de prueba enviado desde Ajustes → Notificaciones por correo.',
      })
    );
    // La prueba sí devuelve a dónde fue: en modo prueba el correo no llega a quien lo pidió,
    // y decir "revisa tu bandeja" a secas mandaría a buscar un correo que nunca va a estar ahí.
    return r.ok
      ? json({ success: true, destinatarios: 1, enviadoA: r.enviadoA, modoPrueba: !!MODO_PRUEBA })
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
