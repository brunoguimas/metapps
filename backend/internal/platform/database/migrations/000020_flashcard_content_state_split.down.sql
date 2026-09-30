-- Restore SRS columns onto flashcards (best-effort reverse of the split).
ALTER TABLE public.flashcards ADD COLUMN ease_factor NUMERIC(5, 4) NOT NULL DEFAULT 2.5;
ALTER TABLE public.flashcards ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.flashcards ADD COLUMN repetitions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.flashcards ADD COLUMN next_review_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.flashcards ADD COLUMN last_reviewed_at TIMESTAMPTZ;

UPDATE public.flashcards f
SET ease_factor = p.ease_factor,
    interval_days = p.interval_days,
    repetitions = p.repetitions,
    next_review_at = p.next_review_at,
    last_reviewed_at = p.last_reviewed_at
FROM public.flashcard_progress p
WHERE p.flashcard_id = f.id
  AND p.user_id = f.user_id;

DROP TABLE IF EXISTS public.flashcard_progress;

DROP INDEX IF EXISTS idx_flashcards_topic_front;

-- tasks: restore NOT NULL on user_id.
UPDATE public.tasks SET user_id = NULL WHERE user_id IS NULL;
