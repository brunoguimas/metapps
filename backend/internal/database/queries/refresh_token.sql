-- name: CreateRefreshToken :exec
INSERT INTO public.refresh_tokens (id, user_id, expires_at)
VALUES ($1, $2, $3);

-- name: GetRefreshTokenById :one
SELECT * FROM public.refresh_tokens
WHERE id = $1
    AND expires_at > now()
    AND revoked = false;

-- name: RevokeRefreshTokenById :exec
UPDATE public.refresh_tokens
SET revoked = true,
    revoked_at = now()
WHERE id = $1;

-- name: RefreshTokenCleanup :exec
DELETE FROM public.refresh_tokens
WHERE expires_at < now() OR revoked = true;
