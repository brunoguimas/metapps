-- name: CreateOneUser :one
INSERT INTO users (username, email, password_hash)
VALUES ($1, $2, $3)
RETURNING id, username, email, password_hash, created_at;

-- name: GetUserByEmail :one
SELECT id, username, email, password_hash, created_at
FROM users
WHERE email = $1;

-- name: DeleteUserByEmail :one
DELETE FROM users
WHERE email = $1
RETURNING id;
