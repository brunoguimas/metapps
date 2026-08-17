ALTER TABLE public.topic_progress ADD COLUMN evolution_stage VARCHAR(50) NOT NULL DEFAULT 'Ovo';

-- Update existing rows to set appropriate evolution stage based on mastery_score
UPDATE public.topic_progress
SET evolution_stage = CASE
    WHEN mastery_score < 0.2 THEN 'Ovo'
    WHEN mastery_score < 0.4 THEN 'Larva'
    WHEN mastery_score < 0.6 THEN 'Pupa'
    WHEN mastery_score < 0.8 THEN 'Juvenil'
    ELSE 'Adulto'
END;