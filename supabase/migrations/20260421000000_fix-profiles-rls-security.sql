-- Drop overly broad policy that exposes emails and full names to all authenticated users.
-- Mercadeo admins retain full access via "Mercadeo can manage profiles" (FOR ALL).
-- Regular users retain access to their own profile via "Users can view their own profile".
DROP POLICY IF EXISTS "All authenticated users can view profiles" ON public.profiles;
