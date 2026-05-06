-- Migration 002 — Auth & Audit
-- ============================================================
-- Adds password authentication, account types, refresh tokens, audit logs,
-- and brute-force protection. Idempotent — safe to re-run.
-- ============================================================

-- ── users: password + account type + activity columns ───────────────────────
alter table public.users
    add column if not exists password_hash    text,
    add column if not exists account_type     text not null default 'student',
    add column if not exists is_active        boolean not null default true,
    add column if not exists auth_provider    text not null default 'local';

-- Drop and re-add the check constraint so it covers the new columns
do $$
begin
    if exists (
        select 1 from pg_constraint where conname = 'users_account_type_check'
    ) then
        alter table public.users drop constraint users_account_type_check;
    end if;
    alter table public.users add constraint users_account_type_check
        check (account_type in ('student', 'teacher', 'admin'));

    if exists (
        select 1 from pg_constraint where conname = 'users_auth_provider_check'
    ) then
        alter table public.users drop constraint users_auth_provider_check;
    end if;
    alter table public.users add constraint users_auth_provider_check
        check (auth_provider in ('local', 'firebase', 'google'));
end $$;

create index if not exists users_account_type_idx on public.users(account_type);
create index if not exists users_email_lower_idx on public.users(lower(email));

-- ── refresh_tokens — hashed at rest, rotated on use ─────────────────────────
create table if not exists public.refresh_tokens (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references public.users(id) on delete cascade,
    token_hash    text not null unique,
    expires_at    timestamptz not null,
    revoked_at    timestamptz,
    replaced_by   uuid references public.refresh_tokens(id) on delete set null,
    user_agent    text,
    ip_address    text,
    created_at    timestamptz not null default now()
);

create index if not exists refresh_tokens_user_idx on public.refresh_tokens(user_id);
create index if not exists refresh_tokens_expires_idx on public.refresh_tokens(expires_at);

-- ── audit_logs — append-only record of security-relevant actions ────────────
create table if not exists public.audit_logs (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid references public.users(id) on delete set null,
    actor_email  text,
    action       text not null,
    entity_type  text,
    entity_id    text,
    metadata     jsonb,
    ip_address   text,
    user_agent   text,
    created_at   timestamptz not null default now()
);

create index if not exists audit_logs_user_idx    on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_action_idx  on public.audit_logs(action, created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

-- ── failed_login_attempts — brute-force protection bucket ───────────────────
create table if not exists public.failed_login_attempts (
    email             text primary key,
    attempts          integer not null default 0,
    locked_until      timestamptz,
    first_attempt_at  timestamptz not null default now(),
    last_attempt_at   timestamptz not null default now()
);

-- ── seed an admin row marker for the seed script to upsert into ─────────────
-- (the actual admin user is inserted by seed.ts with a bcrypt-hashed password)

-- ── enable RLS on the new tables for defence in depth ───────────────────────
alter table public.refresh_tokens         enable row level security;
alter table public.audit_logs             enable row level security;
alter table public.failed_login_attempts  enable row level security;

-- Backend uses a privileged connection (DATABASE_URL points at owner role),
-- so it bypasses RLS. These policies cover any direct anon access.
do $$
begin
    if not exists (
        select 1 from pg_policies
        where tablename = 'refresh_tokens' and policyname = 'refresh_tokens: own only'
    ) then
        create policy "refresh_tokens: own only" on public.refresh_tokens
            for select using (user_id = auth.uid());
    end if;
end $$;
