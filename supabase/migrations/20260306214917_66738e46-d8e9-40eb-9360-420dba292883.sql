-- Add 'seo' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'seo';

-- Add 'seo_1' and 'seo_2' to task_assigned_role enum
ALTER TYPE public.task_assigned_role ADD VALUE IF NOT EXISTS 'seo_1';
ALTER TYPE public.task_assigned_role ADD VALUE IF NOT EXISTS 'seo_2';