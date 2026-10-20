-- name: GetProfileByUserID :one
SELECT * FROM profile WHERE user_id = $1;

-- name: CreateProfile :one
INSERT INTO profile (id, user_id, xp, streak, last_activity_date, avatar_url, daily_goal_xp, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: UpdateProfile :one
UPDATE profile SET xp = $2, streak = $3, last_activity_date = $4, avatar_url = $5, daily_goal_xp = $6, updated_at = $7 WHERE id = $1
RETURNING *;

-- name: AddProfileXP :one
UPDATE profile SET xp = GREATEST(0, xp + $2), updated_at = now() WHERE id = $1
RETURNING *;

-- name: UpdateProfileStreak :one
UPDATE profile SET streak = $2, last_activity_date = $3, updated_at = now() WHERE id = $1
RETURNING *;

-- name: UpdateProfileDailyGoal :one
UPDATE profile SET daily_goal_xp = $2, updated_at = now() WHERE id = $1
RETURNING *;
