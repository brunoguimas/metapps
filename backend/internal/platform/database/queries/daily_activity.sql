-- name: UpsertDailyActivity :one
INSERT INTO public.daily_activity (user_id, activity_date, xp, exercises, lessons, seconds)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id, activity_date) DO UPDATE SET
    xp = public.daily_activity.xp + EXCLUDED.xp,
    exercises = public.daily_activity.exercises + EXCLUDED.exercises,
    lessons = public.daily_activity.lessons + EXCLUDED.lessons,
    seconds = public.daily_activity.seconds + EXCLUDED.seconds,
    updated_at = now()
RETURNING *;

-- name: GetDailyActivity :one
SELECT * FROM public.daily_activity
WHERE user_id = $1
  AND activity_date = $2;

-- name: ListDailyActivityRange :many
SELECT * FROM public.daily_activity
WHERE user_id = $1
  AND activity_date >= $2
  AND activity_date <= $3
ORDER BY activity_date ASC;

-- name: ListDailyActivityRecent :many
SELECT * FROM public.daily_activity
WHERE user_id = $1
ORDER BY activity_date DESC
LIMIT $2;
