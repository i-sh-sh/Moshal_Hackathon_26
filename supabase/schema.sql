-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Flexible bucket: role, display_name, monday_user_id, skill_level, etc.
  -- Nothing is enforced here on purpose — product requirements still fluid.
  metadata    jsonb not null default '{}'::jsonb
);

comment on column public.users.metadata is
  'Flexible JSONB bucket. Expected keys (non-exhaustive): display_name, role, monday_user_id, preferred_language, skill_level';

-- Keep updated_at current automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- ACTIVITIES
-- ============================================================
create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  action_type  text not null,          -- e.g. 'monday.item_created', 'ai.jargon_scored', 'lesson.completed'
  created_at   timestamptz not null default now(),

  -- Flexible bucket: any context the action carries.
  -- For monday webhooks: raw payload. For AI results: scores + suggestions.
  payload      jsonb not null default '{}'::jsonb
);

comment on column public.activities.action_type is
  'Dot-namespaced action slug, e.g. monday.item_created | ai.soft_skill_scored | lesson.completed';

comment on column public.activities.payload is
  'Arbitrary JSON relevant to the action. Schema evolves per action_type.';

create index activities_user_id_idx      on public.activities(user_id);
create index activities_action_type_idx  on public.activities(action_type);
create index activities_created_at_idx   on public.activities(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY (basic scaffolding — harden before prod)
-- ============================================================
alter table public.users      enable row level security;
alter table public.activities enable row level security;

-- Users can only read/write their own row
create policy "users: own row" on public.users
  using (id = auth.uid());

-- Users can only read/write their own activities
create policy "activities: own rows" on public.activities
  using (user_id = auth.uid());