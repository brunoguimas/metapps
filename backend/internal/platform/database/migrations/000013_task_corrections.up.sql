CREATE TABLE IF NOT EXISTS public.task_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES task_attempts(id) ON DELETE CASCADE,
    feedback TEXT NOT NULL,
    score NUMERIC(5, 4) CHECK (score >= 0 AND score <= 1),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_corrections_attempt_id ON public.task_corrections(attempt_id);
CREATE INDEX IF NOT EXISTS idx_task_corrections_status ON public.task_corrections(status);
CREATE INDEX IF NOT EXISTS idx_task_corrections_created_at ON public.task_corrections(created_at);
