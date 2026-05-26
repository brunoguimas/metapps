DROP INDEX IF EXISTS public.idx_topic_progress_topic_id;
DROP INDEX IF EXISTS public.idx_topic_progress_user_id;

DROP TABLE IF EXISTS public.topic_progress;

DROP INDEX IF EXISTS public.idx_topics_parent_topic_id;
DROP INDEX IF EXISTS public.idx_topics_goal_id;

DROP TYPE IF EXISTS topic_status;

DROP TABLE IF EXISTS public.topics CASCADE;
