-- Add priority column to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text DEFAULT NULL;

-- Update the task_status enum to include 'in_review'
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'in_review';

-- Add a comment explaining priority values
COMMENT ON COLUMN public.tasks.priority IS 'Priority levels: high (red), medium (yellow), null (no priority)';