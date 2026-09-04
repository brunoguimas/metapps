-- name: CreateFlashcard :one
INSERT INTO public.flashcards (user_id, topic_id, source, front, back)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetFlashcardByID :one
SELECT * FROM public.flashcards WHERE id = $1;

-- name: ListFlashcardsByTopic :many
SELECT * FROM public.flashcards WHERE topic_id = $1 ORDER BY created_at DESC;

-- name: UpdateFlashcard :one
UPDATE public.flashcards
SET front = $2, back = $3, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteFlashcard :exec
DELETE FROM public.flashcards WHERE id = $1;

-- name: CreateFlashcardProgress :one
INSERT INTO public.flashcard_progress (user_id, flashcard_id, ease_factor, interval_days, repetitions, next_review_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetFlashcardProgressByUserAndCard :one
SELECT * FROM public.flashcard_progress WHERE user_id = $1 AND flashcard_id = $2;

-- name: UpdateFlashcardProgress :one
UPDATE public.flashcard_progress
SET ease_factor = $2,
    interval_days = $3,
    repetitions = $4,
    next_review_at = $5,
    last_reviewed_at = now(),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListDueFlashcardProgressByUser :many
SELECT p.*, f.topic_id, f.front, f.back, f.source
FROM public.flashcard_progress p
JOIN public.flashcards f ON f.id = p.flashcard_id
WHERE p.user_id = $1 AND p.next_review_at <= now()
ORDER BY p.next_review_at ASC
LIMIT $2;

-- name: ListDueFlashcardProgressByTopicIDs :many
SELECT p.*, f.topic_id, f.front, f.back, f.source
FROM public.flashcard_progress p
JOIN public.flashcards f ON f.id = p.flashcard_id
WHERE p.user_id = $1
  AND f.topic_id = ANY($2::uuid[])
  AND p.next_review_at <= now()
ORDER BY p.next_review_at ASC
LIMIT $3;

-- name: ListCardProgressByUserAndTopic :many
SELECT f.id AS flashcard_id, f.topic_id, f.source, f.front, f.back, f.created_at AS flashcard_created_at,
       p.id AS progress_id, p.ease_factor, p.interval_days, p.repetitions, p.next_review_at, p.last_reviewed_at
FROM public.flashcards f
LEFT JOIN public.flashcard_progress p ON p.flashcard_id = f.id AND p.user_id = $1
WHERE f.topic_id = $2
ORDER BY f.created_at DESC;
