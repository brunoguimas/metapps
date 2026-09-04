CREATE TABLE public.classrooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    invite_code TEXT NOT NULL UNIQUE,
    goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_classrooms_owner ON public.classrooms(owner_id);
CREATE INDEX idx_classrooms_invite_code ON public.classrooms(invite_code);

CREATE TABLE public.classroom_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_in_class TEXT NOT NULL DEFAULT 'student' CHECK (role_in_class IN ('student', 'teacher', 'assistant')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'left')),
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(classroom_id, user_id)
);

CREATE INDEX idx_classroom_memberships_classroom ON public.classroom_memberships(classroom_id);
CREATE INDEX idx_classroom_memberships_user ON public.classroom_memberships(user_id);
