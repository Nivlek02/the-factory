-- Remove the automatic mercadeo role assignment from the profile-insert trigger.
-- Roles must now be explicitly set by an admin when creating a user.
-- This prevents deleted users from silently regaining mercadeo access on re-login.
CREATE OR REPLACE FUNCTION public.assign_default_role_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;
