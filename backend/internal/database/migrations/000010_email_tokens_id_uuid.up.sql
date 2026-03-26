CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.email_tokens
    ADD COLUMN id_uuid UUID DEFAULT uuid_generate_v4();

UPDATE public.email_tokens
SET id_uuid = uuid_generate_v4()
WHERE id_uuid IS NULL;

ALTER TABLE public.email_tokens DROP CONSTRAINT IF EXISTS email_tokens_pkey;

ALTER TABLE public.email_tokens DROP COLUMN id;
ALTER TABLE public.email_tokens RENAME COLUMN id_uuid TO id;
ALTER TABLE public.email_tokens ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.email_tokens ADD PRIMARY KEY (id);
