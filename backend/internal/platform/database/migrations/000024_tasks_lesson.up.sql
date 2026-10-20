-- Evolui a "task" para o modelo de LESSON: uma sequencia de passos
-- curtos (exercicios), respondidos um a um, com feedback instantaneo.
--
-- O conteudo continua no JSONB da coluna `content`, mas passa a ter o
-- formato v2:
--
--   { "meta": {...}, "content": { "version": 2, "steps": [ ... ] } }
--
-- As colunas novas sao o estado de execucao da lesson. `done`/`done_at`
-- sao mantidos (e sincronizados com `status`) para nao quebrar o que ja
-- existe em producao.

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS version     int  NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS source      text NOT NULL DEFAULT 'lesson',
    ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS step_cursor int  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_combo   int  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS score       numeric,
    ADD COLUMN IF NOT EXISTS xp_gained   int  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_step_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

-- As tabelas antigas foram criadas com o type 'essay' que foi removido na
-- 000016, mas o CHECK original continua valendo 'quiz' ou 'question'.
-- 'lesson', 'practice' e 'review' sao os tipos de sessao suportados.
ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS tasks_type_check;

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_type_check
    CHECK (type IN ('quiz', 'question', 'lesson', 'practice', 'review'));

ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS tasks_source_check;

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_source_check
    CHECK (source IN ('lesson', 'practice', 'review'));

ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed'));

-- Busca da lesson em andamento de um topico: permite retomar sem chamar
-- a IA de novo (o clique em "Comecar" vira instantaneo).
CREATE INDEX IF NOT EXISTS idx_tasks_user_status
    ON public.tasks (user_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_user_topic
    ON public.tasks (user_id, topic_id);

-- Enunciados ja usados no mesmo topico, para a IA nao repetir conteudo.
CREATE INDEX IF NOT EXISTS idx_tasks_content_gin
    ON public.tasks USING gin (content jsonb_path_ops);
