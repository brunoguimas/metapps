-- name: CreateAssignment :one
INSERT INTO public.classroom_assignments (classroom_id, title, description, goal_id, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetAssignmentByID :one
SELECT * FROM public.classroom_assignments WHERE id = $1;

-- name: ListAssignmentsByClassroom :many
SELECT * FROM public.classroom_assignments
WHERE classroom_id = $1 AND status = 'active'
ORDER BY created_at DESC;

-- name: UpdateAssignment :one
UPDATE public.classroom_assignments
SET title = $2, description = $3, goal_id = $4, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteAssignment :exec
DELETE FROM public.classroom_assignments WHERE id = $1;
