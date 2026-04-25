-- name: UpsertEmailCode :one
INSERT INTO public.email_codes (
    user_id,
    type,
    code_hash,
    attempts,
    max_attempts,
    expires_at
)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id, type) DO UPDATE
SET code_hash = EXCLUDED.code_hash,
    attempts = EXCLUDED.attempts,
    max_attempts = EXCLUDED.max_attempts,
    expires_at = EXCLUDED.expires_at,
    created_at = now()
RETURNING *;

-- name: GetEmailCodeByUserIDAndType :one
SELECT * FROM public.email_codes
WHERE user_id = $1 AND type = $2;

-- name: DeleteEmailCodeByUserIDAndType :exec
DELETE FROM public.email_codes
WHERE user_id = $1 AND type = $2;

-- name: CleanExpiredCodes :exec
DELETE FROM public.email_codes
WHERE expires_at < now();
