-- name: GetTopicProgressByUserIDAndTopicID :one
SELECT id, user_id, topic_id, mastery_score, confidence_score, attempts_count, status, evolution_stage, created_at, updated_at
FROM public.topic_progress
WHERE user_id = $1 AND topic_id = $2;

-- name: CreateTopicProgress :one
INSERT INTO public.topic_progress (user_id, topic_id, mastery_score, confidence_score, attempts_count, status, evolution_stage)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, user_id, topic_id, mastery_score, confidence_score, attempts_count, status, evolution_stage, created_at, updated_at;

-- name: UpdateTopicProgress :one
UPDATE public.topic_progress
SET mastery_score = $2, confidence_score = $3, attempts_count = $4, status = $5, evolution_stage = $6, updated_at = now()
WHERE id = $1
RETURNING id, user_id, topic_id, mastery_score, confidence_score, attempts_count, status, evolution_stage, created_at, updated_at;