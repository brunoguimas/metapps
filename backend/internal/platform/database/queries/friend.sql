-- name: CreateFriendship :one
INSERT INTO public.friendships (user_id, friend_id)
VALUES ($1, $2)
RETURNING *;

-- name: GetFriendship :one
SELECT * FROM public.friendships
WHERE user_id = $1 AND friend_id = $2;

-- name: DeleteFriendship :exec
DELETE FROM public.friendships
WHERE user_id = $1 AND friend_id = $2;

-- name: CountFriendshipsByUser :one
SELECT count(*) FROM public.friendships
WHERE user_id = $1;

-- Lista os amigos com o perfil público de cada um (avatar, nível, streak).
-- Deliberadamente NÃO entra nenhum goal/roadmap/topic: a tela de social
-- mostra o que o amigo "tem" (nível, streak, conquistas), nunca as
-- trilhas dele.
-- name: ListFriendshipsWithProfile :many
SELECT
    f.id,
    f.created_at,
    u.id AS friend_id,
    u.username,
    u.created_at AS friend_since,
    COALESCE(p.avatar_url, '') AS avatar_url,
    COALESCE(p.xp, 0) AS xp,
    COALESCE(p.streak, 0) AS streak,
    p.last_activity_date
FROM public.friendships f
JOIN public.users u ON u.id = f.friend_id
LEFT JOIN public.profile p ON p.user_id = u.id
WHERE f.user_id = $1
ORDER BY f.created_at DESC;

-- Busca usuário por e-mail ou username (case-insensitive) para o fluxo de
-- adicionar amigo. username não é UNIQUE no schema, então devolvemos até
-- alguns candidatos e o service escolhe o mais antigo em caso de empate.
-- name: SearchUsersByEmailOrUsername :many
SELECT * FROM public.users
WHERE lower(email) = lower($1)
   OR lower(username) = lower($2)
ORDER BY created_at ASC
LIMIT 5;

-- Sugestões enquanto o usuário digita o e-mail/nome do amigo.
-- name: SearchUsersForFriends :many
SELECT
    u.id,
    u.username,
    COALESCE(p.avatar_url, '') AS avatar_url,
    COALESCE(p.xp, 0) AS xp,
    COALESCE(p.streak, 0) AS streak,
    EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.user_id = $1 AND f.friend_id = u.id
    ) AS is_friend
FROM public.users u
LEFT JOIN public.profile p ON p.user_id = u.id
WHERE u.id <> $1
  AND (lower(u.username) LIKE lower('%' || $2 || '%')
       OR lower(u.email) LIKE lower('%' || $2 || '%'))
ORDER BY is_friend DESC, u.username ASC
LIMIT 8;