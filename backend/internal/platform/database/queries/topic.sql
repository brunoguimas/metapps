-- name: CreateTopic :one
INSERT INTO public.topics (goal_id, parent_topic_id, title, description, required_mastery, weight, order_index)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetTopicByID :one
SELECT * FROM public.topics
WHERE id = $1;

-- name: GetTopicByGoalID :many
SELECT * FROM public.topics
WHERE goal_id = $1;

-- name: DeleteTopicsByGoalID :exec
DELETE FROM public.topics
WHERE goal_id = $1;
