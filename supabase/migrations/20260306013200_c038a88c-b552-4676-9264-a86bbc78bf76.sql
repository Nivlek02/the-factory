-- Add 'manager' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- Add 'sm_1' and 'sm_2' to task_assigned_role enum
ALTER TYPE public.task_assigned_role ADD VALUE IF NOT EXISTS 'sm_1';
ALTER TYPE public.task_assigned_role ADD VALUE IF NOT EXISTS 'sm_2';