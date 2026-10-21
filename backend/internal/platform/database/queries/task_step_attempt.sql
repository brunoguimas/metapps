-- name: CreateTaskStepAttempt :one
INSERT INTO public.task_step_attempts (user_id, task_id, step_index, answer, correct, xp_awarded)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetTaskStepAttempt :one
SELECT * FROM public.task_step_attempts
WHERE task_id = $1
  AND step_index = $2;

-- name: ListTaskStepAttemptsByTask :many
SELECT * FROM public.task_step_attempts
WHERE task_id = $1
ORDER BY step_index ASC;

-- name: ListTaskStepAttemptsByUser :many
SELECT * FROM public.task_step_attempts
WHERE user_id = $1
ORDER BY answered_at DESC
LIMIT $2;

-- name: ListIncorrectTaskStepAttemptsByUser :many
-- Passos errados pelo usuario: materia-prima das sessoes de Treino.
SELECT sa.* FROM public.task_step_attempts sa
JOIN public.tasks t ON t.id = sa.task_id
WHERE sa.user_id = $1
  AND sa.correct = false
ORDER BY sa.answered_at DESC
LIMIT $2;

-- name: CountTaskStepAttemptsByUser :one
SELECT count(*) FROM public.task_step_attempts
WHERE user_id = $1;
