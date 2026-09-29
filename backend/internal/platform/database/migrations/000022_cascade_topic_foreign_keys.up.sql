-- Corrige o erro 500 ao excluir uma trilha.
--
-- O topics sao removidos em cascata junto com o goal (goal_id -> ON DELETE
-- CASCADE), mas a FK de tasks ainda referenciava topics SEM cascata:
--
--   tasks.topic_id -> topics(id)   (criada na migration 000012, sem cascata)
--
-- Com isso, o DELETE /protected/goals/:id removia o goal, o Postgres tentava
-- apagar os topics e batia em violacao de foreign key: HTTP 500. Pior: a
-- exclusao inteira era desfeita (a query roda em uma unica transacao
-- implicita), entao a trilha continuava na tela mesmo apos o 500.
--
-- A FK irma (topic_dependencies.depends_on_topic_id) foi criada sem cascata
-- na 000010, mas ja aparece com ON DELETE CASCADE no banco de producao --
-- provavelmente corrigida em migrations posteriores (18+) que nao estao
-- neste repositorio. Reaplicamos as duas de forma idempotente para que a
-- migration tambem conserte um banco novo, montado apenas com os arquivos
-- daqui.
--
-- Numerada como 000022 porque o banco de producao ja esta na versao 21.

ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS tasks_topic_id_fkey;

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_topic_id_fkey
    FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;

ALTER TABLE public.topic_dependencies
    DROP CONSTRAINT IF EXISTS topic_dependencies_depends_on_topic_id_fkey;

ALTER TABLE public.topic_dependencies
    ADD CONSTRAINT topic_dependencies_depends_on_topic_id_fkey
    FOREIGN KEY (depends_on_topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;
