-- name: CreateTopicDependency :one
INSERT INTO public.topic_dependencies (topic_id, depends_on_topic_id)
VALUES ($1, $2)
RETURNING *;
