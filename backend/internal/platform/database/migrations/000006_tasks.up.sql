CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    type TEXT NOT NULL 
        CHECK (type = 'quiz' OR type = 'question' OR type = 'essay'),
    done BOOLEAN NOT NULL DEFAULT false,
    done_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_goal_id
ON public.tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id
ON public.tasks(user_id);
