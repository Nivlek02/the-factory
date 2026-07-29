-- Ventana de autoactivación de cuentas.
--
-- El link de activación es UNO SOLO para todo el equipo (/activar): cada persona escribe su
-- correo y elige su contraseña. Eso significa que, mientras la ventana esté abierta, cualquiera
-- que tenga el link y conozca el correo de un compañero podría tomar esa cuenta — decisión
-- explícita del usuario, y por eso la ventana existe: se abre para repartir accesos y se cierra.
--
-- La fecha se valida en la edge function `activar-acceso` (service_role), no en el navegador:
-- esconder el formulario no sirve de nada si el endpoint sigue aceptando requests.

create table if not exists public.activacion_config (
  -- Singleton: una sola fila. El check sobre un boolean primary key impide insertar una segunda.
  id boolean primary key default true,
  activo_hasta timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint activacion_config_singleton check (id)
);

-- Ventana inicial: hasta el viernes 7 de agosto de 2026, fin del día, hora de Colombia (UTC-5).
insert into public.activacion_config (id, activo_hasta)
values (true, '2026-08-07 23:59:59-05')
on conflict (id) do nothing;

alter table public.activacion_config enable row level security;

-- Lectura para cualquier autenticado: Ajustes muestra el estado de la ventana.
-- Quien activa su cuenta NO lee esta tabla desde el navegador — la function lo hace por él con
-- service_role, que bypassea RLS.
create policy "activacion_config_select_autenticados"
  on public.activacion_config for select
  to authenticated
  using (true);

-- Solo Estratega/Soporte mueven la fecha. Mismo SECURITY DEFINER que usuarios_roles (ver
-- 20260717010000): consultar usuarios_roles desde una policy sin él se evalúa recursivamente.
create policy "activacion_config_update_gestores"
  on public.activacion_config for update
  to authenticated
  using (public.puede_gestionar_usuarios(auth.uid()))
  with check (public.puede_gestionar_usuarios(auth.uid()));
