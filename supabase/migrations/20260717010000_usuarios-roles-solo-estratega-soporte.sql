-- Restringe la gestión de usuarios a los roles Estratega y Soporte.
--
-- La migración anterior (20260717000000) dejó que cualquier autenticado escribiera. Eso
-- permitía que cualquiera se cambiara el rol a sí mismo; ahora que el rol decide quién
-- administra usuarios, eso SÍ sería una escalada de privilegios real.
--
-- La verificación va en una función SECURITY DEFINER, no en un subselect dentro de la policy:
-- una policy sobre usuarios_roles que consulte usuarios_roles se evalúa recursivamente contra
-- sí misma. Es el mismo patrón que ya usa public.has_role() para user_roles.

CREATE OR REPLACE FUNCTION public.puede_gestionar_usuarios(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_roles
    WHERE user_id = _user_id
      AND rol IN ('Estratega', 'Soporte')
  );
$$;

-- SELECT sigue abierto a cualquier autenticado: la app necesita la lista del equipo para
-- asignar tareas y mostrar nombres. Lo que se restringe es escribir.
DROP POLICY IF EXISTS "Authenticated can insert usuarios_roles" ON public.usuarios_roles;
CREATE POLICY "Estratega y Soporte pueden crear usuarios"
ON public.usuarios_roles
FOR INSERT
TO authenticated
WITH CHECK (public.puede_gestionar_usuarios(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can update usuarios_roles" ON public.usuarios_roles;
CREATE POLICY "Estratega y Soporte pueden editar usuarios"
ON public.usuarios_roles
FOR UPDATE
TO authenticated
USING (public.puede_gestionar_usuarios(auth.uid()))
WITH CHECK (public.puede_gestionar_usuarios(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can delete usuarios_roles" ON public.usuarios_roles;
CREATE POLICY "Estratega y Soporte pueden eliminar usuarios"
ON public.usuarios_roles
FOR DELETE
TO authenticated
USING (public.puede_gestionar_usuarios(auth.uid()));
