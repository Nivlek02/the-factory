-- Fix user_id column on task_comments.
-- The previous migration used REFERENCES auth.users(id) which can fail
-- in some Supabase setups. We drop the FK constraint (if it exists),
-- then ensure the column exists with DEFAULT auth.uid() so PostgreSQL
-- sets it automatically on every insert — no client-side value needed.

ALTER TABLE public.task_comments
  DROP CONSTRAINT IF EXISTS task_comments_user_id_fkey;

ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();

ALTER TABLE public.task_comments
  ALTER COLUMN user_id SET DEFAULT auth.uid();
