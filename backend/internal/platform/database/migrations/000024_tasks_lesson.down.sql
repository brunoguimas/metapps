DROP INDEX IF EXISTS idx_tasks_content_gin;
DROP INDEX IF EXISTS idx_tasks_user_topic;
DROP INDEX IF EXISTS idx_tasks_user_status;

ALTER TABLE public.tasks
    DROP COLUMN IF EXISTS version,
    DROP COLUMN IF EXISTS source,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS step_cursor,
    DROP COLUMN IF EXISTS max_combo,
    DROP COLUMN IF EXISTS score,
    DROP COLUMN IF EXISTS xp_gained,
    DROP COLUMN IF EXISTS last_step_at,
    DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS tasks_source_check;
ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS tasks_status_check;
