ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_type_check;

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_type_check
    CHECK (type = 'quiz' OR type = 'question');
