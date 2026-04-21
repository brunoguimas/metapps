-- name: CreateTaskAttempt :one
INSERT INTO task_attempts (user_id, task_id, content, score, status, task_evaluation)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetTaskAttemptByID :one
SELECT *
FROM task_attempts
WHERE id = $1;

-- name: ListTaskAttemptsByUser :many
SELECT *
FROM task_attempts
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: ListTaskAttemptsByUserAndTask :many
SELECT *
FROM task_attempts
WHERE user_id = $1
  AND task_id = $2
ORDER BY created_at DESC;

-- name: GetLastTaskAttempt :one
SELECT *
FROM task_attempts
WHERE user_id = $1
  AND task_id = $2
ORDER BY created_at DESC
LIMIT 1;
