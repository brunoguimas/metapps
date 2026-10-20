-- Camada de repeticao espacada (SRS) + meta diaria.
--
-- review_items guarda os exercicios que o usuario errou (ou que ainda
-- precisam ser revisitados) e quando cada um volta a aparecer. O
-- question_hash (sha1 do enunciado + alternativas) evita duplicar o
-- mesmo exercicio quando ele aparece em tasks diferentes.
--
-- daily_activity e o historico diario: alimenta a meta diaria, a streak
-- e o heatmap de atividade.

CREATE TABLE IF NOT EXISTS public.review_items (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id       uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    step_index    int  NOT NULL,
    question_hash text NOT NULL,
    ease          float NOT NULL DEFAULT 2.5,
    interval_days int  NOT NULL DEFAULT 1,
    lapses        int  NOT NULL DEFAULT 0,
    due_at        timestamptz NOT NULL DEFAULT now(),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT review_items_unique_question UNIQUE (user_id, question_hash)
);

CREATE INDEX IF NOT EXISTS idx_review_items_due
    ON public.review_items (user_id, due_at);

CREATE TABLE IF NOT EXISTS public.daily_activity (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_date  date NOT NULL,
    xp             int NOT NULL DEFAULT 0,
    exercises      int NOT NULL DEFAULT 0,
    lessons        int NOT NULL DEFAULT 0,
    seconds        int NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT daily_activity_unique_day UNIQUE (user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date
    ON public.daily_activity (user_id, activity_date DESC);

-- Meta diaria de XP (padrao 50, igual a uma meta "casca" no Duolingo).
ALTER TABLE public.profile
    ADD COLUMN IF NOT EXISTS daily_goal_xp int NOT NULL DEFAULT 50;
