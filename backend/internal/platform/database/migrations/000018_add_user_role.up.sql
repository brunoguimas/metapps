ALTER TABLE public.users
    ADD COLUMN role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'teacher', 'admin'));

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
