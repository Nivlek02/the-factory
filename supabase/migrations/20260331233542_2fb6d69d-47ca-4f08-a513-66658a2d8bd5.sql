
CREATE TABLE public.app_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text
);

ALTER TABLE public.app_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view app version"
  ON public.app_version FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Mercadeo can manage app version"
  ON public.app_version FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mercadeo'::app_role))
  WITH CHECK (has_role(auth.uid(), 'mercadeo'::app_role));

INSERT INTO public.app_version (version, updated_by) VALUES ('1.0.0', 'system');

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_version;
