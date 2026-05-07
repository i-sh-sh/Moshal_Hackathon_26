-- Migration 003 — 3D-print roles + teacher role assignment workflow
-- ============================================================
-- Pivots the role taxonomy from pm/qa/dev/hardware to the four
-- 3D-printing roles: designer / editor / qa / printer.
--
-- Notes on quoting:
--   `current_role` is a PostgreSQL reserved keyword (SQL function).
--   Without quotes Postgres parses it as the function call instead of
--   the column reference, leaving the CHECK constraint silently broken.
--   Always quote: "current_role".
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ── 1. Re-map existing data so old check values become new ones ─────────────
update public.users
set "current_role" = case "current_role"
    when 'dev'      then 'designer'
    when 'pm'       then 'editor'
    when 'hardware' then 'printer'
    else "current_role"
end
where "current_role" in ('pm', 'dev', 'hardware');

update public.tasks
set assigned_role = case assigned_role
    when 'dev'      then 'designer'
    when 'pm'       then 'editor'
    when 'hardware' then 'printer'
    else assigned_role
end
where assigned_role in ('pm', 'dev', 'hardware');

-- ── 2. Swap CHECK constraints to the new 4-role set ────────────────────────
do $$
begin
    if exists (
        select 1 from pg_constraint where conname = 'users_current_role_check'
    ) then
        alter table public.users drop constraint users_current_role_check;
    end if;
    alter table public.users add constraint users_current_role_check
        check ("current_role" in ('designer', 'editor', 'qa', 'printer'));

    if exists (
        select 1 from pg_constraint where conname = 'tasks_assigned_role_check'
    ) then
        alter table public.tasks drop constraint tasks_assigned_role_check;
    end if;
    alter table public.tasks add constraint tasks_assigned_role_check
        check (assigned_role in ('designer', 'editor', 'qa', 'printer'));
end $$;

-- ── 3. student_role_history — per-mission role audit log ────────────────────
create table if not exists public.student_role_history (
    id                 uuid primary key default gen_random_uuid(),
    user_id            uuid not null references public.users(id) on delete cascade,
    team_id            uuid not null references public.teams(id) on delete cascade,
    challenge_id       uuid references public.challenges(id) on delete set null,
    "role"             text not null check ("role" in ('designer', 'editor', 'qa', 'printer')),
    assignment_source  text not null check (assignment_source in ('manual', 'automatic')),
    assigned_by        text,
    created_at         timestamptz not null default now()
);

create index if not exists idx_role_history_user on public.student_role_history(user_id);
create index if not exists idx_role_history_team on public.student_role_history(team_id);
