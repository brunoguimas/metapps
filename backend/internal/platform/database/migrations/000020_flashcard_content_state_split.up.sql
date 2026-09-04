-- Tasks: allow shared classroom content (owned by a teacher or personal).
ALTER TABLE public.tasks ALTER COLUMN user_id DROP NOT NULL;

-- Flashcards: split into shared content + per-user SRS progress.
-- Allow user_id NULL (classroom content owned by a teacher).
ALTER TABLE public.flashcards ALTER COLUMN user_id DROP NOT NULL;

-- Create per-user SRS state table.
CREATE TABLE public.flashcard_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
    ease_factor NUMERIC(5, 4) NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    next_review_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, flashcard_id),
    CHECK (interval_days >= 0),
    CHECK (repetitions >= 0)
);

CREATE INDEX idx_flashcard_progress_user ON public.flashcard_progress(user_id);
CREATE INDEX idx_flashcard_progress_flashcard ON public.flashcard_progress(flashcard_id);
CREATE INDEX idx_flashcard_progress_user_due ON public.flashcard_progress(user_id, next_review_at);

-- Migrate existing SRS state to the new per-user table (before dropping columns).
INSERT INTO public.flashcard_progress (user_id, flashcard_id, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at)
SELECT user_id, id, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at
FROM public.flashcards
WHERE user_id IS NOT NULL;

-- Flashcards become content-only.
ALTER TABLE public.flashcards DROP COLUMN IF EXISTS ease_factor;
ALTER TABLE public.flashcards DROP COLUMN IF EXISTS interval_days;
ALTER TABLE public.flashcards DROP COLUMN IF EXISTS repetitions;
ALTER TABLE public.flashcards DROP COLUMN IF EXISTS next_review_at;
ALTER TABLE public.flashcards DROP COLUMN IF EXISTS last_reviewed_at;

-- Unique content per topic.
DROP INDEX IF EXISTS idx_flashcards_user_topic_front;
CREATE UNIQUE INDEX idx_flashcards_topic_front ON public.flashcards(topic_id, front);
