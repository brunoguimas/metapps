-- name: CreateOneUser :one
INSERT INTO public.users (username, email, password_hash, verified)
VALUES ($1, $2, $3, $4)
RETURNING id, username, email, password_hash, verified, created_at;

-- name: GetUserByID :one
SELECT *
FROM public.users
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT *
FROM public.users
WHERE email = $1;

-- name: DeleteUserByEmail :one
DELETE FROM public.users
WHERE email = $1
RETURNING id;

-- name: VerifyUserByID :exec
UPDATE public.users
SET verified = true
WHERE id = $1;

-- name: UpdateUserPasswordByID :exec
UPDATE public.users
SET password_hash = $2
WHERE id = $1;
