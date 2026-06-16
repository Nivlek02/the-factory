CREATE TABLE public.factory_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'planning',
  priority TEXT NOT NULL DEFAULT 'P1',
  due_date TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.factory_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view factory projects"
ON public.factory_projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create factory projects"
ON public.factory_projects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update factory projects"
ON public.factory_projects FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete factory projects"
ON public.factory_projects FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_factory_projects_updated_at
BEFORE UPDATE ON public.factory_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_factory_projects_updated_at ON public.factory_projects(updated_at DESC);