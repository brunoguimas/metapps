CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id UUID PRIMARY KEY NOT NULL,
    user_id BIGINT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_user FOREIGN KEY(user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);
