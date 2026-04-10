-- name: CreateOAuthAccount :one
INSERT INTO public.oauth_accounts (user_id, provider, provider_user_id)
VALUES ($1, $2, $3)
RETURNING id, user_id, provider, provider_user_id, created_at;

-- name: GetOAuthAccountByProviderID :one
SELECT id, user_id, provider, provider_user_id, created_at FROM public.oauth_accounts
WHERE provider = $1
    AND provider_user_id = $2;
