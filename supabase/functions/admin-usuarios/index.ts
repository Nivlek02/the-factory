/**
 * Operaciones sobre auth.users que el navegador no puede hacer (exigen service_role):
 * cambiar correo de acceso, fijar contraseña y crear la cuenta de acceso de alguien
 * que ya está en el directorio.
 *
 * SEGURIDAD — el service_role bypassea toda RLS, así que la autorización se hace acá a mano:
 *   1. Exige un JWT válido en Authorization (identifica a quien llama; no se confía en el body).
 *   2. Verifica contra usuarios_roles que ese usuario sea Estratega o Soporte.
 * Sin ambos pasos esto sería una puerta abierta para cambiarle la contraseña a cualquiera.
 * (Ver supabase/functions/admin-set-password: no valida nada — NO desplegar esa.)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ROLES_GESTORES = ['Estratega', 'Soporte'];
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

  // ── 2. ¿Puede gestionar usuarios? ──
  const { data: quienLlama } = await admin
    .from('usuarios_roles')
    .select('rol')
    .eq('user_id', caller.user.id)
    .maybeSingle();

  if (!quienLlama || !ROLES_GESTORES.includes(quienLlama.rol)) {
    return json({ error: 'Solo los roles Estratega y Soporte pueden gestionar usuarios.' }, 403);
  }

  // ── 3. Acción ──
  let body: { action?: string; rowId?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }

  const { action, rowId, email, password } = body;
  if (!action || !rowId) return json({ error: 'Falta action o rowId' }, 400);

  // La fila objetivo siempre se lee de la base por su id: nunca se confía en el email del body.
  const { data: destino, error: destinoError } = await admin
    .from('usuarios_roles')
    .select('id, user_id, email, usuario, nombre_completo')
    .eq('id', rowId)
    .maybeSingle();

  if (destinoError || !destino) return json({ error: 'Usuario no encontrado' }, 404);

  switch (action) {
    // Cambia el correo de acceso en auth.users Y en el directorio, para que no queden peleados.
    case 'set-email': {
      const nuevo = email?.trim().toLowerCase();
      if (!nuevo) return json({ error: 'Falta el correo' }, 400);
      if (!destino.user_id) {
        return json({ error: 'Este usuario todavía no tiene cuenta de acceso.' }, 400);
      }

      const { error: authError } = await admin.auth.admin.updateUserById(destino.user_id, {
        email: nuevo,
        email_confirm: true, // sin SMTP propio no hay forma de que confirmen por correo
      });
      if (authError) return json({ error: authError.message }, 400);

      const { error: filaError } = await admin
        .from('usuarios_roles')
        .update({ email: nuevo })
        .eq('id', rowId);
      // auth.users ya quedó cambiado: si el directorio falla, avisamos en vez de fingir éxito.
      if (filaError) {
        return json(
          { error: `El correo de acceso cambió, pero el directorio no: ${filaError.message}` },
          500
        );
      }

      return json({ success: true });
    }

    case 'set-password': {
      if (!password || password.length < MIN_PASSWORD) {
        return json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }, 400);
      }
      if (!destino.user_id) {
        return json({ error: 'Este usuario todavía no tiene cuenta de acceso.' }, 400);
      }

      const { error } = await admin.auth.admin.updateUserById(destino.user_id, { password });
      if (error) return json({ error: error.message }, 400);

      await admin.from('usuarios_roles').update({ debe_cambiar_password: true }).eq('id', rowId);
      return json({ success: true });
    }

    // Crea la cuenta en auth.users para alguien que ya está en el directorio y la enlaza.
    case 'create-access': {
      if (!password || password.length < MIN_PASSWORD) {
        return json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }, 400);
      }
      if (destino.user_id) return json({ error: 'Este usuario ya tiene cuenta de acceso.' }, 400);

      const { data: creado, error } = await admin.auth.admin.createUser({
        email: destino.email,
        password,
        email_confirm: true,
        user_metadata: {
          username: destino.usuario,
          full_name: destino.nombre_completo,
          debe_cambiar_password: true,
        },
      });
      if (error) return json({ error: error.message }, 400);

      const { error: linkError } = await admin
        .from('usuarios_roles')
        .update({ user_id: creado.user.id, debe_cambiar_password: true })
        .eq('id', rowId);

      if (linkError) {
        // Sin el enlace la cuenta es inservible (loginUser la rechaza) y bloquearía reintentos.
        await admin.auth.admin.deleteUser(creado.user.id);
        return json({ error: `No se pudo enlazar la cuenta: ${linkError.message}` }, 500);
      }

      return json({ success: true });
    }

    default:
      return json({ error: `Acción desconocida: ${action}` }, 400);
  }
});
