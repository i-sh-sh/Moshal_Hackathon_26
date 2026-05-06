-- TeamSprintUp — Full Schema
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- CHALLENGES
-- ============================================================
create table if not exists public.challenges (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  monday_board_id bigint unique,
  is_active       boolean not null default false,
  order_index     integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- TEAMS
-- ============================================================
create table if not exists public.teams (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  accumulated_score     integer not null default 0,
  sprint_status         text not null default 'idle'
                          check (sprint_status in ('idle','active','completed')),
  is_completed          boolean not null default false,
  current_challenge_id  uuid references public.challenges(id),
  current_sprint_id     uuid,  -- FK added below after sprints table
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- USERS
-- ============================================================
create table if not exists public.users (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text not null unique,
  current_team_id   uuid references public.teams(id),
  "current_role"    text check ("current_role" in ('pm','qa','dev','hardware')),
  total_active_time integer not null default 0,  -- seconds
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- SPRINTS
-- ============================================================
create table if not exists public.sprints (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.challenges(id) on delete cascade,
  title         text not null,
  description   text,
  order_index   integer not null default 0,
  created_at    timestamptz not null default now()
);

-- Wire deferred FK now that sprints exists
alter table public.teams
  add constraint teams_current_sprint_id_fk
  foreign key (current_sprint_id) references public.sprints(id);

-- ============================================================
-- TASKS
-- Status flow: pending → qa_review → pm_review → teacher_review → approved
--              any stage ← rejected (returns to previous stage)
-- ============================================================
create table if not exists public.tasks (
  id                    uuid primary key default gen_random_uuid(),
  sprint_id             uuid not null references public.sprints(id) on delete cascade,
  team_id               uuid not null references public.teams(id) on delete cascade,
  assigned_role         text not null check (assigned_role in ('pm','qa','dev','hardware')),
  title                 text not null,
  description           text,
  status                text not null default 'pending'
                          check (status in (
                            'pending','qa_review','pm_review',
                            'teacher_review','approved','rejected'
                          )),
  submission_url        text,
  submission_image_url  text,
  monday_item_id        bigint,
  qa_checklist          jsonb,    -- { isCompleted, hasErrors, improvements[] }
  qa_notes              text,
  pm_notes              text,
  submitted_by          uuid references public.users(id),
  reviewed_by_qa        uuid references public.users(id),
  reviewed_by_pm        uuid references public.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- HINT LOGS
-- ============================================================
create table if not exists public.hint_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  team_id          uuid not null references public.teams(id) on delete cascade,
  task_id          uuid references public.tasks(id) on delete set null,
  hint_number      integer not null,
  hint_text        text,
  points_deducted  integer not null default 0,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- TEAM HINT COUNTERS (resets naturally when user changes team)
-- ============================================================
create table if not exists public.team_hint_counters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  hint_count  integer not null default 0,
  unique(user_id, team_id)
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger teams_updated_at
  before update on public.teams
  for each row execute procedure public.set_updated_at();

create trigger users_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- SCORE RPC FUNCTIONS (atomic, floor at 0)
-- ============================================================
create or replace function public.add_team_score(p_team_id uuid, p_amount integer)
returns void language plpgsql as $$
begin
  update public.teams
  set accumulated_score = accumulated_score + p_amount
  where id = p_team_id;
end;
$$;

create or replace function public.deduct_team_score(p_team_id uuid, p_amount integer)
returns void language plpgsql as $$
begin
  update public.teams
  set accumulated_score = greatest(0, accumulated_score - p_amount)
  where id = p_team_id;
end;
$$;

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists tasks_team_id_idx      on public.tasks(team_id);
create index if not exists tasks_sprint_id_idx    on public.tasks(sprint_id);
create index if not exists tasks_status_idx       on public.tasks(status);
create index if not exists tasks_monday_item_idx  on public.tasks(monday_item_id);
create index if not exists hint_logs_user_idx     on public.hint_logs(user_id, team_id);
create index if not exists challenges_board_idx   on public.challenges(monday_board_id);

-- ============================================================
-- LEADERBOARD VIEWS
-- ============================================================

-- Group leaderboard — all teams ranked by score
create or replace view public.group_leaderboard as
select
  t.id,
  t.name,
  t.accumulated_score,
  t.sprint_status,
  t.is_completed,
  count(tk.id) filter (where tk.status = 'approved') as approved_task_count
from public.teams t
left join public.tasks tk on tk.team_id = t.id
group by t.id
order by t.accumulated_score desc;

-- Individual leaderboard — top performers (frontend limits to top 3)
create or replace view public.individual_leaderboard as
select
  u.id,
  u.name,
  u.current_team_id,
  u."current_role",
  count(t.id) filter (where t.status = 'approved') as approved_tasks,
  u.total_active_time,
  rank() over (
    order by count(t.id) filter (where t.status = 'approved') desc
  ) as rank
from public.users u
left join public.tasks t on t.submitted_by = u.id
group by u.id;

-- Teacher analytics — active time vs execution speed
create or replace view public.teacher_analytics as
select
  u.id,
  u.name,
  u.email,
  u.current_team_id,
  tm.name                                                as team_name,
  u."current_role",
  u.total_active_time,
  count(tk.id)                                           as total_tasks,
  count(tk.id) filter (where tk.status = 'approved')     as approved_tasks,
  round(
    count(tk.id) filter (where tk.status = 'approved')::numeric
    / nullif(u.total_active_time, 0) * 3600,
    2
  ) as tasks_per_hour
from public.users u
left join public.teams  tm on tm.id = u.current_team_id
left join public.tasks  tk on tk.submitted_by = u.id
group by u.id, tm.name;

-- ============================================================
-- ROW LEVEL SECURITY
-- Backend service-role key bypasses RLS for all writes.
-- These policies cover direct client / anon access.
-- ============================================================
alter table public.users              enable row level security;
alter table public.teams              enable row level security;
alter table public.challenges         enable row level security;
alter table public.sprints            enable row level security;
alter table public.tasks              enable row level security;
alter table public.hint_logs          enable row level security;
alter table public.team_hint_counters enable row level security;

-- Users: own row only
create policy "users: read own"   on public.users for select using (id = auth.uid());
create policy "users: update own" on public.users for update using (id = auth.uid());

-- Teams: a user can read the team they belong to
create policy "teams: read own" on public.teams
  for select using (
    id in (select current_team_id from public.users where id = auth.uid())
  );

-- Challenges + Sprints: public read
create policy "challenges: read all" on public.challenges for select using (true);
create policy "sprints: read all"    on public.sprints    for select using (true);

-- Tasks: team members only
create policy "tasks: read own team" on public.tasks
  for select using (
    team_id in (select current_team_id from public.users where id = auth.uid())
  );
create policy "tasks: update own team" on public.tasks
  for update using (
    team_id in (select current_team_id from public.users where id = auth.uid())
  );

-- Hint data: own only
create policy "hint_logs: own"     on public.hint_logs
  for select using (user_id = auth.uid());
create policy "hint_counters: own" on public.team_hint_counters
  for select using (user_id = auth.uid());
