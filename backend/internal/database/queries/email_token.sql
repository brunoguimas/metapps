-- name: CreateEmailToken :one
INSERT INTO public.email_tokens (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetLatestTokenByUserID :one
SELECT * FROM public.email_tokens
WHERE user_id = $1
    AND expires_at > now()
ORDER BY created_at DESC
LIMIT 1;

-- name: VerifyTokenByHash :one
UPDATE public.email_tokens
SET verified_at = now()
WHERE token_hash = $1
    AND expires_at > now()
    AND verified_at IS NULL
    RETURNING *;

-- name: EmailTokenCleanup :exec
DELETE FROM public.email_tokens
WHERE expires_at < now();
