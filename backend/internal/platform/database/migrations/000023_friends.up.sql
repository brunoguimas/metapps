-- Amizades "de um lado": a linha diz que user_id adicioneu friend_id.
-- A lista de amigos do usuário é tudo onde ele é user_id, então o mesmo
-- par em direções opostas são duas linhas distintas (e a UNIQUE impede
-- duplicar a mesma direção).
CREATE TABLE public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- ninguem é amigo de si mesmo
    CONSTRAINT friendships_no_self CHECK (user_id <> friend_id),
    CONSTRAINT friendships_unique UNIQUE (user_id, friend_id)
);

CREATE INDEX idx_friendships_user ON public.friendships(user_id);
CREATE INDEX idx_friendships_friend ON public.friendships(friend_id);