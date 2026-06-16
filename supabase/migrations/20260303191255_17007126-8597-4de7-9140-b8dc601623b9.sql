DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "All authenticated users can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);