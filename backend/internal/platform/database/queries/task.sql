-- name: CreateTask :one
INSERT INTO public.tasks (user_id, topic_id, content, type, source, version, status)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetTasksByUserID :many
SELECT * FROM public.tasks
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: GetTaskByID :one
SELECT * FROM public.tasks
WHERE id = $1
    AND user_id = $2;

-- name: MarkTaskDone :one
UPDATE public.tasks
SET done = true,
    done_at = now(),
    status = 'completed',
    updated_at = now()
WHERE id = $1
    AND user_id = $2
RETURNING *;

-- name: GetTaskByUserAndTopicAndStatus :one
SELECT * FROM public.tasks
WHERE user_id = $1
  AND topic_id = $2
  AND status = $3
ORDER BY created_at DESC
LIMIT 1;

-- name: ListTasksByUserAndTopic :many
SELECT * FROM public.tasks
WHERE user_id = $1
  AND topic_id = $2
ORDER BY created_at DESC;

-- name: ListTasksByUserAndSource :many
SELECT * FROM public.tasks
WHERE user_id = $1
  AND source = $2
ORDER BY created_at DESC;

-- name: UpdateTaskSession :one
UPDATE public.tasks
SET status = $2,
    step_cursor = $3,
    max_combo = $4,
    score = $5,
    last_step_at = now(),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateTaskDone :one
UPDATE public.tasks
SET done = $2,
    done_at = CASE WHEN $2 THEN now() ELSE done_at END,
    status = $3,
    score = $4,
    xp_gained = $5,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListTaskStatementsByTopic :many
-- Enunciados ja usados nas tasks do topico, para a IA nao repetir conteudo.
SELECT (s.item ->> 'statement')::text AS statement
FROM public.tasks t
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(t.content -> 'content' -> 'steps') = 'array'
            THEN t.content -> 'content' -> 'steps'
        WHEN jsonb_typeof(t.content -> 'steps') = 'array'
            THEN t.content -> 'steps'
        WHEN jsonb_typeof(t.content -> 'questions') = 'array'
            THEN t.content -> 'questions'
        ELSE '[]'::jsonb
    END
) AS s(item)
WHERE t.user_id = $1
  AND t.topic_id = $2
  AND s.item ->> 'statement' IS NOT NULL
LIMIT 60;
