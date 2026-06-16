
DROP POLICY IF EXISTS "Public can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Public can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Public can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Public can delete tasks" ON public.tasks;

DROP POLICY IF EXISTS "Public can view comments" ON public.task_comments;
DROP POLICY IF EXISTS "Public can create comments" ON public.task_comments;
DROP POLICY IF EXISTS "Public can update comments" ON public.task_comments;
DROP POLICY IF EXISTS "Public can delete comments" ON public.task_comments;
