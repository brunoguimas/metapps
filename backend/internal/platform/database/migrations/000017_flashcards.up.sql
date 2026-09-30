CREATE TYPE flashcard_source AS ENUM ('ai', 'manual');

CREATE TABLE public.flashcards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id        UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    source          flashcard_source NOT NULL DEFAULT 'manual',
    front           TEXT NOT NULL,
    back            TEXT NOT NULL,
    ease_factor     NUMERIC(5,4) NOT NULL DEFAULT 2.5,
    interval_days   INTEGER NOT NULL DEFAULT 0,
    repetitions     INTEGER NOT NULL DEFAULT 0,
    next_review_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_reviewed_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (interval_days >= 0),
    CHECK (repetitions >= 0)
);

CREATE UNIQUE INDEX idx_flashcards_user_topic_front ON public.flashcards(user_id, topic_id, front);

CREATE INDEX idx_flashcards_user_due ON public.flashcards(user_id, next_review_at);
CREATE INDEX idx_flashcards_topic ON public.flashcards(topic_id);
