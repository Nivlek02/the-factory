ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_board_check;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_board_check
CHECK (board = ANY (ARRAY['design', 'copys', 'social_media', 'seo']::text[]));