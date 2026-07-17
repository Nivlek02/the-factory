-- La migración 20260716000000 creó usuarios_roles con RLS habilitada pero SOLO con policy
-- de SELECT. Consecuencia: la UI de Ajustes no podía escribir. Peor, fallaba distinto según
-- la operación — el INSERT devolvía 42501, pero el UPDATE devolvía "éxito" afectando 0 filas
-- (RLS filtra las filas, no rechaza el comando), así que "Guardar" decía que había guardado
-- sin guardar nada.
--
-- Alcance deliberado: cualquier usuario autenticado puede escribir. La app no tiene concepto
-- de administrador, y `rol` es informativo (no controla acceso a nada, ver punto 8 de la
-- bitácora), así que esto no es una escalada de privilegios real hoy. Si algún día el rol
-- llega a decidir permisos, estas policies hay que apretarlas: tal como están, cualquiera
-- que entre puede cambiarse el rol a sí mismo.
--
-- Sigue sin haber acceso para `anon`: sin sesión no se lee ni se escribe nada.

DROP POLICY IF EXISTS "Authenticated can insert usuarios_roles" ON public.usuarios_roles;
CREATE POLICY "Authenticated can insert usuarios_roles"
ON public.usuarios_roles
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update usuarios_roles" ON public.usuarios_roles;
CREATE POLICY "Authenticated can update usuarios_roles"
ON public.usuarios_roles
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete usuarios_roles" ON public.usuarios_roles;
CREATE POLICY "Authenticated can delete usuarios_roles"
ON public.usuarios_roles
FOR DELETE
TO authenticated
USING (true);
