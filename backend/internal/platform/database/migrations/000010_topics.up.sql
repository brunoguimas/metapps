CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES public.goal(id) ON DELETE CASCADE,
    parent_topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    required_mastery NUMERIC(5, 4) DEFAULT 0.7 CHECK(require_mastery >= 0 AND require_mastery <= 1),
    weight FLOAT DEFAULT 1.0,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topic_user_id
ON public.topics(user_id);

CREATE INDEX IF NOT EXISTS idx_topic_goal_id
ON public.topics(goal_id);

CREATE TABLE IF NOT EXISTS public.topic_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    mastery_score NUMERIC(5, 4) DEFAULT 0,
    confidence_score NUMERIC(5, 4) DEFAULT 0,
    attempts_count INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (
        status IN (
            'LOCKED',
            'AVAILABLE',
            'IN_PROGRESS',
            'MASTERED'
        )
    ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_progress_user_id
ON public.topic_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_topic_progress_topic_id
ON public.topic_progress(topic_id);

CREATE TABLE IF NOT EXISTS public.topic_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    depends_on_topic_id UUID NOT NULL REFERENCES topics(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
