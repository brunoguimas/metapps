-- name: CreateTaskCorrection :one
INSERT INTO task_corrections (attempt_id, feedback, score, status)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetTaskCorrectionByID :one
SELECT *
FROM task_corrections
WHERE id = $1;

-- name: GetTaskCorrectionByAttemptID :one
SELECT *
FROM task_corrections
WHERE attempt_id = $1;

-- name: UpdateTaskCorrection :one
UPDATE task_corrections
SET feedback = $2,
    score = $3,
    status = $4,
    updated_at = now()
WHERE id = $1
RETURNING *;
