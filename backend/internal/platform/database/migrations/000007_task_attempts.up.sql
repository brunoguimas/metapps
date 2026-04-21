CREATE TABLE IF NOT EXISTS public.task_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    score NUMERIC(5, 4) CHECK (score >= 0 AND score <= 1),
    status TEXT CHECK (status IN ('pending', 'processed', 'failed')) DEFAULT 'pending',
    task_evaluation JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_attempts_task_id
ON public.task_attempts(task_id);

CREATE INDEX IF NOT EXISTS idx_task_attempts_user_id
ON public.task_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_task_attempts_user_task
ON public.task_attempts(user_id, task_id);

CREATE INDEX idx_task_attempts_user_created
ON public.task_attempts(user_id, created_at DESC);
