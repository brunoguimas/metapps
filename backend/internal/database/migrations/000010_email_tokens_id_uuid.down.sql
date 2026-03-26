ALTER TABLE public.email_tokens DROP CONSTRAINT IF EXISTS email_tokens_pkey;

ALTER TABLE public.email_tokens
    ADD COLUMN id_bigint BIGINT GENERATED ALWAYS AS IDENTITY;

UPDATE public.email_tokens
SET id_bigint = DEFAULT;

ALTER TABLE public.email_tokens DROP COLUMN id;
ALTER TABLE public.email_tokens RENAME COLUMN id_bigint TO id;
ALTER TABLE public.email_tokens ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.email_tokens ADD PRIMARY KEY (id);
