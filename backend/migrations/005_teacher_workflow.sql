-- Migration 005 — Teacher role-assignment workflow
-- ============================================================
-- Adds the audit log used by the teacher's manual + auto-assign role flow.
-- Does NOT modify users.current_role or tasks.assigned_role — DB stays
-- at the original pm/qa/dev/hardware values. The display label ("Designer",
-- "Editor", "QA", "Printer") is mapped at the UI layer via ROLE_LABELS.
--
-- "role" is quoted because it's a Postgres reserved word.
-- Idempotent — safe to re-run.
-- ============================================================

create table if not exists public.student_role_history (
    id                 uuid primary key default gen_random_uuid(),
    user_id            uuid not null references public.users(id) on delete cascade,
    team_id            uuid not null references public.teams(id) on delete cascade,
    challenge_id       uuid references public.challenges(id) on delete set null,
    "role"             text not null check ("role" in ('pm','qa','dev','hardware')),
    assignment_source  text not null check (assignment_source in ('manual','automatic')),
    assigned_by        text,
    created_at         timestamptz not null default now()
);

create index if not exists idx_role_history_user on public.student_role_history(user_id);
create index if not exists idx_role_history_team on public.student_role_history(team_id);
