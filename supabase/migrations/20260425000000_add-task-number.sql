-- Add sequential numeric task_number to tasks table
CREATE SEQUENCE IF NOT EXISTS tasks_task_number_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS task_number INTEGER;

-- Backfill existing tasks with sequential numbers ordered by creation date
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.tasks
)
UPDATE public.tasks
SET task_number = numbered.rn
FROM numbered
WHERE public.tasks.id = numbered.id;

-- Advance sequence past current max so new tasks continue from there
SELECT setval(
  'tasks_task_number_seq',
  COALESCE((SELECT MAX(task_number) FROM public.tasks), 0) + 1,
  false
);

-- All future inserts auto-generate the next number
ALTER TABLE public.tasks
ALTER COLUMN task_number SET DEFAULT nextval('tasks_task_number_seq');
