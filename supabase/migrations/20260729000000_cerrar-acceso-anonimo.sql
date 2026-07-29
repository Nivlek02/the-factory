-- Cierra el acceso ANÓNIMO a los datos de la app.
--
-- Contexto: `factory_projects`, `tasks` y `task_comments` quedaron con políticas
-- `TO anon, authenticated USING (true)` cuando la app todavía no tenía login
-- (ver 20260106024406 y 20260707120000). La publishable key es pública y viaja dentro
-- del bundle de JS, así que con esas políticas cualquiera podía leer, modificar y BORRAR
-- todas las campañas sin tener cuenta: el login de App.tsx solo escondía la UI.
--
-- Desde el 2026-07-16 la app usa Supabase Auth real y TODO el tráfico a estas tablas pasa
-- después del login (`hydrate` se llama desde FactoryPage / MisTareasPage / ReportsPage, las
-- tres detrás del gate de sesión), así que restringir a `authenticated` no rompe ningún camino.
--
-- OJO si algo dejara de guardar: un rechazo de RLS **falla en silencio** (solo se ve en la
-- consola del navegador) y un UPDATE sin permiso vuelve SIN error y con 0 filas. Si aparece
-- algo así, el culpable es un camino que escribe sin sesión, no esta migración.

-- ── factory_projects ──
DROP POLICY IF EXISTS "Public can view factory projects" ON public.factory_projects;
DROP POLICY IF EXISTS "Public can create factory projects" ON public.factory_projects;
DROP POLICY IF EXISTS "Public can update factory projects" ON public.factory_projects;
DROP POLICY IF EXISTS "Public can delete factory projects" ON public.factory_projects;

DROP POLICY IF EXISTS "Authenticated can view factory projects" ON public.factory_projects;
CREATE POLICY "Authenticated can view factory projects"
ON public.factory_projects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can create factory projects" ON public.factory_projects;
CREATE POLICY "Authenticated can create factory projects"
ON public.factory_projects FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update factory projects" ON public.factory_projects;
CREATE POLICY "Authenticated can update factory projects"
ON public.factory_projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete factory projects" ON public.factory_projects;
CREATE POLICY "Authenticated can delete factory projects"
ON public.factory_projects FOR DELETE TO authenticated USING (true);

-- ── tasks (kanban viejo, todavía alcanzable en /board/:id) ──
DROP POLICY IF EXISTS "Public can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Public can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Public can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Public can delete tasks" ON public.tasks;

DROP POLICY IF EXISTS "Authenticated can view tasks" ON public.tasks;
CREATE POLICY "Authenticated can view tasks"
ON public.tasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can create tasks" ON public.tasks;
CREATE POLICY "Authenticated can create tasks"
ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.tasks;
CREATE POLICY "Authenticated can update tasks"
ON public.tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete tasks" ON public.tasks;
CREATE POLICY "Authenticated can delete tasks"
ON public.tasks FOR DELETE TO authenticated USING (true);

-- ── task_comments ──
DROP POLICY IF EXISTS "Public can view comments" ON public.task_comments;
DROP POLICY IF EXISTS "Public can create comments" ON public.task_comments;
DROP POLICY IF EXISTS "Public can update comments" ON public.task_comments;
DROP POLICY IF EXISTS "Public can delete comments" ON public.task_comments;

DROP POLICY IF EXISTS "Authenticated can view comments" ON public.task_comments;
CREATE POLICY "Authenticated can view comments"
ON public.task_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can create comments" ON public.task_comments;
CREATE POLICY "Authenticated can create comments"
ON public.task_comments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update comments" ON public.task_comments;
CREATE POLICY "Authenticated can update comments"
ON public.task_comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete comments" ON public.task_comments;
CREATE POLICY "Authenticated can delete comments"
ON public.task_comments FOR DELETE TO authenticated USING (true);
