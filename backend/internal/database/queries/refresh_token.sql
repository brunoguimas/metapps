-- name: CreateRefreshToken :exec
INSERT INTO refresh_tokens (id, user_id, expires_at)
VALUES ($1, $2, $3);

-- name: GetRefreshTokenById :one
SELECT * FROM refresh_tokens
WHERE id = $1
    AND expires_at > NOW()
    AND revoked = false;

-- name: RevokeRefreshTokenById :exec
UPDATE refresh_tokens
SET revoked = true,
    revoked_at = NOW()
WHERE id = $1;

-- name: RefreshTokenCleanup :exec
DELETE FROM refresh_tokens
WHERE expires_at < NOW() OR revoked = true;
