-- name: CreateTopicDependency :one
INSERT INTO public.topic_dependencies (topic_id, depends_on_topic_id)
VALUES ($1, $2)
RETURNING *;

-- name: GetByTopicIDs :many
SELECT * FROM public.topic_dependencies
WHERE topic_id = ANY($1::uuid[]);