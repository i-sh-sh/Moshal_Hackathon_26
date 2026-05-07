-- Migration 004 — Pre/post-mission knowledge quizzes
-- ============================================================
-- A pool of multiple-choice questions, plus per-student quiz
-- attempts that capture pre-mission and post-mission knowledge.
-- The same questions are asked again in the post phase so we can
-- compute learning_gain = post_score − pre_score per student.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ── Pool of questions ──────────────────────────────────────────────────────
-- Generic-per-role questions: scope='role',     role=<role>,        challenge_id=null
-- Mission-specific questions: scope='mission',  role=null (or any), challenge_id=<challenge>
create table if not exists public.quiz_questions (
    id            uuid primary key default gen_random_uuid(),
    scope         text not null check (scope in ('role', 'mission')),
    role          text check (role in ('designer', 'editor', 'qa', 'printer')),
    challenge_id  uuid references public.challenges(id) on delete cascade,
    prompt        text not null,
    options       jsonb not null,                 -- ["A","B","C","D"]
    correct_index integer not null check (correct_index >= 0),
    created_at    timestamptz not null default now(),
    constraint quiz_questions_scope_consistency check (
        (scope = 'role'    and role is not null)
        or
        (scope = 'mission' and challenge_id is not null)
    )
);

create index if not exists idx_quiz_questions_role      on public.quiz_questions(role)         where scope = 'role';
create index if not exists idx_quiz_questions_challenge on public.quiz_questions(challenge_id) where scope = 'mission';

-- ── A student's attempt for a (mission, phase) pair ────────────────────────
create table if not exists public.quiz_attempts (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references public.users(id) on delete cascade,
    team_id             uuid references public.teams(id) on delete set null,
    challenge_id        uuid not null references public.challenges(id) on delete cascade,
    phase               text not null check (phase in ('pre', 'post')),
    started_at          timestamptz not null default now(),
    submitted_at        timestamptz,
    score               integer,                      -- null until submitted
    total               integer not null,
    paired_attempt_id   uuid references public.quiz_attempts(id) on delete set null,
                                                      -- post.paired_attempt_id → pre attempt id
    learning_gain       integer,                      -- post.score − pre.score, set on post submit
    constraint quiz_attempts_unique_phase unique (user_id, challenge_id, phase)
);

create index if not exists idx_quiz_attempts_user      on public.quiz_attempts(user_id);
create index if not exists idx_quiz_attempts_challenge on public.quiz_attempts(challenge_id);

-- ── The frozen set of questions for an attempt ─────────────────────────────
-- Pre-attempt samples 5-7 random questions and inserts rows here.
-- Post-attempt copies the same question_ids in the same order_index.
create table if not exists public.quiz_attempt_questions (
    id              uuid primary key default gen_random_uuid(),
    attempt_id      uuid not null references public.quiz_attempts(id) on delete cascade,
    question_id     uuid not null references public.quiz_questions(id) on delete restrict,
    order_index     integer not null,
    selected_index  integer,                          -- null until answered
    is_correct      boolean,
    answered_at     timestamptz,
    constraint quiz_attempt_questions_unique unique (attempt_id, order_index)
);

create index if not exists idx_qaq_attempt on public.quiz_attempt_questions(attempt_id);
