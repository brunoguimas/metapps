-- name: UpsertReviewItem :one
INSERT INTO public.review_items (user_id, task_id, step_index, question_hash, ease, interval_days, lapses, due_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (user_id, question_hash) DO UPDATE SET
    ease = EXCLUDED.ease,
    interval_days = EXCLUDED.interval_days,
    lapses = EXCLUDED.lapses,
    due_at = EXCLUDED.due_at,
    updated_at = now()
RETURNING *;

-- name: GetReviewItemByHash :one
SELECT * FROM public.review_items
WHERE user_id = $1
  AND question_hash = $2;

-- name: ListDueReviewItems :many
SELECT * FROM public.review_items
WHERE user_id = $1
  AND due_at <= now()
ORDER BY due_at ASC
LIMIT $2;

-- name: CountDueReviewItems :one
SELECT count(*) FROM public.review_items
WHERE user_id = $1
  AND due_at <= now();

-- name: ListReviewItemsByUser :many
SELECT * FROM public.review_items
WHERE user_id = $1
ORDER BY due_at ASC
LIMIT $2;

-- name: DeleteReviewItem :exec
DELETE FROM public.review_items
WHERE id = $1 AND user_id = $2;
