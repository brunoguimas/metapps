ALTER TABLE public.profile
    DROP COLUMN IF EXISTS daily_goal_xp;

DROP TABLE IF EXISTS public.daily_activity;
DROP TABLE IF EXISTS public.review_items;
