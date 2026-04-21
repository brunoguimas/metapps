-- name: CreateTask :one 
INSERT INTO public.tasks (user_id, goal_id, content, type)
VALUES ($1, $2, $3, $4) RETURNING *;

-- name: GetTasksByUserID :many
SELECT * FROM public.tasks
WHERE user_id = $1;

-- name: GetTaskByID :one
SELECT * FROM public.tasks 
WHERE id = $1
    AND user_id = $2;

-- name: MarkTaskDone :one
UPDATE public.tasks
SET done = true,
    done_at = now()
WHERE id = $1
    AND user_id = $2
RETURNING *;
