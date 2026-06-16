-- Allow all authenticated users to view all profiles (needed for notifications)
CREATE POLICY "All authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);