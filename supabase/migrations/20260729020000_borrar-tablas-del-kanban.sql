-- Borra `tasks` y `task_comments`, las tablas del kanban viejo, cuyo código se eliminó el
-- 2026-07-29.
--
-- IMPORTANTE, porque el nombre engaña: **NO son las tareas ni los comentarios de las campañas.**
-- Las tareas de una campaña (`fabricaBriefs`) y sus comentarios viven dentro del blob
-- `factory_projects.data` (JSONB), no en tablas propias — se comprobó contra la base: no existe
-- ninguna tabla `tareas`/`comentarios`/`campanas`. Estas dos eran exclusivas del tablero kanban
-- de Diseño/Copys que ya no está en la app.
--
-- SE BORRAN SOLO SI ESTÁN VACÍAS. Si tienen filas, la migración **falla a propósito** y no toca
-- nada: puede ser histórico del kanban y borrarlo no se puede deshacer. En ese caso hay que
-- mirar qué hay y decidir a mano.

do $$
declare
  n_tareas    bigint;
  n_comments  bigint;
begin
  select count(*) into n_tareas   from public.tasks;
  select count(*) into n_comments from public.task_comments;

  if n_tareas = 0 and n_comments = 0 then
    -- task_comments primero: tiene la FK hacia tasks.
    drop table if exists public.task_comments;
    drop table if exists public.tasks;
    raise notice 'tasks y task_comments borradas (estaban vacías).';
  else
    raise exception
      'NO se borró nada: tasks tiene % fila(s) y task_comments % fila(s). Es historial del kanban viejo: revísalo antes de borrarlo (select * from public.tasks;) y, si no sirve, corre los drops a mano.',
      n_tareas, n_comments;
  end if;
end $$;

-- Nota sobre las OTRAS tablas huérfanas, para que nadie las borre de corrido:
--
--   · `app_version` — sin lectores ni escritores desde que el aviso de versión usa /version.json.
--     Se puede borrar sin consecuencias.
--   · `profiles` — vacía y con el modelo de roles viejo. Se puede borrar.
--   · `user_roles` — vacía, PERO **tiene una dependencia viva**: la función `public.has_role()`
--     consulta esta tabla, y esa función se usa en la policy de DELETE del bucket
--     `task-attachments` (migración 20260421000002). Si se borra la tabla, esa policy empieza a
--     fallar y **nadie podrá borrar adjuntos**. Antes de borrarla hay que reescribir esa policy
--     (por ejemplo, contra `usuarios_roles` con `puede_gestionar_usuarios()`).
