-- Registro de resposta de cada passo (step) de uma lesson.
--
-- Serve para tres coisas:
--   1. Idempotencia: a UNIQUE (task_id, step_index) garante que um passo
--      so vale uma resposta, entao repetir o POST nao duplica XP.
--   2. Feed do modo Treino: os passos errados sao a materia-prima das
--      sessoes de pratica.
--   3. Estatisticas por exercicio (precisao, tempo, reincidencia).

CREATE TABLE IF NOT EXISTS public.task_step_attempts (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id     uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    step_index  int  NOT NULL,
    answer      jsonb NOT NULL,
    correct     boolean NOT NULL,
    xp_awarded  int  NOT NULL DEFAULT 0,
    answered_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT task_step_attempts_unique_step UNIQUE (task_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_task_step_attempts_user
    ON public.task_step_attempts (user_id, answered_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_step_attempts_task
    ON public.task_step_attempts (task_id);
