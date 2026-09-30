-- name: CreateClassroom :one
INSERT INTO public.classrooms (owner_id, name, description, invite_code)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetClassroomByID :one
SELECT * FROM public.classrooms WHERE id = $1;

-- name: ListClassroomsByOwner :many
SELECT * FROM public.classrooms WHERE owner_id = $1 ORDER BY created_at DESC;

-- name: UpdateClassroom :one
UPDATE public.classrooms
SET name = $2, description = $3, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateClassroomGoal :one
UPDATE public.classrooms
SET goal_id = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteClassroom :exec
DELETE FROM public.classrooms WHERE id = $1;

-- name: GetClassroomByInviteCode :one
SELECT * FROM public.classrooms WHERE invite_code = $1 AND status = 'active';

-- name: AddClassroomMembership :one
INSERT INTO public.classroom_memberships (classroom_id, user_id, role_in_class, status, joined_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetMembershipByClassroomAndUser :one
SELECT * FROM public.classroom_memberships WHERE classroom_id = $1 AND user_id = $2;

-- name: ListMembershipsByClassroom :many
SELECT m.*, u.username, u.email
FROM public.classroom_memberships m
JOIN public.users u ON u.id = m.user_id
WHERE m.classroom_id = $1
ORDER BY m.joined_at ASC;

-- name: ListClassroomsByMember :many
SELECT c.*
FROM public.classrooms c
JOIN public.classroom_memberships m ON m.classroom_id = c.id
WHERE m.user_id = $1 AND m.status = 'active'
ORDER BY c.created_at DESC;

-- name: UpdateMembershipStatus :one
UPDATE public.classroom_memberships
SET status = $2, updated_at = now()
WHERE id = $1
RETURNING *;
