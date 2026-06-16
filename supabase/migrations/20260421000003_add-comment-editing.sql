-- Add user_id column to task_comments (no FK constraint to avoid permission issues).
ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- UPDATE policy: DB-level guard is the 10-minute time window.
-- Ownership is verified service-side by matching the author name.
DROP POLICY IF EXISTS "Users can edit own comments within 10 minutes" ON public.task_comments;
DROP POLICY IF EXISTS "Authenticated users can edit recent comments" ON public.task_comments;
CREATE POLICY "Authenticated users can edit recent comments"
ON public.task_comments
FOR UPDATE
TO authenticated
USING (NOW() - created_at <= INTERVAL '10 minutes')
WITH CHECK (NOW() - created_at <= INTERVAL '10 minutes');
