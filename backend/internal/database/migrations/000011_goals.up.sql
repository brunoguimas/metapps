CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    difficulties JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(user_id, title)
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id
ON public.goals(user_id);
