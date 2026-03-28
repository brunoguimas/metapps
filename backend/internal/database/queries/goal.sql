-- name: CreateOneGoal :one
INSERT INTO public.goals (user_id, title, difficulties)
VALUES ($1, $2, $3)
RETURNING *;

-- name: DeleteGoalByID :one
DELETE FROM public.goals
WHERE id = $1
    AND user_id = $2
RETURNING id;

-- name: UpdateGoalByID :one
UPDATE public.goals
SET title = $1,
    difficulties = $2
WHERE id = $3
    AND user_id = $4
RETURNING id;

-- name: GetGoalsByUserID :many
SELECT * FROM public.goals
WHERE user_id = $1;

-- name: GetGoalByID :one
SELECT * FROM public.goals
WHERE id = $1
    AND user_id = $2;

-- name: GetGoalByUserIDandTitle :one
SELECT * FROM public.goals
WHERE user_id = $1
    AND title = $2;
