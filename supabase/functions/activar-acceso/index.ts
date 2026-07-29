/**
 * Autoactivación de cuenta: alguien que ya está en el directorio (`usuarios_roles`) escribe su
 * correo, elige contraseña y queda con acceso.
 *
 * SEGURIDAD — esta función es PÚBLICA (verify_jwt = false), y tiene que serlo: quien la usa
 * todavía no tiene cuenta, así que no puede mandar un JWT. Lo que la contiene es:
 *
 *   1. La VENTANA de tiempo (`activacion_config.activo_hasta`), validada acá. Fuera de la
 *      ventana no crea nada. Es la única barrera real, porque el link es compartido: mientras
 *      esté abierta, cualquiera que lo tenga y sepa el correo de un compañero puede tomar esa
 *      cuenta. Decisión explícita del usuario; cerrar la ventana apenas se repartan los accesos.
 *   2. Solo activa filas que YA existen en el directorio y que todavía no tienen `user_id`.
 *      No crea usuarios nuevos ni toca cuentas ya activas, así que no sirve para secuestrar
 *      una cuenta existente ni para cambiarle la contraseña a nadie.
 *   3. Nunca acepta un rol desde el body: el rol es el que ya tenga la fila en la base.
 *
 * Lo que NO hace, a propósito: cambiar contraseñas de cuentas ya activas. Eso sigue siendo
 * exclusivo de `admin-usuarios`, que exige rol de gestor.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MIN_PASSWORD = 8;

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

/** Vuelve literal un valor que va a un `ilike`: `%` (cualquier texto), `_` (un carácter) y `\`
 *  (el escape) dejan de ser comodines. Sin esto, el "correo" que escribe quien activa su cuenta
 *  es en realidad un PATRÓN de búsqueda. */
const comoLiteral = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let body: { email?: string; password?: string; soloEstado?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }

  // ── 1. ¿La ventana está abierta? ──
  const { data: config } = await admin
    .from('activacion_config')
    .select('activo_hasta')
    .maybeSingle();

  const activoHasta = config?.activo_hasta ? new Date(config.activo_hasta) : null;
  const abierta = !!activoHasta && activoHasta.getTime() >= Date.now();

  // La pantalla consulta el estado antes de pintar el formulario. Devuelve la fecha para poder
  // decir hasta cuándo estuvo disponible, sin exponer nada del directorio.
  if (body.soloEstado) return json({ abierta, activoHasta: config?.activo_hasta ?? null });

  if (!abierta) {
    return json(
      { error: 'El periodo para activar cuentas está cerrado. Pídele acceso al equipo de mercadeo.' },
      403,
    );
  }

  // ── 2. Datos ──
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!email) return json({ error: 'Escribe tu correo.' }, 400);
  // Forma mínima de correo. Además de atajar erratas, bloquea el `%`: ver `comoLiteral`.
  if (!/^[^\s@%]+@[^\s@%]+\.[^\s@%]{2,}$/.test(email)) {
    return json({ error: 'Escribe un correo válido.' }, 400);
  }
  if (password.length < MIN_PASSWORD) {
    return json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }, 400);
  }

  // ── 3. ¿Está en el directorio? ──
  // El correo se compara sin distinguir mayúsculas: en la tabla están escritos a mano. Se sigue
  // usando `ilike` por eso mismo (y no `eq`), pero el valor va **escapado**: `%` y `_` son
  // comodines para `ilike`, así que sin escaparlos un patrón como '%netsat%' que matcheara una
  // sola fila permitía activar la cuenta de un compañero SIN saber su correo — y la respuesta
  // devolvía su nombre. El `_` se escapa porque es legal dentro de un correo real
  // (maria_jose@…): no se puede rechazar, hay que tratarlo como texto.
  const { data: fila, error: filaError } = await admin
    .from('usuarios_roles')
    .select('id, user_id, email, nombre_completo')
    .ilike('email', comoLiteral(email))
    .maybeSingle();

  if (filaError) return json({ error: 'No se pudo consultar el directorio.' }, 500);
  if (!fila) {
    return json(
      { error: 'Ese correo no está en el equipo. Revisa que sea el mismo que te registraron.' },
      404,
    );
  }
  if (fila.user_id) {
    return json({ error: 'Esa cuenta ya está activa. Inicia sesión con tu contraseña.' }, 409);
  }

  // ── 4. Crear el acceso ──
  // email_confirm: true porque el proyecto no tiene SMTP propio y el correo de confirmación
  // nunca llegaría — la persona quedaría sin poder entrar (ver punto 31 de la bitácora).
  const { data: creado, error: createError } = await admin.auth.admin.createUser({
    email: fila.email,
    password,
    email_confirm: true,
  });

  if (createError || !creado?.user) {
    return json({ error: createError?.message ?? 'No se pudo crear la cuenta.' }, 400);
  }

  // ── 5. Enlazar con el directorio ──
  const { error: linkError, count } = await admin
    .from('usuarios_roles')
    .update({ user_id: creado.user.id, debe_cambiar_password: false, updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', fila.id)
    .select();

  if (linkError || !count) {
    // Si no se pudo enlazar, la cuenta quedaría huérfana: existe en auth pero el directorio no
    // la reconoce, y `fetchUserProfile` devolvería null al entrar. Se deshace.
    await admin.auth.admin.deleteUser(creado.user.id);
    return json({ error: 'No se pudo enlazar la cuenta con el directorio. Intenta de nuevo.' }, 500);
  }

  return json({ success: true, email: fila.email, nombre: fila.nombre_completo });
});
