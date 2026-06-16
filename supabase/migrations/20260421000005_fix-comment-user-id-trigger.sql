-- Ensure user_id column exists without FK constraint.
-- The DEFAULT auth.uid() approach is unreliable in some Supabase setups
-- because it is evaluated outside the PostgREST request context.
-- We use an explicit BEFORE INSERT trigger instead as a server-side fallback.

ALTER TABLE public.task_comments
  DROP CONSTRAINT IF EXISTS task_comments_user_id_fkey;

ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Trigger fallback: if user_id is not supplied by the client, set it from auth.uid()
CREATE OR REPLACE FUNCTION public.set_comment_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_comment_user_id ON public.task_comments;
CREATE TRIGGER trg_set_comment_user_id
  BEFORE INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_comment_user_id();
