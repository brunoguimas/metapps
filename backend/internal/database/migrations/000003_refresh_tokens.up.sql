CREATE INDEX idx_refresh_token_expires_at
ON public.refresh_tokens(expires_at);
