DROP INDEX IF EXISTS idx_refresh_tokens_user_id;
DROP INDEX IF EXISTS idx_refresh_tokens_revoked;

DROP TABLE IF EXISTS public.refresh_tokens CASCADE;
