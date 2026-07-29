-- Quita las policies que la migración anterior (20260729000000) agregó de más en `tasks` y
-- `task_comments`.
--
-- Qué pasó: esa migración asumió que esas dos tablas tenían las policies abiertas a `anon` de
-- 20260106024406 ("Public can view tasks"…). Al aplicarla, Postgres avisó que **no existían** —
-- esa migración vieja nunca llegó a este proyecto, así que las tablas ya estaban restringidas a
-- `authenticated` desde 20251217203726. Resultado: quedaron dos juegos de policies equivalentes.
--
-- Duplicar no abre nada (las policies permisivas se suman con OR y las originales son las mismas
-- `TO authenticated USING (true)`), PERO sí rompió una restricción real: `task_comments` tenía
-- "Authenticated users can edit recent comments", que solo permite editar durante 10 minutos
-- (20260421000003). Un `USING (true)` al lado la vuelve inútil — la suma de permisivas se queda
-- con la más laxa. Quitando las mías vuelve a regir la ventana de 10 minutos.
--
-- `factory_projects` NO se toca: ahí las policies `anon` sí existían, se borraron bien y las
-- nuevas son las únicas que hay.

DROP POLICY IF EXISTS "Authenticated can view tasks"   ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can delete tasks" ON public.tasks;

DROP POLICY IF EXISTS "Authenticated can view comments"   ON public.task_comments;
DROP POLICY IF EXISTS "Authenticated can create comments" ON public.task_comments;
DROP POLICY IF EXISTS "Authenticated can update comments" ON public.task_comments;
DROP POLICY IF EXISTS "Authenticated can delete comments" ON public.task_comments;

-- Red de seguridad: si algún día esas policies `anon` aparecen (por un `db push --include-all` que
-- reaplique 20260106024406), esto las vuelve a cerrar. Son las que esa migración crea.
DROP POLICY IF EXISTS "Public can view tasks"      ON public.tasks;
DROP POLICY IF EXISTS "Public can create tasks"    ON public.tasks;
DROP POLICY IF EXISTS "Public can update tasks"    ON public.tasks;
DROP POLICY IF EXISTS "Public can delete tasks"    ON public.tasks;
DROP POLICY IF EXISTS "Public can view comments"   ON public.task_comments;
DROP POLICY IF EXISTS "Public can create comments" ON public.task_comments;
DROP POLICY IF EXISTS "Public can update comments" ON public.task_comments;
DROP POLICY IF EXISTS "Public can delete comments" ON public.task_comments;
