-- factory_projects required TO authenticated only, but the app has no real auth
-- session (see 20260106024406 for the same fix on tasks/task_comments).
-- This left every insert/update silently rejected by RLS.
DROP POLICY IF EXISTS "Authenticated users can view factory projects" ON public.factory_projects;
DROP POLICY IF EXISTS "Authenticated users can create factory projects" ON public.factory_projects;
DROP POLICY IF EXISTS "Authenticated users can update factory projects" ON public.factory_projects;
DROP POLICY IF EXISTS "Authenticated users can delete factory projects" ON public.factory_projects;

CREATE POLICY "Public can view factory projects"
ON public.factory_projects FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public can create factory projects"
ON public.factory_projects FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Public can update factory projects"
ON public.factory_projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public can delete factory projects"
ON public.factory_projects FOR DELETE TO anon, authenticated USING (true);
