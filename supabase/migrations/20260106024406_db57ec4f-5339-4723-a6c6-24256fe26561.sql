-- Allow public (anon) access for tasks + comments so the app works without auth
-- Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Public can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Public can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Public can delete tasks" ON public.tasks;

CREATE POLICY "Public can view tasks"
ON public.tasks
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Public can create tasks"
ON public.tasks
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public can update tasks"
ON public.tasks
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can delete tasks"
ON public.tasks
FOR DELETE
TO anon, authenticated
USING (true);

-- Task comments
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view comments" ON public.task_comments;
DROP POLICY IF EXISTS "Public can create comments" ON public.task_comments;
DROP POLICY IF EXISTS "Public can update comments" ON public.task_comments;
DROP POLICY IF EXISTS "Public can delete comments" ON public.task_comments;

CREATE POLICY "Public can view comments"
ON public.task_comments
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Public can create comments"
ON public.task_comments
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public can update comments"
ON public.task_comments
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can delete comments"
ON public.task_comments
FOR DELETE
TO anon, authenticated
USING (true);

-- Ensure tasks updated_at is maintained (function exists already; add trigger)
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_tasks_updated_at();