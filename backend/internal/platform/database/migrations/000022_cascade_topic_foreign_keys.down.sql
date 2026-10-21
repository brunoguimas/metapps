-- Reverte as constraints para o estado anterior (sem ON DELETE CASCADE).
--
-- Atencao: se ja existirem tasks ou topic_dependencies apontando para topics
-- que serao removidos, a recriacao da constraint original vai falhar -- que e
-- justamente o comportamento que a migration 000022 corrige.

ALTER TABLE public.topic_dependencies
    DROP CONSTRAINT IF EXISTS topic_dependencies_depends_on_topic_id_fkey;

ALTER TABLE public.topic_dependencies
    ADD CONSTRAINT topic_dependencies_depends_on_topic_id_fkey
    FOREIGN KEY (depends_on_topic_id) REFERENCES public.topics(id);

ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS tasks_topic_id_fkey;

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_topic_id_fkey
    FOREIGN KEY (topic_id) REFERENCES public.topics(id);
