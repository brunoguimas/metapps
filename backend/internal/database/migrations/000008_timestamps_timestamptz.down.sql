ALTER TABLE public.refresh_tokens
    ALTER COLUMN expires_at TYPE TIMESTAMP,
    ALTER COLUMN revoked_at TYPE TIMESTAMP,
    ALTER COLUMN created_at TYPE TIMESTAMP;

ALTER TABLE public.users
    ALTER COLUMN created_at TYPE TIMESTAMP;
