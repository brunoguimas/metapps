-- name: GetProfileByUserID :one
SELECT id, user_id, xp, streak, last_activity_date, avatar_url, created_at, updated_at FROM profile WHERE user_id = $1;

-- name: CreateProfile :one
INSERT INTO profile (id, user_id, xp, streak, last_activity_date, avatar_url, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, user_id, xp, streak, last_activity_date, avatar_url, created_at, updated_at;

-- name: UpdateProfile :one
UPDATE profile SET xp = $2, streak = $3, last_activity_date = $4, avatar_url = $5, updated_at = $6 WHERE id = $1
RETURNING id, user_id, xp, streak, last_activity_date, avatar_url, created_at, updated_at;