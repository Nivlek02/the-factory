-- La ventana de activación se administra únicamente desde el backend: se quitó de Ajustes el
-- control que la leía y la escribía. Sin nadie que la consulte desde el navegador, las policies
-- sobran — y dejarlas abiertas solo amplía la superficie sin dar nada a cambio.
--
-- Al quedar RLS activa y sin policies, la tabla es inalcanzable para anon y authenticated. La
-- edge function `activar-acceso` la sigue leyendo sin problema porque usa service_role, que
-- bypassea RLS por definición.
--
-- Para mover la fecha (abrir o cerrar la activación), desde el SQL Editor de Supabase:
--   update public.activacion_config set activo_hasta = '2026-08-07 23:59:59-05', updated_at = now();
-- Cerrarla de inmediato = ponerle una fecha pasada, p. ej. now() - interval '1 day'.

drop policy if exists "activacion_config_select_autenticados" on public.activacion_config;
drop policy if exists "activacion_config_update_gestores" on public.activacion_config;
