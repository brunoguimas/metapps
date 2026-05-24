-- name: CreateTopic :one
INSERT INTO public.topics (goal_id, parent_topic_id, title, description, required_mastery, weight, order_index)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;
