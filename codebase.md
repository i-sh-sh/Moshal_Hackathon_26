# TeamSprintUp — Codebase

Hi-tech workplace simulation for students with AI mentoring, task pipeline, and teacher analytics

---

## backend/migrations/002_auth_audit.sql
**Type:** migration

```sql
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

```

---

## backend/migrations/003_dude_chat.sql
**Type:** migration

```sql
-- 003_dude_chat.sql
-- DUDE system: group chat channels, AI bot, student learning profiles.

-- ── Chat channels (one per team) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_channels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(team_id)
);

-- ── Chat messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id   UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    sender_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_name  TEXT NOT NULL,
    is_bot       BOOLEAN NOT NULL DEFAULT false,
    content      TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Channel participants ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_participants (
    channel_id  UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member',   -- member | teacher | bot
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (channel_id, user_id)
);

-- ── Analysis log (one entry per automated analysis run) ──────────────────────
CREATE TABLE IF NOT EXISTS channel_analysis_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id     UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    analyzed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    message_count  INT NOT NULL DEFAULT 0,
    summary        TEXT
);

-- ── Per-student learning profiles ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_profiles (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jargon_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
    soft_skill_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
    detected_terms     TEXT[] NOT NULL DEFAULT '{}',
    messages_analyzed  INT NOT NULL DEFAULT 0,
    last_analyzed_at   TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- ── Profile snapshots (historical progress tracking) ─────────────────────────
CREATE TABLE IF NOT EXISTS profile_snapshots (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jargon_score      NUMERIC(5,2) NOT NULL,
    soft_skill_score  NUMERIC(5,2) NOT NULL,
    detected_terms    TEXT[] NOT NULL DEFAULT '{}',
    snapshot_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Teacher alerts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    channel_id  UUID REFERENCES chat_channels(id) ON DELETE SET NULL,
    alert_type  TEXT NOT NULL,   -- 'knowledge_gap' | 'low_engagement' | 'stuck'
    message     TEXT NOT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Jargon events (per-message term detection) ────────────────────────────────
CREATE TABLE IF NOT EXISTS jargon_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id   UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    message_id   UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    term         TEXT NOT NULL,
    context      TEXT,
    detected_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel    ON chat_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_channel_participants_user ON channel_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_alerts_unread    ON teacher_alerts(is_read, created_at) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_profile_snapshots_user   ON profile_snapshots(user_id, snapshot_at);
CREATE INDEX IF NOT EXISTS idx_jargon_events_user       ON jargon_events(user_id, detected_at);

```

---

## backend/migrations/005_teacher_workflow.sql
**Type:** migration

```sql
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

```

---

## backend/migrations/006_quizzes.sql
**Type:** migration

```sql
-- Migration 006 — Pre/post-mission knowledge quizzes
-- ============================================================
-- A pool of multiple-choice questions plus per-student attempts that
-- capture pre-mission and post-mission knowledge. The same questions are
-- asked again in the post phase so we can compute
--   learning_gain = post_score − pre_score per student.
--
-- Role values match the existing users.current_role taxonomy
-- (pm/qa/dev/hardware) — the new "Designer/Editor/QA/Printer" labels are
-- a UI-layer mapping only.
--
-- "role" is quoted because it's a Postgres reserved word.
-- Idempotent — safe to re-run.
-- ============================================================

-- ── Pool of questions ──────────────────────────────────────────────────────
-- Generic-per-role: scope='role',     "role"=<role>,     challenge_id=null
-- Mission-specific: scope='mission',  "role"=null,        challenge_id=<challenge>
create table if not exists public.quiz_questions (
    id            uuid primary key default gen_random_uuid(),
    scope         text not null check (scope in ('role', 'mission')),
    "role"        text check ("role" in ('pm', 'qa', 'dev', 'hardware')),
    challenge_id  uuid references public.challenges(id) on delete cascade,
    prompt        text not null,
    options       jsonb not null,
    correct_index integer not null check (correct_index >= 0),
    created_at    timestamptz not null default now(),
    constraint quiz_questions_scope_consistency check (
        (scope = 'role'    and "role" is not null)
        or
        (scope = 'mission' and challenge_id is not null)
    )
);

create index if not exists idx_quiz_questions_role      on public.quiz_questions("role")     where scope = 'role';
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
    score               integer,
    total               integer not null,
    paired_attempt_id   uuid references public.quiz_attempts(id) on delete set null,
    learning_gain       integer,
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
    selected_index  integer,
    is_correct      boolean,
    answered_at     timestamptz,
    constraint quiz_attempt_questions_unique unique (attempt_id, order_index)
);

create index if not exists idx_qaq_attempt on public.quiz_attempt_questions(attempt_id);

```

---

## backend/migrations/007_private_dude_messages.sql
**Type:** migration

```sql
-- Migration 007: private DUDE conversation log
-- Stores every student ↔ DUDE private message so teachers can view and analyze them.

CREATE TABLE IF NOT EXISTS private_dude_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT        NOT NULL CHECK (role IN ('student', 'dude')),
    content     TEXT        NOT NULL,
    analyzed    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_private_dude_user     ON private_dude_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_dude_analyzed ON private_dude_messages(user_id, analyzed) WHERE analyzed = FALSE;

```

---

## backend/migrations/007_teacher_group_notes.sql
**Type:** migration

```sql
-- Teacher notes per group/team
CREATE TABLE IF NOT EXISTS teacher_group_notes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID        NOT NULL,
    teacher_id  TEXT,
    note        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_group_notes_team_created
    ON teacher_group_notes (team_id, created_at DESC);

```

---

## backend/migrations/008_teacher_student_notes.sql
**Type:** migration

```sql
-- Teacher notes per student
CREATE TABLE IF NOT EXISTS teacher_student_notes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID        NOT NULL,
    teacher_id  TEXT,
    note        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_student_notes_student_created
    ON teacher_student_notes (student_id, created_at DESC);

```

---

## backend/src/activity/activity.controller.ts
**Type:** backend

```typescript
/**
 * Activity controller — `/api/activity/heartbeat`, `/api/activity/me`.
 *
 * During the additive-auth phase, the heartbeat endpoint accepts a `userId`
 * in the body as a fallback for clients that haven't integrated JWT yet.
 * Once the frontend sends Authorization headers, the body field can be
 * dropped and the JWT becomes the only source of identity.
 *
 * @version 1.00
 */

import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityService, ActivitySnapshot } from './activity.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('activity')
@Controller('activity')
export class ActivityController {
    constructor(private readonly activity: ActivityService) {}

    @Public()
    @Post('heartbeat')
    @HttpCode(200)
    async heartbeat(
        @Body() dto: HeartbeatDto,
        @CurrentUser() user?: AuthenticatedUser,
    ): Promise<ActivitySnapshot> {
        const userId = user?.userId ?? dto.userId;
        if (!userId) {
            throw new BadRequestException(
                'Heartbeat requires either an Authorization header or a userId in the body',
            );
        }
        return this.activity.heartbeat(userId, dto.deltaSeconds);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@CurrentUser() user: AuthenticatedUser): Promise<ActivitySnapshot> {
        return this.activity.getActivity(user.userId);
    }
}

```

---

## backend/src/activity/activity.module.ts
**Type:** backend

```typescript
/**
 * Activity module.
 *
 * @version 1.00
 */

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Module({
    imports: [AuthModule],
    controllers: [ActivityController],
    providers: [ActivityService],
    exports: [ActivityService],
})
export class ActivityModule {}

```

---

## backend/src/activity/activity.service.ts
**Type:** backend

```typescript
/**
 * ActivityService — tracks per-user time-on-platform.
 *
 * The spec mandates per-week active-time measurement for the teacher
 * analytics view (`teacher_analytics`). This service is the only place
 * `users.last_login_at` and `users.total_active_time` are written.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MAX_DELTA_SECONDS } from './dto/heartbeat.dto';

export interface ActivitySnapshot {
    userId: string;
    totalActiveTime: number;
    lastLoginAt: string | null;
}

@Injectable()
export class ActivityService {
    private readonly logger = new Logger(ActivityService.name);

    constructor(private readonly supabase: SupabaseService) {}

    /** Called from the auth flow on successful login. */
    async recordLogin(userId: string): Promise<void> {
        await this.supabase.db
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', userId);
    }

    /**
     * Add `deltaSeconds` to the user's `total_active_time`. The value is
     * clamped at {@link MAX_DELTA_SECONDS} to bound abuse from a malicious
     * client that ignores the DTO validator.
     */
    async heartbeat(userId: string, deltaSeconds: number): Promise<ActivitySnapshot> {
        const clamped = Math.max(1, Math.min(deltaSeconds, MAX_DELTA_SECONDS));

        // Fetch current value, increment in JS, then update
        const { data: current } = await this.supabase.db
            .from('users')
            .select('id, total_active_time, last_login_at')
            .eq('id', userId)
            .maybeSingle();

        if (!current) throw new Error(`Heartbeat for unknown user ${userId}`);

        const newTime = (current.total_active_time ?? 0) + clamped;

        const { data: row } = await this.supabase.db
            .from('users')
            .update({
                total_active_time: newTime,
                last_login_at: current.last_login_at ?? new Date().toISOString(),
            })
            .eq('id', userId)
            .select('id, total_active_time, last_login_at')
            .single();

        return {
            userId: (row as any).id,
            totalActiveTime: (row as any).total_active_time,
            lastLoginAt: (row as any).last_login_at,
        };
    }

    async getActivity(userId: string): Promise<ActivitySnapshot> {
        const { data: row } = await this.supabase.db
            .from('users')
            .select('id, total_active_time, last_login_at')
            .eq('id', userId)
            .maybeSingle();

        if (!row) throw new Error(`Unknown user ${userId}`);
        return {
            userId: (row as any).id,
            totalActiveTime: (row as any).total_active_time,
            lastLoginAt: (row as any).last_login_at,
        };
    }
}

```

---

## backend/src/activity/dto/heartbeat.dto.ts
**Type:** backend

```typescript
/**
 * Heartbeat DTO. The frontend pings ~once per minute while the user is
 * active. `deltaSeconds` is capped server-side to bound abuse — even if
 * a malicious client sends 999, we accept at most {@link MAX_DELTA_SECONDS}.
 *
 * @version 1.00
 */

import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const MAX_DELTA_SECONDS = 120;

export class HeartbeatDto {
    @IsInt()
    @Min(1)
    @Max(MAX_DELTA_SECONDS)
    deltaSeconds!: number;

    /**
     * Used during the additive-auth phase — the JWT is preferred when
     * present, but if no Authorization header is sent, the userId in the
     * body is the fallback.
     */
    @IsOptional()
    @IsUUID()
    userId?: string;
}

```

---

## backend/src/admin/admin.controller.ts
**Type:** backend

```typescript
/**
 * Admin controller — `/api/admin/*`. All endpoints require an `admin`
 * account.
 *
 * @version 1.00
 */

import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService, AdminUserView } from './admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
    AssignTeamDto,
    ResetPasswordDto,
    UpdateUserDto,
} from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuditLogService } from '../audit/audit-log.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
    constructor(
        private readonly admin: AdminService,
        private readonly audit: AuditLogService,
    ) {}

    @Get('users')
    listUsers(): Promise<AdminUserView[]> {
        return this.admin.listUsers();
    }

    @Post('users')
    @HttpCode(201)
    createUser(
        @Body() dto: CreateUserDto,
        @CurrentUser() actor: AuthenticatedUser,
    ): Promise<AdminUserView> {
        return this.admin.createUser(dto, actor);
    }

    @Get('users/:id')
    getUser(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminUserView> {
        return this.admin.getUser(id);
    }

    @Patch('users/:id')
    updateUser(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateUserDto,
        @CurrentUser() actor: AuthenticatedUser,
    ): Promise<AdminUserView> {
        return this.admin.updateUser(id, dto, actor);
    }

    @Delete('users/:id')
    @HttpCode(200)
    disableUser(
        @Param('id', new ParseUUIDPipe()) id: string,
        @CurrentUser() actor: AuthenticatedUser,
    ): Promise<AdminUserView> {
        return this.admin.disableUser(id, actor);
    }

    @Post('users/:id/reset-password')
    @HttpCode(204)
    async resetPassword(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: ResetPasswordDto,
        @CurrentUser() actor: AuthenticatedUser,
    ): Promise<void> {
        await this.admin.resetPassword(id, dto, actor);
    }

    @Post('users/:id/assign-team')
    assignTeam(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: AssignTeamDto,
        @CurrentUser() actor: AuthenticatedUser,
    ): Promise<AdminUserView> {
        return this.admin.assignTeam(id, dto, actor);
    }

    @Get('audit-log')
    auditLog(@Query('limit') limit?: string): Promise<unknown[]> {
        const n = limit ? parseInt(limit, 10) : 100;
        return this.audit.recent(Number.isFinite(n) ? n : 100);
    }
}

```

---

## backend/src/admin/admin.module.ts
**Type:** backend

```typescript
/**
 * Admin module.
 *
 * @version 1.00
 */

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
    imports: [AuthModule],
    controllers: [AdminController],
    providers: [AdminService],
    exports: [AdminService],
})
export class AdminModule {}

```

---

## backend/src/admin/admin.service.ts
**Type:** backend

```typescript
/**
 * AdminService — user management for production school deployments.
 *
 * Every mutation writes to audit_logs and revokes outstanding refresh
 * tokens for the affected user when their security state changes
 * (password reset, account disabled, account_type changed).
 *
 * @version 1.00
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../audit/audit-log.service';
import { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { EmailAlreadyTakenError } from '../common/errors/domain-errors';
import {
    AccountType,
    AuthenticatedUser,
    WorkRole,
} from '../common/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import {
    AssignTeamDto,
    ResetPasswordDto,
    UpdateUserDto,
} from './dto/update-user.dto';

export interface AdminUserView {
    id: string;
    name: string;
    email: string;
    accountType: AccountType;
    isActive: boolean;
    authProvider: 'local' | 'firebase' | 'google';
    currentTeamId: string | null;
    currentRole: WorkRole | null;
    totalActiveTime: number;
    lastLoginAt: string | null;
    createdAt: string;
}

interface UserRow {
    id: string;
    name: string;
    email: string;
    account_type: AccountType;
    is_active: boolean;
    auth_provider: 'local' | 'firebase' | 'google';
    current_team_id: string | null;
    current_role: WorkRole | null;
    total_active_time: number;
    last_login_at: string | null;
    created_at: string;
}

@Injectable()
export class AdminService {
    constructor(
        private readonly supabase: SupabaseService,
        private readonly audit: AuditLogService,
        private readonly local: LocalAuthProvider,
        private readonly refresh: RefreshTokenService,
    ) {}

    async listUsers(): Promise<AdminUserView[]> {
        const { data } = await this.supabase.db
            .from('users')
            .select('id, name, email, account_type, is_active, auth_provider, current_team_id, current_role, total_active_time, last_login_at, created_at')
            .order('name');
        return ((data ?? []) as UserRow[]).map(this.toView);
    }

    async getUser(id: string): Promise<AdminUserView> {
        const { data } = await this.supabase.db
            .from('users')
            .select('id, name, email, account_type, is_active, auth_provider, current_team_id, current_role, total_active_time, last_login_at, created_at')
            .eq('id', id)
            .maybeSingle();
        if (!data) throw new NotFoundException(`User ${id} not found`);
        return this.toView(data as UserRow);
    }

    async createUser(dto: CreateUserDto, actor: AuthenticatedUser): Promise<AdminUserView> {
        const email = dto.email.toLowerCase().trim();

        const { data: existing } = await this.supabase.db
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();
        if (existing) throw new EmailAlreadyTakenError();

        const passwordHash = await this.local.hashPassword(dto.password);

        const { data: row, error } = await this.supabase.db
            .from('users')
            .insert({
                name: dto.name,
                email,
                password_hash: passwordHash,
                account_type: dto.accountType,
                auth_provider: 'local',
                current_team_id: dto.teamId ?? null,
                current_role: dto.workRole ?? null,
                is_active: true,
            })
            .select('id, name, email, account_type, is_active, auth_provider, current_team_id, current_role, total_active_time, last_login_at, created_at')
            .single();

        if (error) throw new Error(error.message);

        await this.audit.write({
            userId: actor.userId,
            actorEmail: actor.email,
            action: 'admin.user.created',
            entityType: 'user',
            entityId: (row as UserRow).id,
            metadata: { newUserEmail: (row as UserRow).email, accountType: (row as UserRow).account_type },
        });
        return this.toView(row as UserRow);
    }

    async updateUser(id: string, dto: UpdateUserDto, actor: AuthenticatedUser): Promise<AdminUserView> {
        const before = await this.getUser(id);

        const updates: Record<string, unknown> = {};
        if (dto.name !== undefined) updates['name'] = dto.name;
        if (dto.email !== undefined) updates['email'] = dto.email.toLowerCase().trim();
        if (dto.accountType !== undefined) updates['account_type'] = dto.accountType;
        if (dto.teamId !== undefined) updates['current_team_id'] = dto.teamId;
        if (dto.workRole !== undefined) updates['current_role'] = dto.workRole;
        if (dto.isActive !== undefined) updates['is_active'] = dto.isActive;

        if (Object.keys(updates).length === 0) return before;

        await this.supabase.db
            .from('users')
            .update(updates)
            .eq('id', id);

        const updated = await this.getUser(id);

        // Security-relevant changes invalidate sessions
        const securityChanged =
            (dto.accountType !== undefined && dto.accountType !== before.accountType) ||
            (dto.isActive !== undefined && dto.isActive === false);
        if (securityChanged) {
            await this.refresh.revokeAllForUser(id, 'admin_update');
        }

        await this.audit.write({
            userId: actor.userId,
            actorEmail: actor.email,
            action: dto.isActive === false ? 'admin.user.disabled' : 'admin.user.updated',
            entityType: 'user',
            entityId: id,
            metadata: { changes: dto },
        });
        return updated;
    }

    async resetPassword(id: string, dto: ResetPasswordDto, actor: AuthenticatedUser): Promise<void> {
        await this.getUser(id); // 404 if missing
        const hash = await this.local.hashPassword(dto.newPassword);
        await this.supabase.db
            .from('users')
            .update({ password_hash: hash })
            .eq('id', id);
        await this.refresh.revokeAllForUser(id, 'password_reset');
        await this.audit.write({
            userId: actor.userId,
            actorEmail: actor.email,
            action: 'admin.user.password_reset',
            entityType: 'user',
            entityId: id,
        });
    }

    async assignTeam(id: string, dto: AssignTeamDto, actor: AuthenticatedUser): Promise<AdminUserView> {
        await this.getUser(id);
        await this.supabase.db
            .from('users')
            .update({ current_team_id: dto.teamId, current_role: dto.workRole })
            .eq('id', id);
        await this.audit.write({
            userId: actor.userId,
            actorEmail: actor.email,
            action: 'admin.user.team_assigned',
            entityType: 'user',
            entityId: id,
            metadata: { teamId: dto.teamId, workRole: dto.workRole },
        });
        return this.getUser(id);
    }

    async disableUser(id: string, actor: AuthenticatedUser): Promise<AdminUserView> {
        return this.updateUser(id, { isActive: false }, actor);
    }

    private toView(r: UserRow): AdminUserView {
        return {
            id: r.id,
            name: r.name,
            email: r.email,
            accountType: r.account_type,
            isActive: r.is_active,
            authProvider: r.auth_provider,
            currentTeamId: r.current_team_id,
            currentRole: r.current_role,
            totalActiveTime: r.total_active_time,
            lastLoginAt: r.last_login_at,
            createdAt: r.created_at,
        };
    }
}

```

---

## backend/src/admin/dto/create-user.dto.ts
**Type:** backend

```typescript
/**
 * Create-user DTO for the admin API.
 *
 * @version 1.00
 */

import {
    IsEmail,
    IsIn,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
} from 'class-validator';
import { AccountType, WorkRole } from '../../common/types/authenticated-user';

export class CreateUserDto {
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name!: string;

    @IsEmail()
    @MaxLength(254)
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(256)
    password!: string;

    @IsIn(['student', 'teacher', 'admin'])
    accountType!: AccountType;

    @IsOptional()
    @IsUUID()
    teamId?: string;

    @IsOptional()
    @IsIn(['pm', 'qa', 'dev', 'hardware'])
    workRole?: WorkRole;
}

```

---

## backend/src/admin/dto/update-user.dto.ts
**Type:** backend

```typescript
/**
 * Update-user DTO. All fields optional — admin can update any subset.
 *
 * @version 1.00
 */

import {
    IsBoolean,
    IsEmail,
    IsIn,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
} from 'class-validator';
import { AccountType, WorkRole } from '../../common/types/authenticated-user';

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name?: string;

    @IsOptional()
    @IsEmail()
    @MaxLength(254)
    email?: string;

    @IsOptional()
    @IsIn(['student', 'teacher', 'admin'])
    accountType?: AccountType;

    @IsOptional()
    @IsUUID()
    teamId?: string | null;

    @IsOptional()
    @IsIn(['pm', 'qa', 'dev', 'hardware'])
    workRole?: WorkRole;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class ResetPasswordDto {
    @IsString()
    @MinLength(8)
    @MaxLength(256)
    newPassword!: string;
}

export class AssignTeamDto {
    @IsUUID()
    teamId!: string;

    @IsIn(['pm', 'qa', 'dev', 'hardware'])
    workRole!: WorkRole;
}

```

---

## backend/src/app.module.ts
**Type:** backend

```typescript
/**
 * Root composition for the TeamSprintUp backend.
 *
 * @version 1.20
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { SupabaseModule } from './supabase/supabase.module';
import { GatekeeperModule } from './gatekeeper/gatekeeper.module';
import { AuditModule } from './audit/audit.module';
import { AIModule } from './integrations/ai/ai.module';
import { MondayApiModule } from './integrations/monday/monday-api.module';
import { FirebaseIntegrationModule } from './integrations/firebase/firebase.module';
import { StorageIntegrationModule } from './integrations/storage/storage.module';
import { TechSchoolIntegrationModule } from './integrations/techschool/techschool.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { ActivityModule } from './activity/activity.module';
import { TasksModule } from './tasks/tasks.module';
import { HintsModule } from './hints/hints.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MockMondayModule } from './mock-monday/mock-monday.module';
import { ChatModule } from './chat/chat.module';
import { DudeModule } from './dude/dude.module';
import { StudentProfileModule } from './student-profile/student-profile.module';

@Module({
    imports: [
        ConfigModule,
        SupabaseModule,
        GatekeeperModule,
        AuditModule,
        AIModule,
        MondayApiModule,
        FirebaseIntegrationModule,
        StorageIntegrationModule,
        TechSchoolIntegrationModule,
        AuthModule,
        AdminModule,
        ActivityModule,
        TeamsModule,
        UsersModule,
        TasksModule,
        HintsModule,
        WebhooksModule,
        MockMondayModule,
        ChatModule,
        StudentProfileModule,
        DudeModule,
    ],
})
export class AppModule {}

```

---

## backend/src/audit/audit-log.service.ts
**Type:** backend

```typescript
/**
 * Audit log writer.
 *
 * Append-only record of security-relevant actions: login, logout, password
 * change, user created/disabled, role change, task approved by teacher, hint
 * over free limit, etc.
 *
 * Failures to write are logged but do not fail the originating request —
 * a missed audit entry is preferable to a broken user-facing flow.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type AuditAction =
    | 'auth.login.success'
    | 'auth.login.failed'
    | 'auth.login.locked'
    | 'auth.logout'
    | 'auth.refresh.rotated'
    | 'auth.refresh.theft_detected'
    | 'auth.password.changed'
    | 'auth.register.success'
    | 'admin.user.created'
    | 'admin.user.updated'
    | 'admin.user.disabled'
    | 'admin.user.password_reset'
    | 'admin.user.team_assigned'
    | 'task.teacher_approved'
    | 'task.teacher_rejected'
    | 'hint.over_free_limit';

export interface AuditEntry {
    readonly userId?: string | null;
    readonly actorEmail?: string | null;
    readonly action: AuditAction;
    readonly entityType?: string;
    readonly entityId?: string;
    readonly metadata?: Record<string, unknown>;
    readonly ipAddress?: string;
    readonly userAgent?: string;
}

@Injectable()
export class AuditLogService {
    private readonly logger = new Logger(AuditLogService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async write(entry: AuditEntry): Promise<void> {
        try {
            await this.supabase.db.from('audit_logs').insert({
                user_id: entry.userId ?? null,
                actor_email: entry.actorEmail ?? null,
                action: entry.action,
                entity_type: entry.entityType ?? null,
                entity_id: entry.entityId ?? null,
                metadata: entry.metadata ?? null,
                ip_address: entry.ipAddress ?? null,
                user_agent: entry.userAgent ?? null,
            });
        } catch (err) {
            this.logger.error(
                `Failed to write audit log (action=${entry.action}): ${(err as Error).message}`,
            );
        }
    }

    async recent(limit: number = 100): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('audit_logs')
            .select('id, user_id, actor_email, action, entity_type, entity_id, metadata, ip_address, created_at')
            .order('created_at', { ascending: false })
            .limit(Math.min(Math.max(limit, 1), 500));
        return data ?? [];
    }

    async forUser(userId: string, limit: number = 50): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('audit_logs')
            .select('id, action, entity_type, entity_id, metadata, ip_address, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(Math.min(Math.max(limit, 1), 200));
        return data ?? [];
    }
}

```

---

## backend/src/audit/audit.module.ts
**Type:** backend

```typescript
/**
 * Audit log module — global so any feature can inject AuditLogService.
 *
 * @version 1.00
 */

import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

@Global()
@Module({
    providers: [AuditLogService],
    exports: [AuditLogService],
})
export class AuditModule {}

```

---

## backend/src/auth/auth.controller.ts
**Type:** backend

```typescript
/**
 * Auth controller — `/api/auth/*` endpoints.
 *
 * Routes are tagged `@Public()` so the global JWT guard (when enabled)
 * doesn't 401 unauthenticated callers trying to log in.
 *
 * @version 1.00
 */

import {
    Body,
    Controller,
    HttpCode,
    Post,
    Get,
    Req,
    Res,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '../config/config.service';
import { LoginInput } from './providers/auth-provider.interface';

const REFRESH_COOKIE = 'tsu_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly auth: AuthService,
        private readonly config: ConfigService,
    ) {}

    @Public()
    @Post('login')
    @HttpCode(200)
    async login(
        @Body() dto: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<Omit<TokenPair, 'refreshToken'>> {
        const input = this.dtoToLoginInput(dto);
        const result = await this.auth.login(input, this.ctx(req));
        this.setRefreshCookie(res, result.refreshToken);
        return this.stripRefresh(result);
    }

    @Public()
    @Post('register')
    @HttpCode(201)
    async register(
        @Body() dto: RegisterDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<Omit<TokenPair, 'refreshToken'>> {
        const result = await this.auth.register(dto, this.ctx(req));
        this.setRefreshCookie(res, result.refreshToken);
        return this.stripRefresh(result);
    }

    @Public()
    @Post('refresh')
    @HttpCode(200)
    async refresh(
        @Body() dto: RefreshDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<Omit<TokenPair, 'refreshToken'>> {
        const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
        const raw = dto.refreshToken ?? cookies?.[REFRESH_COOKIE];
        if (!raw) throw new UnauthorizedException('No refresh token provided');
        const result = await this.auth.refreshTokens(raw, this.ctx(req));
        this.setRefreshCookie(res, result.refreshToken);
        return this.stripRefresh(result);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post('logout')
    @HttpCode(204)
    async logout(
        @Body() dto: RefreshDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @CurrentUser() user?: AuthenticatedUser,
    ): Promise<void> {
        const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
        const raw = dto.refreshToken ?? cookies?.[REFRESH_COOKIE];
        if (raw) await this.auth.logout(raw, user);
        res.clearCookie(REFRESH_COOKIE, { path: '/' });
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
        return user;
    }

    private dtoToLoginInput(dto: LoginDto): LoginInput {
        switch (dto.kind) {
            case 'local':
                return { kind: 'local', email: dto.email!, password: dto.password! };
            case 'firebase':
                return { kind: 'firebase', idToken: dto.idToken! };
            case 'google':
                return { kind: 'google', authorizationCode: dto.authorizationCode! };
        }
    }

    private ctx(req: Request): { ip?: string; userAgent?: string } {
        const xff = req.headers['x-forwarded-for'];
        const ip = Array.isArray(xff)
            ? xff[0]
            : (xff?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? undefined);
        return { ip, userAgent: req.headers['user-agent'] };
    }

    private setRefreshCookie(res: Response, raw: string): void {
        res.cookie(REFRESH_COOKIE, raw, {
            httpOnly: true,
            secure: this.config.isProduction,
            sameSite: 'strict',
            path: '/',
            maxAge: this.config.jwt.refreshTtlSeconds * 1000,
        });
    }

    private stripRefresh(t: TokenPair): Omit<TokenPair, 'refreshToken'> {
        const { refreshToken: _ignored, ...rest } = t;
        return rest;
    }
}

```

---

## backend/src/auth/auth.module.ts
**Type:** backend

```typescript
/**
 * Auth module — wires the active provider, JWT services, refresh-token
 * persistence, and the HTTP controller.
 *
 * @version 1.00
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditModule } from '../audit/audit.module';
import { FirebaseIntegrationModule } from '../integrations/firebase/firebase.module';
import { FIREBASE_PROVIDER_TOKEN, FirebaseProvider } from '../integrations/firebase/firebase.interface';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { LocalAuthProvider } from './providers/local-auth.provider';
import { FirebaseAuthProvider } from './providers/firebase-auth.provider';
import { GoogleOAuthProvider } from './providers/google-oauth.provider';
import { AUTH_PROVIDER_TOKEN, AuthProvider } from './providers/auth-provider.interface';

@Module({
    imports: [AuditModule, FirebaseIntegrationModule],
    providers: [
        JwtService,
        RefreshTokenService,
        LocalAuthProvider,
        FirebaseAuthProvider,
        GoogleOAuthProvider,
        AuthService,
        JwtAuthGuard,
        RolesGuard,
        {
            provide: AUTH_PROVIDER_TOKEN,
            inject: [ConfigService, LocalAuthProvider, SupabaseService, AuditLogService, FIREBASE_PROVIDER_TOKEN],
            useFactory: (
                cfg: ConfigService,
                local: LocalAuthProvider,
                _supabase: SupabaseService,
                _audit: AuditLogService,
                firebaseAdapter: FirebaseProvider,
            ): AuthProvider => {
                switch (cfg.auth.provider) {
                    case 'firebase':
                        return new FirebaseAuthProvider(_supabase, firebaseAdapter);
                    case 'google':
                        return new GoogleOAuthProvider();
                    case 'local':
                    default:
                        return local;
                }
            },
        },
    ],
    controllers: [AuthController],
    exports: [JwtService, JwtAuthGuard, RolesGuard, LocalAuthProvider, RefreshTokenService, AuthService],
})
export class AuthModule {}

```

---

## backend/src/auth/auth.service.ts
**Type:** backend

```typescript
/**
 * AuthService — orchestrates login / register / refresh / logout.
 *
 * Delegates credential verification to the active AuthProvider, issues
 * access + refresh tokens, writes audit log entries, and updates the user's
 * `last_login_at` timestamp on success. (`total_active_time` is incremented
 * by the activity module's heartbeat endpoint, separately.)
 *
 * @version 1.00
 */

import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../audit/audit-log.service';
import { JwtService } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';
import {
    AUTH_PROVIDER_TOKEN,
    AuthProvider,
    LoginInput,
    RegisterInput,
} from './providers/auth-provider.interface';
import {
    AccountType,
    AuthenticatedUser,
    WorkRole,
} from '../common/types/authenticated-user';
import { LocalAuthProvider } from './providers/local-auth.provider';

export interface TokenPair {
    accessToken: string;
    accessTokenExpiresAt: Date;
    refreshToken: string;
    user: AuthenticatedUser;
}

interface UserStateRow {
    id: string;
    email: string;
    account_type: AccountType;
    current_team_id: string | null;
    current_role: WorkRole | null;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly config: ConfigService,
        private readonly supabase: SupabaseService,
        private readonly jwt: JwtService,
        private readonly refresh: RefreshTokenService,
        private readonly audit: AuditLogService,
        @Inject(AUTH_PROVIDER_TOKEN) private readonly provider: AuthProvider,
        private readonly localProvider: LocalAuthProvider,
    ) {}

    async login(input: LoginInput, ctx: { ip?: string; userAgent?: string }): Promise<TokenPair> {
        const user = await this.provider.verify(input, ctx);
        await this.markLoggedIn(user.userId);
        const access = this.jwt.signAccessToken(user);
        const refreshToken = await this.refresh.issue(user.userId, ctx);
        await this.audit.write({
            userId: user.userId,
            actorEmail: user.email,
            action: 'auth.login.success',
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
            metadata: { provider: this.provider.name },
        });
        return {
            accessToken: access.token,
            accessTokenExpiresAt: access.expiresAt,
            refreshToken,
            user,
        };
    }

    async register(input: RegisterInput, ctx: { ip?: string; userAgent?: string }): Promise<TokenPair> {
        if (!this.config.auth.allowSelfRegistration) {
            throw new ForbiddenException(
                'Self-registration is disabled. Ask an administrator to create your account.',
            );
        }
        // Self-registration is local-only, regardless of the active provider
        const user = await this.localProvider.register(input);
        await this.markLoggedIn(user.userId);
        const access = this.jwt.signAccessToken(user);
        const refreshToken = await this.refresh.issue(user.userId, ctx);
        await this.audit.write({
            userId: user.userId,
            actorEmail: user.email,
            action: 'auth.register.success',
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
        });
        return {
            accessToken: access.token,
            accessTokenExpiresAt: access.expiresAt,
            refreshToken,
            user,
        };
    }

    async refreshTokens(rawRefresh: string, ctx: { ip?: string; userAgent?: string }): Promise<TokenPair> {
        const rotated = await this.refresh.rotate(rawRefresh, ctx);

        const { data: row } = await this.supabase.db
            .from('users')
            .select('id, email, account_type, current_team_id, current_role')
            .eq('id', rotated.userId)
            .eq('is_active', true)
            .maybeSingle();

        if (!row) throw new ForbiddenException('User no longer active');

        const authUser: AuthenticatedUser = {
            userId: (row as UserStateRow).id,
            email: (row as UserStateRow).email,
            accountType: (row as UserStateRow).account_type,
            currentRole: (row as UserStateRow).current_role,
            currentTeamId: (row as UserStateRow).current_team_id,
        };
        const access = this.jwt.signAccessToken(authUser);
        return {
            accessToken: access.token,
            accessTokenExpiresAt: access.expiresAt,
            refreshToken: rotated.raw,
            user: authUser,
        };
    }

    async logout(rawRefresh: string, actor: AuthenticatedUser | undefined): Promise<void> {
        await this.refresh.revoke(rawRefresh);
        await this.audit.write({
            userId: actor?.userId ?? null,
            actorEmail: actor?.email ?? null,
            action: 'auth.logout',
        });
    }

    private async markLoggedIn(userId: string): Promise<void> {
        await this.supabase.db
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', userId);
    }
}

```

---

## backend/src/auth/dto/login.dto.ts
**Type:** backend

```typescript
/**
 * Login DTOs — discriminated union over auth providers.
 *
 * @version 1.00
 */

import {
    IsEmail,
    IsIn,
    IsString,
    MaxLength,
    MinLength,
    ValidateIf,
} from 'class-validator';

export class LoginDto {
    @IsIn(['local', 'firebase', 'google'])
    kind!: 'local' | 'firebase' | 'google';

    @ValidateIf((o: LoginDto) => o.kind === 'local')
    @IsEmail()
    @MaxLength(254)
    email?: string;

    @ValidateIf((o: LoginDto) => o.kind === 'local')
    @IsString()
    @MinLength(8)
    @MaxLength(256)
    password?: string;

    @ValidateIf((o: LoginDto) => o.kind === 'firebase')
    @IsString()
    @MaxLength(4096)
    idToken?: string;

    @ValidateIf((o: LoginDto) => o.kind === 'google')
    @IsString()
    @MaxLength(2048)
    authorizationCode?: string;
}

```

---

## backend/src/auth/dto/refresh.dto.ts
**Type:** backend

```typescript
/**
 * Refresh-token DTO. The refresh token is also accepted from a HttpOnly
 * cookie when present — body is the fallback for clients that can't use
 * cookies (mobile apps).
 *
 * @version 1.00
 */

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefreshDto {
    @IsOptional()
    @IsString()
    @MaxLength(512)
    refreshToken?: string;
}

```

---

## backend/src/auth/dto/register.dto.ts
**Type:** backend

```typescript
/**
 * Self-registration DTO — only the local provider supports this, and only
 * when ALLOW_SELF_REGISTRATION=true. Production schools provision users
 * via the admin API.
 *
 * @version 1.00
 */

import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name!: string;

    @IsEmail()
    @MaxLength(254)
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(256)
    password!: string;
}

```

---

## backend/src/auth/guards/jwt-auth.guard.ts
**Type:** backend

```typescript
/**
 * JwtAuthGuard — verifies a Bearer access token and attaches the decoded
 * AuthenticatedUser to `req.user`.
 *
 * Routes marked with `@Public()` bypass the guard entirely. This is used
 * during the additive-auth phase to keep existing routes reachable while
 * the frontend integrates login.
 *
 * @version 1.00
 */

import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtService } from '../jwt.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly jwt: JwtService,
    ) {}

    canActivate(ctx: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        if (isPublic) return true;

        const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or malformed Authorization header');
        }
        const token = header.slice('Bearer '.length).trim();
        const payload = this.jwt.verifyAccessToken(token);
        req.user = {
            userId: payload.userId,
            email: payload.email,
            accountType: payload.accountType,
            currentRole: payload.currentRole,
            currentTeamId: payload.currentTeamId,
        };
        return true;
    }
}

```

---

## backend/src/auth/guards/roles.guard.ts
**Type:** backend

```typescript
/**
 * RolesGuard — checks that req.user has one of the required AccountTypes
 * declared by `@Roles(...)` on the route.
 *
 * Must be applied AFTER JwtAuthGuard — it relies on `req.user` being set.
 *
 * @version 1.00
 */

import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AccountType, AuthenticatedUser } from '../../common/types/authenticated-user';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(ctx: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<AccountType[]>(ROLES_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        if (!required || required.length === 0) return true;

        const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
        const user = req.user;
        if (!user) throw new ForbiddenException('Unauthenticated');
        if (!required.includes(user.accountType)) {
            throw new ForbiddenException(
                `Account type "${user.accountType}" cannot perform this action`,
            );
        }
        return true;
    }
}

```

---

## backend/src/auth/jwt.service.ts
**Type:** backend

```typescript
/**
 * JWT signing and verification.
 *
 * Access tokens are short-lived (15 min default) and stateless. Refresh
 * tokens are random 256-bit strings stored hashed in `refresh_tokens` —
 * see refresh-token.service.ts.
 *
 * @version 1.00
 */

import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '../config/config.service';
import {
    AuthenticatedUser,
    JwtAccessPayload,
} from '../common/types/authenticated-user';
import { InvalidRefreshTokenError } from '../common/errors/domain-errors';

@Injectable()
export class JwtService {
    constructor(private readonly config: ConfigService) {}

    signAccessToken(user: AuthenticatedUser): { token: string; expiresAt: Date } {
        const { accessSecret, accessTtlSeconds, issuer } = this.config.jwt;
        const now = Math.floor(Date.now() / 1000);
        const payload: Omit<JwtAccessPayload, 'iat' | 'exp' | 'iss' | 'sub'> = {
            userId: user.userId,
            email: user.email,
            accountType: user.accountType,
            currentRole: user.currentRole,
            currentTeamId: user.currentTeamId,
        };
        const token = jwt.sign(payload, accessSecret, {
            algorithm: 'HS256',
            expiresIn: accessTtlSeconds,
            issuer,
            subject: user.userId,
        });
        return { token, expiresAt: new Date((now + accessTtlSeconds) * 1000) };
    }

    verifyAccessToken(token: string): JwtAccessPayload {
        const { accessSecret, issuer } = this.config.jwt;
        try {
            const decoded = jwt.verify(token, accessSecret, {
                algorithms: ['HS256'],
                issuer,
            }) as JwtAccessPayload;
            return decoded;
        } catch {
            throw new InvalidRefreshTokenError();
        }
    }

    /** Generate a fresh refresh token (raw + hash). Caller stores the hash. */
    generateRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
        const raw = randomBytes(32).toString('base64url');
        const hash = this.hashRefreshToken(raw);
        const expiresAt = new Date(
            Date.now() + this.config.jwt.refreshTtlSeconds * 1000,
        );
        return { raw, hash, expiresAt };
    }

    hashRefreshToken(raw: string): string {
        return createHash('sha256').update(raw).digest('hex');
    }
}

```

---

## backend/src/auth/providers/auth-provider.interface.ts
**Type:** backend

```typescript
/**
 * Auth provider contract.
 *
 * Implementations: LocalAuthProvider (bcrypt + DB), FirebaseAuthProvider
 * (verifies Firebase ID token), GoogleOAuthProvider (OAuth 2.0 code flow).
 *
 * The active provider is selected by `config.auth.provider` at boot.
 *
 * @version 1.00
 */

import { AuthenticatedUser } from '../../common/types/authenticated-user';

export const AUTH_PROVIDER_TOKEN = Symbol('AUTH_PROVIDER');

export interface LocalLoginInput {
    readonly kind: 'local';
    readonly email: string;
    readonly password: string;
}

export interface FirebaseLoginInput {
    readonly kind: 'firebase';
    readonly idToken: string;
}

export interface GoogleLoginInput {
    readonly kind: 'google';
    readonly authorizationCode: string;
}

export type LoginInput = LocalLoginInput | FirebaseLoginInput | GoogleLoginInput;

export interface RegisterInput {
    readonly email: string;
    readonly password: string;
    readonly name: string;
}

export interface AuthProvider {
    readonly name: 'local' | 'firebase' | 'google';
    /** Verify credentials and return the authenticated user. Throws on failure. */
    verify(input: LoginInput, ctx: { ip?: string; userAgent?: string }): Promise<AuthenticatedUser>;
    /** Optional — only LocalAuthProvider supports self-registration. */
    register?(input: RegisterInput): Promise<AuthenticatedUser>;
}

```

---

## backend/src/auth/providers/firebase-auth.provider.ts
**Type:** backend

```typescript
/**
 * Firebase auth provider — verifies a Firebase ID token via the Firebase
 * integration adapter (mock or real, chosen by FIREBASE_PROVIDER env var).
 *
 * On first sign-in for a previously-unknown email, we DO NOT auto-provision
 * a user — production schools provision users via the admin API. The
 * Firebase token must already correspond to an existing `users.email`.
 *
 * @version 1.00
 */

import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
    AccountDisabledError,
    InvalidCredentialsError,
} from '../../common/errors/domain-errors';
import {
    AccountType,
    AuthenticatedUser,
    WorkRole,
} from '../../common/types/authenticated-user';
import {
    FIREBASE_PROVIDER_TOKEN,
    FirebaseProvider,
} from '../../integrations/firebase/firebase.interface';
import { AuthProvider, LoginInput } from './auth-provider.interface';

interface UserRow {
    id: string;
    email: string;
    account_type: AccountType;
    is_active: boolean;
    current_team_id: string | null;
    current_role: WorkRole | null;
}

@Injectable()
export class FirebaseAuthProvider implements AuthProvider {
    readonly name = 'firebase' as const;

    constructor(
        private readonly supabase: SupabaseService,
        @Inject(FIREBASE_PROVIDER_TOKEN) private readonly firebase: FirebaseProvider,
    ) {}

    async verify(input: LoginInput): Promise<AuthenticatedUser> {
        if (input.kind !== 'firebase') throw new InvalidCredentialsError();

        const decoded = await this.firebase.verifyIdToken(input.idToken);
        const email = decoded.email.toLowerCase().trim();

        const { data: row } = await this.supabase.db
            .from('users')
            .select('id, email, account_type, is_active, current_team_id, current_role')
            .eq('email', email)
            .eq('auth_provider', 'firebase')
            .maybeSingle();

        if (!row) throw new InvalidCredentialsError();
        if (!(row as UserRow).is_active) throw new AccountDisabledError();

        return {
            userId: (row as UserRow).id,
            email: (row as UserRow).email,
            accountType: (row as UserRow).account_type,
            currentRole: (row as UserRow).current_role,
            currentTeamId: (row as UserRow).current_team_id,
        };
    }
}

```

---

## backend/src/auth/providers/google-oauth.provider.ts
**Type:** backend

```typescript
/**
 * Google OAuth provider — stub for tomorrow's credentials.
 *
 * TODO(creds-day): wire `google-auth-library`.
 *   1. `npm i google-auth-library`
 *   2. Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` env vars
 *   3. Implement the code → tokens exchange and JWT verification.
 *   4. Set AUTH_PROVIDER=google.
 *
 * @version 0.10
 */

import { Injectable } from '@nestjs/common';
import { AuthProvider, LoginInput } from './auth-provider.interface';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Injectable()
export class GoogleOAuthProvider implements AuthProvider {
    readonly name = 'google' as const;

    async verify(_input: LoginInput): Promise<AuthenticatedUser> {
        throw new Error(
            'GoogleOAuthProvider not implemented. See TODO(creds-day) in google-oauth.provider.ts',
        );
    }
}

```

---

## backend/src/auth/providers/local-auth.provider.ts
**Type:** backend

```typescript
/**
 * Local auth provider — bcrypt password verification against `users.password_hash`.
 *
 * Includes brute-force protection: tracks failed attempts in
 * `failed_login_attempts` and locks accounts for `lockoutWindowSeconds`
 * after `maxFailedLogins` consecutive failures within the window.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '../../config/config.service';
import { SupabaseService } from '../../supabase/supabase.service';
import {
    AccountDisabledError,
    AccountLockedError,
    EmailAlreadyTakenError,
    InvalidCredentialsError,
    WeakPasswordError,
} from '../../common/errors/domain-errors';
import {
    AccountType,
    AuthenticatedUser,
    WorkRole,
} from '../../common/types/authenticated-user';
import { AuditLogService } from '../../audit/audit-log.service';
import {
    AuthProvider,
    LoginInput,
    RegisterInput,
} from './auth-provider.interface';

interface UserRow {
    id: string;
    email: string;
    name: string;
    password_hash: string | null;
    account_type: AccountType;
    is_active: boolean;
    auth_provider: 'local' | 'firebase' | 'google';
    current_team_id: string | null;
    current_role: WorkRole | null;
}

const PASSWORD_RX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

@Injectable()
export class LocalAuthProvider implements AuthProvider {
    readonly name = 'local' as const;
    private readonly logger = new Logger(LocalAuthProvider.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly config: ConfigService,
        private readonly audit: AuditLogService,
    ) {}

    async verify(input: LoginInput, ctx: { ip?: string; userAgent?: string }): Promise<AuthenticatedUser> {
        if (input.kind !== 'local') {
            throw new InvalidCredentialsError();
        }
        const email = input.email.toLowerCase().trim();
        await this.assertNotLocked(email);

        const { data: row } = await this.supabase.db
            .from('users')
            .select('id, email, name, password_hash, account_type, is_active, auth_provider, current_team_id, current_role')
            .eq('email', email)
            .maybeSingle();

        if (!row || !(row as UserRow).password_hash || (row as UserRow).auth_provider !== 'local') {
            await this.recordFailure(email);
            await this.audit.write({
                action: 'auth.login.failed',
                actorEmail: email,
                ipAddress: ctx.ip,
                userAgent: ctx.userAgent,
            });
            throw new InvalidCredentialsError();
        }
        if (!(row as UserRow).is_active) throw new AccountDisabledError();

        const ok = await bcrypt.compare(input.password, (row as UserRow).password_hash!);
        if (!ok) {
            await this.recordFailure(email);
            await this.audit.write({
                userId: (row as UserRow).id,
                action: 'auth.login.failed',
                actorEmail: email,
                ipAddress: ctx.ip,
                userAgent: ctx.userAgent,
            });
            throw new InvalidCredentialsError();
        }

        await this.clearFailures(email);
        return this.toAuthenticated(row as UserRow);
    }

    async register(input: RegisterInput): Promise<AuthenticatedUser> {
        if (!PASSWORD_RX.test(input.password)) throw new WeakPasswordError();
        const email = input.email.toLowerCase().trim();

        const { data: existing } = await this.supabase.db
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existing) throw new EmailAlreadyTakenError();

        const hash = await bcrypt.hash(input.password, this.config.auth.bcryptCost);

        const { data: row, error } = await this.supabase.db
            .from('users')
            .insert({ name: input.name, email, password_hash: hash, account_type: 'student', auth_provider: 'local' })
            .select('id, email, name, password_hash, account_type, is_active, auth_provider, current_team_id, current_role')
            .single();

        if (error) throw new Error(error.message);
        return this.toAuthenticated(row as UserRow);
    }

    /** Hash a password — used by AdminService when creating/resetting users. */
    async hashPassword(plain: string): Promise<string> {
        if (!PASSWORD_RX.test(plain)) throw new WeakPasswordError();
        return bcrypt.hash(plain, this.config.auth.bcryptCost);
    }

    private toAuthenticated(row: UserRow): AuthenticatedUser {
        return {
            userId: row.id,
            email: row.email,
            accountType: row.account_type,
            currentRole: row.current_role,
            currentTeamId: row.current_team_id,
        };
    }

    private async assertNotLocked(email: string): Promise<void> {
        const { data: row } = await this.supabase.db
            .from('failed_login_attempts')
            .select('locked_until')
            .eq('email', email)
            .maybeSingle();

        if (row?.locked_until) {
            const remaining = Math.ceil(
                (new Date(row.locked_until).getTime() - Date.now()) / 1000,
            );
            if (remaining > 0) {
                await this.audit.write({ action: 'auth.login.locked', actorEmail: email });
                throw new AccountLockedError(remaining);
            }
        }
    }

    private async recordFailure(email: string): Promise<void> {
        const { maxFailedLogins, lockoutWindowSeconds } = this.config.auth;

        try {
            const { data: existing } = await this.supabase.db
                .from('failed_login_attempts')
                .select('attempts, last_attempt_at')
                .eq('email', email)
                .maybeSingle();

            const now = new Date();
            const windowStart = new Date(Date.now() - lockoutWindowSeconds * 1000);
            const withinWindow = existing && new Date(existing.last_attempt_at) > windowStart;
            const newAttempts = withinWindow ? (existing!.attempts + 1) : 1;
            const lockedUntil = newAttempts >= maxFailedLogins
                ? new Date(Date.now() + lockoutWindowSeconds * 1000).toISOString()
                : null;

            await this.supabase.db
                .from('failed_login_attempts')
                .upsert({
                    email,
                    attempts: newAttempts,
                    last_attempt_at: now.toISOString(),
                    locked_until: lockedUntil,
                }, { onConflict: 'email' });
        } catch (e) {
            this.logger.error(`recordFailure failed: ${(e as Error).message}`);
        }
    }

    private async clearFailures(email: string): Promise<void> {
        await this.supabase.db
            .from('failed_login_attempts')
            .delete()
            .eq('email', email);
    }
}

```

---

## backend/src/auth/refresh-token.service.ts
**Type:** backend

```typescript
/**
 * Refresh token persistence.
 *
 * Refresh tokens are stored as SHA-256 hashes — a database read does not
 * leak live sessions. Tokens are rotated on every successful refresh, and
 * a presented-after-rotation token is treated as a theft signal: the entire
 * chain for that user is revoked.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { JwtService } from './jwt.service';
import { InvalidRefreshTokenError } from '../common/errors/domain-errors';
import { AuditLogService } from '../audit/audit-log.service';

interface StoredToken {
    id: string;
    user_id: string;
    expires_at: string;
    revoked_at: string | null;
    replaced_by: string | null;
}

@Injectable()
export class RefreshTokenService {
    private readonly logger = new Logger(RefreshTokenService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly jwt: JwtService,
        private readonly audit: AuditLogService,
    ) {}

    async issue(userId: string, ctx: { userAgent?: string; ip?: string }): Promise<string> {
        const { raw, hash, expiresAt } = this.jwt.generateRefreshToken();
        await this.supabase.db.from('refresh_tokens').insert({
            user_id: userId,
            token_hash: hash,
            expires_at: expiresAt.toISOString(),
            user_agent: ctx.userAgent ?? null,
            ip_address: ctx.ip ?? null,
        });
        return raw;
    }

    /**
     * Rotate a refresh token. Returns a new raw token. Throws if the input
     * token is unknown, expired, or already revoked. If revoked, treat as
     * theft and revoke the entire chain.
     */
    async rotate(
        rawToken: string,
        ctx: { userAgent?: string; ip?: string },
    ): Promise<{ raw: string; userId: string }> {
        const presentedHash = this.jwt.hashRefreshToken(rawToken);

        const { data: stored } = await this.supabase.db
            .from('refresh_tokens')
            .select('id, user_id, expires_at, revoked_at, replaced_by')
            .eq('token_hash', presentedHash)
            .maybeSingle();

        if (!stored) throw new InvalidRefreshTokenError();

        const now = Date.now();
        if (new Date((stored as StoredToken).expires_at).getTime() < now) {
            throw new InvalidRefreshTokenError();
        }

        if ((stored as StoredToken).revoked_at) {
            // Theft signal — token was revoked but is being presented.
            this.logger.warn(
                `Refresh-token theft signal for user=${(stored as StoredToken).user_id} ` +
                `(token id=${(stored as StoredToken).id})`,
            );
            await this.revokeAllForUser((stored as StoredToken).user_id, 'theft_detected');
            await this.audit.write({
                userId: (stored as StoredToken).user_id,
                action: 'auth.refresh.theft_detected',
                metadata: { presentedTokenId: (stored as StoredToken).id },
                ipAddress: ctx.ip,
                userAgent: ctx.userAgent,
            });
            throw new InvalidRefreshTokenError();
        }

        // Generate a new token, revoke the old one, link them
        const fresh = this.jwt.generateRefreshToken();

        const { data: inserted } = await this.supabase.db
            .from('refresh_tokens')
            .insert({
                user_id: (stored as StoredToken).user_id,
                token_hash: fresh.hash,
                expires_at: fresh.expiresAt.toISOString(),
                user_agent: ctx.userAgent ?? null,
                ip_address: ctx.ip ?? null,
            })
            .select('id')
            .single();

        await this.supabase.db
            .from('refresh_tokens')
            .update({ revoked_at: new Date().toISOString(), replaced_by: (inserted as { id: string }).id })
            .eq('id', (stored as StoredToken).id);

        await this.audit.write({
            userId: (stored as StoredToken).user_id,
            action: 'auth.refresh.rotated',
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
        });
        return { raw: fresh.raw, userId: (stored as StoredToken).user_id };
    }

    async revoke(rawToken: string): Promise<void> {
        const hash = this.jwt.hashRefreshToken(rawToken);
        await this.supabase.db
            .from('refresh_tokens')
            .update({ revoked_at: new Date().toISOString() })
            .eq('token_hash', hash)
            .is('revoked_at', null);
    }

    async revokeAllForUser(userId: string, _reason: string): Promise<void> {
        await this.supabase.db
            .from('refresh_tokens')
            .update({ revoked_at: new Date().toISOString() })
            .eq('user_id', userId)
            .is('revoked_at', null);
    }
}

```

---

## backend/src/chat/chat.controller.ts
**Type:** backend

```typescript
import {
    Body, Controller, Get, HttpCode, Param,
    Post, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { AIService } from '../integrations/ai/ai.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat')
export class ChatController {
    constructor(
        private readonly chat: ChatService,
        private readonly ai: AIService,
    ) {}

    /** GET /chat/channels — all channels (teacher view) */
    @Get('channels')
    getAllChannels() {
        return this.chat.getAllChannels();
    }

    /** GET /chat/teams/:teamId/channel — get channel for a team */
    @Get('teams/:teamId/channel')
    getTeamChannel(@Param('teamId') teamId: string) {
        return this.chat.getChannelByTeam(teamId);
    }

    /** POST /chat/teams/:teamId/channel — create or get channel for a team */
    @Post('teams/:teamId/channel')
    createTeamChannel(
        @Param('teamId') teamId: string,
        @Query('teamName') teamName: string,
    ) {
        return this.chat.createChannel(teamId, teamName || 'Team');
    }

    /** GET /chat/channels/:channelId/messages */
    @Get('channels/:channelId/messages')
    getMessages(
        @Param('channelId') channelId: string,
        @Query('limit') limit?: string,
    ) {
        return this.chat.getMessages(channelId, limit ? parseInt(limit, 10) : 100);
    }

    /** POST /chat/channels/:channelId/messages */
    @Post('channels/:channelId/messages')
    sendMessage(
        @Param('channelId') channelId: string,
        @Body() dto: SendMessageDto,
    ) {
        return this.chat.sendMessage(channelId, dto.senderId, dto.senderName, dto.content);
    }

    /**
     * POST /chat/transcribe
     * Accepts a multipart audio file and returns { text: string }.
     * Frontend records via MediaRecorder, sends as FormData field "audio".
     */
    @Post('transcribe')
    @HttpCode(200)
    @UseInterceptors(FileInterceptor('audio'))
    async transcribe(@UploadedFile() file: any) {
        if (!file) return { text: '' };
        const text = await this.ai.transcribeAudio(file.buffer, file.mimetype);
        return { text };
    }
}

```

---

## backend/src/chat/chat.module.ts
**Type:** backend

```typescript
import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AIModule } from '../integrations/ai/ai.module';

@Module({
    imports: [AIModule],
    providers: [ChatService],
    controllers: [ChatController],
    exports: [ChatService],
})
export class ChatModule {}

```

---

## backend/src/chat/chat.service.ts
**Type:** backend

```typescript
/**
 * ChatService — manages group chat channels and messages for the DUDE system.
 *
 * Each team has exactly one chat channel (unique constraint on team_id).
 * Teachers are added as observers to all channels on login.
 * DUDE bot messages are stored with is_bot=true.
 *
 * Private DUDE conversations are stored in private_dude_messages (migration 007).
 *
 * @version 1.10
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ChatMessage {
    id: string;
    channelId: string;
    senderId: string | null;
    senderName: string;
    isBot: boolean;
    content: string;
    createdAt: string;
}

export interface ChatChannel {
    id: string;
    teamId: string;
    name: string;
    createdAt: string;
}

const DUDE_BOT_NAME = 'DUDE 🤖';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async createChannel(teamId: string, teamName: string): Promise<ChatChannel> {
        const { data, error } = await this.supabase.db
            .from('chat_channels')
            .upsert({ team_id: teamId, name: `${teamName} Chat` }, { onConflict: 'team_id' })
            .select('id, team_id, name, created_at')
            .single();

        if (error) {
            this.logger.error('Failed to create channel', error.message);
            throw new Error(error.message);
        }

        return this.mapChannel(data as any);
    }

    async getChannelByTeam(teamId: string): Promise<ChatChannel | null> {
        const { data } = await this.supabase.db
            .from('chat_channels')
            .select('id, team_id, name, created_at')
            .eq('team_id', teamId)
            .maybeSingle();

        return data ? this.mapChannel(data as any) : null;
    }

    async getAllChannels(): Promise<ChatChannel[]> {
        const { data } = await this.supabase.db
            .from('chat_channels')
            .select('id, team_id, name, created_at')
            .order('created_at', { ascending: true });

        return (data ?? []).map((r: any) => this.mapChannel(r));
    }

    async getMessages(channelId: string, limit = 100): Promise<ChatMessage[]> {
        const { data, error } = await this.supabase.db
            .from('chat_messages')
            .select('id, channel_id, sender_id, sender_name, is_bot, content, created_at')
            .eq('channel_id', channelId)
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) throw new NotFoundException(error.message);
        return (data ?? []).map((r: any) => this.mapMessage(r));
    }

    async sendMessage(
        channelId: string,
        senderId: string,
        senderName: string,
        content: string,
    ): Promise<ChatMessage> {
        const { data, error } = await this.supabase.db
            .from('chat_messages')
            .insert({
                channel_id: channelId,
                sender_id: senderId,
                sender_name: senderName,
                is_bot: false,
                content,
            })
            .select('id, channel_id, sender_id, sender_name, is_bot, content, created_at')
            .single();

        if (error) throw new Error(error.message);
        return this.mapMessage(data as any);
    }

    async sendBotMessage(channelId: string, content: string): Promise<ChatMessage> {
        const { data, error } = await this.supabase.db
            .from('chat_messages')
            .insert({
                channel_id: channelId,
                sender_id: null,
                sender_name: DUDE_BOT_NAME,
                is_bot: true,
                content,
            })
            .select('id, channel_id, sender_id, sender_name, is_bot, content, created_at')
            .single();

        if (error) throw new Error(error.message);
        return this.mapMessage(data as any);
    }

    async addParticipant(channelId: string, userId: string, role: 'member' | 'teacher'): Promise<void> {
        await this.supabase.db
            .from('channel_participants')
            .upsert({ channel_id: channelId, user_id: userId, role }, { onConflict: 'channel_id,user_id' });
    }

    async addTeacherToAllChannels(teacherId: string): Promise<void> {
        const channels = await this.getAllChannels();
        for (const ch of channels) {
            await this.addParticipant(ch.id, teacherId, 'teacher');
        }
        this.logger.log(`Teacher ${teacherId} added to ${channels.length} channels`);
    }

    /** Returns messages since the last analysis or all if never analyzed */
    async getUnanalyzedMessages(channelId: string): Promise<ChatMessage[]> {
        const { data: log } = await this.supabase.db
            .from('channel_analysis_log')
            .select('analyzed_at')
            .eq('channel_id', channelId)
            .order('analyzed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let query = this.supabase.db
            .from('chat_messages')
            .select('id, channel_id, sender_id, sender_name, is_bot, content, created_at')
            .eq('channel_id', channelId)
            .eq('is_bot', false)
            .order('created_at', { ascending: true });

        if (log) {
            query = query.gt('created_at', (log as any).analyzed_at);
        }

        const { data } = await query;
        return (data ?? []).map((r: any) => this.mapMessage(r));
    }

    async logAnalysis(channelId: string, messageCount: number, summary: string): Promise<void> {
        await this.supabase.db
            .from('channel_analysis_log')
            .insert({ channel_id: channelId, message_count: messageCount, summary });
    }

    // ── Private DUDE messages ──────────────────────────────────────────────────

    async savePrivateMessage(userId: string, role: 'student' | 'dude', content: string): Promise<void> {
        const { error } = await this.supabase.db
            .from('private_dude_messages')
            .insert({ user_id: userId, role, content });
        if (error) this.logger.warn('savePrivateMessage failed (migration 007 pending?)', error.message);
    }

    async getPrivateMessages(userId: string, limit = 100): Promise<{ id: string; role: 'student' | 'dude'; content: string; createdAt: string }[]> {
        const { data, error } = await this.supabase.db
            .from('private_dude_messages')
            .select('id, role, content, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) {
            this.logger.warn('getPrivateMessages failed (migration 007 pending?)', error.message);
            return [];
        }
        return (data ?? []).map((r: any) => ({ id: r.id, role: r.role, content: r.content, createdAt: r.created_at }));
    }

    async getUnanalyzedPrivateMessages(userId: string): Promise<{ id: string; role: 'student' | 'dude'; content: string }[]> {
        const { data, error } = await this.supabase.db
            .from('private_dude_messages')
            .select('id, role, content')
            .eq('user_id', userId)
            .eq('analyzed', false)
            .order('created_at', { ascending: true });

        if (error) {
            this.logger.warn('getUnanalyzedPrivateMessages failed (migration 007 pending?)', error.message);
            return [];
        }
        return (data ?? []).map((r: any) => ({ id: r.id, role: r.role, content: r.content }));
    }

    async markPrivateMessagesAnalyzed(userId: string): Promise<void> {
        const { error } = await this.supabase.db
            .from('private_dude_messages')
            .update({ analyzed: true })
            .eq('user_id', userId)
            .eq('analyzed', false);
        if (error) this.logger.warn('markPrivateMessagesAnalyzed failed', error.message);
    }

    private mapChannel(r: any): ChatChannel {
        return { id: r.id, teamId: r.team_id, name: r.name, createdAt: r.created_at };
    }

    private mapMessage(r: any): ChatMessage {
        return {
            id: r.id,
            channelId: r.channel_id,
            senderId: r.sender_id,
            senderName: r.sender_name,
            isBot: r.is_bot,
            content: r.content,
            createdAt: r.created_at,
        };
    }
}

```

---

## backend/src/chat/dto/send-message.dto.ts
**Type:** backend

```typescript
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
    @IsString()
    senderId!: string;

    @IsString()
    @IsNotEmpty()
    senderName!: string;

    @IsString()
    @IsNotEmpty()
    content!: string;
}

```

---

## backend/src/common/decorators/current-user.decorator.ts
**Type:** backend

```typescript
/**
 * `@CurrentUser()` parameter decorator.
 *
 * Extracts the AuthenticatedUser previously attached by the JwtAuthGuard.
 * Returns `undefined` on routes marked `@Public()` — callers must handle that
 * case explicitly.
 *
 * @version 1.00
 */

import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
        const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
        return req.user;
    },
);

```

---

## backend/src/common/decorators/public.decorator.ts
**Type:** backend

```typescript
/**
 * `@Public()` route decorator.
 *
 * Marks a route as exempt from the JwtAuthGuard. Used during the additive-
 * auth migration phase so existing endpoints stay reachable while the
 * frontend integrates login (see docs/AUTH.md).
 *
 * @version 1.00
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = (): MethodDecorator & ClassDecorator =>
    SetMetadata(IS_PUBLIC_KEY, true);

```

---

## backend/src/common/decorators/roles.decorator.ts
**Type:** backend

```typescript
/**
 * `@Roles(...)` route decorator.
 *
 * Declares which AccountTypes are allowed to call a route. Enforced by
 * RolesGuard — has no effect unless that guard is also applied.
 *
 * @version 1.00
 */

import { SetMetadata } from '@nestjs/common';
import { AccountType } from '../types/authenticated-user';

export const ROLES_KEY = 'requiredRoles';

export const Roles = (...roles: AccountType[]): MethodDecorator & ClassDecorator =>
    SetMetadata(ROLES_KEY, roles);

```

---

## backend/src/common/errors/domain-errors.ts
**Type:** backend

```typescript
/**
 * Domain-level error classes.
 *
 * These are thrown by services and translated to HTTP exceptions at the
 * controller boundary by NestJS's built-in exception filters. Keep them
 * framework-agnostic so the same services can be reused from a CLI or
 * future GraphQL layer.
 *
 * @version 1.00
 */

import {
    BadRequestException,
    HttpException,
    HttpStatus,
    UnauthorizedException,
} from '@nestjs/common';

export class GatekeeperError extends HttpException {
    constructor(reason: string, public readonly provider?: string) {
        super(`gatekeeper: ${reason}`, HttpStatus.BAD_GATEWAY);
        this.name = 'GatekeeperError';
    }
}

export class GatekeeperQueueFullError extends GatekeeperError {
    constructor(provider: string) {
        super(`queue full for provider "${provider}"`, provider);
        this.name = 'GatekeeperQueueFullError';
    }
}

export class GatekeeperTimeoutError extends GatekeeperError {
    constructor(provider: string) {
        super(`timeout calling provider "${provider}"`, provider);
        this.name = 'GatekeeperTimeoutError';
    }
}

export class InvalidCredentialsError extends UnauthorizedException {
    constructor() {
        super('Invalid credentials');
        this.name = 'InvalidCredentialsError';
    }
}

export class AccountLockedError extends UnauthorizedException {
    constructor(retryAfterSeconds: number) {
        super(`Account temporarily locked. Retry after ${retryAfterSeconds}s.`);
        this.name = 'AccountLockedError';
    }
}

export class AccountDisabledError extends UnauthorizedException {
    constructor() {
        super('Account is disabled');
        this.name = 'AccountDisabledError';
    }
}

export class InvalidRefreshTokenError extends UnauthorizedException {
    constructor() {
        super('Invalid or expired refresh token');
        this.name = 'InvalidRefreshTokenError';
    }
}

export class WeakPasswordError extends BadRequestException {
    constructor() {
        super('Password must be at least 8 characters and contain a letter and a digit');
        this.name = 'WeakPasswordError';
    }
}

export class EmailAlreadyTakenError extends BadRequestException {
    constructor() {
        super('Email is already in use');
        this.name = 'EmailAlreadyTakenError';
    }
}

```

---

## backend/src/common/types/authenticated-user.ts
**Type:** backend

```typescript
/**
 * Shape attached to `req.user` after the JwtAuthGuard verifies a request.
 *
 * The contents of this object are signed into the JWT payload at issue time,
 * so they reflect the user's state at login. Mutations to the user (role
 * change, account disabled) only take effect on the next access-token refresh.
 *
 * @version 1.00
 */

export type AccountType = 'student' | 'teacher' | 'admin';

export type WorkRole = 'pm' | 'qa' | 'dev' | 'hardware';

export interface AuthenticatedUser {
    /** users.id */
    readonly userId: string;
    /** users.email */
    readonly email: string;
    /** App-level role for RBAC. Distinct from work role. */
    readonly accountType: AccountType;
    /** Current in-team role. May be null for admins/teachers not on a team. */
    readonly currentRole: WorkRole | null;
    /** Currently active team. May be null for admins/teachers. */
    readonly currentTeamId: string | null;
}

export interface JwtAccessPayload extends AuthenticatedUser {
    /** issued-at, seconds since epoch */
    readonly iat: number;
    /** expiry, seconds since epoch */
    readonly exp: number;
    readonly iss: string;
    /** subject — user id, duplicated from userId for JWT-spec compatibility */
    readonly sub: string;
}

```

---

## backend/src/config/app-config.ts
**Type:** backend

```typescript
/**
 * Typed configuration for the TeamSprintUp backend.
 *
 * Single source of truth — every env var the app cares about is declared here
 * and validated at boot. Direct `process.env.X` reads outside this module are
 * a code smell (see docs/ARCHITECTURE.md).
 *
 * @version 1.00
 */

export const APP_CONFIG_VERSION = '1.00';

export type AuthProviderName = 'local' | 'firebase' | 'google';
export type IntegrationMode = 'mock' | 'real';

export interface ServerConfig {
    readonly port: number;
    readonly corsOrigins: readonly string[];
    readonly nodeEnv: 'development' | 'production' | 'test';
}

export interface DatabaseConfig {
    readonly url: string;
    readonly ssl: 'require' | 'disable';
    readonly poolMax: number;
}

export interface JwtConfig {
    readonly accessSecret: string;
    readonly accessTtlSeconds: number;
    readonly refreshTtlSeconds: number;
    readonly issuer: string;
}

export interface AuthConfig {
    readonly provider: AuthProviderName;
    readonly bcryptCost: number;
    readonly allowSelfRegistration: boolean;
    readonly maxFailedLogins: number;
    readonly lockoutWindowSeconds: number;
}

export interface IntegrationsConfig {
    readonly firebase: IntegrationMode;
    readonly storage: IntegrationMode;
    readonly techschool: IntegrationMode;
    readonly mondayApiToken: string;
    readonly mondayWebhookSecret: string;
    readonly azureOpenAiEndpoint: string;
    readonly azureOpenAiApiKey: string;
    readonly azureOpenAiDeployment: string;
    readonly azureOpenAiApiVersion: string;
    readonly azureOpenAiWhisperDeployment: string;
}

export interface GatekeeperOverrides {
    readonly anthropicRpm?: number;
    readonly mondayRpm?: number;
}

export interface AppConfig {
    readonly version: string;
    readonly server: ServerConfig;
    readonly database: DatabaseConfig;
    readonly jwt: JwtConfig;
    readonly auth: AuthConfig;
    readonly integrations: IntegrationsConfig;
    readonly gatekeeper: GatekeeperOverrides;
}

export class ConfigError extends Error {
    constructor(missingVars: string[]) {
        super(
            `Missing or invalid required env vars: ${missingVars.join(', ')}. ` +
            `See backend/.env.example.`,
        );
        this.name = 'ConfigError';
    }
}

const requiredEnv = (key: string, errors: string[]): string => {
    const v = process.env[key];
    if (!v || v.trim() === '') { errors.push(key); return ''; }
    return v;
};

const intEnv = (key: string, fallback: number): number => {
    const v = process.env[key];
    if (!v) return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
};

const boolEnv = (key: string, fallback: boolean): boolean => {
    const v = process.env[key]?.toLowerCase();
    if (v === undefined) return fallback;
    return v === 'true' || v === '1' || v === 'yes';
};

const enumEnv = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const v = process.env[key];
    return (v && (allowed as readonly string[]).includes(v)) ? (v as T) : fallback;
};

export function loadAppConfig(): AppConfig {
    const errors: string[] = [];
    const isTest = process.env.NODE_ENV === 'test';

    const databaseUrl = isTest
        ? (process.env.DATABASE_URL ?? 'postgresql://test@localhost/test?sslmode=disable')
        : requiredEnv('DATABASE_URL', errors);

    const accessSecret = isTest
        ? (process.env.JWT_ACCESS_SECRET ?? 'test-secret-not-for-production-do-not-ship')
        : requiredEnv('JWT_ACCESS_SECRET', errors);

    if (errors.length > 0) throw new ConfigError(errors);

    return {
        version: APP_CONFIG_VERSION,
        server: {
            port: intEnv('PORT', 3001),
            corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
                .split(',').map((o) => o.trim()).filter(Boolean),
            nodeEnv: enumEnv('NODE_ENV', ['development', 'production', 'test'] as const, 'development'),
        },
        database: {
            url: databaseUrl,
            ssl: databaseUrl.includes('sslmode=disable') ? 'disable' : 'require',
            poolMax: intEnv('DB_POOL_MAX', 5),
        },
        jwt: {
            accessSecret,
            accessTtlSeconds: intEnv('JWT_ACCESS_TTL_SECONDS', 15 * 60),
            refreshTtlSeconds: intEnv('JWT_REFRESH_TTL_SECONDS', 7 * 24 * 60 * 60),
            issuer: process.env.JWT_ISSUER ?? 'teamsprintup',
        },
        auth: {
            provider: enumEnv('AUTH_PROVIDER', ['local', 'firebase', 'google'] as const, 'local'),
            bcryptCost: intEnv('BCRYPT_COST', 12),
            allowSelfRegistration: boolEnv('ALLOW_SELF_REGISTRATION', false),
            maxFailedLogins: intEnv('AUTH_MAX_FAILED_LOGINS', 5),
            lockoutWindowSeconds: intEnv('AUTH_LOCKOUT_WINDOW_SECONDS', 15 * 60),
        },
        integrations: {
            firebase: enumEnv('FIREBASE_PROVIDER', ['mock', 'real'] as const, 'mock'),
            storage: enumEnv('STORAGE_PROVIDER', ['mock', 'real'] as const, 'mock'),
            techschool: enumEnv('TECHSCHOOL_PROVIDER', ['mock', 'real'] as const, 'mock'),
            mondayApiToken: process.env.MONDAY_API_TOKEN ?? '',
            mondayWebhookSecret: process.env.MONDAY_WEBHOOK_SECRET ?? '',
            azureOpenAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',
            azureOpenAiApiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
            azureOpenAiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o',
            azureOpenAiApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-02-15-preview',
            azureOpenAiWhisperDeployment: process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? 'whisper',
        },
        gatekeeper: {
            anthropicRpm: process.env.GATEKEEPER_AZURE_RPM ? intEnv('GATEKEEPER_AZURE_RPM', 60) : undefined,
            mondayRpm: process.env.GATEKEEPER_MONDAY_RPM ? intEnv('GATEKEEPER_MONDAY_RPM', 60) : undefined,
        },
    };
}

```

---

## backend/src/config/config.module.ts
**Type:** backend

```typescript
/**
 * Global config module.
 *
 * Loads {@link AppConfig} from environment variables once at application
 * boot, validates required vars, and exposes a typed {@link ConfigService}
 * to every other module via global injection.
 *
 * @version 1.00
 */

import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { AppConfig, loadAppConfig } from './app-config';

const APP_CONFIG = Symbol('APP_CONFIG');

@Global()
@Module({
    providers: [
        {
            provide: APP_CONFIG,
            useFactory: (): AppConfig => loadAppConfig(),
        },
        {
            provide: ConfigService,
            useFactory: (cfg: AppConfig) => new ConfigService(cfg),
            inject: [APP_CONFIG],
        },
    ],
    exports: [ConfigService],
})
export class ConfigModule {}

```

---

## backend/src/config/config.service.ts
**Type:** backend

```typescript
/**
 * Typed accessor for the loaded application config.
 *
 * Inject this anywhere config is needed instead of reading `process.env`
 * directly. The underlying AppConfig is loaded once at module init.
 *
 * @version 1.00
 */

import { Injectable } from '@nestjs/common';
import {
    AppConfig,
    AuthConfig,
    DatabaseConfig,
    IntegrationsConfig,
    JwtConfig,
    ServerConfig,
    GatekeeperOverrides,
} from './app-config';

@Injectable()
export class ConfigService {
    constructor(private readonly cfg: AppConfig) {}

    get version(): string { return this.cfg.version; }
    get server(): ServerConfig { return this.cfg.server; }
    get database(): DatabaseConfig { return this.cfg.database; }
    get jwt(): JwtConfig { return this.cfg.jwt; }
    get auth(): AuthConfig { return this.cfg.auth; }
    get integrations(): IntegrationsConfig { return this.cfg.integrations; }
    get gatekeeper(): GatekeeperOverrides { return this.cfg.gatekeeper; }

    get isProduction(): boolean { return this.cfg.server.nodeEnv === 'production'; }
    get isTest(): boolean { return this.cfg.server.nodeEnv === 'test'; }

    /** Snapshot suitable for /health responses — strips secrets. */
    publicSummary(): Record<string, unknown> {
        return {
            version: this.cfg.version,
            nodeEnv: this.cfg.server.nodeEnv,
            authProvider: this.cfg.auth.provider,
            integrations: {
                firebase: this.cfg.integrations.firebase,
                storage: this.cfg.integrations.storage,
                techschool: this.cfg.integrations.techschool,
                monday: this.cfg.integrations.mondayApiToken ? 'configured' : 'mock',
                azure: this.cfg.integrations.azureOpenAiApiKey ? 'configured' : 'mock',
            },
        };
    }
}

```

---

## backend/src/dude/dude.controller.ts
**Type:** backend

```typescript
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DudeService } from './dude.service';
import { ChatService } from '../chat/chat.service';
import { SendMessageDto } from '../chat/dto/send-message.dto';

class PrivateChatHistoryItem {
    @IsIn(['user', 'assistant'])
    role!: 'user' | 'assistant';

    @IsString()
    content!: string;
}

class PrivateChatDto {
    @IsString()
    message!: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PrivateChatHistoryItem)
    history!: PrivateChatHistoryItem[];
}

@Controller('dude')
export class DudeController {
    constructor(
        private readonly dude: DudeService,
        private readonly chat: ChatService,
    ) {}

    /**
     * POST /dude/channels/:channelId/messages
     * Sends a student message and optionally triggers a DUDE response.
     */
    @Post('channels/:channelId/messages')
    async sendAndRespond(
        @Param('channelId') channelId: string,
        @Body() dto: SendMessageDto,
    ) {
        const saved = await this.chat.sendMessage(channelId, dto.senderId, dto.senderName, dto.content);
        // Fire-and-forget: DUDE response is async, client polls for new messages
        this.dude.onStudentMessage(channelId, saved).catch(() => undefined);
        return saved;
    }

    /**
     * POST /dude/channels/:channelId/analyze
     * Triggers a full conversation analysis for the channel.
     * Called by the teacher or an idle-detection hook.
     */
    @Post('channels/:channelId/analyze')
    @HttpCode(200)
    analyzeChannel(@Param('channelId') channelId: string) {
        return this.dude.analyzeChannel(channelId);
    }

    /**
     * POST /dude/private/:userId/chat
     * Private 1-on-1 mentor chat with DUDE.
     * Both sides are persisted to private_dude_messages.
     */
    @Post('private/:userId/chat')
    @HttpCode(200)
    async privateChat(
        @Param('userId') userId: string,
        @Body() dto: PrivateChatDto,
    ) {
        const reply = await this.dude.privateMentorChat(userId, dto.message, dto.history);
        return { reply };
    }

    /**
     * GET /dude/private/:userId/messages
     * Returns the private conversation history for a student (teacher view).
     */
    @Get('private/:userId/messages')
    getPrivateMessages(@Param('userId') userId: string) {
        return this.chat.getPrivateMessages(userId);
    }

    /**
     * POST /dude/private/:userId/analyze
     * Teacher-triggered analysis of a student's private DUDE conversation.
     */
    @Post('private/:userId/analyze')
    @HttpCode(200)
    analyzePrivate(@Param('userId') userId: string) {
        return this.dude.analyzePrivate(userId);
    }
}

```

---

## backend/src/dude/dude.module.ts
**Type:** backend

```typescript
import { Module } from '@nestjs/common';
import { DudeService } from './dude.service';
import { DudeController } from './dude.controller';
import { ChatModule } from '../chat/chat.module';
import { AIModule } from '../integrations/ai/ai.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';

@Module({
    imports: [ChatModule, AIModule, StudentProfileModule],
    providers: [DudeService],
    controllers: [DudeController],
    exports: [DudeService],
})
export class DudeModule {}

```

---

## backend/src/dude/dude.service.ts
**Type:** backend

```typescript
/**
 * DudeService — orchestrates the DUDE AI bot.
 *
 * Group chat policy (v2):
 *   • DUDE no longer posts messages in group channels.
 *   • Analysis still runs silently every AUTO_ANALYZE_INTERVAL student messages.
 *   • Teacher can trigger analysis manually via POST /dude/channels/:id/analyze.
 *   • Private 1-on-1 mentor chat is unchanged.
 *
 * @version 2.00
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChatService, ChatMessage } from '../chat/chat.service';
import { AIService } from '../integrations/ai/ai.service';
import { StudentProfileService } from '../student-profile/student-profile.service';

const AUTO_ANALYZE_GROUP_INTERVAL = 10;
const AUTO_ANALYZE_PRIVATE_INTERVAL = 5;

@Injectable()
export class DudeService {
    private readonly logger = new Logger(DudeService.name);

    /** In-memory counters for auto-analysis triggers */
    private readonly groupAnalyzeCounters   = new Map<string, number>();
    private readonly privateAnalyzeCounters = new Map<string, number>();

    constructor(
        private readonly chat: ChatService,
        private readonly ai: AIService,
        private readonly profiles: StudentProfileService,
    ) {}

    /**
     * Called after each student message is saved.
     * Silently triggers background analysis every AUTO_ANALYZE_GROUP_INTERVAL messages.
     * Does NOT post any bot reply to the group channel.
     */
    async onStudentMessage(channelId: string, message: ChatMessage): Promise<void> {
        if (message.isBot) return;

        const count = (this.groupAnalyzeCounters.get(channelId) ?? 0) + 1;
        this.groupAnalyzeCounters.set(channelId, count);
        if (count >= AUTO_ANALYZE_GROUP_INTERVAL) {
            this.groupAnalyzeCounters.set(channelId, 0);
            this.analyzeChannel(channelId).catch(() => undefined);
        }
    }

    /**
     * Private 1-on-1 chat with DUDE.
     * Persists both sides to private_dude_messages and auto-analyzes every N exchanges.
     */
    async privateMentorChat(
        userId: string,
        message: string,
        history: { role: 'user' | 'assistant'; content: string }[],
    ): Promise<string> {
        // Save student message
        this.chat.savePrivateMessage(userId, 'student', message).catch(() => undefined);

        const reply = await this.ai.privateMentorChat(message, history);

        // Save DUDE reply
        this.chat.savePrivateMessage(userId, 'dude', reply).catch(() => undefined);

        // Auto-analyze private chat every AUTO_ANALYZE_PRIVATE_INTERVAL student messages
        const count = (this.privateAnalyzeCounters.get(userId) ?? 0) + 1;
        this.privateAnalyzeCounters.set(userId, count);
        if (count >= AUTO_ANALYZE_PRIVATE_INTERVAL) {
            this.privateAnalyzeCounters.set(userId, 0);
            this.analyzePrivate(userId).catch(() => undefined);
        }

        return reply;
    }

    /**
     * Full channel analysis — called by teacher or on idle trigger.
     * Updates every participant's student profile and logs the analysis.
     */
    async analyzeChannel(channelId: string): Promise<{ analyzed: number; summary: string }> {
        const messages = await this.chat.getUnanalyzedMessages(channelId);

        if (messages.length === 0) {
            return { analyzed: 0, summary: 'No new messages to analyze.' };
        }

        // Group messages by sender
        const bySender = new Map<string, { senderId: string; senderName: string; messages: string[] }>();
        for (const m of messages) {
            if (!m.senderId) continue;
            const entry = bySender.get(m.senderId) ?? { senderId: m.senderId, senderName: m.senderName, messages: [] };
            entry.messages.push(m.content);
            bySender.set(m.senderId, entry);
        }

        const summaryParts: string[] = [];

        for (const { senderId, senderName, messages: texts } of bySender.values()) {
            try {
                const result = await this.ai.analyzeConversation(texts, senderId);
                await this.profiles.updateFromAnalysis(senderId, result, channelId);
                summaryParts.push(`${senderName}: jargon=${result.jargonScore}, soft=${result.softSkillScore}`);
                this.logger.log(`Profile updated for ${senderName} (${senderId})`);
            } catch (err) {
                this.logger.error(`Profile update failed for ${senderId}`, (err as Error).message);
            }
        }

        const summary = summaryParts.join(' | ') || 'Analysis complete.';
        await this.chat.logAnalysis(channelId, messages.length, summary);
        return { analyzed: messages.length, summary };
    }

    /**
     * Analyzes unanalyzed private DUDE messages for a single student.
     * Called by teacher or auto-triggered every AUTO_ANALYZE_PRIVATE_INTERVAL messages.
     */
    async analyzePrivate(userId: string): Promise<{ analyzed: number; summary: string }> {
        const messages = await this.chat.getUnanalyzedPrivateMessages(userId);
        const studentMessages = messages.filter((m) => m.role === 'student');

        if (studentMessages.length === 0) {
            return { analyzed: 0, summary: 'No new private messages to analyze.' };
        }

        try {
            const texts = studentMessages.map((m) => m.content);
            const result = await this.ai.analyzeConversation(texts, userId);
            await this.profiles.updateFromAnalysis(userId, result, undefined);
            await this.chat.markPrivateMessagesAnalyzed(userId);
            const summary = `private: jargon=${result.jargonScore}, soft=${result.softSkillScore}`;
            this.logger.log(`Private analysis done for ${userId}: ${summary}`);
            return { analyzed: studentMessages.length, summary };
        } catch (err) {
            this.logger.error(`Private analysis failed for ${userId}`, (err as Error).message);
            return { analyzed: 0, summary: 'Analysis failed.' };
        }
    }
}

```

---

## backend/src/gatekeeper/gatekeeper.module.ts
**Type:** backend

```typescript
/**
 * Global gatekeeper module — every module can inject GatekeeperService.
 *
 * @version 1.00
 */

import { Global, Module } from '@nestjs/common';
import { GatekeeperService } from './gatekeeper.service';

@Global()
@Module({
    providers: [GatekeeperService],
    exports: [GatekeeperService],
})
export class GatekeeperModule {}

```

---

## backend/src/gatekeeper/gatekeeper.service.ts
**Type:** backend

```typescript
/**
 * GatekeeperService — the single chokepoint for outbound API calls.
 *
 * Every outbound HTTP / SDK call from the backend goes through
 * `gatekeeper.execute(provider, fn)`. The service applies:
 *   - per-provider FIFO queue with token-bucket rate limiting
 *   - per-attempt timeout
 *   - exponential-backoff retries with jitter
 *   - structured log line per call
 *
 * See docs/GATEKEEPER.md for the design.
 *
 * @version 1.00
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
    GatekeeperError,
    GatekeeperTimeoutError,
} from '../common/errors/domain-errors';
import { ConfigService } from '../config/config.service';
import { ProviderQueue } from './queue';
import { withRetry } from './retry';
import {
    DEFAULT_PROVIDER_CONFIGS,
    applyOverrides,
} from './providers.config';
import { ProviderConfig, ProviderName } from './types';

@Injectable()
export class GatekeeperService implements OnModuleDestroy {
    private readonly logger = new Logger(GatekeeperService.name);
    private readonly queues: Map<ProviderName, ProviderQueue> = new Map();
    private readonly configs: Readonly<Record<ProviderName, ProviderConfig>>;

    constructor(private readonly config: ConfigService) {
        this.configs = applyOverrides(DEFAULT_PROVIDER_CONFIGS, this.config.gatekeeper);
        for (const name of Object.keys(this.configs) as ProviderName[]) {
            this.queues.set(name, new ProviderQueue(this.configs[name]));
        }
    }

    /**
     * Run `fn` against the named provider. Resolves with `fn`'s value or
     * rejects with a {@link GatekeeperError} if all retries are exhausted.
     */
    async execute<T>(provider: ProviderName, fn: () => Promise<T>): Promise<T> {
        const cfg = this.configs[provider];
        if (!cfg) throw new GatekeeperError(`unknown provider "${provider}"`);
        const queue = this.queues.get(provider)!;
        const startedAt = Date.now();

        let queueWaitMs = 0;
        let attempts = 0;
        try {
            queueWaitMs = await queue.acquire();
            const wrapped = (): Promise<T> => this.withTimeout(provider, cfg.timeoutMs, fn);
            const result = await withRetry(wrapped, cfg);
            attempts = result.attempts;
            this.logCall(provider, startedAt, attempts, 'ok', queueWaitMs);
            return result.value;
        } catch (err) {
            this.logCall(
                provider,
                startedAt,
                Math.max(1, attempts),
                'error',
                queueWaitMs,
                err,
            );
            if (err instanceof GatekeeperError) throw err;
            throw new GatekeeperError(
                (err as Error).message ?? 'unknown error',
                provider,
            );
        }
    }

    private async withTimeout<T>(
        provider: ProviderName,
        ms: number,
        fn: () => Promise<T>,
    ): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new GatekeeperTimeoutError(provider)), ms);
        });
        try {
            return await Promise.race([fn(), timeout]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    private logCall(
        provider: ProviderName,
        startedAt: number,
        attempts: number,
        outcome: 'ok' | 'error',
        queueWaitMs: number,
        err?: unknown,
    ): void {
        const e = err as Error | undefined;
        const entry = {
            evt: 'gatekeeper.call',
            provider,
            durationMs: Date.now() - startedAt,
            attempts,
            outcome,
            queueWaitMs,
            ...(e && { errorClass: e.name, errorMsg: e.message }),
        };
        if (outcome === 'ok') this.logger.log(JSON.stringify(entry));
        else this.logger.warn(JSON.stringify(entry));
    }

    /** Inspect-only — useful for /health and tests. */
    snapshot(): Record<string, { pending: number; tokens: number }> {
        const out: Record<string, { pending: number; tokens: number }> = {};
        for (const [name, q] of this.queues) {
            out[name] = { pending: q.pendingCount, tokens: q.availableTokens };
        }
        return out;
    }

    onModuleDestroy(): void {
        for (const q of this.queues.values()) q.drainForShutdown('app shutting down');
    }
}

```

---

## backend/src/gatekeeper/providers.config.ts
**Type:** backend

```typescript
/**
 * Per-provider gatekeeper policy.
 *
 * Tuneable via env vars (see app-config.ts) — these are the defaults used
 * when no override is set.
 *
 * @version 1.00
 */

import { ProviderConfig, ProviderName } from './types';

const def = (
    name: ProviderName,
    overrides: Partial<ProviderConfig>,
): ProviderConfig => ({
    name,
    rateLimitPerMinute: 60,
    burstSize: 10,
    timeoutMs: 30_000,
    maxRetries: 2,
    retryBackoffMs: 500,
    retryOnStatus: [429, 502, 503, 504],
    queueOverflowStrategy: 'fifo',
    maxQueueDepth: 100,
    ...overrides,
});

export const DEFAULT_PROVIDER_CONFIGS: Readonly<Record<ProviderName, ProviderConfig>> = {
    azure:      def('azure',      { rateLimitPerMinute: 60, timeoutMs: 30_000, maxRetries: 2 }),
    monday:     def('monday',     { rateLimitPerMinute: 60, timeoutMs: 10_000, maxRetries: 3 }),
    firebase:   def('firebase',   { rateLimitPerMinute: 600, timeoutMs: 5_000, maxRetries: 1 }),
    storage:    def('storage',    { rateLimitPerMinute: 200, timeoutMs: 30_000, maxRetries: 3 }),
    techschool: def('techschool', { rateLimitPerMinute: 30, timeoutMs: 10_000, maxRetries: 2 }),
};

export function applyOverrides(
    base: Readonly<Record<ProviderName, ProviderConfig>>,
    overrides: { anthropicRpm?: number; mondayRpm?: number },
): Readonly<Record<ProviderName, ProviderConfig>> {
    const out: Record<ProviderName, ProviderConfig> = { ...base };
    if (overrides.anthropicRpm) {
        out.azure = { ...out.azure, rateLimitPerMinute: overrides.anthropicRpm };
    }
    if (overrides.mondayRpm) {
        out.monday = { ...out.monday, rateLimitPerMinute: overrides.mondayRpm };
    }
    return out;
}

```

---

## backend/src/gatekeeper/queue.ts
**Type:** backend

```typescript
/**
 * Per-provider FIFO queue with token-bucket rate limiting.
 *
 * One instance per provider. `acquire()` resolves either immediately (a token
 * was available) or after waiting in the FIFO until a token replenishes.
 * Returns the time spent waiting so the gatekeeper can log it.
 *
 * In-memory only — see docs/GATEKEEPER.md for scaling notes.
 *
 * @version 1.00
 */

import { GatekeeperQueueFullError } from '../common/errors/domain-errors';
import { ProviderConfig } from './types';

interface Waiter {
    readonly enqueuedAt: number;
    readonly resolve: (waitedMs: number) => void;
    readonly reject: (err: Error) => void;
}

export class ProviderQueue {
    private tokens: number;
    private lastRefill: number;
    private readonly waiters: Waiter[] = [];
    private timer?: ReturnType<typeof setTimeout>;

    constructor(private readonly cfg: ProviderConfig, now: () => number = Date.now) {
        this.tokens = cfg.burstSize;
        this.lastRefill = now();
        this.now = now;
    }

    private readonly now: () => number;

    /** Block until a token is available. Returns ms spent queued. */
    async acquire(): Promise<number> {
        this.refill();

        if (this.tokens >= 1 && this.waiters.length === 0) {
            this.tokens -= 1;
            return 0;
        }

        if (this.waiters.length >= this.cfg.maxQueueDepth) {
            if (this.cfg.queueOverflowStrategy === 'reject') {
                throw new GatekeeperQueueFullError(this.cfg.name);
            }
            // fifo: drop the oldest waiter to make room
            const dropped = this.waiters.shift();
            dropped?.reject(new GatekeeperQueueFullError(this.cfg.name));
        }

        return new Promise<number>((resolve, reject) => {
            this.waiters.push({ enqueuedAt: this.now(), resolve, reject });
            this.scheduleNextDrain();
        });
    }

    private refill(): void {
        const now = this.now();
        const elapsedMs = now - this.lastRefill;
        if (elapsedMs <= 0) return;
        const tokensPerMs = this.cfg.rateLimitPerMinute / 60_000;
        const earned = elapsedMs * tokensPerMs;
        this.tokens = Math.min(this.cfg.burstSize, this.tokens + earned);
        this.lastRefill = now;
    }

    private scheduleNextDrain(): void {
        if (this.timer) return;
        const tokensPerMs = this.cfg.rateLimitPerMinute / 60_000;
        const msUntilToken = Math.max(1, Math.ceil((1 - this.tokens) / tokensPerMs));
        this.timer = setTimeout(() => {
            this.timer = undefined;
            this.drain();
        }, msUntilToken);
    }

    private drain(): void {
        this.refill();
        while (this.tokens >= 1 && this.waiters.length > 0) {
            const w = this.waiters.shift()!;
            this.tokens -= 1;
            w.resolve(this.now() - w.enqueuedAt);
        }
        if (this.waiters.length > 0) this.scheduleNextDrain();
    }

    /** For tests / shutdown — reject all pending waiters and clear timer. */
    drainForShutdown(reason: string): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
        for (const w of this.waiters) w.reject(new Error(reason));
        this.waiters.length = 0;
    }

    get pendingCount(): number { return this.waiters.length; }
    get availableTokens(): number { return this.tokens; }
}

```

---

## backend/src/gatekeeper/retry.ts
**Type:** backend

```typescript
/**
 * Retry helper for the gatekeeper.
 *
 * Implements exponential backoff with full jitter. Honours `Retry-After`
 * (in seconds) when the underlying error exposes it.
 *
 * @version 1.00
 */

import { ProviderConfig, RetryableError } from './types';

const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

export function shouldRetry(err: unknown, cfg: ProviderConfig): boolean {
    const e = err as RetryableError | undefined;
    if (!e) return false;
    if (typeof e.status === 'number' && cfg.retryOnStatus.includes(e.status)) return true;
    if (typeof e.code === 'string') {
        // node fetch / network errors
        const networkCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_SOCKET'];
        if (networkCodes.includes(e.code)) return true;
    }
    return false;
}

/**
 * Compute the next backoff delay. Honours `Retry-After` from the error if
 * present, otherwise uses exponential backoff with full jitter:
 *   delay = random(0, base * 2^(attempt - 1))
 */
export function nextDelayMs(attempt: number, cfg: ProviderConfig, err?: unknown): number {
    const e = err as RetryableError | undefined;
    if (e?.retryAfterSeconds && Number.isFinite(e.retryAfterSeconds)) {
        return Math.max(0, Math.floor(e.retryAfterSeconds * 1000));
    }
    const ceiling = cfg.retryBackoffMs * Math.pow(2, Math.max(0, attempt - 1));
    return Math.floor(Math.random() * ceiling);
}

/**
 * Run `fn` with retry policy. Returns the value or rethrows after the final
 * attempt. The number of attempts is `1 + cfg.maxRetries`.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    cfg: ProviderConfig,
): Promise<{ value: T; attempts: number }> {
    let lastErr: unknown;
    const totalAttempts = 1 + cfg.maxRetries;
    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
        try {
            const value = await fn();
            return { value, attempts: attempt };
        } catch (err) {
            lastErr = err;
            if (attempt === totalAttempts) break;
            if (!shouldRetry(err, cfg)) break;
            await wait(nextDelayMs(attempt, cfg, err));
        }
    }
    throw lastErr;
}

```

---

## backend/src/gatekeeper/types.ts
**Type:** backend

```typescript
/**
 * Gatekeeper types — provider configuration, request shape, log entry.
 *
 * See docs/GATEKEEPER.md for the design rationale.
 *
 * @version 1.00
 */

export type ProviderName =
    | 'azure'
    | 'monday'
    | 'firebase'
    | 'storage'
    | 'techschool';

export type QueueOverflowStrategy = 'fifo' | 'reject';

export interface ProviderConfig {
    readonly name: ProviderName;
    readonly rateLimitPerMinute: number;
    readonly burstSize: number;
    readonly timeoutMs: number;
    readonly maxRetries: number;
    readonly retryBackoffMs: number;
    readonly retryOnStatus: readonly number[];
    readonly queueOverflowStrategy: QueueOverflowStrategy;
    readonly maxQueueDepth: number;
}

export interface GatekeeperLogEntry {
    readonly evt: 'gatekeeper.call';
    readonly provider: ProviderName;
    readonly durationMs: number;
    readonly attempts: number;
    readonly outcome: 'ok' | 'error';
    readonly queueWaitMs: number;
    readonly errorClass?: string;
    readonly errorMsg?: string;
}

/**
 * Lightweight error shape used to detect retry-eligible failures from the
 * caller's `fn`. The gatekeeper inspects `.status` (HTTP) and `.code` (network)
 * and falls back to retrying any thrown Error if `retryOnStatus` is empty.
 */
export interface RetryableError extends Error {
    readonly status?: number;
    readonly code?: string;
    readonly retryAfterSeconds?: number;
}

```

---

## backend/src/hints/dto/request-hint.dto.ts
**Type:** backend

```typescript
import { IsString, IsOptional } from 'class-validator';

export class RequestHintDto {
    @IsString()
    userId!: string;

    @IsString()
    teamId!: string;

    @IsString()
    @IsOptional()
    taskId?: string;

    @IsString()
    @IsOptional()
    taskDescription?: string;

    @IsString()
    @IsOptional()
    context?: string;
}

```

---

## backend/src/hints/hints.controller.ts
**Type:** backend

```typescript
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { HintsService } from './hints.service';
import { RequestHintDto } from './dto/request-hint.dto';

@Controller('hints')
export class HintsController {
    constructor(private readonly hints: HintsService) {}

    @Post()
    @HttpCode(200)
    requestHint(@Body() dto: RequestHintDto) {
        return this.hints.requestHint(dto);
    }

    @Get('count')
    getCount(
        @Query('userId') userId: string,
        @Query('teamId') teamId: string,
    ) {
        return this.hints.getHintCount(userId, teamId).then((count) => ({ count }));
    }

    @Get('history')
    getHistory(
        @Query('userId') userId: string,
        @Query('teamId') teamId: string,
    ) {
        return this.hints.getHintHistory(userId, teamId);
    }
}

```

---

## backend/src/hints/hints.module.ts
**Type:** backend

```typescript
import { Module } from '@nestjs/common';
import { HintsService } from './hints.service';
import { HintsController } from './hints.controller';
import { AIModule } from '../integrations/ai/ai.module';
import { RagModule } from '../rag/rag.module';

@Module({
    imports: [AIModule, RagModule],
    providers: [HintsService],
    controllers: [HintsController],
})
export class HintsModule {}

```

---

## backend/src/hints/hints.service.ts
**Type:** backend

```typescript
import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AIService } from '../integrations/ai/ai.service';
import { RagService } from '../rag/rag.service';
import { RequestHintDto } from './dto/request-hint.dto';

const FREE_HINTS = 3;
const POINTS_PER_EXTRA_HINT = 10;

export interface HintResponse {
    hint: string;
    hintNumber: number;
    hintsRemaining: number;
    pointsDeducted: number;
    isFree: boolean;
}

@Injectable()
export class HintsService {
    private readonly logger = new Logger(HintsService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly aiService: AIService,
        private readonly rag: RagService,
    ) {}

    async requestHint(dto: RequestHintDto): Promise<HintResponse> {
        const context = await this.rag.buildContext(
            dto.taskId ?? '',
            dto.userId,
            dto.teamId,
        );

        const hintNumber = context.hintNumber;
        const hint = await this.aiService.generateHint(context);
        const pointsDeducted = hintNumber > FREE_HINTS ? POINTS_PER_EXTRA_HINT : 0;

        const { error: logError } = await this.supabase.db
            .from('hint_logs')
            .insert({
                user_id: dto.userId,
                team_id: dto.teamId,
                task_id: dto.taskId ?? null,
                hint_number: hintNumber,
                hint_text: hint,
                points_deducted: pointsDeducted,
            });

        if (logError) {
            this.logger.error('Failed to log hint', logError.message);
        }

        const { error: counterError } = await this.supabase.db
            .from('team_hint_counters')
            .upsert(
                { user_id: dto.userId, team_id: dto.teamId, hint_count: hintNumber },
                { onConflict: 'user_id,team_id' },
            );

        if (counterError) {
            this.logger.error('Failed to update hint counter', counterError.message);
        }

        if (pointsDeducted > 0) {
            const { error: rpcError } = await this.supabase.db.rpc(
                'deduct_team_score',
                { p_team_id: dto.teamId, p_amount: pointsDeducted },
            );

            if (rpcError) {
                this.logger.error('Failed to deduct team score', rpcError.message);
            } else {
                this.logger.log(
                    `Deducted ${pointsDeducted} pts from team ${dto.teamId} (hint #${hintNumber})`,
                );
            }
        }

        return {
            hint,
            hintNumber,
            hintsRemaining: Math.max(0, FREE_HINTS - hintNumber),
            pointsDeducted,
            isFree: hintNumber <= FREE_HINTS,
        };
    }

    async getHintCount(userId: string, teamId: string): Promise<number> {
        const { data } = await this.supabase.db
            .from('team_hint_counters')
            .select('hint_count')
            .eq('user_id', userId)
            .eq('team_id', teamId)
            .maybeSingle();

        return data?.hint_count ?? 0;
    }

    async getHintHistory(userId: string, teamId: string): Promise<unknown[]> {
        const { data, error } = await this.supabase.db
            .from('hint_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('team_id', teamId)
            .order('created_at', { ascending: true });

        if (error) throw new InternalServerErrorException(error.message);
        return data ?? [];
    }
}

```

---

## backend/src/integrations/ai/ai.module.ts
**Type:** backend

```typescript
/**
 * Anthropic Claude integration module.
 *
 * AIService is exported globally? No — exported on demand. Hints module
 * imports it; nothing else needs Claude directly.
 *
 * @version 1.10
 */

import { Module } from '@nestjs/common';
import { AIService } from './ai.service';

@Module({
    providers: [AIService],
    exports: [AIService],
})
export class AIModule {}

```

---

## backend/src/integrations/ai/ai.service.ts
**Type:** backend

```typescript
/**
 * AIService — domain-level methods backed by Azure OpenAI.
 *
 * All requests are routed through GatekeeperService — never call
 * `this.client` directly outside `gatekeeper.execute(...)`.
 *
 * Falls back to a deterministic mock string when no API key is configured,
 * so local dev and offline demos still work end-to-end.
 *
 * @version 1.20
 */

import { Injectable, Logger } from '@nestjs/common';
import { AzureOpenAI, toFile } from 'openai';
import type { HintContext } from '../../rag/rag.service';
import { ConfigService } from '../../config/config.service';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';

export interface AIAnalysisRequest {
    text: string;
    context?: Record<string, unknown>;
}

export interface AIAnalysisResult {
    jargonScore: number;
    softSkillScore: number;
    detectedTerms: string[];
    suggestions: string[];
    struggleAreas: string[];
    alertLevel: 'none' | 'low' | 'medium' | 'high';
    alertMessage: string;
    rawResponse: unknown;
}

const HINT_UNAVAILABLE = 'Hint unavailable right now. Try again in a moment.';

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);
    private readonly client: AzureOpenAI | null;
    private readonly deployment: string;
    private readonly whisperDeployment: string;
    private readonly enabled: boolean;

    constructor(
        private readonly config: ConfigService,
        private readonly gatekeeper: GatekeeperService,
    ) {
        const {
            azureOpenAiEndpoint,
            azureOpenAiApiKey,
            azureOpenAiDeployment,
            azureOpenAiApiVersion,
            azureOpenAiWhisperDeployment,
        } = this.config.integrations;

        this.enabled = azureOpenAiEndpoint.length > 0 && azureOpenAiApiKey.length > 0;
        this.deployment = azureOpenAiDeployment;
        this.whisperDeployment = azureOpenAiWhisperDeployment;

        this.client = this.enabled
            ? new AzureOpenAI({
                  endpoint: azureOpenAiEndpoint,
                  apiKey: azureOpenAiApiKey,
                  apiVersion: azureOpenAiApiVersion,
                  deployment: azureOpenAiDeployment,
              })
            : null;

        if (!this.enabled) {
            this.logger.warn('AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY not set — AI calls will return mock responses');
        }
    }

    async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
        if (!this.client) {
            return {
                jargonScore: 0,
                softSkillScore: 0,
                detectedTerms: [],
                suggestions: ['AI analysis disabled — Azure OpenAI not configured'],
                struggleAreas: [],
                alertLevel: 'none' as const,
                alertMessage: '',
                rawResponse: null,
            };
        }

        const systemPrompt =
            `You are an educational assistant for a hi-tech simulation platform (Tech School).\n` +
            `Analyze the provided student messages and return ONLY a valid JSON object (no markdown):\n` +
            `{\n` +
            `  "jargonScore": <0-100>,\n` +
            `  "softSkillScore": <0-100>,\n` +
            `  "detectedTerms": ["tech term 1", ...],\n` +
            `  "suggestions": ["pedagogical suggestion 1", ...],\n` +
            `  "struggleAreas": ["specific topic/task the student struggled with", ...],\n` +
            `  "alertLevel": "none|low|medium|high",\n` +
            `  "alertMessage": "Brief Hebrew sentence for the teacher about this student"\n` +
            `}\n` +
            `jargonScore: professional tech jargon usage (higher = more).\n` +
            `softSkillScore: communication clarity & collaboration (higher = better).\n` +
            `struggleAreas: specific topics, tools, or tasks where student showed confusion or repeated questions. Empty array if none.\n` +
            `alertLevel: none=all good, low=minor confusion, medium=needs check-in, high=clearly stuck or frustrated.\n` +
            `alertMessage: if alertLevel != none, write a short Hebrew sentence for the teacher (e.g. "התלמיד מתקשה עם ייצוא STL"). Otherwise empty string.\n` +
            `Context: ${JSON.stringify(request.context ?? {})}`;

        try {
            const response = await this.gatekeeper.execute('azure', () =>
                this.client!.chat.completions.create({
                    model: this.deployment,
                    max_tokens: 512,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: request.text },
                    ],
                }),
            );
            const raw = response.choices[0]?.message?.content ?? '{}';
            const parsed = JSON.parse(raw) as Partial<AIAnalysisResult>;
            return {
                jargonScore: parsed.jargonScore ?? 0,
                softSkillScore: parsed.softSkillScore ?? 0,
                detectedTerms: parsed.detectedTerms ?? [],
                suggestions: parsed.suggestions ?? [],
                struggleAreas: parsed.struggleAreas ?? [],
                alertLevel: parsed.alertLevel ?? 'none',
                alertMessage: parsed.alertMessage ?? '',
                rawResponse: parsed,
            };
        } catch (err) {
            this.logger.error('AI analysis failed', (err as Error).message);
            return {
                jargonScore: 0,
                softSkillScore: 0,
                detectedTerms: [],
                suggestions: ['AI analysis temporarily unavailable'],
                struggleAreas: [],
                alertLevel: 'none' as const,
                alertMessage: '',
                rawResponse: null,
            };
        }
    }

    async generateHint(ctx: HintContext): Promise<string> {
        if (!this.client) return this.mockHint(ctx);

        const systemPrompt = this.buildHintSystemPrompt(ctx);
        const userMessage = `תן Hint #${ctx.hintNumber} למשימה: "${ctx.taskTitle}"`;

        try {
            const response = await this.gatekeeper.execute('azure', () =>
                this.client!.chat.completions.create({
                    model: this.deployment,
                    max_tokens: 300,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage },
                    ],
                }),
            );
            return response.choices[0]?.message?.content ?? HINT_UNAVAILABLE;
        } catch (err) {
            this.logger.error('generateHint failed', (err as Error).message);
            return HINT_UNAVAILABLE;
        }
    }

    private buildHintSystemPrompt(ctx: HintContext): string {
        const { syllabus, teamProgress, hintNumber, isLastFreeHint, isOverFreeLimit } = ctx;
        const techniquesBlock = syllabus.fusion360Techniques
            .map((t) => `  • ${t.name} — ${t.hebrewDescription} (${t.sprintRelevance})`)
            .join('\n');
        const depthInstruction =
            hintNumber === 1
                ? 'Hint #1: כוון לכיוון הכללי — שם הכלי או העקרון הרלוונטי, בלי לפרט.'
                : hintNumber === 2
                ? 'Hint #2: תן כיוון ספציפי יותר — איזה כלי להשתמש ואיך לגשת אליו.'
                : 'Hint #3+: תלמיד/ה מתקשה — תן צעד מעשי וישיר עם הנחיה ממוקדת.';
        const costNotice = isLastFreeHint
            ? '\n⚠️ זהו ה-Hint החינמי האחרון. רמז נוסף יעלה 10 נקודות לצוות.'
            : isOverFreeLimit
            ? `\n💸 Hint #${hintNumber} — נוכו 10 נקודות מהצוות.`
            : '';

        return `
אתה מנטור תומך ב-Tech School — תוכנית תלת-מימד לנוער.
תפקידך: לעזור לתלמיד/ה להתקדם מבלי לתת את התשובה ישירות.

═══════════════════════════════════
📚 SYLLABUS — ${syllabus.hebrewTitle}
═══════════════════════════════════
תקופה: ${syllabus.period} | מפגשים: ${syllabus.sessionsCount}
מטרת האתגר: ${syllabus.cblGoal}
נושאי ליבה: ${syllabus.coreTopics.join(' | ')}
אירוע שיא: ${syllabus.peakEvent}
הגשה: ${syllabus.submissionNote}

כלי Fusion 360 רלוונטיים:
${techniquesBlock}

מיומנויות: ${syllabus.skillsToLearn.join(' | ')}

═══════════════════════════════════
📋 CURRENT TASK
═══════════════════════════════════
כותרת: ${ctx.taskTitle}
תיאור: ${ctx.taskDescription}
תפקיד: ${ctx.assignedRole.toUpperCase()}

═══════════════════════════════════
👥 TEAM PROGRESS
═══════════════════════════════════
ספרינט: ${teamProgress.sprintTitle}
אושרו: ${teamProgress.approvedCount}/${teamProgress.totalCount}
${costNotice}

═══════════════════════════════════
📏 HINT RULES
═══════════════════════════════════
${depthInstruction}
- שלב עברית ואנגלית באופן טבעי
- אם רלוונטי — ציין כלי Fusion 360 ספציפי בשמו
- אל תתן את הפתרון המלא
- עד 3 משפטים
`.trim();
    }

    /**
     * Transcribes an audio buffer to text using Azure OpenAI Whisper.
     * Accepts any browser-recorded format (webm, ogg, mp4, wav).
     */
    async transcribeAudio(buffer: Buffer, mimeType = 'audio/webm'): Promise<string> {
        if (!this.client) {
            return '[Mock transcription] speech-to-text requires AZURE_OPENAI_API_KEY + AZURE_OPENAI_WHISPER_DEPLOYMENT';
        }
        try {
            const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'webm';
            const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });
            const result = await this.gatekeeper.execute('azure', () =>
                this.client!.audio.transcriptions.create({
                    file,
                    model: this.whisperDeployment,
                }),
            );
            return result.text ?? '';
        } catch (err) {
            this.logger.error('transcribeAudio failed', (err as Error).message);
            return '';
        }
    }

    /**
     * Generates a DUDE bot reply given a recent message history and the
     * triggering student message.
     */
    async generateDudeResponse(history: { senderName: string; content: string; isBot: boolean }[], trigger: string): Promise<string> {
        if (!this.client) return this.mockDudeResponse(trigger);

        const systemPrompt =
            `אתה DUDE — בוט לימודי ידידותי בפלטפורמת Tech School.\n` +
            `אתה משתתף בצ'אט קבוצתי של צוות תלמידים שעובדים על אתגר תלת-מימד ב-Fusion 360.\n` +
            `תפקידך: לעודד, להכווין, לעזור להבין מושגים מבלי לתת תשובות ישירות.\n` +
            `כאשר תלמיד שואל שאלה — ענה בצורה מכוונת ולא ישירה.\n` +
            `כאשר הצוות שותק — שאל שאלה מעוררת מחשבה.\n` +
            `שמור על תשובות קצרות (עד 3 משפטים). שלב עברית ואנגלית טכנית.`;

        const contextMessages = history.slice(-10).map((m) => ({
            role: m.isBot ? 'assistant' as const : 'user' as const,
            content: m.isBot ? m.content : `[${m.senderName}]: ${m.content}`,
        }));

        try {
            const response = await this.gatekeeper.execute('azure', () =>
                this.client!.chat.completions.create({
                    model: this.deployment,
                    max_tokens: 200,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...contextMessages,
                        { role: 'user', content: trigger },
                    ],
                }),
            );
            return response.choices[0]?.message?.content ?? 'המשיכו כך! 💪';
        } catch (err) {
            this.logger.error('generateDudeResponse failed', (err as Error).message);
            return this.mockDudeResponse(trigger);
        }
    }

    /**
     * Analyzes a list of student messages and returns jargon / soft-skill scores.
     * Used by DudeService to update student profiles after channel analysis.
     */
    async analyzeConversation(messages: string[], userId: string): Promise<AIAnalysisResult> {
        const combined = messages.join('\n');
        return this.analyze({ text: combined, context: { userId, source: 'group_chat' } });
    }

    /**
     * Private 1-on-1 mentor chat with DUDE.
     * Answers freely but stays within Tech School challenge context.
     */
    async privateMentorChat(
        message: string,
        history: { role: 'user' | 'assistant'; content: string }[],
    ): Promise<string> {
        if (!this.client) {
            return `[DUDE Mock] שלום! אני DUDE המנטור הפרטי שלך. שאל/י אותי כל דבר שקשור לאתגרים, Fusion 360, תפקידי הצוות, תהליכי עבודה ועוד. (set AZURE_OPENAI keys for real responses)`;
        }

        const systemPrompt =
            `אתה DUDE — מנטור אישי וחכם בפלטפורמת Tech School לנוער.\n` +
            `אתה מנהל שיחה פרטית עם תלמיד/ה אחד/ת.\n` +
            `תוכל לדון בכל נושא שקשור לאתגרים הטכנולוגיים:\n` +
            `  • Fusion 360 — עיצוב תלת-מימד, STL, הדפסה, מיפוי\n` +
            `  • תפקידי הצוות — PM, QA, Dev, Hardware\n` +
            `  • תהליכי עבודה — Agile, ספרינטים, ביקורת קוד, תיעוד\n` +
            `  • מיומנויות רכות — תקשורת, ניהול זמן, עבודת צוות\n` +
            `  • שאלות טכניות כלליות בגבולות האתגרים\n` +
            `אל תדון בנושאים שאינם קשורים ל-Tech School.\n` +
            `סגנון: ידידותי, מעודד, קצר (עד 4 משפטים). שלב עברית ואנגלית טכנית.`;

        const contextMessages = history.slice(-12).map((m) => ({
            role: m.role,
            content: m.content,
        }));

        try {
            const response = await this.gatekeeper.execute('azure', () =>
                this.client!.chat.completions.create({
                    model: this.deployment,
                    max_tokens: 300,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...contextMessages,
                        { role: 'user', content: message },
                    ],
                }),
            );
            return response.choices[0]?.message?.content ?? 'לא הצלחתי לענות כרגע, נסה שוב.';
        } catch (err) {
            this.logger.error('privateMentorChat failed', (err as Error).message);
            return 'שגיאה זמנית — נסה שוב בעוד רגע.';
        }
    }

    private mockDudeResponse(trigger: string): string {
        if (trigger.endsWith('?')) {
            return '[DUDE Mock] שאלה מעולה! נסו לחשוב על הכלים שלמדתם בספרינט הנוכחי. (set AZURE_OPENAI keys for real responses)';
        }
        return '[DUDE Mock] ממשיכים לעבוד יפה! 💡 זכרו לתעד את ההחלטות שלכם. (set AZURE_OPENAI keys for real responses)';
    }

    private mockHint(ctx: HintContext): string {
        return (
            `[Mock hint #${ctx.hintNumber}] חשוב על איזה כלי ב-Fusion 360 ` +
            `יכול לעזור עם המשימה "${ctx.taskTitle}". (set AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY to enable real hints)`
        );
    }
}

```

---

## backend/src/integrations/firebase/firebase.interface.ts
**Type:** backend

```typescript
/**
 * Firebase integration contract — what the rest of the app expects from any
 * Firebase implementation (mock or real).
 *
 * Used by FirebaseAuthProvider in the auth module to verify ID tokens
 * minted by the Firebase JS SDK on the client.
 *
 * @version 1.00
 */

export const FIREBASE_PROVIDER_TOKEN = Symbol('FIREBASE_PROVIDER');

export interface FirebaseUser {
    readonly uid: string;
    readonly email: string;
    readonly emailVerified: boolean;
    readonly displayName?: string;
}

export interface FirebaseProvider {
    /**
     * Verify a Firebase ID token. Throws if the token is invalid, expired,
     * or signed for a different Firebase project.
     */
    verifyIdToken(token: string): Promise<FirebaseUser>;
}

```

---

## backend/src/integrations/firebase/firebase.mock.ts
**Type:** backend

```typescript
/**
 * Mock Firebase provider — parses tokens of the shape `mock-uid:<email>`
 * for local development and tests. Logs a loud warning so it's obvious
 * if this ends up running in production.
 *
 * @version 1.00
 */

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { FirebaseProvider, FirebaseUser } from './firebase.interface';

@Injectable()
export class MockFirebaseProvider implements FirebaseProvider {
    private readonly logger = new Logger(MockFirebaseProvider.name);

    async verifyIdToken(token: string): Promise<FirebaseUser> {
        this.logger.warn('[MOCK] verifying Firebase token (set FIREBASE_PROVIDER=real to disable)');
        const match = /^mock-uid:([^:]+@[^:]+)$/.exec(token);
        if (!match) {
            throw new UnauthorizedException(
                'Invalid mock Firebase token. Expected format: "mock-uid:<email>"',
            );
        }
        const email = match[1];
        return {
            uid: `mock-${email}`,
            email,
            emailVerified: true,
        };
    }
}

```

---

## backend/src/integrations/firebase/firebase.module.ts
**Type:** backend

```typescript
/**
 * Firebase integration module.
 *
 * Selects the active provider (mock vs. real) based on
 * `config.integrations.firebase`. Default is mock so dev/CI runs without creds.
 *
 * @version 1.00
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';
import { FIREBASE_PROVIDER_TOKEN } from './firebase.interface';
import { MockFirebaseProvider } from './firebase.mock';
import { RealFirebaseProvider } from './firebase.real';

@Module({
    providers: [
        {
            provide: FIREBASE_PROVIDER_TOKEN,
            inject: [ConfigService, GatekeeperService],
            useFactory: (cfg: ConfigService, gk: GatekeeperService) =>
                cfg.integrations.firebase === 'real'
                    ? new RealFirebaseProvider(gk)
                    : new MockFirebaseProvider(),
        },
    ],
    exports: [FIREBASE_PROVIDER_TOKEN],
})
export class FirebaseIntegrationModule {}

```

---

## backend/src/integrations/firebase/firebase.real.ts
**Type:** backend

```typescript
/**
 * Real Firebase provider — stub.
 *
 * TODO(creds-day): wire `firebase-admin` SDK once we have the service
 * account JSON. Steps:
 *   1. `npm i firebase-admin`
 *   2. Set `FIREBASE_SERVICE_ACCOUNT_JSON` and `FIREBASE_PROJECT_ID` env vars
 *   3. Replace the body of `verifyIdToken` with `admin.auth().verifyIdToken(token)`
 *   4. Wrap the call in `gatekeeper.execute('firebase', () => ...)`
 *   5. Set `FIREBASE_PROVIDER=real`
 *
 * Until the SDK is wired, throwing here at boot is intentional — it forces
 * a clear failure rather than silently falling back to mock when admin
 * thinks they enabled real auth.
 *
 * @version 0.10
 */

import { Injectable, Logger } from '@nestjs/common';
import { FirebaseProvider, FirebaseUser } from './firebase.interface';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';

@Injectable()
export class RealFirebaseProvider implements FirebaseProvider {
    private readonly logger = new Logger(RealFirebaseProvider.name);

    constructor(private readonly _gatekeeper: GatekeeperService) {
        this.logger.warn(
            'RealFirebaseProvider not implemented — install firebase-admin and ' +
            'replace this stub before flipping FIREBASE_PROVIDER=real',
        );
    }

    async verifyIdToken(_token: string): Promise<FirebaseUser> {
        throw new Error(
            'RealFirebaseProvider.verifyIdToken not implemented. See TODO(creds-day) in firebase.real.ts',
        );
    }
}

```

---

## backend/src/integrations/monday/monday-api.module.ts
**Type:** backend

```typescript
/**
 * Monday.com integration module.
 *
 * @version 1.10
 */

import { Module } from '@nestjs/common';
import { MondayApiService } from './monday-api.service';

@Module({
    providers: [MondayApiService],
    exports: [MondayApiService],
})
export class MondayApiModule {}

```

---

## backend/src/integrations/monday/monday-api.service.ts
**Type:** backend

```typescript
/**
 * Monday.com GraphQL client.
 *
 * All outbound requests go through GatekeeperService — never call `fetch`
 * directly outside of `gatekeeper.execute(...)`.
 *
 * Gracefully no-ops when MONDAY_API_TOKEN is unset, so local dev and the
 * mock-monday simulator can run end-to-end without a Monday workspace.
 *
 * @version 1.10
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';

interface GraphQLResponse<T> {
    data: T;
    errors?: { message: string }[];
}

class HttpStatusError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'HttpStatusError';
    }
}

@Injectable()
export class MondayApiService {
    private readonly logger = new Logger(MondayApiService.name);
    private readonly apiUrl = 'https://api.monday.com/v2';
    private readonly token: string;

    constructor(
        private readonly config: ConfigService,
        private readonly gatekeeper: GatekeeperService,
    ) {
        this.token = this.config.integrations.mondayApiToken;
        if (!this.token) {
            this.logger.warn('MONDAY_API_TOKEN not set — Monday calls will no-op');
        }
    }

    async updateItemStatus(itemId: number, statusLabel: string): Promise<void> {
        if (!this.token) return;
        const gql = `
            mutation {
                change_simple_column_value(
                    item_id: ${itemId},
                    column_id: "status",
                    value: ${JSON.stringify(statusLabel)}
                ) { id }
            }
        `;
        try {
            await this.run(gql);
            this.logger.log(`Monday item ${itemId} → "${statusLabel}"`);
        } catch (err) {
            this.logger.error(
                `Failed to update Monday item ${itemId}`,
                (err as Error).message,
            );
        }
    }

    async createItem(
        boardId: number,
        groupId: string,
        itemName: string,
    ): Promise<number | null> {
        if (!this.token) return null;
        const gql = `
            mutation {
                create_item(
                    board_id: ${boardId},
                    group_id: ${JSON.stringify(groupId)},
                    item_name: ${JSON.stringify(itemName)}
                ) { id }
            }
        `;
        try {
            const data = await this.run<{ create_item: { id: string } }>(gql);
            return parseInt(data.create_item.id, 10);
        } catch (err) {
            this.logger.error('Failed to create Monday item', (err as Error).message);
            return null;
        }
    }

    private async run<T>(gql: string): Promise<T> {
        return this.gatekeeper.execute('monday', async () => {
            const res = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: this.token,
                },
                body: JSON.stringify({ query: gql }),
            });
            if (!res.ok) {
                throw new HttpStatusError(res.status, `Monday HTTP ${res.status}`);
            }
            const json = (await res.json()) as GraphQLResponse<T>;
            if (json.errors?.length) {
                throw new Error(
                    `Monday GraphQL: ${json.errors.map((e) => e.message).join(', ')}`,
                );
            }
            return json.data;
        });
    }
}

```

---

## backend/src/integrations/storage/storage.interface.ts
**Type:** backend

```typescript
/**
 * Storage integration contract.
 *
 * Used for any persistent file storage — task submissions (images, STL files),
 * profile pictures, exported reports.
 *
 * @version 1.00
 */

export const STORAGE_PROVIDER_TOKEN = Symbol('STORAGE_PROVIDER');

export interface UploadInput {
    /** Path within the bucket, e.g. `submissions/<task-id>/<filename>` */
    readonly key: string;
    readonly contentType: string;
    readonly body: Buffer;
}

export interface UploadResult {
    /** Canonical URL (signed if private). */
    readonly url: string;
}

export interface StorageProvider {
    uploadFile(input: UploadInput): Promise<UploadResult>;
    getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
    deleteFile(key: string): Promise<void>;
}

```

---

## backend/src/integrations/storage/storage.mock.ts
**Type:** backend

```typescript
/**
 * Mock storage provider — writes to a local directory under `./tmp/uploads`.
 *
 * Useful for local development. Returned URLs use a `mock-storage://` scheme
 * so it's obvious in logs that they aren't real.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
    StorageProvider,
    UploadInput,
    UploadResult,
} from './storage.interface';

const ROOT = path.resolve(process.cwd(), 'tmp', 'uploads');

@Injectable()
export class MockStorageProvider implements StorageProvider {
    private readonly logger = new Logger(MockStorageProvider.name);

    async uploadFile(input: UploadInput): Promise<UploadResult> {
        const fullPath = path.join(ROOT, input.key);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, input.body);
        const url = `mock-storage://${input.key}`;
        this.logger.warn(`[MOCK] uploaded ${input.body.length} bytes → ${fullPath}`);
        return { url };
    }

    async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
        return `mock-storage://${key}`;
    }

    async deleteFile(key: string): Promise<void> {
        const fullPath = path.join(ROOT, key);
        await fs.rm(fullPath, { force: true });
        this.logger.warn(`[MOCK] deleted ${fullPath}`);
    }
}

```

---

## backend/src/integrations/storage/storage.module.ts
**Type:** backend

```typescript
/**
 * Storage integration module — picks mock vs. real adapter.
 *
 * @version 1.00
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';
import { STORAGE_PROVIDER_TOKEN } from './storage.interface';
import { MockStorageProvider } from './storage.mock';
import { RealStorageProvider } from './storage.real';

@Module({
    providers: [
        {
            provide: STORAGE_PROVIDER_TOKEN,
            inject: [ConfigService, GatekeeperService],
            useFactory: (cfg: ConfigService, gk: GatekeeperService) =>
                cfg.integrations.storage === 'real'
                    ? new RealStorageProvider(gk)
                    : new MockStorageProvider(),
        },
    ],
    exports: [STORAGE_PROVIDER_TOKEN],
})
export class StorageIntegrationModule {}

```

---

## backend/src/integrations/storage/storage.real.ts
**Type:** backend

```typescript
/**
 * Real storage provider — stub for AWS S3.
 *
 * TODO(creds-day): wire `@aws-sdk/client-s3` once we have an AWS account.
 *   1. `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
 *   2. Set `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
 *      `STORAGE_BUCKET` env vars.
 *   3. Replace the stubs below with `S3Client` calls wrapped in
 *      `gatekeeper.execute('storage', () => ...)`.
 *   4. Set `STORAGE_PROVIDER=real`.
 *
 * @version 0.10
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    StorageProvider,
    UploadInput,
    UploadResult,
} from './storage.interface';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';

@Injectable()
export class RealStorageProvider implements StorageProvider {
    private readonly logger = new Logger(RealStorageProvider.name);

    constructor(private readonly _gatekeeper: GatekeeperService) {
        this.logger.warn(
            'RealStorageProvider not implemented — install @aws-sdk/client-s3 and ' +
            'replace this stub before flipping STORAGE_PROVIDER=real',
        );
    }

    async uploadFile(_input: UploadInput): Promise<UploadResult> {
        throw new Error('RealStorageProvider.uploadFile not implemented. See TODO(creds-day).');
    }

    async getSignedUrl(_key: string, _expiresInSeconds: number): Promise<string> {
        throw new Error('RealStorageProvider.getSignedUrl not implemented. See TODO(creds-day).');
    }

    async deleteFile(_key: string): Promise<void> {
        throw new Error('RealStorageProvider.deleteFile not implemented. See TODO(creds-day).');
    }
}

```

---

## backend/src/integrations/techschool/techschool.interface.ts
**Type:** backend

```typescript
/**
 * Tech School LMS integration contract.
 *
 * Tomorrow this pulls live mission/lesson metadata to feed the RAG syllabus.
 * Today the mock returns fixture missions covering the three spec'd
 * sprint themes (gift / games / branding).
 *
 * @version 1.00
 */

export const TECHSCHOOL_PROVIDER_TOKEN = Symbol('TECHSCHOOL_PROVIDER');

export interface TechSchoolMission {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly englishTerms: readonly string[];
    readonly difficulty: 1 | 2 | 3;
    readonly estimatedMinutes: number;
    readonly topic: 'gift' | 'games' | 'branding';
}

export interface ListMissionsFilters {
    readonly topic?: 'gift' | 'games' | 'branding';
    readonly maxDifficulty?: 1 | 2 | 3;
}

export interface TechSchoolProvider {
    listMissions(filters?: ListMissionsFilters): Promise<TechSchoolMission[]>;
    getMission(id: string): Promise<TechSchoolMission | null>;
}

```

---

## backend/src/integrations/techschool/techschool.mock.ts
**Type:** backend

```typescript
/**
 * Mock Tech School provider — five fixture missions covering the three spec
 * sprint themes. Enough to drive offline development of any feature that
 * depends on mission metadata.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    ListMissionsFilters,
    TechSchoolMission,
    TechSchoolProvider,
} from './techschool.interface';

const FIXTURES: readonly TechSchoolMission[] = [
    {
        id: 'tsm-gift-01',
        title: 'Sketch a personal gift in Fusion 360',
        description:
            'Use Sketch + Extrude to design a 3D object with personal meaning. ' +
            'Max height 10cm. Must be printable without supports.',
        englishTerms: ['Sketch', 'Extrude', 'Constraint', 'Origin Plane'],
        difficulty: 1,
        estimatedMinutes: 45,
        topic: 'gift',
    },
    {
        id: 'tsm-gift-02',
        title: 'Export STL and run a slicer simulation',
        description:
            'Export the model to STL, validate wall thickness ≥ 1.2mm, and ' +
            'add supports in the slicer where needed.',
        englishTerms: ['STL', 'Slicer', 'Supports', 'Layer Height', 'Wall Thickness'],
        difficulty: 2,
        estimatedMinutes: 30,
        topic: 'gift',
    },
    {
        id: 'tsm-games-01',
        title: 'Multi-component game piece',
        description:
            'Design a game with at least two interlocking parts. Use Combine ' +
            'and Joint tools. Tolerance 0.2mm for fit.',
        englishTerms: ['Combine', 'Joint', 'Tolerance', 'Assembly'],
        difficulty: 2,
        estimatedMinutes: 60,
        topic: 'games',
    },
    {
        id: 'tsm-branding-01',
        title: 'Personal logo as a 3D-printable medallion',
        description:
            'Convert a logo into an extruded 3D shape with chamfered edges. ' +
            'Test print at 50% scale before final.',
        englishTerms: ['Extrude', 'Chamfer', 'Scale', 'Test Print'],
        difficulty: 2,
        estimatedMinutes: 50,
        topic: 'branding',
    },
    {
        id: 'tsm-branding-02',
        title: 'Multi-material composition for the makeathon entry',
        description:
            'Combine two filament types in a single design. Plan support ' +
            'placement to avoid colour bleed.',
        englishTerms: ['Multi-material', 'Filament', 'Pause Layer', 'Z-seam'],
        difficulty: 3,
        estimatedMinutes: 90,
        topic: 'branding',
    },
];

@Injectable()
export class MockTechSchoolProvider implements TechSchoolProvider {
    private readonly logger = new Logger(MockTechSchoolProvider.name);

    async listMissions(filters?: ListMissionsFilters): Promise<TechSchoolMission[]> {
        this.logger.warn('[MOCK] listMissions — set TECHSCHOOL_PROVIDER=real to use live data');
        return FIXTURES.filter(
            (m) =>
                (!filters?.topic || m.topic === filters.topic) &&
                (!filters?.maxDifficulty || m.difficulty <= filters.maxDifficulty),
        ).map((m) => ({ ...m }));
    }

    async getMission(id: string): Promise<TechSchoolMission | null> {
        const m = FIXTURES.find((x) => x.id === id);
        return m ? { ...m } : null;
    }
}

```

---

## backend/src/integrations/techschool/techschool.module.ts
**Type:** backend

```typescript
/**
 * Tech School integration module — picks mock vs. real adapter.
 *
 * @version 1.00
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';
import { TECHSCHOOL_PROVIDER_TOKEN } from './techschool.interface';
import { MockTechSchoolProvider } from './techschool.mock';
import { RealTechSchoolProvider } from './techschool.real';

@Module({
    providers: [
        {
            provide: TECHSCHOOL_PROVIDER_TOKEN,
            inject: [ConfigService, GatekeeperService],
            useFactory: (cfg: ConfigService, gk: GatekeeperService) =>
                cfg.integrations.techschool === 'real'
                    ? new RealTechSchoolProvider(gk)
                    : new MockTechSchoolProvider(),
        },
    ],
    exports: [TECHSCHOOL_PROVIDER_TOKEN],
})
export class TechSchoolIntegrationModule {}

```

---

## backend/src/integrations/techschool/techschool.real.ts
**Type:** backend

```typescript
/**
 * Real Tech School provider — stub.
 *
 * TODO(creds-day): wire to the real Tech School demo API.
 *   1. Set `TECHSCHOOL_API_URL` and `TECHSCHOOL_API_TOKEN` env vars.
 *   2. Replace the stubs below with `fetch` calls wrapped in
 *      `gatekeeper.execute('techschool', () => ...)`.
 *   3. Set `TECHSCHOOL_PROVIDER=real`.
 *
 * @version 0.10
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    ListMissionsFilters,
    TechSchoolMission,
    TechSchoolProvider,
} from './techschool.interface';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';

@Injectable()
export class RealTechSchoolProvider implements TechSchoolProvider {
    private readonly logger = new Logger(RealTechSchoolProvider.name);

    constructor(private readonly _gatekeeper: GatekeeperService) {
        this.logger.warn(
            'RealTechSchoolProvider not implemented — fill in real.ts before ' +
            'flipping TECHSCHOOL_PROVIDER=real',
        );
    }

    async listMissions(_filters?: ListMissionsFilters): Promise<TechSchoolMission[]> {
        throw new Error('RealTechSchoolProvider.listMissions not implemented. See TODO(creds-day).');
    }

    async getMission(_id: string): Promise<TechSchoolMission | null> {
        throw new Error('RealTechSchoolProvider.getMission not implemented. See TODO(creds-day).');
    }
}

```

---

## backend/src/main.ts
**Type:** backend

```typescript
/**
 * Application bootstrap.
 *
 * Instantiates the Nest app, applies global pipes, configures CORS from
 * the typed config, mounts Swagger at /api/docs, and starts the HTTP server.
 *
 * @version 1.10
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, { bufferLogs: false });
    const config = app.get(ConfigService);

    app.setGlobalPrefix('api');
    app.use(cookieParser());

    app.enableCors({
        origin: [...config.server.corsOrigins],
        credentials: true,
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: false },
        }),
    );

    const docBuilder = new DocumentBuilder()
        .setTitle('TeamSprintUp API')
        .setDescription('Backend for the TeamSprintUp hi-tech-workplace simulator.')
        .setVersion(config.version)
        .addBearerAuth()
        .build();
    const doc = SwaggerModule.createDocument(app, docBuilder);
    SwaggerModule.setup('api/docs', app, doc);

    await app.listen(config.server.port);
    Logger.log(
        `Backend v${config.version} on http://localhost:${config.server.port}/api ` +
        `(env=${config.server.nodeEnv}, auth=${config.auth.provider})`,
        'Bootstrap',
    );
    Logger.log(`Swagger docs at http://localhost:${config.server.port}/api/docs`, 'Bootstrap');
}

bootstrap().catch((err) => {
    Logger.error(`Bootstrap failed: ${(err as Error).message}`, (err as Error).stack, 'Bootstrap');
    process.exit(1);
});

```

---

## backend/src/migrate.ts
**Type:** backend

```typescript
/**
 * Migration runner.
 *
 * Applies any unapplied numbered SQL files in `backend/migrations/` to the
 * database referenced by DATABASE_URL. Tracks applied migrations in a
 * `_migrations` table.
 *
 * Usage: `npm run migrate` (uses ts-node)
 *
 * Exit codes:
 *   0 — all migrations applied (or already up to date)
 *   1 — failure (DB unreachable, SQL error, etc.)
 *
 * @version 1.00
 */

import postgres from 'postgres';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
// When run from src/ the migrations dir is at backend/migrations/ — i.e.
// one directory up from __dirname.

const log = (msg: string): void => console.log(`[migrate] ${msg}`);
const err = (msg: string): void => console.error(`[migrate] ✗ ${msg}`);

interface MigrationFile {
    readonly name: string;
    readonly path: string;
    readonly content: string;
}

async function discoverMigrations(): Promise<MigrationFile[]> {
    const entries = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = entries
        .filter((f) => f.endsWith('.sql'))
        .sort();
    const out: MigrationFile[] = [];
    for (const name of sqlFiles) {
        const fullPath = path.join(MIGRATIONS_DIR, name);
        const content = await fs.readFile(fullPath, 'utf-8');
        out.push({ name, path: fullPath, content });
    }
    return out;
}

async function ensureTable(sql: postgres.Sql): Promise<void> {
    await sql`
        create table if not exists public._migrations (
            name        text primary key,
            applied_at  timestamptz not null default now(),
            checksum    text not null
        )
    `;
}

function checksum(content: string): string {
    // Simple FNV-1a so we don't need a crypto import — collision-resistant
    // enough to detect accidental edits to applied migrations.
    let h = 0x811c9dc5;
    for (let i = 0; i < content.length; i += 1) {
        h ^= content.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return ('0000000' + (h >>> 0).toString(16)).slice(-8);
}

async function run(): Promise<void> {
    const url = process.env.DATABASE_URL;
    if (!url) {
        err('DATABASE_URL not set — see backend/.env.example');
        process.exit(1);
    }

    const sql = postgres(url, {
        ssl: url.includes('sslmode=disable') ? false : 'require',
        max: 1,
    });

    try {
        await ensureTable(sql);
        const applied = await sql<{ name: string; checksum: string }[]>`
            select name, checksum from public._migrations
        `;
        const appliedMap = new Map(applied.map((r) => [r.name, r.checksum]));

        const migrations = await discoverMigrations();
        if (migrations.length === 0) {
            log('No migration files found. Nothing to do.');
            return;
        }

        let appliedCount = 0;
        for (const m of migrations) {
            const sum = checksum(m.content);
            const prior = appliedMap.get(m.name);
            if (prior) {
                if (prior !== sum) {
                    err(
                        `${m.name} has been edited since it was applied ` +
                        `(checksum ${prior} → ${sum}). Migrations are immutable. ` +
                        `Create a new migration to apply changes.`,
                    );
                    process.exit(1);
                }
                continue;
            }
            log(`Applying ${m.name}...`);
            await sql.unsafe(m.content);
            await sql`
                insert into public._migrations (name, checksum)
                values (${m.name}, ${sum})
            `;
            log(`  ✓ ${m.name}`);
            appliedCount += 1;
        }

        if (appliedCount === 0) log('Database is up to date.');
        else log(`Applied ${appliedCount} migration(s).`);
    } catch (e) {
        err(`Migration failed: ${(e as Error).message}`);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

run();

```

---

## backend/src/mock-monday/mock-monday.controller.ts
**Type:** backend

```typescript
import {
    Controller,
    Get,
    Param,
    Post,
    HttpCode,
} from '@nestjs/common';
import { MockMondayService } from './mock-monday.service';

@Controller('mock-monday')
export class MockMondayController {
    constructor(private readonly mockMonday: MockMondayService) {}

    @Get('challenges')
    listChallenges() {
        return this.mockMonday.listChallenges();
    }

    @Get('board/:challengeId')
    getBoard(@Param('challengeId') challengeId: string) {
        return this.mockMonday.getBoard(challengeId);
    }

    @Post('kickoff/:challengeId')
    @HttpCode(200)
    kickoff(@Param('challengeId') challengeId: string) {
        return this.mockMonday.kickoffChallenge(challengeId);
    }

    @Post('approve/:taskId')
    @HttpCode(200)
    approve(@Param('taskId') taskId: string) {
        return this.mockMonday.approveTask(taskId);
    }

    @Post('reject/:taskId')
    @HttpCode(200)
    reject(@Param('taskId') taskId: string) {
        return this.mockMonday.rejectTask(taskId);
    }
}

```

---

## backend/src/mock-monday/mock-monday.module.ts
**Type:** backend

```typescript
import { Module } from '@nestjs/common';
import { MockMondayService } from './mock-monday.service';
import { MockMondayController } from './mock-monday.controller';
import { TasksModule } from '../tasks/tasks.module';

@Module({
    imports: [TasksModule],
    providers: [MockMondayService],
    controllers: [MockMondayController],
})
export class MockMondayModule {}

```

---

## backend/src/mock-monday/mock-monday.service.ts
**Type:** backend

```typescript
import {
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TasksService } from '../tasks/tasks.service';

export interface MockBoardItem {
    id: string;
    mondayItemId: number | null;
    title: string;
    teamName: string;
    assignedRole: string;
    status: string;
    submissionUrl: string | null;
    submittedAt: string;
}

export interface MockBoard {
    challengeId: string;
    challengeTitle: string;
    columns: {
        label: string;
        color: string;
        items: MockBoardItem[];
    }[];
}

@Injectable()
export class MockMondayService {
    private readonly logger = new Logger(MockMondayService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly tasksService: TasksService,
    ) {}

    async getBoard(challengeId: string): Promise<MockBoard> {
        const { data: challenge } = await this.supabase.db
            .from('challenges')
            .select('id, title')
            .eq('id', challengeId)
            .single();

        if (!challenge) throw new NotFoundException(`Challenge ${challengeId} not found`);

        const { data: tasks, error } = await this.supabase.db
            .from('tasks')
            .select(`
                id, title, status, assigned_role,
                submission_url, monday_item_id, updated_at,
                teams(name),
                sprints!inner(challenge_id)
            `)
            .eq('sprints.challenge_id', challengeId)
            .order('updated_at', { ascending: false });

        if (error) throw new InternalServerErrorException(error.message);

        const all = (tasks ?? []) as any[];

        const bucket = (statuses: string[]) =>
            all
                .filter((t) => statuses.includes(t.status))
                .map((t): MockBoardItem => ({
                    id: t.id,
                    mondayItemId: t.monday_item_id,
                    title: t.title,
                    teamName: t.teams?.name ?? '—',
                    assignedRole: t.assigned_role,
                    status: t.status,
                    submissionUrl: t.submission_url,
                    submittedAt: t.updated_at,
                }));

        return {
            challengeId: challenge.id,
            challengeTitle: challenge.title,
            columns: [
                { label: 'In Progress',            color: '#579bfc', items: bucket(['pending', 'rejected']) },
                { label: 'QA Review',              color: '#ffcb00', items: bucket(['qa_review']) },
                { label: 'PM Review',              color: '#ff7575', items: bucket(['pm_review']) },
                { label: 'Pending Teacher Review', color: '#a25ddc', items: bucket(['teacher_review']) },
                { label: 'Approved',               color: '#00c875', items: bucket(['approved']) },
            ],
        };
    }

    async approveTask(taskId: string): Promise<{ message: string }> {
        this.logger.log(`[MOCK MONDAY] Teacher approved task ${taskId}`);
        await this.tasksService.teacherApprove(taskId);
        return { message: 'Task approved by teacher (mock Monday event)' };
    }

    async rejectTask(taskId: string): Promise<{ message: string }> {
        this.logger.log(`[MOCK MONDAY] Teacher rejected task ${taskId}`);
        const { error } = await this.supabase.db
            .from('tasks')
            .update({ status: 'pm_review' })
            .eq('id', taskId)
            .eq('status', 'teacher_review');

        if (error) throw new InternalServerErrorException(error.message);
        return { message: 'Task rejected — returned to PM review (mock Monday event)' };
    }

    async kickoffChallenge(challengeId: string): Promise<{ message: string }> {
        this.logger.log(`[MOCK MONDAY] Teacher kicked off challenge ${challengeId}`);

        await this.supabase.db
            .from('challenges')
            .update({ is_active: true })
            .eq('id', challengeId);

        // Resolve the first sprint of this challenge so student dashboards show the correct title
        const { data: sprintData } = await this.supabase.db
            .from('sprints')
            .select('id')
            .eq('challenge_id', challengeId)
            .order('order_index' as any)
            .limit(1)
            .maybeSingle();

        const firstSprintId = (sprintData as any)?.id ?? null;

        await this.supabase.db
            .from('teams')
            .update({
                current_challenge_id: challengeId,
                current_sprint_id: firstSprintId,
                sprint_status: 'active',
                is_completed: false,
            })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        return { message: `Challenge ${challengeId} kicked off for all teams (mock Monday event)` };
    }

    async listChallenges(): Promise<{ id: string; title: string; isActive: boolean }[]> {
        const { data, error } = await this.supabase.db
            .from('challenges')
            .select('id, title, is_active')
            .order('order_index' as any);

        if (error) throw new InternalServerErrorException(error.message);
        return (data ?? []).map((c) => ({ id: c.id, title: c.title, isActive: c.is_active }));
    }
}

```

---

## backend/src/quizzes/dto/start-quiz.dto.ts
**Type:** backend

```typescript
import { IsIn, IsOptional, IsInt, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MAX_QUIZ_LENGTH, MIN_QUIZ_LENGTH, QuizPhase } from '../quizzes.types';

export class StartQuizDto {
    @ApiProperty()
    @IsUUID()
    userId!: string;

    @ApiProperty({ enum: ['pre', 'post'] })
    @IsIn(['pre', 'post'])
    phase!: QuizPhase;

    @ApiProperty({ required: false, minimum: MIN_QUIZ_LENGTH, maximum: MAX_QUIZ_LENGTH })
    @IsOptional()
    @IsInt()
    @Min(MIN_QUIZ_LENGTH)
    @Max(MAX_QUIZ_LENGTH)
    length?: number;
}

```

---

## backend/src/quizzes/dto/submit-quiz.dto.ts
**Type:** backend

```typescript
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsInt,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QuizAnswerDto {
    @ApiProperty()
    @IsUUID()
    questionId!: string;

    @ApiProperty()
    @IsInt()
    @Min(0)
    selectedIndex!: number;
}

export class SubmitQuizDto {
    @ApiProperty({ type: [QuizAnswerDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => QuizAnswerDto)
    answers!: QuizAnswerDto[];
}

```

---

## backend/src/quizzes/quizzes.controller.ts
**Type:** backend

```typescript
/**
 * Quiz REST endpoints — pre/post mission knowledge measurement.
 *
 * @version 1.00
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { StartQuizDto } from './dto/start-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { QuizPhase } from './quizzes.types';

@ApiTags('quizzes')
@Controller('quizzes')
export class QuizzesController {
    constructor(private readonly quizzes: QuizzesService) {}

    @Post('missions/:challengeId/start')
    start(
        @Param('challengeId') challengeId: string,
        @Body() dto: StartQuizDto,
    ) {
        return this.quizzes.startQuiz(challengeId, dto);
    }

    @Post('attempts/:attemptId/submit')
    submit(
        @Param('attemptId') attemptId: string,
        @Body() dto: SubmitQuizDto,
    ) {
        return this.quizzes.submitQuiz(attemptId, dto);
    }

    @Get('missions/:challengeId/me')
    getMine(
        @Param('challengeId') challengeId: string,
        @Query('userId') userId: string,
        @Query('phase') phase: QuizPhase,
    ) {
        return this.quizzes.getMyAttempt(challengeId, userId, phase);
    }

    @Get('missions/:challengeId/results')
    results(@Param('challengeId') challengeId: string) {
        return this.quizzes.getResultsForChallenge(challengeId);
    }
}

```

---

## backend/src/quizzes/quizzes.module.ts
**Type:** backend

```typescript
import { Module } from '@nestjs/common';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';

@Module({
    controllers: [QuizzesController],
    providers: [QuizzesService],
    exports: [QuizzesService],
})
export class QuizzesModule {}

```

---

## backend/src/quizzes/quizzes.service.ts
**Type:** backend

```typescript
/**
 * QuizzesService — pre/post-mission knowledge quizzes.
 *
 * Pre quiz   : random sample of 5–7 questions from the pool
 *              (role-knowledge for the student's role + mission-specific).
 * Post quiz  : reuses the exact pre questions for the same student.
 * On post-submit, learning_gain = post.score − pre.score is stored.
 *
 * @version 1.00
 */

import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
    AttemptQuestion,
    AttemptWithQuestions,
    DEFAULT_QUIZ_LENGTH,
    MAX_QUIZ_LENGTH,
    MIN_QUIZ_LENGTH,
    QuizAttempt,
    QuizPhase,
    QuizQuestion,
} from './quizzes.types';
import { StartQuizDto } from './dto/start-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { StudentRole } from '../teacher/teacher.types';

@Injectable()
export class QuizzesService {
    private readonly logger = new Logger(QuizzesService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async startQuiz(
        challengeId: string,
        dto: StartQuizDto,
    ): Promise<AttemptWithQuestions> {
        const length = clampLength(dto.length ?? DEFAULT_QUIZ_LENGTH);

        // existing attempt for (user, challenge, phase) → return it
        const existing = await this.findAttempt(dto.userId, challengeId, dto.phase);
        if (existing) {
            const questions = await this.loadAttemptQuestions(existing.id);
            return { attempt: this.toApi(existing), questions };
        }

        const { data: user } = await this.supabase.db
            .from('users')
            .select('id, current_team_id, current_role')
            .eq('id', dto.userId)
            .maybeSingle();
        if (!user) throw new NotFoundException('User not found');

        if (dto.phase === 'pre') {
            return this.createPreAttempt(
                challengeId,
                dto.userId,
                user.current_team_id ?? null,
                user.current_role as StudentRole | null,
                length,
            );
        }

        // post: must have a completed pre attempt to copy from
        const pre = await this.findAttempt(dto.userId, challengeId, 'pre');
        if (!pre || !pre.submitted_at) {
            throw new BadRequestException(
                'Pre-quiz must be completed before starting the post-quiz',
            );
        }
        return this.createPostAttempt(
            pre as AttemptRow,
            user.current_team_id ?? null,
        );
    }

    async submitQuiz(
        attemptId: string,
        dto: SubmitQuizDto,
    ): Promise<{ score: number; total: number; learningGain: number | null }> {
        const { data: attempt } = await this.supabase.db
            .from('quiz_attempts')
            .select('*')
            .eq('id', attemptId)
            .maybeSingle();
        if (!attempt) throw new NotFoundException('Attempt not found');
        if (attempt.submitted_at) {
            throw new BadRequestException('Attempt already submitted');
        }

        const questions = await this.loadAttemptQuestions(attemptId);
        const correctMap = new Map(
            await this.loadCorrectIndexes(questions.map((q) => q.questionId)),
        );

        const now = new Date().toISOString();
        let score = 0;
        for (const a of dto.answers) {
            const aq = questions.find((q) => q.questionId === a.questionId);
            if (!aq) continue;
            const correctIndex = correctMap.get(a.questionId);
            const isCorrect = correctIndex === a.selectedIndex;
            if (isCorrect) score++;
            await this.supabase.db
                .from('quiz_attempt_questions')
                .update({
                    selected_index: a.selectedIndex,
                    is_correct: isCorrect,
                    answered_at: now,
                })
                .eq('id', aq.id);
        }

        let learningGain: number | null = null;
        if (attempt.phase === 'post' && attempt.paired_attempt_id) {
            const { data: pre } = await this.supabase.db
                .from('quiz_attempts')
                .select('score')
                .eq('id', attempt.paired_attempt_id)
                .maybeSingle();
            if (pre && typeof pre.score === 'number') {
                learningGain = score - pre.score;
            }
        }

        await this.supabase.db
            .from('quiz_attempts')
            .update({
                submitted_at: now,
                score,
                learning_gain: learningGain,
            })
            .eq('id', attemptId);

        return { score, total: attempt.total, learningGain };
    }

    async getMyAttempt(
        challengeId: string,
        userId: string,
        phase: QuizPhase,
    ): Promise<AttemptWithQuestions | null> {
        const attempt = await this.findAttempt(userId, challengeId, phase);
        if (!attempt) return null;
        const questions = await this.loadAttemptQuestions(attempt.id);
        return { attempt: this.toApi(attempt), questions };
    }

    async getResultsForChallenge(challengeId: string): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('quiz_attempts')
            .select(
                'id, user_id, phase, score, total, submitted_at, learning_gain, paired_attempt_id',
            )
            .eq('challenge_id', challengeId)
            .order('user_id', { ascending: true });
        return data ?? [];
    }

    // ─── internal helpers ──────────────────────────────────────────────

    private async findAttempt(
        userId: string,
        challengeId: string,
        phase: QuizPhase,
    ): Promise<AttemptRow | null> {
        const { data } = await this.supabase.db
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', userId)
            .eq('challenge_id', challengeId)
            .eq('phase', phase)
            .maybeSingle();
        return (data as AttemptRow) ?? null;
    }

    private async createPreAttempt(
        challengeId: string,
        userId: string,
        teamId: string | null,
        role: StudentRole | null,
        length: number,
    ): Promise<AttemptWithQuestions> {
        const pool = await this.fetchPool(role, challengeId);
        if (pool.length < MIN_QUIZ_LENGTH) {
            throw new BadRequestException(
                `Question pool too small (have ${pool.length}, need at least ${MIN_QUIZ_LENGTH})`,
            );
        }
        const sampleSize = Math.min(length, pool.length);
        const sampled = shuffle(pool).slice(0, sampleSize);

        const { data: inserted, error } = await this.supabase.db
            .from('quiz_attempts')
            .insert({
                user_id: userId,
                team_id: teamId,
                challenge_id: challengeId,
                phase: 'pre',
                total: sampleSize,
            })
            .select('*')
            .single();
        if (error || !inserted) {
            throw new BadRequestException(error?.message ?? 'Failed to start quiz');
        }

        const rows = sampled.map((q, idx) => ({
            attempt_id: inserted.id,
            question_id: q.id,
            order_index: idx,
        }));
        await this.supabase.db.from('quiz_attempt_questions').insert(rows);

        const questions = await this.loadAttemptQuestions(inserted.id);
        return { attempt: this.toApi(inserted as AttemptRow), questions };
    }

    private async createPostAttempt(
        pre: AttemptRow,
        teamId: string | null,
    ): Promise<AttemptWithQuestions> {
        const preQuestions = await this.loadAttemptQuestions(pre.id);

        const { data: inserted, error } = await this.supabase.db
            .from('quiz_attempts')
            .insert({
                user_id: pre.user_id,
                team_id: teamId,
                challenge_id: pre.challenge_id,
                phase: 'post',
                total: pre.total,
                paired_attempt_id: pre.id,
            })
            .select('*')
            .single();
        if (error || !inserted) {
            throw new BadRequestException(error?.message ?? 'Failed to start post quiz');
        }

        const rows = preQuestions.map((q) => ({
            attempt_id: inserted.id,
            question_id: q.questionId,
            order_index: q.orderIndex,
        }));
        await this.supabase.db.from('quiz_attempt_questions').insert(rows);

        const questions = await this.loadAttemptQuestions(inserted.id);
        return { attempt: this.toApi(inserted as AttemptRow), questions };
    }

    private async fetchPool(
        role: StudentRole | null,
        challengeId: string,
    ): Promise<QuizQuestion[]> {
        const out: QuizQuestion[] = [];

        if (role) {
            const { data } = await this.supabase.db
                .from('quiz_questions')
                .select('*')
                .eq('scope', 'role')
                .eq('role', role);
            out.push(...((data as QuizQuestion[]) ?? []));
        }

        const { data: missionRows } = await this.supabase.db
            .from('quiz_questions')
            .select('*')
            .eq('scope', 'mission')
            .eq('challenge_id', challengeId);
        out.push(...((missionRows as QuizQuestion[]) ?? []));

        return out;
    }

    private async loadAttemptQuestions(
        attemptId: string,
    ): Promise<AttemptQuestion[]> {
        const { data: rows } = await this.supabase.db
            .from('quiz_attempt_questions')
            .select('id, question_id, order_index, selected_index, is_correct')
            .eq('attempt_id', attemptId)
            .order('order_index', { ascending: true });

        const ids = (rows ?? []).map((r: { question_id: string }) => r.question_id);
        if (ids.length === 0) return [];

        const { data: qs } = await this.supabase.db
            .from('quiz_questions')
            .select('id, prompt, options')
            .in('id', ids);
        const qMap = new Map(
            ((qs as { id: string; prompt: string; options: string[] }[]) ?? [])
                .map((q) => [q.id, q]),
        );

        return (rows ?? []).map((r: AttemptQuestionRow) => {
            const q = qMap.get(r.question_id);
            return {
                id: r.id,
                questionId: r.question_id,
                orderIndex: r.order_index,
                prompt: q?.prompt ?? '',
                options: q?.options ?? [],
                selectedIndex: r.selected_index,
                isCorrect: r.is_correct,
            };
        });
    }

    private async loadCorrectIndexes(
        questionIds: string[],
    ): Promise<[string, number][]> {
        if (questionIds.length === 0) return [];
        const { data } = await this.supabase.db
            .from('quiz_questions')
            .select('id, correct_index')
            .in('id', questionIds);
        return (data ?? []).map((q: { id: string; correct_index: number }) => [
            q.id,
            q.correct_index,
        ]);
    }

    private toApi(row: AttemptRow): QuizAttempt {
        return {
            id: row.id,
            userId: row.user_id,
            teamId: row.team_id,
            challengeId: row.challenge_id,
            phase: row.phase,
            startedAt: row.started_at,
            submittedAt: row.submitted_at,
            score: row.score,
            total: row.total,
            pairedAttemptId: row.paired_attempt_id,
            learningGain: row.learning_gain,
        };
    }
}

interface AttemptRow {
    id: string;
    user_id: string;
    team_id: string | null;
    challenge_id: string;
    phase: QuizPhase;
    started_at: string;
    submitted_at: string | null;
    score: number | null;
    total: number;
    paired_attempt_id: string | null;
    learning_gain: number | null;
}

interface AttemptQuestionRow {
    id: string;
    question_id: string;
    order_index: number;
    selected_index: number | null;
    is_correct: boolean | null;
}

function clampLength(n: number): number {
    return Math.max(MIN_QUIZ_LENGTH, Math.min(MAX_QUIZ_LENGTH, n));
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

```

---

## backend/src/quizzes/quizzes.types.ts
**Type:** backend

```typescript
/**
 * Pre/post-mission quiz domain types.
 *
 * Each mission (== challenge) has a pre-quiz and a post-quiz per student.
 * The post-quiz reuses the exact same questions sampled for the pre-quiz,
 * so we can compute learning_gain = post_score − pre_score.
 *
 * @version 1.00
 */

import { StudentRole } from '../teacher/teacher.types';

export type QuizPhase = 'pre' | 'post';
export type QuestionScope = 'role' | 'mission';

export const DEFAULT_QUIZ_LENGTH = 5;
export const MIN_QUIZ_LENGTH = 3;
export const MAX_QUIZ_LENGTH = 7;

export interface QuizQuestion {
    id: string;
    scope: QuestionScope;
    role: StudentRole | null;
    challenge_id: string | null;
    prompt: string;
    options: string[];
    correct_index: number;
}

export interface QuizAttempt {
    id: string;
    userId: string;
    teamId: string | null;
    challengeId: string;
    phase: QuizPhase;
    startedAt: string;
    submittedAt: string | null;
    score: number | null;
    total: number;
    pairedAttemptId: string | null;
    learningGain: number | null;
}

export interface AttemptQuestion {
    id: string;
    questionId: string;
    orderIndex: number;
    prompt: string;
    options: string[];
    selectedIndex: number | null;
    isCorrect: boolean | null;
}

export interface AttemptWithQuestions {
    attempt: QuizAttempt;
    questions: AttemptQuestion[];
}

```

---

## backend/src/rag/rag.module.ts
**Type:** backend

```typescript
import { Module } from '@nestjs/common';
import { RagService } from './rag.service';

@Module({
    providers: [RagService],
    exports: [RagService],
})
export class RagModule {}

```

---

## backend/src/rag/rag.service.ts
**Type:** backend

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
    SYLLABUS_BY_SPRINT,
    GENERIC_SYLLABUS,
    SprintSyllabus,
} from './syllabus';

export interface TeamProgress {
    approvedCount: number;
    totalCount: number;
    sprintTitle: string;
}

export interface HintContext {
    taskTitle: string;
    taskDescription: string;
    assignedRole: string;
    syllabus: SprintSyllabus;
    teamProgress: TeamProgress;
    hintNumber: number;
    hintsUsedSoFar: number;
    isLastFreeHint: boolean;
    isOverFreeLimit: boolean;
}

@Injectable()
export class RagService {
    private readonly logger = new Logger(RagService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async buildContext(
        taskId: string,
        userId: string,
        teamId: string,
    ): Promise<HintContext> {
        const [task, hintCount] = await Promise.all([
            this.fetchTask(taskId),
            this.fetchHintCount(userId, teamId),
        ]);

        const syllabus = task?.sprint_id
            ? (SYLLABUS_BY_SPRINT[task.sprint_id] ?? GENERIC_SYLLABUS)
            : GENERIC_SYLLABUS;

        const teamProgress = task?.sprint_id
            ? await this.fetchTeamProgress(teamId, task.sprint_id, syllabus.hebrewTitle)
            : { approvedCount: 0, totalCount: 0, sprintTitle: syllabus.hebrewTitle };

        const hintNumber    = hintCount + 1;
        const FREE_LIMIT    = 3;

        return {
            taskTitle:       task?.title       ?? 'Unknown task',
            taskDescription: task?.description ?? '',
            assignedRole:    task?.assigned_role ?? 'dev',
            syllabus,
            teamProgress,
            hintNumber,
            hintsUsedSoFar:   hintCount,
            isLastFreeHint:   hintNumber === FREE_LIMIT,
            isOverFreeLimit:  hintNumber > FREE_LIMIT,
        };
    }

    private async fetchTask(taskId: string) {
        if (!taskId) return null;

        const { data, error } = await this.supabase.db
            .from('tasks')
            .select('title, description, assigned_role, sprint_id')
            .eq('id', taskId)
            .maybeSingle();

        if (error) {
            this.logger.warn(`fetchTask failed for ${taskId}: ${error.message}`);
            return null;
        }
        return data;
    }

    private async fetchHintCount(userId: string, teamId: string): Promise<number> {
        const { data } = await this.supabase.db
            .from('team_hint_counters')
            .select('hint_count')
            .eq('user_id', userId)
            .eq('team_id', teamId)
            .maybeSingle();

        return data?.hint_count ?? 0;
    }

    private async fetchTeamProgress(
        teamId: string,
        sprintId: string,
        sprintTitle: string,
    ): Promise<TeamProgress> {
        const { data: tasks } = await this.supabase.db
            .from('tasks')
            .select('status')
            .eq('team_id', teamId)
            .eq('sprint_id', sprintId);

        return {
            approvedCount: tasks?.filter((t) => t.status === 'approved').length ?? 0,
            totalCount: tasks?.length ?? 0,
            sprintTitle,
        };
    }
}

```

---

## backend/src/rag/syllabus.ts
**Type:** backend

```typescript
// Fixed sprint IDs from seed.ts — syllabus content keyed by sprint UUID
export const SPRINT_IDS = {
    gift:     'bbbb0001-0000-0000-0000-000000000000',
    games:    'bbbb0002-0000-0000-0000-000000000000',
    branding: 'bbbb0003-0000-0000-0000-000000000000',
} as const;

export interface SprintSyllabus {
    hebrewTitle: string;
    englishTitle: string;
    period: string;
    sessionsCount: number;
    coreTopics: string[];
    fusion360Techniques: Fusion360Technique[];
    skillsToLearn: string[];
    cblGoal: string;
    peakEvent: string;
    submissionNote: string;
}

export interface Fusion360Technique {
    name: string;            // tool name — used verbatim in hints
    hebrewDescription: string;
    sprintRelevance: string; // why it matters this sprint
}

// ── Sprint 1: מתנה ────────────────────────────────────────────────────────────

const SPRINT_GIFT: SprintSyllabus = {
    hebrewTitle: 'אתגר 01 — מתנה',
    englishTitle: 'Challenge 01 — Gift',
    period: 'אוקטובר–נובמבר',
    sessionsCount: 7,
    coreTopics: [
        'יסודות התלת-מימד',
        'צורות בסיסיות (box, cylinder, sphere)',
        'טכניקות עיצוב ראשוניות',
        'הגדרת מידות ואילוצים ב-Sketch',
    ],
    fusion360Techniques: [
        {
            name: 'Sketch',
            hebrewDescription: 'רישום 2D — בסיס לכל מודל',
            sprintRelevance: 'כל אובייקט מתחיל בסקצ׳ על מישור',
        },
        {
            name: 'Extrude',
            hebrewDescription: 'המרת סקצ׳ 2D לגוף 3D',
            sprintRelevance: 'הכלי המרכזי ליצירת גובה ועומק',
        },
        {
            name: 'Fillet',
            hebrewDescription: 'עיגול פינות חדות',
            sprintRelevance: 'חשוב להדפסה — פינות חדות נוטות להיתלש',
        },
        {
            name: 'Chamfer',
            hebrewDescription: 'גזירת פינות בזווית 45°',
            sprintRelevance: 'אלטרנטיבה לFillet, נותן מראה טכני',
        },
        {
            name: 'Appearance',
            hebrewDescription: 'הוספת צבע וחומר למודל',
            sprintRelevance: 'לרינדור ולהצגה ויזואלית',
        },
    ],
    skillsToLearn: [
        'יצירתיות — עיצוב עם משמעות אישית',
        'ירידה לפרטים — דיוק מידות',
        'אמפתיה — מתנה מותאמת למקבל',
        'התמודדות עם אתגר — למידה מאיטרציות',
    ],
    cblGoal:
        'עיצוב והדפסת מתנה תלת-מימדית בעלת משמעות אישית תוך שימוש בצורות בסיס. ' +
        'המוצר חייב להיות ניתן להדפסה ללא תמיכות מורכבות.',
    peakEvent: 'Kick-off — אירוע פתיחת שנה',
    submissionNote: 'תוצר קבוצתי אחד — קובץ STL + מצגת 5 שקפים ב-LMS',
};

// ── Sprint 2: משחקים ──────────────────────────────────────────────────────────

const SPRINT_GAMES: SprintSyllabus = {
    hebrewTitle: 'אתגר 02 — משחקים',
    englishTitle: 'Challenge 02 — Games',
    period: 'נובמבר–ינואר',
    sessionsCount: 7,
    coreTopics: [
        'מספר רכיבים ומכלולים (Assembly)',
        'שילוב בין טכניקות עיצוב',
        'תכנון לאחור — מהמוצר הסופי להחלטות העיצוב',
        'ייחוד מקומי — אלמנט מהעיר/ישוב',
    ],
    fusion360Techniques: [
        {
            name: 'Bodies & Components',
            hebrewDescription: 'ניהול מספר גופים במסמך אחד',
            sprintRelevance: 'משחק = מספר חלקים — כל חלק = Component',
        },
        {
            name: 'Joint / As-Built Joint',
            hebrewDescription: 'חיבור בין רכיבים עם אילוצי תנועה',
            sprintRelevance: 'מאפשר סימולציה של תנועת חלקי המשחק',
        },
        {
            name: 'Pattern (Rectangular / Circular)',
            hebrewDescription: 'שכפול אלמנטים במרווחים שווים',
            sprintRelevance: 'יעיל לאריחי לוח משחק, כלים זהים',
        },
        {
            name: 'Mirror',
            hebrewDescription: 'שיקוף סימטרי של גוף או Feature',
            sprintRelevance: 'חוסך זמן בעיצוב חלקים סימטריים',
        },
        {
            name: 'Combine (Join / Cut / Intersect)',
            hebrewDescription: 'מיזוג או חיתוך בין גופים',
            sprintRelevance: 'יצירת חריצים ומחזיקים בין חלקים',
        },
    ],
    skillsToLearn: [
        'חשיבה לוגית — כללי המשחק → דרישות העיצוב',
        'פתרון בעיות — מה לא עובד ולמה',
        'תקשורת — תיאום בין חברי הצוות',
        'עבודת צוות — חלוקת עבודה נכונה',
        'גמישות מחשבתית — שינוי גישה כשנדרש',
    ],
    cblGoal:
        'עיצוב משחק תלת-מימדי מרובה רכיבים עם ייחוד לעיר/ישוב. ' +
        'המשחק חייב להכיל לפחות 3 רכיבים נפרדים שמתחברים.',
    peakEvent: 'גביע ראש העיר — תחרות עירונית',
    submissionNote: 'תוצר קבוצתי — Assembly מלא + הוראות משחק',
};

// ── Sprint 3: מיתוג אישי ──────────────────────────────────────────────────────

const SPRINT_BRANDING: SprintSyllabus = {
    hebrewTitle: 'אתגר 03 — מיתוג אישי',
    englishTitle: 'Challenge 03 — Personal Branding',
    period: 'ינואר–מרץ',
    sessionsCount: 7,
    coreTopics: [
        'קנה מידה ויחסים בין רכיבים',
        'הרכבה וחיבורים מדויקים',
        'שילוב חומרים שונים',
        'חיתוכים וחריטות (Engrave / Emboss)',
    ],
    fusion360Techniques: [
        {
            name: 'Scale',
            hebrewDescription: 'שינוי גודל אחיד או על ציר מסוים',
            sprintRelevance: 'התאמת אלמנטי מיתוג לגדלים שונים',
        },
        {
            name: 'Emboss / Engrave',
            hebrewDescription: 'הבלטה או חריטה של טקסט ואיורים',
            sprintRelevance: 'הוספת שם, לוגו, טקסטורה אישית',
        },
        {
            name: 'Shell',
            hebrewDescription: 'חלילת גוף מוצק להדפסה חסכונית',
            sprintRelevance: 'חוסך חומר הדפסה ב-30-50%',
        },
        {
            name: 'Loft',
            hebrewDescription: 'יצירת מעבר חלק בין שני פרופילים',
            sprintRelevance: 'צורות אורגניות ועיצוביות',
        },
        {
            name: 'Decal / Texture',
            hebrewDescription: 'הוספת תמונה/לוגו לפני המודל',
            sprintRelevance: 'מיתוג ויזואלי למצגת',
        },
    ],
    skillsToLearn: [
        'ביטוי אישי — זהות עיצובית',
        'חשיבה עיצובית (Design Thinking)',
        'עמידה ביעדים — הגשה לתחרות אזורית',
    ],
    cblGoal:
        'עיצוב אובייקט מיתוגי אישי לתחרות אזורית (Makeathon). ' +
        'חייב לשלב לפחות 2 טכניקות מתקדמות ולהציג זהות ייחודית.',
    peakEvent: 'Makeathon — תחרות מוקדמות אזורית',
    submissionNote: 'מוגש לתחרות אזורית — קובץ STL + קובץ Fusion 360 + poster',
};

// ── Fallback for tasks not linked to a known sprint ──────────────────────────

export const GENERIC_SYLLABUS: SprintSyllabus = {
    hebrewTitle: 'Tech School 3D Design',
    englishTitle: 'Tech School 3D Design',
    period: 'שנה א׳',
    sessionsCount: 0,
    coreTopics: ['מידול תלת-מימד', 'הדפסת תלת-מימד', 'Fusion 360'],
    fusion360Techniques: [
        { name: 'Sketch',   hebrewDescription: 'רישום 2D',    sprintRelevance: 'בסיס לכל מודל' },
        { name: 'Extrude',  hebrewDescription: 'גוף 3D מסקצ׳', sprintRelevance: 'יצירת גובה' },
        { name: 'Fillet',   hebrewDescription: 'עיגול פינות',  sprintRelevance: 'עיצוב ועמידות' },
    ],
    skillsToLearn: ['יצירתיות', 'דיוק', 'עבודת צוות'],
    cblGoal: 'עיצוב והדפסת מודל תלת-מימדי איכותי.',
    peakEvent: '',
    submissionNote: 'הגשה ל-LMS',
};

// ── Lookup map ────────────────────────────────────────────────────────────────

export const SYLLABUS_BY_SPRINT: Record<string, SprintSyllabus> = {
    [SPRINT_IDS.gift]:     SPRINT_GIFT,
    [SPRINT_IDS.games]:    SPRINT_GAMES,
    [SPRINT_IDS.branding]: SPRINT_BRANDING,
};

```

---

## backend/src/seed.ts
**Type:** backend

```typescript
/**
 * Seed script — idempotent demo data.
 *
 * Inserts (or upserts) the canonical hackathon demo: 1 challenge, 3 sprints,
 * 2 teams, 8 students, 1 teacher, 1 admin, 8 tasks. All accounts use the
 * same demo password so they're easy to test with — DO NOT run this against
 * production.
 *
 * @version 1.10
 */

import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const log = (msg: string): void => console.log(`[Seed] ${msg}`);
const err = (msg: string): void => console.error(`[Seed] ✗ ${msg}`);

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'demo1234';

const ID = {
    challenge: {
        gift:   'aaaa0001-0000-0000-0000-000000000000',  // אתגר מספר 1 – מתנה
        puzzle: 'aaaa0002-0000-0000-0000-000000000000',  // אתגר אישי: פאזל — פאזלים לכבדי ראייה
        style:  'aaaa0003-0000-0000-0000-000000000000',  // אתגר מספר 3 – סטייל אישי
    },
    sprint: {
        // GIFT — אתגר 1: 5 lesson sets
        gift_medal:   'bbbb0101-0000-0000-0000-000000000000',
        gift_parents: 'bbbb0102-0000-0000-0000-000000000000',
        gift_simple:  'bbbb0103-0000-0000-0000-000000000000',
        gift_complex: 'bbbb0104-0000-0000-0000-000000000000',
        gift_more:    'bbbb0105-0000-0000-0000-000000000000',
        // PUZZLE — אתגר אישי: 3 lesson sets
        puzzle_basic:  'bbbb0201-0000-0000-0000-000000000000',
        puzzle_shapes: 'bbbb0202-0000-0000-0000-000000000000',
        puzzle_free:   'bbbb0203-0000-0000-0000-000000000000',
        // STYLE — אתגר 3: 7 lesson sets
        style_party:           'bbbb0301-0000-0000-0000-000000000000',
        style_glasses:         'bbbb0302-0000-0000-0000-000000000000',
        style_rings:           'bbbb0303-0000-0000-0000-000000000000',
        style_bracelets:       'bbbb0304-0000-0000-0000-000000000000',
        style_pendants:        'bbbb0305-0000-0000-0000-000000000000',
        style_masks:           'bbbb0306-0000-0000-0000-000000000000',
        style_print_in_place:  'bbbb0307-0000-0000-0000-000000000000',
    },
    team: {
        alpha: 'cccc0001-0000-0000-0000-000000000000',
        beta:  'cccc0002-0000-0000-0000-000000000000',
    },
    user: {
        yael:  'dddd0001-0000-0000-0000-000000000000',
        david: 'dddd0002-0000-0000-0000-000000000000',
        noa:   'dddd0003-0000-0000-0000-000000000000',
        ariel: 'dddd0004-0000-0000-0000-000000000000',
        maya:  'dddd0005-0000-0000-0000-000000000000',
        omer:  'dddd0006-0000-0000-0000-000000000000',
        lior:  'dddd0007-0000-0000-0000-000000000000',
        tal:   'dddd0008-0000-0000-0000-000000000000',
        teacher: 'dddd0009-0000-0000-0000-000000000000',
        admin:   'dddd000a-0000-0000-0000-000000000000',
    },
    task: {
        // 8 tasks for the active mission (puzzle), 1 per role per team
        a_designer: 'eeee0001-0000-0000-0000-000000000000',
        a_editor:   'eeee0002-0000-0000-0000-000000000000',
        a_qa:       'eeee0003-0000-0000-0000-000000000000',
        a_printer:  'eeee0004-0000-0000-0000-000000000000',
        b_designer: 'eeee0005-0000-0000-0000-000000000000',
        b_editor:   'eeee0006-0000-0000-0000-000000000000',
        b_qa:       'eeee0007-0000-0000-0000-000000000000',
        b_printer:  'eeee0008-0000-0000-0000-000000000000',
    },
} as const;

async function seed(): Promise<void> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) { err('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1); }

    const db = createClient(url, key);

    try {
        log(`Hashing demo password (cost ${process.env.BCRYPT_COST ?? 12})...`);
        const cost = parseInt(process.env.BCRYPT_COST ?? '12', 10);
        const hash = await bcrypt.hash(DEMO_PASSWORD, cost);

        // ── 1. Challenges (= TechSchool missions) ────────────────────────
        log('challenges...');
        const { error: e1 } = await db.from('challenges').upsert([
            {
                id: ID.challenge.gift,
                title: 'אתגר מספר 1 – מתנה',
                description:
                    'מגנים, מדליות ומתנות מודפסות. נלמד טכניקות מידול בסיסיות ומתקדמות, נעצב פריט אישי בעל משמעות, ' +
                    'ונדפיס אותו ב-3D. דגש על דיוק, גימור, וייחוד אישי.',
                is_active: false,
                order_index: 1,
                monday_board_id: null,
            },
            {
                id: ID.challenge.puzzle,
                title: 'אתגר אישי: פאזל — פאזלים לכבדי ראייה',
                description:
                    'יצירת פאזלים תלת-ממדיים נגישים לילדים עם לקויות ראייה. שפה של מגע, חיבורים חכמים עם ' +
                    'מרווח סובלנות 0.2-0.4 מ"מ, וצורות מעולם התוכן של הילדים. גודל 10-16 ס"מ, גובה 10 מ"מ. ' +
                    'יעד: 2-6 חלקים פאזל אחד.',
                is_active: true,
                order_index: 2,
                monday_board_id: null,
            },
            {
                id: ID.challenge.style,
                title: 'אתגר מספר 3 – סטייל אישי',
                description:
                    'אביזרי אופנה ועיצוב מודפסים: טבעות, צמידים, תליונים, משקפיים, מסכות וחלקים זזים. ' +
                    'דגש על קולקציה אחידה, יצירתיות, מורכבות טכנית וגימור.',
                is_active: false,
                order_index: 3,
                monday_board_id: null,
            },
        ], { onConflict: 'id' });
        if (e1) throw new Error(`challenges: ${e1.message}`);

        // ── 2. Sprints (= lesson sets within each mission) ───────────────
        log('sprints...');
        const { error: e2 } = await db.from('sprints').upsert([
            // GIFT — 5 lesson sets, verbatim from TechSchool
            { id: ID.sprint.gift_medal,   challenge_id: ID.challenge.gift, title: 'מדליה למצטיינים',                    description: '5 נושאים — מידול מדליה אישית, חריטה, וגימור.',                  order_index: 1 },
            { id: ID.sprint.gift_parents, challenge_id: ID.challenge.gift, title: 'מתנה להורים',                       description: '9 נושאים — פריט מתנה משמעותי לבני המשפחה.',                       order_index: 2 },
            { id: ID.sprint.gift_simple,  challenge_id: ID.challenge.gift, title: 'מגן הוקרה פשוט',                    description: '2 נושאים — מגן בסיסי עם טקסט ועיצוב פשוט.',                       order_index: 3 },
            { id: ID.sprint.gift_complex, challenge_id: ID.challenge.gift, title: 'מגן הוקרה מורכב',                   description: '2 נושאים — מגן עם קימורים, הבלטות ועיצוב מתקדם.',                 order_index: 4 },
            { id: ID.sprint.gift_more,    challenge_id: ID.challenge.gift, title: 'עוד מתנות (מידול מורכב יותר)',       description: '5 נושאים — מחזיק מפתחות, עציץ, קופסת חתול, כוס לעטים, תג שם.',     order_index: 5 },
            // PUZZLE — 3 lesson sets
            { id: ID.sprint.puzzle_basic,  challenge_id: ID.challenge.puzzle, title: 'פאזלים בסיסיים',  description: '4 נושאים — צורות פשוטות, חיבורים בסיסיים, וסימוני מגע.', order_index: 1 },
            { id: ID.sprint.puzzle_shapes, challenge_id: ID.challenge.puzzle, title: 'פאזלים בצורות',   description: '3 נושאים — צורות מוכרות (חיות / פירות / תחבורה).',         order_index: 2 },
            { id: ID.sprint.puzzle_free,   challenge_id: ID.challenge.puzzle, title: 'פאזלים חופשיים', description: '3 נושאים — תכנון מקורי לבחירת התלמיד.',                       order_index: 3 },
            // STYLE — 7 lesson sets
            { id: ID.sprint.style_party,          challenge_id: ID.challenge.style, title: 'אבזרים למסיבה / סלפי',    description: '3 נושאים — אבזרים יומיומיים לאירועים.', order_index: 1 },
            { id: ID.sprint.style_glasses,        challenge_id: ID.challenge.style, title: 'משקפיים',                 description: '3 נושאים — מסגרות משקפיים מודפסות.',     order_index: 2 },
            { id: ID.sprint.style_rings,          challenge_id: ID.challenge.style, title: 'טבעות',                   description: '4 נושאים — טבעות אישיות בעיצוב חופשי.',  order_index: 3 },
            { id: ID.sprint.style_bracelets,      challenge_id: ID.challenge.style, title: 'צמידים',                  description: '3 נושאים — צמידים וטכניקות שילוב.',       order_index: 4 },
            { id: ID.sprint.style_pendants,       challenge_id: ID.challenge.style, title: 'תליונים וסיכות',           description: '4 נושאים — תכשיטים ופרטי קישוט.',          order_index: 5 },
            { id: ID.sprint.style_masks,          challenge_id: ID.challenge.style, title: 'מסכות',                   description: '2 נושאים — מסכות אופנה ולתחפושת.',        order_index: 6 },
            { id: ID.sprint.style_print_in_place, challenge_id: ID.challenge.style, title: 'מבוא לחלקים זזים — print in place', description: '3 נושאים — חלקים זזים ללא הרכבה.', order_index: 7 },
        ], { onConflict: 'id' });
        if (e2) throw new Error(`sprints: ${e2.message}`);

        // ── 3. Teams (both currently on the puzzle mission) ──────────────
        log('teams...');
        const { error: e3 } = await db.from('teams').upsert([
            { id: ID.team.alpha, name: 'Team Alpha — נבחרת אלפא', accumulated_score: 150, sprint_status: 'active', is_completed: false, current_challenge_id: ID.challenge.puzzle, current_sprint_id: ID.sprint.puzzle_basic },
            { id: ID.team.beta,  name: 'Team Beta — נבחרת בטא',   accumulated_score: 120, sprint_status: 'active', is_completed: false, current_challenge_id: ID.challenge.puzzle, current_sprint_id: ID.sprint.puzzle_basic },
        ], { onConflict: 'id' });
        if (e3) throw new Error(`teams: ${e3.message}`);

        // ── 4. Users (8 students + 1 teacher + 1 admin, all with same hash) ──
        log('users...');
        const { error: e4 } = await db.from('users').upsert([
            { id: ID.user.yael,    name: 'Yael Mizrahi',   email: 'yael@techschool.demo',    password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.alpha, current_role: 'pm',       total_active_time: 3240, is_active: true },
            { id: ID.user.david,   name: 'David Cohen',    email: 'david@techschool.demo',   password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.alpha, current_role: 'qa',       total_active_time: 2880, is_active: true },
            { id: ID.user.noa,     name: 'Noa Ben-David',  email: 'noa@techschool.demo',     password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.alpha, current_role: 'dev',      total_active_time: 4200, is_active: true },
            { id: ID.user.ariel,   name: 'Ariel Levy',     email: 'ariel@techschool.demo',   password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.alpha, current_role: 'hardware', total_active_time: 3600, is_active: true },
            { id: ID.user.maya,    name: 'Maya Shapiro',   email: 'maya@techschool.demo',    password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.beta,  current_role: 'pm',       total_active_time: 2700, is_active: true },
            { id: ID.user.omer,    name: 'Omer Peretz',    email: 'omer@techschool.demo',    password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.beta,  current_role: 'qa',       total_active_time: 3100, is_active: true },
            { id: ID.user.lior,    name: 'Lior Katz',      email: 'lior@techschool.demo',    password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.beta,  current_role: 'dev',      total_active_time: 2400, is_active: true },
            { id: ID.user.tal,     name: 'Tal Friedman',   email: 'tal@techschool.demo',     password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.beta,  current_role: 'hardware', total_active_time: 3900, is_active: true },
            { id: ID.user.teacher, name: 'Teacher Demo',   email: 'teacher@techschool.demo', password_hash: hash, account_type: 'teacher', auth_provider: 'local', current_team_id: null,          current_role: null,       total_active_time: 0,    is_active: true },
            { id: ID.user.admin,   name: 'Admin Demo',     email: 'admin@techschool.demo',   password_hash: hash, account_type: 'admin',   auth_provider: 'local', current_team_id: null,          current_role: null,       total_active_time: 0,    is_active: true },
        ], { onConflict: 'id' });
        if (e4) throw new Error(`users: ${e4.message}`);

        // ── 5. Tasks (puzzle mission, 1 per role per team) ───────────────
        log('tasks...');
        const qaA = { isCompleted: true,  hasErrors: false, improvements: ['חזק את ה-tolerance בין החלקים'] };
        const qaB = { isCompleted: true,  hasErrors: false, improvements: ['סמן בולט ל"למעלה" של החלק'] };
        const qaC = { isCompleted: true,  hasErrors: false, improvements: [] };
        const qaD = { isCompleted: false, hasErrors: true,  improvements: ['חיבורים תפוסים — הגדל מרווח ל-0.3 מ"מ', 'בדוק כיוון הדפסה'] };

        const { error: e5 } = await db.from('tasks').upsert([
            // Team Alpha — Puzzle mission
            { id: ID.task.a_designer, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.alpha, assigned_role: 'dev',
              title: 'מידול פאזל בסיסי ב-Fusion 360',
              description: 'עצבו פאזל 3-4 חלקים, גודל 12ס"מ, גובה 10מ"מ. סימוני מגע על כל חלק.',
              status: 'approved', submission_url: 'https://drive.google.com/demo/puzzle-design-alpha',
              submitted_by: ID.user.noa, reviewed_by_qa: ID.user.david, reviewed_by_pm: ID.user.yael,
              qa_checklist: qaA, qa_notes: 'מידות תקינות, סימוני מגע ברורים.', pm_notes: 'מוכן להדפסה.' },
            { id: ID.task.a_editor, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.alpha, assigned_role: 'pm',
              title: 'הכנת קובץ Slicer + תמיכות',
              description: 'layer 0.2מ"מ, infill 20%, אופטימיזציה לזמן הדפסה.',
              status: 'teacher_review', submission_url: 'https://drive.google.com/demo/puzzle-slicer-alpha',
              submitted_by: ID.user.yael, reviewed_by_qa: ID.user.david, reviewed_by_pm: ID.user.yael,
              qa_checklist: qaB, qa_notes: 'הגדרות נכונות.', pm_notes: 'שולח למורה.' },
            { id: ID.task.a_qa, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.alpha, assigned_role: 'qa',
              title: 'בדיקת tolerance ובדיקת מגע',
              description: 'אמת מרווח 0.2-0.4מ"מ בכל חיבור. בדוק שניתן לזהות חלקים לפי מגע בלבד.',
              status: 'qa_review', submission_url: 'https://drive.google.com/demo/puzzle-qa-alpha',
              submitted_by: ID.user.david },
            { id: ID.task.a_printer, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.alpha, assigned_role: 'hardware',
              title: 'הדפסת הפאזל + הרכבה בעיניים מכוסות',
              description: 'הדפיסו את הפאזל. נסו להרכיב אותו בעיניים מכוסות. תעדו תוצאות.',
              status: 'pending' },
            // Team Beta — Puzzle mission
            { id: ID.task.b_designer, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.beta, assigned_role: 'dev',
              title: 'פאזל חיה מוכרת',
              description: 'עצבו פאזל 4-5 חלקים בצורת חיה (כלב/חתול). גודל 14ס"מ, גובה 12מ"מ.',
              status: 'approved', submission_url: 'https://drive.google.com/demo/puzzle-design-beta',
              submitted_by: ID.user.lior, reviewed_by_qa: ID.user.omer, reviewed_by_pm: ID.user.maya,
              qa_checklist: qaC, pm_notes: 'יצירתי ונגיש למגע.' },
            { id: ID.task.b_editor, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.beta, assigned_role: 'pm',
              title: 'Slicer + תמיכות ל-overhangs',
              description: 'בדוק זוויות overhang, הוסף תמיכות נדרשות, חישב זמן הדפסה.',
              status: 'pm_review', submission_url: 'https://drive.google.com/demo/puzzle-slicer-beta',
              submitted_by: ID.user.maya, reviewed_by_qa: ID.user.omer,
              qa_checklist: qaD, qa_notes: 'חיבורים תפוסים — צריך להגדיל סובלנות.' },
            { id: ID.task.b_qa, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.beta, assigned_role: 'qa',
              title: 'בדיקה איכותית + בדיקת מגע',
              description: 'אמת שכל חלק מסומן לכיוון. אין שני חלקים זהים במגע.',
              status: 'pending' },
            { id: ID.task.b_printer, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.beta, assigned_role: 'hardware',
              title: 'הדפסה + תיעוד',
              description: 'הדפס בשני צבעים שונים. צלם תהליך + תוצר סופי.',
              status: 'pending' },
        ], { onConflict: 'id' });
        if (e5) throw new Error(`tasks: ${e5.message}`);

        // ── 6. Quiz question bank — role-knowledge for pm/qa/dev/hardware ──
        // (Display labels: pm→Editor, qa→QA, dev→Designer, hardware→Printer)
        try {
            log('quiz questions...');
        const roleQuestions: {
            scope: 'role';
            role: 'pm' | 'qa' | 'dev' | 'hardware';
            prompt: string;
            options: string[];
            correct_index: number;
        }[] = [
            // dev = Designer
            { scope: 'role', role: 'dev', prompt: 'In Fusion 360, which feature lets you carve material out of a body?',
              options: ['Extrude — Join', 'Extrude — Cut', 'Sketch — Trim', 'Patch'], correct_index: 1 },
            { scope: 'role', role: 'dev', prompt: 'A "prototype" in 3D-print missions is...',
              options: ['The final, polished part', 'A first version of a model used to test the design', 'A presentation slide', 'A bill of materials'], correct_index: 1 },
            { scope: 'role', role: 'dev', prompt: 'Minimum recommended wall thickness for FDM prints is roughly...',
              options: ['0.1 mm', '1.2 mm', '5 mm', '10 mm'], correct_index: 1 },
            { scope: 'role', role: 'dev', prompt: 'Which file format is the standard 3D-print mesh export?',
              options: ['PNG', 'STL', 'CSV', 'PSD'], correct_index: 1 },
            // pm = Editor (slicer / pre-print prep + review)
            { scope: 'role', role: 'pm', prompt: 'In a slicer, "infill" controls...',
              options: ['Print speed', 'How dense the inside of the part is', 'The bed temperature', 'The filament colour'], correct_index: 1 },
            { scope: 'role', role: 'pm', prompt: 'A typical FDM layer height for a balanced print is...',
              options: ['0.02 mm', '0.20 mm', '2.00 mm', '20 mm'], correct_index: 1 },
            { scope: 'role', role: 'pm', prompt: 'Why generate "supports" in a slicer?',
              options: ['To make the model heavier', 'To hold up overhangs and bridges during printing', 'To save filament', 'To translate text'], correct_index: 1 },
            { scope: 'role', role: 'pm', prompt: 'What is "G-code"?',
              options: ['A grading rubric', 'Instructions the printer executes layer by layer', 'A type of plastic', 'A photo format'], correct_index: 1 },
            // qa
            { scope: 'role', role: 'qa', prompt: 'Submitting work "for QA" means you are asking someone to...',
              options: ['Build it for you', 'Throw it away', 'Check that it meets the requirements', 'Translate it'], correct_index: 2 },
            { scope: 'role', role: 'qa', prompt: 'A "bug" found during QA review is...',
              options: ['An insect on the printer', 'A defect that should be fixed before approval', 'A new feature request', 'A delivery delay'], correct_index: 1 },
            { scope: 'role', role: 'qa', prompt: 'What does "approved" usually mean in the task pipeline?',
              options: ['Pending review', 'Sent back for fixes', 'Signed off as complete', 'Cancelled'], correct_index: 2 },
            { scope: 'role', role: 'qa', prompt: 'If a part fails dimensional check, the right action is to...',
              options: ['Approve anyway', 'Mark needs-fix and explain in the notes', 'Delete the team', 'Ignore it'], correct_index: 1 },
            // hardware = Printer
            { scope: 'role', role: 'hardware', prompt: 'Bed adhesion failures most often happen because...',
              options: ['The filament is too cold and the bed is not level/clean', 'The wifi is slow', 'The model has too many polygons', 'Supports are disabled'], correct_index: 0 },
            { scope: 'role', role: 'hardware', prompt: 'What is "stringing" on a 3D print?',
              options: ['Thin plastic threads between features caused by oozing', 'Audio cables on the printer', 'A type of infill', 'A status code'], correct_index: 0 },
            { scope: 'role', role: 'hardware', prompt: 'You should level the print bed...',
              options: ['Never — it is automatic always', 'When prints start failing or the printer is moved', 'Only on day 1', 'Once a year'], correct_index: 1 },
            { scope: 'role', role: 'hardware', prompt: 'Which is the safer first step when a print fails mid-way?',
              options: ['Hit the printer', 'Pause, inspect, and re-slice if needed', 'Run it again identically and hope', 'Delete the file'], correct_index: 1 },
        ];

            // Pull existing prompts to avoid inserting duplicates on re-run.
            const { data: existing, error: fetchErr } = await db.from('quiz_questions').select('prompt');
            if (fetchErr) throw fetchErr;

            const existingPrompts = new Set(((existing as { prompt: string }[]) ?? []).map((r) => r.prompt));
            const toInsert = roleQuestions.filter((q) => !existingPrompts.has(q.prompt));
            if (toInsert.length > 0) {
                const { error: eq } = await db.from('quiz_questions').insert(toInsert);
                if (eq) throw eq;
            }
        } catch (quizErr: any) {
            if (quizErr.message?.includes('quiz_questions') || quizErr.code === '42P01' || quizErr.message?.includes('schema cache')) {
                log('Skipping quiz seeding: quiz_questions table not found in database.');
            } else {
                log(`Warning: Quiz seeding skipped due to unexpected error: ${quizErr.message}`);
            }
        }

        // ── 7. Hint counters ─────────────────────────────────────────────
        log('hint counters...');
        const { error: e6 } = await db.from('team_hint_counters').upsert([
            { user_id: ID.user.noa,   team_id: ID.team.alpha, hint_count: 2 },
            { user_id: ID.user.ariel, team_id: ID.team.alpha, hint_count: 4 },
            { user_id: ID.user.lior,  team_id: ID.team.beta,  hint_count: 1 },
            { user_id: ID.user.tal,   team_id: ID.team.beta,  hint_count: 3 },
        ], { onConflict: 'user_id,team_id' });
        if (e6) throw new Error(`hint counters: ${e6.message}`);

        // 🟦 8. Hint logs — realistic data for analytics
        log('hint logs...');
        const { error: e7 } = await db.from('hint_logs').upsert([
            // Ariel: 4 hints (needs_attention)
            { id: 'ffff0001-0000-0000-0000-000000000001', user_id: ID.user.ariel, team_id: ID.team.alpha, task_id: ID.task.a_designer, hint_number: 1, hint_text: 'Check your sketch constraints.', points_deducted: 5 },
            { id: 'ffff0001-0000-0000-0000-000000000002', user_id: ID.user.ariel, team_id: ID.team.alpha, task_id: ID.task.a_designer, hint_number: 2, hint_text: 'Use the Mirror tool for symmetry.', points_deducted: 10 },
            { id: 'ffff0001-0000-0000-0000-000000000003', user_id: ID.user.ariel, team_id: ID.team.alpha, task_id: ID.task.a_designer, hint_number: 3, hint_text: 'Check for open profiles in the sketch.', points_deducted: 15 },
            { id: 'ffff0001-0000-0000-0000-000000000004', user_id: ID.user.ariel, team_id: ID.team.alpha, task_id: ID.task.a_designer, hint_number: 4, hint_text: 'Try using the Patch workspace for complex surfaces.', points_deducted: 20 },

            // Noa: 2 hints (watch)
            { id: 'ffff0002-0000-0000-0000-000000000001', user_id: ID.user.noa, team_id: ID.team.alpha, task_id: ID.task.a_printer, hint_number: 1, hint_text: 'Level the bed before starting.', points_deducted: 5 },
            { id: 'ffff0002-0000-0000-0000-000000000002', user_id: ID.user.noa, team_id: ID.team.alpha, task_id: ID.task.a_printer, hint_number: 2, hint_text: 'Apply some glue stick to the bed.', points_deducted: 10 },

            // Tal: 3 hints
            { id: 'ffff0003-0000-0000-0000-000000000001', user_id: ID.user.tal, team_id: ID.team.beta, task_id: ID.task.b_editor, hint_number: 1, hint_text: 'Adjust your retraction settings.', points_deducted: 5 },
            { id: 'ffff0003-0000-0000-0000-000000000002', user_id: ID.user.tal, team_id: ID.team.beta, task_id: ID.task.b_editor, hint_number: 2, hint_text: 'Check your print temperature.', points_deducted: 10 },
            { id: 'ffff0003-0000-0000-0000-000000000003', user_id: ID.user.tal, team_id: ID.team.beta, task_id: ID.task.b_editor, hint_number: 3, hint_text: 'Enable z-hop when retracting.', points_deducted: 15 },
        ], { onConflict: 'id' });
        if (e7) throw new Error(`hint logs: ${e7.message}`);

        log('');
        log('Seed complete.');
        log('');
        log(`Demo password for every account: ${DEMO_PASSWORD}`);
        log('');
        log('Accounts:');
        log('  admin@techschool.demo    — admin (user CRUD)');
        log('  teacher@techschool.demo  — teacher');
        log('  yael, david, noa, ariel  — Team Alpha (pm/qa/dev/hardware → Editor/QA/Designer/Printer)');
        log('  maya, omer, lior, tal    — Team Beta  (pm/qa/dev/hardware → Editor/QA/Designer/Printer)');
    } catch (e) {
        err(`Seed failed: ${(e as Error).message}`);
        process.exit(1);
    }
}

seed();

```

---

## backend/src/student-profile/student-profile.controller.ts
**Type:** backend

```typescript
import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { StudentProfileService } from './student-profile.service';

@Controller('student-profiles')
export class StudentProfileController {
    constructor(private readonly profiles: StudentProfileService) {}

    /** GET /student-profiles */
    @Get()
    getAll() {
        return this.profiles.getAllProfiles();
    }

    /** GET /student-profiles/alerts?unread=true */
    @Get('alerts')
    getAlerts(@Query('unread') unread?: string) {
        return this.profiles.getAlerts(unread !== 'false');
    }

    /** PATCH /student-profiles/alerts/read-all */
    @Patch('alerts/read-all')
    markAllRead() {
        return this.profiles.markAllAlertsRead();
    }

    /** PATCH /student-profiles/alerts/:id/read */
    @Patch('alerts/:id/read')
    markRead(@Param('id') id: string) {
        return this.profiles.markAlertRead(id);
    }

    /** GET /student-profiles/:userId */
    @Get(':userId')
    getOne(@Param('userId') userId: string) {
        return this.profiles.getProfile(userId);
    }

    /** GET /student-profiles/:userId/snapshots */
    @Get(':userId/snapshots')
    getSnapshots(@Param('userId') userId: string) {
        return this.profiles.getSnapshots(userId);
    }
}

```

---

## backend/src/student-profile/student-profile.module.ts
**Type:** backend

```typescript
import { Module } from '@nestjs/common';
import { StudentProfileService } from './student-profile.service';
import { StudentProfileController } from './student-profile.controller';

@Module({
    providers: [StudentProfileService],
    controllers: [StudentProfileController],
    exports: [StudentProfileService],
})
export class StudentProfileModule {}

```

---

## backend/src/student-profile/student-profile.service.ts
**Type:** backend

```typescript
/**
 * StudentProfileService — maintains per-student learning profiles.
 *
 * A profile aggregates jargon/soft-skill scores from conversation analyses.
 * After each update a snapshot is saved so teachers can track progress over time.
 * Profiles are created lazily on first update.
 *
 * @version 1.10
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AIAnalysisResult } from '../integrations/ai/ai.service';

export interface StudentProfile {
    id: string;
    userId: string;
    jargonScore: number;
    softSkillScore: number;
    detectedTerms: string[];
    struggleAreas: string[];
    alertLevel: 'none' | 'low' | 'medium' | 'high';
    lastAlertMessage: string | null;
    messagesAnalyzed: number;
    lastAnalyzedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ProfileSnapshot {
    id: string;
    userId: string;
    jargonScore: number;
    softSkillScore: number;
    detectedTerms: string[];
    snapshotAt: string;
}

export interface TeacherAlert {
    id: string;
    userId: string | null;
    channelId: string | null;
    alertType: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

@Injectable()
export class StudentProfileService {
    private readonly logger = new Logger(StudentProfileService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async getProfile(userId: string): Promise<StudentProfile | null> {
        const { data } = await this.supabase.db
            .from('student_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        return data ? this.mapProfile(data as any) : null;
    }

    async getAllProfiles(): Promise<StudentProfile[]> {
        const { data } = await this.supabase.db
            .from('student_profiles')
            .select('*')
            .order('updated_at', { ascending: false });

        return (data ?? []).map((r: any) => this.mapProfile(r));
    }

    async getSnapshots(userId: string): Promise<ProfileSnapshot[]> {
        const { data } = await this.supabase.db
            .from('profile_snapshots')
            .select('*')
            .eq('user_id', userId)
            .order('snapshot_at', { ascending: true });

        return (data ?? []).map((r: any) => this.mapSnapshot(r));
    }

    async getAlerts(onlyUnread = true): Promise<TeacherAlert[]> {
        let query = this.supabase.db
            .from('teacher_alerts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (onlyUnread) query = query.eq('is_read', false);

        const { data } = await query;
        return (data ?? []).map((r: any) => this.mapAlert(r));
    }

    async markAlertRead(alertId: string): Promise<void> {
        await this.supabase.db
            .from('teacher_alerts')
            .update({ is_read: true })
            .eq('id', alertId);
    }

    async markAllAlertsRead(): Promise<void> {
        await this.supabase.db
            .from('teacher_alerts')
            .update({ is_read: true })
            .eq('is_read', false);
    }

    /**
     * Upserts profile from an AI analysis result and saves a snapshot.
     * Scores are averaged with the running weighted mean.
     * Creates a teacher_alert if alertLevel != 'none'.
     */
    async updateFromAnalysis(userId: string, analysis: AIAnalysisResult, channelId?: string): Promise<void> {
        const existing = await this.getProfile(userId);
        const analyzed = (existing?.messagesAnalyzed ?? 0) + 1;

        const jargonScore = existing
            ? (existing.jargonScore * existing.messagesAnalyzed + analysis.jargonScore) / analyzed
            : analysis.jargonScore;

        const softSkillScore = existing
            ? (existing.softSkillScore * existing.messagesAnalyzed + analysis.softSkillScore) / analyzed
            : analysis.softSkillScore;

        const terms = Array.from(
            new Set([...(existing?.detectedTerms ?? []), ...analysis.detectedTerms]),
        );

        const struggleAreas = Array.from(
            new Set([...(existing?.struggleAreas ?? []), ...analysis.struggleAreas]),
        ).slice(0, 20);

        const now = new Date().toISOString();

        const { error } = await this.supabase.db
            .from('student_profiles')
            .upsert(
                {
                    user_id: userId,
                    jargon_score: parseFloat(jargonScore.toFixed(2)),
                    soft_skill_score: parseFloat(softSkillScore.toFixed(2)),
                    detected_terms: terms,
                    struggle_areas: struggleAreas,
                    alert_level: analysis.alertLevel,
                    last_alert_message: analysis.alertMessage || null,
                    messages_analyzed: analyzed,
                    last_analyzed_at: now,
                    updated_at: now,
                },
                { onConflict: 'user_id' },
            );

        if (error) {
            this.logger.error('Failed to upsert student profile', error.message);
            return;
        }

        await this.supabase.db.from('profile_snapshots').insert({
            user_id: userId,
            jargon_score: parseFloat(jargonScore.toFixed(2)),
            soft_skill_score: parseFloat(softSkillScore.toFixed(2)),
            detected_terms: terms,
        });

        if (analysis.alertLevel !== 'none' && analysis.alertMessage) {
            await this.supabase.db.from('teacher_alerts').insert({
                user_id: userId,
                channel_id: channelId ?? null,
                alert_type: analysis.alertLevel === 'high' ? 'stuck' : 'knowledge_gap',
                message: analysis.alertMessage,
                is_read: false,
            });
            this.logger.warn(`Alert [${analysis.alertLevel}] created for ${userId}: ${analysis.alertMessage}`);
        }

        this.logger.log(
            `Profile updated for ${userId}: jargon=${jargonScore.toFixed(1)}, soft=${softSkillScore.toFixed(1)}, alert=${analysis.alertLevel}`,
        );
    }

    /** Snapshot current profile without running a new analysis */
    async snapshot(userId: string): Promise<void> {
        const profile = await this.getProfile(userId);
        if (!profile) return;

        await this.supabase.db.from('profile_snapshots').insert({
            user_id: userId,
            jargon_score: profile.jargonScore,
            soft_skill_score: profile.softSkillScore,
            detected_terms: profile.detectedTerms,
        });
    }

    private mapProfile(r: any): StudentProfile {
        return {
            id: r.id,
            userId: r.user_id,
            jargonScore: parseFloat(r.jargon_score),
            softSkillScore: parseFloat(r.soft_skill_score),
            detectedTerms: r.detected_terms ?? [],
            struggleAreas: r.struggle_areas ?? [],
            alertLevel: r.alert_level ?? 'none',
            lastAlertMessage: r.last_alert_message ?? null,
            messagesAnalyzed: r.messages_analyzed,
            lastAnalyzedAt: r.last_analyzed_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }

    private mapSnapshot(r: any): ProfileSnapshot {
        return {
            id: r.id,
            userId: r.user_id,
            jargonScore: parseFloat(r.jargon_score),
            softSkillScore: parseFloat(r.soft_skill_score),
            detectedTerms: r.detected_terms ?? [],
            snapshotAt: r.snapshot_at,
        };
    }

    private mapAlert(r: any): TeacherAlert {
        return {
            id: r.id,
            userId: r.user_id,
            channelId: r.channel_id,
            alertType: r.alert_type,
            message: r.message,
            isRead: r.is_read,
            createdAt: r.created_at,
        };
    }
}

```

---

## backend/src/supabase/supabase.module.ts
**Type:** backend

```typescript
import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
    providers: [SupabaseService],
    exports: [SupabaseService],
})
export class SupabaseModule {}

```

---

## backend/src/supabase/supabase.service.ts
**Type:** backend

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
    private readonly logger = new Logger(SupabaseService.name);
    private client!: SupabaseClient;

    onModuleInit(): void {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !key) {
            this.logger.warn(
                'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — DB calls will fail',
            );
        }

        // Service-role key bypasses RLS — backend is trusted
        this.client = createClient(url ?? '', key ?? '');
        this.logger.log('Supabase client initialised (service role)');
    }

    get db(): SupabaseClient {
        return this.client;
    }
}

```

---

## backend/src/tasks/dto/pm-review.dto.ts
**Type:** backend

```typescript
import { IsString, IsEnum, IsOptional } from 'class-validator';

export type PmDecision = 'approve' | 'reject';

export class PmReviewDto {
    @IsString()
    taskId!: string;

    @IsString()
    userId!: string;

    @IsEnum(['approve', 'reject'])
    decision!: PmDecision;

    @IsString()
    @IsOptional()
    notes?: string;
}

```

---

## backend/src/tasks/dto/qa-review.dto.ts
**Type:** backend

```typescript
import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';

export type QaDecision = 'approve' | 'reject';

export interface QaChecklist {
    isCompleted: boolean;
    hasErrors: boolean;
    improvements: string[];
}

export class QaReviewDto {
    @IsString()
    taskId!: string;

    @IsString()
    userId!: string;

    @IsEnum(['approve', 'reject'])
    decision!: QaDecision;

    @IsObject()
    checklist!: QaChecklist;

    @IsString()
    @IsOptional()
    notes?: string;
}

```

---

## backend/src/tasks/dto/submit-task.dto.ts
**Type:** backend

```typescript
import { IsString, IsOptional, IsUrl } from 'class-validator';

export class SubmitTaskDto {
    @IsString()
    taskId!: string;

    @IsString()
    userId!: string;

    @IsString()
    @IsOptional()
    submissionUrl?: string;

    @IsString()
    @IsOptional()
    submissionImageUrl?: string;
}

```

---

## backend/src/tasks/tasks.controller.ts
**Type:** backend

```typescript
import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    HttpCode,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { QaReviewDto } from './dto/qa-review.dto';
import { PmReviewDto } from './dto/pm-review.dto';

@Controller('tasks')
export class TasksController {
    constructor(private readonly tasks: TasksService) {}

    @Get('team/:teamId')
    getByTeam(@Param('teamId') teamId: string) {
        return this.tasks.getTasksByTeam(teamId);
    }

    @Post('submit')
    @HttpCode(200)
    submit(@Body() dto: SubmitTaskDto) {
        return this.tasks.submitTask(dto);
    }

    @Post('qa-review')
    @HttpCode(200)
    qaReview(@Body() dto: QaReviewDto) {
        return this.tasks.qaReview(dto);
    }

    @Post('pm-review')
    @HttpCode(200)
    pmReview(@Body() dto: PmReviewDto) {
        return this.tasks.pmReview(dto);
    }
}

```

---

## backend/src/tasks/tasks.module.ts
**Type:** backend

```typescript
import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { MondayApiModule } from '../integrations/monday/monday-api.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
    imports: [MondayApiModule, TeamsModule],
    providers: [TasksService],
    controllers: [TasksController],
    exports: [TasksService],
})
export class TasksModule {}

```

---

## backend/src/tasks/tasks.service.ts
**Type:** backend

```typescript
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MondayApiService } from '../integrations/monday/monday-api.service';
import { TeamsService } from '../teams/teams.service';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { QaReviewDto } from './dto/qa-review.dto';
import { PmReviewDto } from './dto/pm-review.dto';

export type TaskStatus =
    | 'pending'
    | 'qa_review'
    | 'pm_review'
    | 'teacher_review'
    | 'approved'
    | 'rejected';

export interface Task {
    id: string;
    sprint_id: string;
    team_id: string;
    assigned_role: 'pm' | 'qa' | 'dev' | 'hardware';
    title: string;
    description: string | null;
    status: TaskStatus;
    submission_url: string | null;
    submission_image_url: string | null;
    monday_item_id: number | null;
    qa_checklist: unknown;
    qa_notes: string | null;
    pm_notes: string | null;
    submitted_by: string | null;
    reviewed_by_qa: string | null;
    reviewed_by_pm: string | null;
    created_at: string;
    updated_at: string;
}

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly mondayApi: MondayApiService,
        private readonly teamsService: TeamsService,
    ) {}

    async submitTask(dto: SubmitTaskDto): Promise<Task> {
        const task = await this.fetchTask(dto.taskId);

        if (!['pending', 'rejected'].includes(task.status)) {
            throw new BadRequestException(
                `Task cannot be submitted from status "${task.status}"`,
            );
        }

        await this.assertUserRole(dto.userId, task.team_id, ['dev', 'hardware']);

        const { data, error } = await this.supabase.db
            .from('tasks')
            .update({
                status: 'qa_review',
                submission_url: dto.submissionUrl ?? null,
                submission_image_url: dto.submissionImageUrl ?? null,
                submitted_by: dto.userId,
            })
            .eq('id', dto.taskId)
            .select()
            .single();

        if (error) throw new InternalServerErrorException(error.message);
        return data as Task;
    }

    async qaReview(dto: QaReviewDto): Promise<Task> {
        const task = await this.fetchTask(dto.taskId);

        if (task.status !== 'qa_review') {
            throw new BadRequestException(
                `Task is not awaiting QA review (current: "${task.status}")`,
            );
        }
        await this.assertUserRole(dto.userId, task.team_id, ['qa']);

        const newStatus: TaskStatus = dto.decision === 'approve' ? 'pm_review' : 'pending';

        const { data, error } = await this.supabase.db
            .from('tasks')
            .update({
                status: newStatus,
                qa_checklist: dto.checklist ?? null,
                qa_notes: dto.notes ?? null,
                reviewed_by_qa: dto.userId,
            })
            .eq('id', dto.taskId)
            .select()
            .single();

        if (error) throw new InternalServerErrorException(error.message);
        return data as Task;
    }

    async pmReview(dto: PmReviewDto): Promise<Task> {
        const task = await this.fetchTask(dto.taskId);

        if (task.status !== 'pm_review') {
            throw new BadRequestException(
                `Task is not awaiting PM review (current: "${task.status}")`,
            );
        }
        await this.assertUserRole(dto.userId, task.team_id, ['pm']);

        if (dto.decision === 'approve') {
            const { data, error } = await this.supabase.db
                .from('tasks')
                .update({
                    status: 'teacher_review',
                    pm_notes: dto.notes ?? null,
                    reviewed_by_pm: dto.userId,
                })
                .eq('id', dto.taskId)
                .select()
                .single();

            if (error) throw new InternalServerErrorException(error.message);

            if (task.monday_item_id) {
                await this.mondayApi.updateItemStatus(task.monday_item_id, 'Pending Teacher Review');
            }
            this.logger.log(`[HARDWARE_EVENT] GREEN_LED on | task_id=${dto.taskId} team_id=${task.team_id}`);
            return data as Task;
        } else {
            const { data, error } = await this.supabase.db
                .from('tasks')
                .update({
                    status: 'qa_review',
                    pm_notes: dto.notes ?? null,
                })
                .eq('id', dto.taskId)
                .select()
                .single();

            if (error) throw new InternalServerErrorException(error.message);
            return data as Task;
        }
    }

    async teacherApprove(taskId: string): Promise<void> {
        const task = await this.fetchTask(taskId);

        if (task.status !== 'teacher_review') {
            this.logger.warn(
                `teacherApprove called on task ${taskId} with status "${task.status}" — ignoring`,
            );
            return;
        }

        const { error } = await this.supabase.db
            .from('tasks')
            .update({ status: 'approved' })
            .eq('id', taskId);

        if (error) throw new InternalServerErrorException(error.message);
        this.logger.log(`Task ${taskId} approved by teacher`);
        await this.teamsService.checkAndCompleteTeam(task.team_id, task.sprint_id);
    }

    async getTasksByTeam(teamId: string): Promise<Task[]> {
        const { data, error } = await this.supabase.db
            .from('tasks')
            .select('*')
            .eq('team_id', teamId)
            .order('created_at', { ascending: true });

        if (error) throw new InternalServerErrorException(error.message);
        return (data ?? []) as Task[];
    }

    private async fetchTask(taskId: string): Promise<Task> {
        const { data, error } = await this.supabase.db
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .maybeSingle();

        if (error) throw new InternalServerErrorException(error.message);
        if (!data) throw new NotFoundException(`Task "${taskId}" not found`);
        return data as Task;
    }

    private async assertUserRole(userId: string, teamId: string, allowedRoles: string[]): Promise<void> {
        const { data } = await this.supabase.db
            .from('users')
            .select('current_role, current_team_id')
            .eq('id', userId)
            .maybeSingle();

        if (!data) throw new UnauthorizedException('User not found');
        if (data.current_team_id !== teamId) throw new ForbiddenException('User does not belong to this team');
        if (!allowedRoles.includes(data.current_role)) {
            throw new ForbiddenException(
                `Role "${data.current_role}" cannot perform this action (allowed: ${allowedRoles.join(', ')})`,
            );
        }
    }
}

```

---

## backend/src/teacher/dto/assign-roles.dto.ts
**Type:** backend

```typescript
import { Type } from 'class-transformer';
import {
    IsArray,
    IsIn,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ROLE_PRIORITY, StudentRole } from '../teacher.types';

export class RoleAssignmentItemDto {
    @ApiProperty()
    @IsUUID()
    userId!: string;

    @ApiProperty({ enum: ROLE_PRIORITY })
    @IsIn(ROLE_PRIORITY as unknown as string[])
    role!: StudentRole;
}

export class AssignRolesDto {
    @ApiProperty({ type: [RoleAssignmentItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RoleAssignmentItemDto)
    assignments!: RoleAssignmentItemDto[];

    @ApiProperty({ required: false })
    @IsUUID()
    @IsOptional()
    challengeId?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    assignedBy?: string;
}

```

---

## backend/src/teacher/dto/publish-challenge.dto.ts
**Type:** backend

```typescript
import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PublishChallengeDto {
    @ApiProperty({ description: 'Team that receives the challenge' })
    @IsUUID()
    teamId!: string;
}

```

---

## backend/src/teacher/teacher.controller.ts
**Type:** backend

```typescript
/**
 * Teacher REST endpoints — challenge publishing + role assignments.
 *
 * @version 1.00
 */

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TeacherService } from './teacher.service';
import { PublishChallengeDto } from './dto/publish-challenge.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

@ApiTags('teacher')
@Controller('teacher')
export class TeacherController {
    constructor(private readonly teacher: TeacherService) {}

    @Get('challenges')
    getChallenges() {
        return this.teacher.getChallenges();
    }

    @Get('teams')
    getTeams() {
        return this.teacher.getTeams();
    }

    @Get('teams/:teamId/students-with-role-history')
    getStudentsWithRoleHistory(@Param('teamId') teamId: string) {
        return this.teacher.getStudentsWithRoleHistory(teamId);
    }

    @Post('challenges/:challengeId/publish')
    publishChallenge(
        @Param('challengeId') challengeId: string,
        @Body() dto: PublishChallengeDto,
    ) {
        return this.teacher.publishChallenge(challengeId, dto);
    }

    @Post('teams/:teamId/assign-roles')
    assignRoles(@Param('teamId') teamId: string, @Body() dto: AssignRolesDto) {
        return this.teacher.assignRoles(teamId, dto);
    }

    @Post('teams/:teamId/auto-assign-roles')
    autoAssignRoles(
        @Param('teamId') teamId: string,
        @Body() body: { challengeId?: string },
    ) {
        return this.teacher.autoAssignRoles(teamId, body?.challengeId);
    }
}

```

---

## backend/src/teacher/teacher.module.ts
**Type:** backend

```typescript
import { Module } from '@nestjs/common';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';

@Module({
    controllers: [TeacherController],
    providers: [TeacherService],
    exports: [TeacherService],
})
export class TeacherModule {}

```

---

## backend/src/teacher/teacher.service.ts
**Type:** backend

```typescript
/**
 * Teacher workflow — publish a challenge to a single team and assign
 * professional roles, with history tracking and fair auto-assignment.
 *
 * @version 1.00
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
    ROLE_PRIORITY,
    RoleCount,
    StudentRole,
    StudentWithRoleHistory,
} from './teacher.types';
import { PublishChallengeDto } from './dto/publish-challenge.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

@Injectable()
export class TeacherService {
    private readonly logger = new Logger(TeacherService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async getChallenges(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('challenges')
            .select('id, title, description, is_active, order_index, created_at')
            .order('order_index', { ascending: true });
        return data ?? [];
    }

    async getTeams(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('teams')
            .select('id, name, sprint_status, is_completed, current_challenge_id')
            .order('name', { ascending: true });
        return data ?? [];
    }

    async getStudentsWithRoleHistory(
        teamId: string,
    ): Promise<StudentWithRoleHistory[]> {
        const { data: students } = await this.supabase.db
            .from('users')
            .select('id, name, email, current_role')
            .eq('current_team_id', teamId)
            .eq('account_type', 'student')
            .order('name', { ascending: true });

        const results: StudentWithRoleHistory[] = [];
        for (const s of students ?? []) {
            const { data: history } = await this.supabase.db
                .from('student_role_history')
                .select('role, created_at')
                .eq('user_id', s.id)
                .order('created_at', { ascending: false })
                .limit(20);

            const roleCount = Object.fromEntries(
                ROLE_PRIORITY.map((r) => [r, 0]),
            ) as unknown as RoleCount;
            for (const h of history ?? []) {
                roleCount[h.role as StudentRole]++;
            }

            const lastRoles = (history ?? [])
                .slice(0, 3)
                .map((h: { role: string }) => h.role as StudentRole);

            results.push({
                id: s.id,
                name: s.name,
                email: s.email,
                currentRole: s.current_role as StudentRole | null,
                lastRoles,
                roleCount,
                suggestedRole: null,
            });
        }
        return results;
    }

    async publishChallenge(
        challengeId: string,
        dto: PublishChallengeDto,
    ): Promise<{ ok: true; challengeId: string; teamId: string }> {
        const { data: challenge } = await this.supabase.db
            .from('challenges')
            .select('id')
            .eq('id', challengeId)
            .maybeSingle();
        if (!challenge) throw new BadRequestException('Challenge not found');

        const { data: team } = await this.supabase.db
            .from('teams')
            .select('id')
            .eq('id', dto.teamId)
            .maybeSingle();
        if (!team) throw new BadRequestException('Team not found');

        await this.supabase.db
            .from('teams')
            .update({
                current_challenge_id: challengeId,
                sprint_status: 'active',
                is_completed: false,
            })
            .eq('id', dto.teamId);

        await this.supabase.db
            .from('challenges')
            .update({ is_active: true })
            .eq('id', challengeId);

        this.logger.log(
            `Published challenge ${challengeId} to team ${dto.teamId}`,
        );
        return { ok: true, challengeId, teamId: dto.teamId };
    }

    async assignRoles(
        teamId: string,
        dto: AssignRolesDto,
    ): Promise<{ ok: true; assigned: number }> {
        for (const item of dto.assignments) {
            const { data: user } = await this.supabase.db
                .from('users')
                .select('id, current_team_id')
                .eq('id', item.userId)
                .maybeSingle();

            if (!user || user.current_team_id !== teamId) {
                throw new BadRequestException(
                    `User ${item.userId} does not belong to team ${teamId}`,
                );
            }

            await this.applyRoleAssignment(
                item.userId,
                teamId,
                item.role,
                'manual',
                dto.assignedBy ?? null,
                dto.challengeId ?? null,
            );
        }
        return { ok: true, assigned: dto.assignments.length };
    }

    async autoAssignRoles(
        teamId: string,
        challengeId?: string,
    ): Promise<StudentWithRoleHistory[]> {
        const students = await this.getStudentsWithRoleHistory(teamId);
        const assignments = this.computeAutoAssignment(students);

        for (const item of assignments) {
            await this.applyRoleAssignment(
                item.userId,
                teamId,
                item.role,
                'automatic',
                'auto',
                challengeId ?? null,
            );
        }

        const refreshed = await this.getStudentsWithRoleHistory(teamId);
        const suggested = new Map(assignments.map((a) => [a.userId, a.role]));
        return refreshed.map((s) => ({
            ...s,
            suggestedRole: suggested.get(s.id) ?? null,
        }));
    }

    private async applyRoleAssignment(
        userId: string,
        teamId: string,
        role: StudentRole,
        source: 'manual' | 'automatic',
        assignedBy: string | null,
        challengeId: string | null,
    ): Promise<void> {
        await this.supabase.db
            .from('users')
            .update({ current_role: role })
            .eq('id', userId);

        await this.supabase.db.from('student_role_history').insert({
            user_id: userId,
            team_id: teamId,
            challenge_id: challengeId,
            role,
            assignment_source: source,
            assigned_by: assignedBy,
        });
    }

    private computeAutoAssignment(
        students: Pick<StudentWithRoleHistory, 'id' | 'roleCount' | 'lastRoles'>[],
    ): { userId: string; role: StudentRole }[] {
        const n = students.length;
        const availableRoles = ROLE_PRIORITY.slice(0, n) as StudentRole[];

        const assigned = new Set<string>();
        const result: { userId: string; role: StudentRole }[] = [];

        for (const role of availableRoles) {
            let bestStudent: string | null = null;
            let bestScore = Infinity;

            for (const student of students) {
                if (assigned.has(student.id)) continue;
                const timesHad = student.roleCount[role] ?? 0;
                const recencyPenalty = student.lastRoles[0] === role ? 2 : 0;
                const score = timesHad * 2 + recencyPenalty;
                if (score < bestScore) {
                    bestScore = score;
                    bestStudent = student.id;
                }
            }

            if (bestStudent) {
                result.push({ userId: bestStudent, role });
                assigned.add(bestStudent);
            }
        }
        return result;
    }
}

```

---

## backend/src/teacher/teacher.types.ts
**Type:** backend

```typescript
/**
 * Shared role constants and types for the teacher workflow.
 *
 * Internal role keys stay as the original taxonomy (pm/qa/dev/hardware) so
 * the existing DB CHECK constraints, task pipeline, and JWT payload all
 * remain valid. Display labels — "Editor", "QA", "Designer", "Printer" —
 * are mapped at the UI layer (frontend ROLE_LABELS).
 *
 * @version 1.10
 */

export const ROLE_PRIORITY = ['pm', 'qa', 'dev', 'hardware'] as const;

export type StudentRole = typeof ROLE_PRIORITY[number];

export interface RoleCount {
    pm: number;
    qa: number;
    dev: number;
    hardware: number;
}

export interface StudentWithRoleHistory {
    id: string;
    name: string;
    email: string;
    currentRole: StudentRole | null;
    lastRoles: StudentRole[];
    roleCount: RoleCount;
    suggestedRole: StudentRole | null;
}

```

---

## backend/src/teams/analytics.interfaces.ts
**Type:** backend

```typescript
export interface TeacherDashboardSummary {
  totalStudents: number;
  totalTeams: number;
  activeTeams: number;
  approvedTasks: number;
  totalTasks: number;
  averageProgressPercent: number;
}

export interface StudentInsight {
  userId: string;
  name: string;
  email: string;
  teamId: string | null;
  teamName: string | null;
  role: 'pm' | 'qa' | 'dev' | 'hardware' | null;
  totalActiveTimeSeconds: number;
  totalTasks: number;
  approvedTasks: number;
  hintCount: number;
  tasksPerHour: number | null;
  riskLevel: 'ok' | 'watch' | 'needs_attention';
  insightReason: string;
}

export interface TeamInsight {
  teamId: string;
  teamName: string;
  score: number;
  sprintStatus: string;
  isCompleted: boolean;
  totalTasks: number;
  approvedTasks: number;
  progressPercent: number;
  totalHints: number;
}

export interface DifficultTask {
  taskId: string;
  title: string;
  teamName: string;
  hintCount: number;
  status: string;
}

export interface TeacherDashboard {
  summary: TeacherDashboardSummary;
  students: StudentInsight[];
  teams: TeamInsight[];
  difficultTasks: DifficultTask[];
}

```

---

## backend/src/teams/dto/create-student-note.dto.ts
**Type:** backend

```typescript
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateStudentNoteDto {
    @IsString()
    @IsNotEmpty()
    note!: string;

    @IsString()
    @IsOptional()
    teacherId?: string;
}

```

---

## backend/src/teams/dto/create-team-note.dto.ts
**Type:** backend

```typescript
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTeamNoteDto {
    @IsString()
    @IsNotEmpty()
    note!: string;

    @IsString()
    @IsOptional()
    teacherId?: string;
}

```

---

## backend/src/teams/teams.controller.ts
**Type:** backend

```typescript
import { Controller, Get, Param, Query, Post, Body, HttpCode } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamNoteDto } from './dto/create-team-note.dto';
import { CreateStudentNoteDto } from './dto/create-student-note.dto';

@Controller('teams')
export class TeamsController {
    constructor(private readonly teams: TeamsService) {}

    @Get('leaderboard/group')
    getGroupLeaderboard() {
        return this.teams.getGroupLeaderboard();
    }

    @Get('leaderboard/individual')
    getIndividualLeaderboard() {
        return this.teams.getIndividualLeaderboard();
    }

    @Get('analytics')
    getAnalytics() {
        return this.teams.getTeacherAnalytics();
    }

    @Get('analytics/teacher-dashboard')
    getTeacherDashboard() {
        return this.teams.getTeacherDashboard();
    }

    @Get(':id')
    getTeam(@Param('id') id: string) {
        return this.teams.getTeamById(id);
    }

    @Get(':id/sprint-progress')
    getSprintProgress(
        @Param('id') teamId: string,
        @Query('sprintId') sprintId: string,
    ) {
        return this.teams.getSprintProgress(teamId, sprintId);
    }

    @Get(':id/notes')
    listNotes(@Param('id') teamId: string) {
        return this.teams.listGroupNotes(teamId);
    }

    @Post(':id/notes')
    @HttpCode(201)
    createNote(@Param('id') teamId: string, @Body() dto: CreateTeamNoteDto) {
        return this.teams.createGroupNote(teamId, dto.note, dto.teacherId);
    }

    @Get('students/:studentId/notes')
    listStudentNotes(@Param('studentId') studentId: string) {
        return this.teams.listStudentNotes(studentId);
    }

    @Post('students/:studentId/notes')
    @HttpCode(201)
    createStudentNote(@Param('studentId') studentId: string, @Body() dto: CreateStudentNoteDto) {
        return this.teams.createStudentNote(studentId, dto.note, dto.teacherId);
    }
}

```

---

## backend/src/teams/teams.module.ts
**Type:** backend

```typescript
import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';

@Module({
    providers: [TeamsService],
    controllers: [TeamsController],
    exports: [TeamsService],
})
export class TeamsModule {}

```

---

## backend/src/teams/teams.service.ts
**Type:** backend

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
    TeacherDashboard,
    StudentInsight,
    TeamInsight,
    DifficultTask,
} from './analytics.interfaces';

@Injectable()
export class TeamsService {
    private readonly logger = new Logger(TeamsService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async getTeacherDashboard(): Promise<TeacherDashboard> {
        // 1. Fetch data from views and tables
        let studentAnalytics: any[] = [];
        let teamLeaderboard: any[] = [];
        let allTeams: any[] = [];
        let allTasks: any[] = [];
        let allHints: any[] = [];

        try {
            const [
                { data: sData, error: sErr },
                { data: tData, error: tErr },
                { data: teamsData, error: teamsErr },
                { data: tasksData, error: tasksErr },
                { data: hintsData, error: hintsErr },
            ] = await Promise.all([
                this.supabase.db.from('teacher_analytics').select('*'),
                this.supabase.db.from('group_leaderboard').select('*'),
                this.supabase.db.from('teams').select('id, name'),
                this.supabase.db.from('tasks').select('id, title, team_id, status'),
                this.supabase.db.from('hint_logs').select('id, user_id, team_id, task_id'),
            ]);

            if (sErr) this.logger.error(`Student analytics fetch error: ${sErr.message}`);
            if (tErr) this.logger.error(`Team leaderboard fetch error: ${tErr.message}`);
            if (teamsErr) this.logger.error(`Teams fetch error: ${teamsErr.message}`);
            if (tasksErr) this.logger.error(`Tasks fetch error: ${tasksErr.message}`);
            if (hintsErr) this.logger.error(`Hints fetch error: ${hintsErr.message}`);

            studentAnalytics = sData ?? [];
            teamLeaderboard = tData ?? [];
            allTeams = teamsData ?? [];
            allTasks = tasksData ?? [];
            allHints = hintsData ?? [];
        } catch (err) {
            this.logger.error(`Unexpected error during teacher dashboard data fetch: ${err}`);
        }

        const teamsMap = new Map(allTeams.map((t) => [t.id, t.name]));

        // 2. Process Students
        const students: StudentInsight[] = studentAnalytics.map((s) => {
            const studentId = s.id || s.user_id;
            const userHints = allHints.filter((h) => h.user_id === studentId).length;
            const activeTime = s.total_active_time ?? 0;
            const approved = s.approved_tasks ?? 0;

            let riskLevel: StudentInsight['riskLevel'] = 'ok';
            let insightReason = 'Normal progress';

            // Risk Scoring Logic
            if (activeTime > 3600 && approved === 0) {
                riskLevel = 'needs_attention';
                insightReason = 'High active time but no tasks approved';
            } else if (userHints >= 4) {
                riskLevel = 'needs_attention';
                insightReason = 'High hint usage (potential blocker)';
            } else if (activeTime < 900 && approved > 2) {
                riskLevel = 'watch';
                insightReason = 'Unusually fast task completion';
            } else if (userHints >= 2) {
                riskLevel = 'watch';
                insightReason = 'Moderate hint usage';
            } else if (activeTime > 1800 && approved < 1) {
                riskLevel = 'watch';
                insightReason = 'Low progress relative to time spent';
            }

            return {
                userId: studentId,
                name: s.name,
                email: s.email,
                teamId: s.current_team_id,
                teamName: s.current_team_id ? teamsMap.get(s.current_team_id) || null : null,
                role: s.current_role,
                totalActiveTimeSeconds: activeTime,
                totalTasks: s.total_tasks ?? 0,
                approvedTasks: approved,
                hintCount: userHints,
                tasksPerHour: s.tasks_per_hour ?? null,
                riskLevel,
                insightReason,
            };
        });

        // 3. Process Teams
        const teams: TeamInsight[] = teamLeaderboard.map((t) => {
            const teamTasks = allTasks.filter((tk) => tk.team_id === t.id);
            const teamHints = allHints.filter((h) => h.team_id === t.id).length;
            const total = teamTasks.length;
            const approved = t.approved_task_count ?? 0;
            const progress = total > 0 ? Math.round((approved / total) * 100) : 0;

            return {
                teamId: t.id,
                teamName: t.name,
                score: t.accumulated_score ?? 0,
                sprintStatus: t.sprint_status,
                isCompleted: t.is_completed ?? false,
                totalTasks: total,
                approvedTasks: approved,
                progressPercent: progress,
                totalHints: teamHints,
            };
        });

        // 4. Process Difficult Tasks (top 5 by hint count)
        const taskHints = new Map<string, number>();
        allHints.forEach((h) => {
            if (h.task_id) {
                taskHints.set(h.task_id, (taskHints.get(h.task_id) || 0) + 1);
            }
        });

        const difficultTasks: DifficultTask[] = allTasks
            .map((tk) => ({
                taskId: tk.id,
                title: tk.title,
                teamName: teamsMap.get(tk.team_id) || 'Unknown',
                hintCount: taskHints.get(tk.id) || 0,
                status: tk.status,
            }))
            .filter((tk) => tk.hintCount > 0)
            .sort((a, b) => b.hintCount - a.hintCount)
            .slice(0, 5);

        // 5. Summary
        const totalTasksSummary = teams.reduce((acc, t) => acc + t.totalTasks, 0);
        const approvedTasksSummary = teams.reduce((acc, t) => acc + t.approvedTasks, 0);
        const activeTeams = teams.filter((t) => t.totalTasks > 0 && !t.isCompleted).length;

        return {
            summary: {
                totalStudents: students.length,
                totalTeams: teams.length,
                activeTeams,
                approvedTasks: approvedTasksSummary,
                totalTasks: totalTasksSummary,
                averageProgressPercent: teams.length > 0
                    ? Math.round(teams.reduce((acc, t) => acc + t.progressPercent, 0) / teams.length)
                    : 0,
            },
            students,
            teams,
            difficultTasks,
        };
    }

    async checkAndCompleteTeam(teamId: string, sprintId: string): Promise<void> {
        const { data: tasks } = await this.supabase.db
            .from('tasks')
            .select('status')
            .eq('team_id', teamId)
            .eq('sprint_id', sprintId);

        if (!tasks || tasks.length === 0) return;

        const allApproved = tasks.every((t) => t.status === 'approved');

        if (allApproved) {
            await this.supabase.db
                .from('teams')
                .update({ is_completed: true, sprint_status: 'completed' })
                .eq('id', teamId);

            this.logger.log(`Team ${teamId} completed sprint ${sprintId}`);
        }
    }

    async getGroupLeaderboard(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('group_leaderboard')
            .select('*');
        return data ?? [];
    }

    async getIndividualLeaderboard(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('individual_leaderboard')
            .select('*')
            .lte('rank', 3);
        return data ?? [];
    }

    async getTeacherAnalytics(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('teacher_analytics')
            .select('*');
        return data ?? [];
    }

    async getTeamById(id: string): Promise<unknown> {
        const { data } = await this.supabase.db
            .from('teams')
            .select(`
                id, name, accumulated_score, sprint_status, is_completed,
                current_challenge_id, current_sprint_id,
                sprints:current_sprint_id (id, title, description)
            `)
            .eq('id', id)
            .maybeSingle();

        return data ?? null;
    }

    async getSprintProgress(teamId: string, sprintId: string): Promise<unknown> {
        const { data: tasks } = await this.supabase.db
            .from('tasks')
            .select('status')
            .eq('team_id', teamId)
            .eq('sprint_id', sprintId);

        const total = tasks?.length ?? 0;
        const approved = tasks?.filter((t) => t.status === 'approved').length ?? 0;
        return { total, approved };
    }

    async listGroupNotes(teamId: string): Promise<unknown[]> {
        const { data, error } = await this.supabase.db
            .from('teacher_group_notes')
            .select('id, team_id, teacher_id, note, created_at')
            .eq('team_id', teamId)
            .order('created_at', { ascending: false });

        if (error) this.logger.error(`listGroupNotes error: ${error.message}`);
        return data ?? [];
    }

    async createGroupNote(teamId: string, note: string, teacherId?: string): Promise<unknown> {
        const { data, error } = await this.supabase.db
            .from('teacher_group_notes')
            .insert({ team_id: teamId, note, teacher_id: teacherId ?? null })
            .select('id, team_id, teacher_id, note, created_at')
            .single();

        if (error) {
            this.logger.error(`createGroupNote error: ${error.message}`);
            throw new Error(error.message);
        }
        return data;
    }

    async listStudentNotes(studentId: string): Promise<unknown[]> {
        const { data, error } = await this.supabase.db
            .from('teacher_student_notes')
            .select('id, student_id, teacher_id, note, created_at')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        if (error) this.logger.error(`listStudentNotes error: ${error.message}`);
        return data ?? [];
    }

    async createStudentNote(studentId: string, note: string, teacherId?: string): Promise<unknown> {
        const { data, error } = await this.supabase.db
            .from('teacher_student_notes')
            .insert({ student_id: studentId, note, teacher_id: teacherId ?? null })
            .select('id, student_id, teacher_id, note, created_at')
            .single();

        if (error) {
            this.logger.error(`createStudentNote error: ${error.message}`);
            throw new Error(error.message);
        }
        return data;
    }
}

```

---

## backend/src/users/users.controller.ts
**Type:** backend

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly users: UsersService) {}

    @Get()
    findAll() {
        return this.users.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.users.findOne(id);
    }
}

```

---

## backend/src/users/users.module.ts
**Type:** backend

```typescript
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
    providers: [UsersService],
    controllers: [UsersController],
    exports: [UsersService],
})
export class UsersModule {}

```

---

## backend/src/users/users.service.ts
**Type:** backend

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface UserRow {
    id: string;
    name: string;
    email: string;
    account_type: string;
    current_team_id: string | null;
    current_role: string | null;
    total_active_time: number;
    last_login_at: string | null;
    created_at: string;
}

@Injectable()
export class UsersService {
    constructor(private readonly supabase: SupabaseService) {}

    async findAll(): Promise<UserRow[]> {
        const { data, error } = await this.supabase.db
            .from('users')
            .select('id, name, email, account_type, current_team_id, current_role, total_active_time, last_login_at, created_at')
            .order('name');

        if (error) throw new Error(error.message);
        return (data as UserRow[]) ?? [];
    }

    async findOne(id: string): Promise<UserRow> {
        const { data, error } = await this.supabase.db
            .from('users')
            .select('id, name, email, account_type, current_team_id, current_role, total_active_time, last_login_at, created_at')
            .eq('id', id)
            .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new NotFoundException(`User ${id} not found`);
        return data as UserRow;
    }
}

```

---

## backend/src/webhooks/monday.controller.ts
**Type:** backend

```typescript
import {
    Body, Controller, Headers, HttpCode, Logger, Post, UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TasksService } from '../tasks/tasks.service';

interface MondayChallenge { challenge: string; }
interface MondayEvent {
    type: string; boardId?: number; pulseId?: number;
    value?: unknown; [key: string]: unknown;
}
type MondayPayload = MondayChallenge | { event: MondayEvent };

@Controller('webhooks')
export class MondayController {
    private readonly logger = new Logger(MondayController.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly tasksService: TasksService,
    ) {}

    @Post('monday')
    @HttpCode(200)
    async handleMonday(
        @Body() payload: MondayPayload,
        @Headers('authorization') auth: string | undefined,
    ): Promise<unknown> {
        this.validateSecret(auth);

        if ('challenge' in payload) {
            this.logger.log('Monday webhook handshake');
            return { challenge: payload.challenge };
        }

        const { event } = payload;
        this.logger.log(`Monday event: type=${event?.type} board=${event?.boardId}`);

        switch (event?.type) {
            case 'create_pulse':
                await this.handleChallengeKickoff(event);
                break;
            case 'change_column_value':
            case 'change_status_column_value':
                await this.handleColumnChange(event);
                break;
            default:
                this.logger.debug(`Unhandled Monday event type: ${event?.type}`);
        }
        return { received: true };
    }

    private async handleChallengeKickoff(event: MondayEvent): Promise<void> {
        const { data: challenge } = await this.supabase.db
            .from('challenges')
            .select('id')
            .eq('monday_board_id', event.boardId ?? null)
            .maybeSingle();

        if (!challenge) {
            this.logger.warn(`No challenge mapped to Monday board ${event.boardId}`);
            return;
        }

        await this.supabase.db
            .from('challenges')
            .update({ is_active: true })
            .eq('id', challenge.id);

        await this.supabase.db
            .from('teams')
            .update({ current_challenge_id: challenge.id, sprint_status: 'active', is_completed: false })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        this.logger.log(`Challenge ${challenge.id} kicked off via Monday board ${event.boardId}`);
    }

    private async handleColumnChange(event: MondayEvent): Promise<void> {
        const value = event.value as { label?: { text?: string } } | undefined;
        const label = value?.label?.text?.toLowerCase() ?? '';
        if (!['approved', 'done'].includes(label)) return;

        const { data: task } = await this.supabase.db
            .from('tasks')
            .select('id, status')
            .eq('monday_item_id', event.pulseId ?? null)
            .maybeSingle();

        if (!task || task.status !== 'teacher_review') return;

        this.logger.log(`Teacher approved task ${task.id} via Monday`);
        await this.tasksService.teacherApprove(task.id);
    }

    private validateSecret(authHeader: string | undefined): void {
        const secret = process.env.MONDAY_WEBHOOK_SECRET;
        if (!secret) return;
        if (authHeader !== secret) throw new UnauthorizedException('Invalid Monday webhook secret');
    }
}

```

---

## backend/src/webhooks/webhooks.module.ts
**Type:** backend

```typescript
import { Module } from '@nestjs/common';
import { MondayController } from './monday.controller';
import { TasksModule } from '../tasks/tasks.module';

@Module({
    imports: [TasksModule],
    controllers: [MondayController],
})
export class WebhooksModule {}

```

---

## frontend/app.vue
**Type:** frontend

```vue
<template>
    <NuxtPage />
</template>

```

---

## frontend/components/AnalyticsDashboard.vue
**Type:** frontend

```vue
<script setup lang="ts">
import { ROLE_LABELS } from '~/types/types';
import type { 
    UserRole, 
    TeacherDashboardResponse, 
    StudentInsight,
    DifficultTask,
    TeamProgress
} from '~/types/types';

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

const data = ref<TeacherDashboardResponse | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
    try {
        data.value = await $fetch<TeacherDashboardResponse>(`${base}/teams/analytics/teacher-dashboard`);
    } catch (e) {
        error.value = 'שגיאה בטעינת הנתונים מהשרת. נסה שוב מאוחר יותר.';
    } finally {
        loading.value = false;
    }
});

function formatTime(seconds: number): string {
    if (!seconds) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

const roleColors: Record<string, string> = {
    pm:       'bg-purple-100 text-purple-700',
    qa:       'bg-yellow-100 text-yellow-700',
    dev:      'bg-blue-100 text-blue-700',
    hardware: 'bg-green-100 text-green-700',
};

function roleDisplay(role: UserRole | null): string {
    if (!role) return 'ללא תפקיד';
    return ROLE_LABELS[role] ?? role.toUpperCase();
}

const needsAttention = computed(() => data.value?.students.filter(s => s.riskLevel === 'needs_attention') ?? []);
const watchList = computed(() => data.value?.students.filter(s => s.riskLevel === 'watch') ?? []);

const riskBadgeClasses: Record<string, string> = {
    needs_attention: 'bg-rose-100 text-rose-700 border-rose-200',
    watch:           'bg-amber-100 text-amber-700 border-amber-200',
    ok:              'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const riskLabels: Record<string, string> = {
    needs_attention: 'דורש תשומת לב',
    watch:           'במעקב',
    ok:              'תקין',
};
</script>

<template>
    <div class="flex flex-col gap-8 pb-10" dir="rtl">
        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-20">
            <div class="w-10 h-10 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-5 text-sm">
            {{ error }}
        </div>

        <template v-else-if="data">
            <!-- Summary Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 transition-all hover:shadow-md">
                    <p class="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">סך הכל תלמידים</p>
                    <p class="text-3xl font-black text-gray-900">{{ data.summary.totalStudents }}</p>
                </div>
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 transition-all hover:shadow-md">
                    <p class="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">צוותים פעילים</p>
                    <p class="text-3xl font-black text-emerald-600">{{ data.summary.activeTeams }} <span class="text-sm font-medium text-gray-400">/ {{ data.summary.totalTeams }}</span></p>
                </div>
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 transition-all hover:shadow-md">
                    <p class="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">משימות שאושרו</p>
                    <p class="text-3xl font-black text-[#3CC2EE]">{{ data.summary.approvedTasks }} <span class="text-sm font-medium text-gray-400">/ {{ data.summary.totalTasks }}</span></p>
                </div>
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 transition-all hover:shadow-md">
                    <p class="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">התקדמות ממוצעת</p>
                    <div class="flex items-end gap-2">
                        <p class="text-3xl font-black text-purple-600">{{ data.summary.averageProgressPercent }}%</p>
                        <div class="h-2 w-20 bg-gray-100 rounded-full mb-2 overflow-hidden">
                            <div class="h-full bg-purple-500" :style="{ width: `${data.summary.averageProgressPercent}%` }" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Attention Section -->
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-8 bg-rose-500 rounded-full" />
                    <h2 class="text-xl font-bold text-gray-900">תלמידים שדורשים התערבות</h2>
                </div>
                
                <div v-if="needsAttention.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div 
                        v-for="s in needsAttention" 
                        :key="s.userId"
                        class="bg-rose-50 border-2 border-rose-100 rounded-2xl p-5 relative overflow-hidden group transition-all hover:border-rose-300"
                    >
                        <div class="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg class="w-12 h-12 text-rose-900" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                        </div>
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h3 class="font-bold text-gray-900 text-lg">{{ s.name }}</h3>
                                <p class="text-sm text-gray-500 font-medium">{{ s.teamName || 'ללא צוות' }} • {{ roleDisplay(s.role) }}</p>
                            </div>
                            <span class="px-2.5 py-1 rounded-lg bg-rose-200 text-rose-800 text-xs font-bold">{{ s.hintCount }} רמזים</span>
                        </div>
                        <div class="bg-white/50 rounded-xl p-3 border border-rose-100">
                            <p class="text-xs font-bold text-rose-900 uppercase mb-1">סיבה לעירנות:</p>
                            <p class="text-sm text-rose-800 leading-relaxed">{{ s.insightReason }}</p>
                        </div>
                        <div class="mt-4 flex justify-between items-center text-xs font-medium text-gray-500">
                            <span>משימות: {{ s.approvedTasks }} / {{ s.totalTasks }}</span>
                            <span>זמן פעיל: {{ formatTime(s.totalActiveTimeSeconds) }}</span>
                        </div>
                    </div>
                </div>
                <div v-else class="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
                    <p class="text-emerald-800 font-medium text-sm">כל הכבוד! אין תלמידים שדורשים התערבות דחופה כרגע.</p>
                </div>
            </div>

            <!-- Watch List & Difficult Tasks -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Watch List -->
                <div class="space-y-4">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-6 bg-amber-400 rounded-full" />
                        <h2 class="text-lg font-bold text-gray-800">רשימת מעקב</h2>
                    </div>
                    <div v-if="watchList.length" class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div 
                            v-for="s in watchList" 
                            :key="s.userId"
                            class="flex items-center justify-between p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                        >
                            <div class="flex flex-col">
                                <span class="font-bold text-gray-900">{{ s.name }}</span>
                                <span class="text-xs text-gray-500">{{ s.teamName }} • {{ s.insightReason }}</span>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="text-right">
                                    <p class="text-xs font-bold text-amber-600">{{ s.hintCount }} רמזים</p>
                                    <p class="text-[10px] text-gray-400">{{ s.approvedTasks }} / {{ s.totalTasks }} משימות</p>
                                </div>
                                <div class="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            </div>
                        </div>
                    </div>
                    <div v-else class="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
                        <p class="text-gray-500 text-xs">רשימת המעקב ריקה.</p>
                    </div>
                </div>

                <!-- Difficult Tasks -->
                <div class="space-y-4">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-6 bg-purple-400 rounded-full" />
                        <h2 class="text-lg font-bold text-gray-800">משימות מאתגרות</h2>
                    </div>
                    <div v-if="data.difficultTasks.length" class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div 
                            v-for="t in data.difficultTasks" 
                            :key="t.taskId"
                            class="flex items-center justify-between p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                        >
                            <div class="flex flex-col max-w-[70%]">
                                <span class="font-bold text-gray-900 truncate">{{ t.title }}</span>
                                <span class="text-xs text-gray-500">{{ t.teamName }}</span>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="text-left bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">
                                    <span class="text-sm font-black text-purple-700">{{ t.hintCount }}</span>
                                    <span class="text-[10px] text-purple-600 mr-1 italic">רמזים</span>
                                </div>
                                <div class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 uppercase">
                                    {{ t.status }}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else class="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
                        <p class="text-gray-500 text-xs">אין משימות בעייתיות כרגע.</p>
                    </div>
                </div>
            </div>

            <!-- Team Progress -->
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-6 bg-emerald-500 rounded-full" />
                    <h2 class="text-lg font-bold text-gray-800">התקדמות צוותים</h2>
                </div>
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div 
                        v-for="team in data.teams" 
                        :key="team.teamId"
                        class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
                    >
                        <div class="flex justify-between items-start mb-3">
                            <h3 class="font-bold text-gray-900">{{ team.teamName }}</h3>
                            <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{{ team.score }} נק'</span>
                        </div>
                        <div class="mb-4">
                            <div class="flex justify-between text-xs text-gray-500 mb-1 font-medium">
                                <span>התקדמות משימות</span>
                                <span>{{ team.progressPercent }}%</span>
                            </div>
                            <div class="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    class="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                                    :style="{ width: `${team.progressPercent}%` }"
                                />
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-center">
                            <div class="bg-gray-50 rounded-xl py-2 border border-gray-100">
                                <p class="text-[10px] text-gray-400 font-bold uppercase">משימות</p>
                                <p class="text-sm font-bold text-gray-700">{{ team.approvedTasks }} / {{ team.totalTasks }}</p>
                            </div>
                            <div class="bg-gray-50 rounded-xl py-2 border border-gray-100">
                                <p class="text-[10px] text-gray-400 font-bold uppercase">רמזים</p>
                                <p class="text-sm font-bold text-gray-700">{{ team.totalHints }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Detailed Student Table -->
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-6 bg-gray-400 rounded-full" />
                    <h2 class="text-lg font-bold text-gray-800">פירוט תלמידים</h2>
                </div>
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm text-right">
                            <thead>
                                <tr class="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-bold uppercase tracking-wider">
                                    <th class="px-5 py-4">תלמיד</th>
                                    <th class="px-5 py-4">צוות</th>
                                    <th class="px-5 py-4">תפקיד</th>
                                    <th class="px-5 py-4">זמן פעיל</th>
                                    <th class="px-5 py-4">משימות</th>
                                    <th class="px-5 py-4">רמזים</th>
                                    <th class="px-5 py-4">קצב (משימה/שעה)</th>
                                    <th class="px-5 py-4 text-center">סטטוס</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="s in data.students"
                                    :key="s.userId"
                                    class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                                >
                                    <td class="px-5 py-4">
                                        <div class="flex flex-col">
                                            <span class="font-bold text-gray-900">{{ s.name }}</span>
                                            <span class="text-[10px] text-gray-400">{{ s.email }}</span>
                                        </div>
                                    </td>
                                    <td class="px-5 py-4 text-gray-600 font-medium">{{ s.teamName || '-' }}</td>
                                    <td class="px-5 py-4">
                                        <span
                                            v-if="s.role"
                                            :class="['text-[10px] font-bold px-2.5 py-1 rounded-lg', roleColors[s.role] ?? 'bg-gray-100 text-gray-600']"
                                        >
                                            {{ roleDisplay(s.role) }}
                                        </span>
                                        <span v-else class="text-gray-300">-</span>
                                    </td>
                                    <td class="px-5 py-4 text-gray-600 font-mono">{{ formatTime(s.totalActiveTimeSeconds) }}</td>
                                    <td class="px-5 py-4">
                                        <div class="flex items-center gap-2">
                                            <div class="h-1.5 w-12 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    class="h-full bg-emerald-400 rounded-full transition-all duration-700"
                                                    :style="{ width: `${(s.approvedTasks / Math.max(1, s.totalTasks)) * 100}%` }"
                                                />
                                            </div>
                                            <span class="font-bold tabular-nums">{{ s.approvedTasks }} / {{ s.totalTasks }}</span>
                                        </div>
                                    </td>
                                    <td class="px-5 py-4 text-gray-600 font-bold tabular-nums">{{ s.hintCount }}</td>
                                    <td class="px-5 py-4 text-gray-500 tabular-nums">
                                        {{ s.tasksPerHour != null ? s.tasksPerHour.toFixed(1) : '-' }}
                                    </td>
                                    <td class="px-5 py-4">
                                        <div 
                                            class="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase"
                                            :class="riskBadgeClasses[s.riskLevel]"
                                        >
                                            <div class="w-1.5 h-1.5 rounded-full" :class="s.riskLevel === 'ok' ? 'bg-emerald-500' : s.riskLevel === 'watch' ? 'bg-amber-500' : 'bg-rose-500'" />
                                            {{ riskLabels[s.riskLevel] }}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

```

---

## frontend/components/ChatChannel.vue
**Type:** frontend

```vue
<script setup lang="ts">
import type { ChatMessage } from '~/types/types';

const props = defineProps<{
    channelName: string;
    messages: readonly ChatMessage[];
    sending: boolean;
    currentUserId: string;
    isPrivate?: boolean;
}>();

const emit = defineEmits<{
    send: [content: string];
}>();

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

const input = ref('');
const scrollEl = ref<HTMLDivElement | null>(null);

// ── Avatar colors ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
    'bg-amber-500',  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500',
];
const colorCache = new Map<string, string>();
function avatarColor(id: string): string {
    if (!colorCache.has(id)) {
        let hash = 0;
        for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xff;
        colorCache.set(id, AVATAR_COLORS[hash % AVATAR_COLORS.length]);
    }
    return colorCache.get(id)!;
}
function initials(name: string): string {
    return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Date separators ───────────────────────────────────────────────────────────
interface DayGroup { date: string; label: string; messages: ChatMessage[] }

const grouped = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    let current: DayGroup | null = null;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    for (const msg of props.messages) {
        const d = new Date(msg.createdAt);
        const key = d.toDateString();
        const label =
            key === today ? 'היום' :
            key === yesterday ? 'אתמול' :
            d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });

        if (!current || current.date !== key) {
            current = { date: key, label, messages: [] };
            groups.push(current);
        }
        current.messages.push(msg);
    }
    return groups;
});

// ── Time format ───────────────────────────────────────────────────────────────
function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

// ── Speech-to-text ────────────────────────────────────────────────────────────
const recording = ref(false);
const transcribing = ref(false);
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            await sendAudioForTranscription();
        };
        mediaRecorder.start();
        recording.value = true;
    } catch {
        alert('לא ניתן לגשת למיקרופון. בדוק הרשאות בדפדפן.');
    }
}

function stopRecording() {
    mediaRecorder?.stop();
    recording.value = false;
}

async function sendAudioForTranscription() {
    if (!audioChunks.length) return;
    transcribing.value = true;
    try {
        const mimeType = mediaRecorder?.mimeType ?? 'audio/webm';
        const blob = new Blob(audioChunks, { type: mimeType });
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        const result = await $fetch<{ text: string }>(`${base}/chat/transcribe`, {
            method: 'POST',
            body: formData,
        });
        if (result.text) input.value = (input.value ? input.value + ' ' : '') + result.text;
    } catch { /* silent */ } finally {
        transcribing.value = false;
        audioChunks = [];
    }
}

function toggleMic() {
    recording.value ? stopRecording() : startRecording();
}

// ── Send ──────────────────────────────────────────────────────────────────────
function handleSend() {
    const text = input.value.trim();
    if (!text || props.sending) return;
    emit('send', text);
    input.value = '';
}

function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
}

// ── Auto-scroll ───────────────────────────────────────────────────────────────
watch(
    () => props.messages.length,
    async () => {
        await nextTick();
        if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
    },
);

onMounted(async () => {
    await nextTick();
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
});
</script>

<template>
    <div class="flex flex-col h-full bg-white overflow-hidden">

        <!-- Header -->
        <div class="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50 shrink-0">
            <span class="text-base">{{ isPrivate ? '🤖' : '💬' }}</span>
            <span class="font-semibold text-gray-800 text-sm truncate flex-1">{{ channelName }}</span>
            <span v-if="messages.length" class="text-xs text-gray-400">{{ messages.length }} הודעות</span>
        </div>

        <!-- Messages -->
        <div ref="scrollEl" class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1 min-h-0">
            <div v-if="!messages.length" class="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                <span class="text-3xl">{{ isPrivate ? '🤖' : '💬' }}</span>
                <p class="text-sm">{{ isPrivate ? 'שאל/י את DUDE כל דבר על האתגר' : 'אין הודעות עדיין. התחילו את השיחה!' }}</p>
            </div>

            <template v-for="group in grouped" :key="group.date">
                <!-- Date separator -->
                <div class="flex items-center gap-3 my-2">
                    <div class="flex-1 h-px bg-gray-100" />
                    <span class="text-xs text-gray-400 font-medium shrink-0">{{ group.label }}</span>
                    <div class="flex-1 h-px bg-gray-100" />
                </div>

                <!-- Messages in this day -->
                <div
                    v-for="msg in group.messages"
                    :key="msg.id"
                    class="flex flex-col"
                    :class="msg.senderId === currentUserId ? 'items-end' : 'items-start'"
                >
                    <!-- Bot message (private DUDE chat) -->
                    <template v-if="msg.isBot">
                        <div class="flex items-end gap-2 max-w-[78%]">
                            <div class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs shrink-0 mb-0.5">🤖</div>
                            <div class="bg-indigo-50 border border-indigo-100 text-gray-800 text-sm rounded-2xl rounded-bl-none px-3.5 py-2 leading-relaxed">
                                {{ msg.content }}
                            </div>
                        </div>
                        <span class="text-[11px] text-gray-400 mt-0.5 ml-9">{{ formatTime(msg.createdAt) }}</span>
                    </template>

                    <!-- Own message -->
                    <template v-else-if="msg.senderId === currentUserId">
                        <div class="bg-indigo-600 text-white text-sm rounded-2xl rounded-br-none px-3.5 py-2 max-w-[78%] leading-relaxed shadow-sm">
                            {{ msg.content }}
                        </div>
                        <span class="text-[11px] text-gray-400 mt-0.5">{{ formatTime(msg.createdAt) }}</span>
                    </template>

                    <!-- Other student -->
                    <template v-else>
                        <div class="flex items-end gap-2 max-w-[78%]">
                            <div
                                :class="['w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mb-0.5', avatarColor(msg.senderId ?? msg.senderName)]"
                            >
                                {{ initials(msg.senderName) }}
                            </div>
                            <div>
                                <p class="text-[11px] text-gray-400 mb-0.5 mr-1">{{ msg.senderName }}</p>
                                <div class="bg-gray-100 text-gray-800 text-sm rounded-2xl rounded-bl-none px-3.5 py-2 leading-relaxed shadow-sm">
                                    {{ msg.content }}
                                </div>
                            </div>
                        </div>
                        <span class="text-[11px] text-gray-400 mt-0.5 ml-9">{{ formatTime(msg.createdAt) }}</span>
                    </template>
                </div>
            </template>

            <!-- Typing indicator -->
            <div v-if="sending" class="flex items-end gap-2 mt-1">
                <div class="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <span class="text-[10px] text-gray-500">···</span>
                </div>
                <div class="bg-gray-100 rounded-2xl rounded-bl-none px-3.5 py-2.5 flex gap-1 items-center">
                    <span v-for="i in 3" :key="i"
                        class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                        :style="`animation-delay: ${(i - 1) * 150}ms`"
                    />
                </div>
            </div>
        </div>

        <!-- Input area -->
        <div class="border-t border-gray-100 px-3 py-2 flex gap-2 items-end shrink-0 bg-white">
            <!-- Mic -->
            <button
                class="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                :class="recording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                :title="recording ? 'עצור הקלטה' : 'הקלט הודעה קולית'"
                :disabled="transcribing"
                @click="toggleMic"
            >
                <span v-if="transcribing" class="inline-block w-4 h-4 border-2 border-gray-400/40 border-t-gray-600 rounded-full animate-spin" />
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 18.93V22h2v-2.07A8.001 8.001 0 0 0 20 12h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z"/>
                </svg>
            </button>

            <textarea
                v-model="input"
                rows="1"
                class="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 leading-snug bg-gray-50 placeholder:text-gray-400"
                :placeholder="recording ? '🔴 מקליט...' : (isPrivate ? 'שאל/י את DUDE...' : 'כתבו הודעה...')"
                style="max-height: 100px; overflow-y: auto"
                @keydown="handleKeydown"
            />

            <button
                class="shrink-0 bg-indigo-600 text-white rounded-xl px-3 py-2 text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-40"
                :disabled="sending || !input.trim()"
                @click="handleSend"
            >
                <svg v-if="sending" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10" stroke-linecap="round"/>
                </svg>
                <svg v-else class="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
            </button>
        </div>

        <!-- Recording banner -->
        <div v-if="recording" class="bg-red-50 border-t border-red-100 px-4 py-1.5 flex items-center gap-2 text-xs text-red-600 shrink-0">
            <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            מקליט... לחץ על 🎤 שוב לסיום ולהמרה לטקסט
        </div>
    </div>
</template>

<style scoped>
@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-4px); }
}
.animate-bounce { animation: bounce 1s ease-in-out infinite; }
</style>

```

---

## frontend/components/EnglishTerm.vue
**Type:** frontend

```vue
<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        term: string;
        translation?: string;
    }>(),
    { translation: undefined },
);

// Built-in glossary — extend as the product grows
const glossary: Record<string, string> = {
    'Submit': 'שלח / הגש',
    'Pending': 'ממתין לאישור',
    'Approved': 'אושר',
    'Rejected': 'נדחה',
    'Sprint': 'ספרינט (מחזור פיתוח קצר)',
    'Product Manager': 'מנהל המוצר',
    'PM': 'מנהל מוצר (Product Manager)',
    'QA': 'בדיקות איכות (Quality Assurance)',
    'Dev': 'מפתח (Developer)',
    'Hardware': 'חומרה',
    'Review': 'סקירה / בדיקה',
    'Checklist': 'רשימת בדיקה',
    'Deadline': 'מועד אחרון',
    'Backlog': 'רשימת משימות ממתינות',
    'Stakeholder': 'בעל עניין',
    'Feedback': 'משוב',
    'Deployment': 'פרסום / העלאה לאוויר',
    'Bug': 'תקלה בתוכנה',
    'Feature': 'פיצ\'ר / יכולת חדשה',
    'Merge': 'מיזוג קוד',
    'Pull Request': 'בקשת משיכה לאיחוד קוד',
    'Stand-up': 'פגישת סטנד-אפ יומית',
    'Milestone': 'אבן דרך',
    'Deliverable': 'תוצרת / פלט',
    'MVP': 'מוצר מינימלי (Minimum Viable Product)',
    'Agile': 'מתודולוגיית אג\'ייל',
    'Scrum': 'מסגרת סקראם',
    'Kanban': 'לוח קנבן',
};

const resolvedTranslation = computed(
    () => props.translation ?? glossary[props.term] ?? null,
);

const isVisible = ref(false);
</script>

<template>
    <span
        class="english-term"
        @mouseenter="isVisible = true"
        @mouseleave="isVisible = false"
        @focusin="isVisible = true"
        @focusout="isVisible = false"
        tabindex="0"
        role="term"
        :aria-label="resolvedTranslation ? `${term} — ${resolvedTranslation}` : term"
    >
        <span class="term-text">{{ term }}</span>

        <Transition name="tooltip-fade">
            <span
                v-if="isVisible && resolvedTranslation"
                class="tooltip"
                role="tooltip"
            >
                {{ resolvedTranslation }}
            </span>
        </Transition>
    </span>
</template>

<style scoped>
.english-term {
    position: relative;
    display: inline-block;
    cursor: help;
}

.term-text {
    border-bottom: 1px dashed currentColor;
    opacity: 0.9;
}

.tooltip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #1e293b;
    color: #f1f5f9;
    font-size: 0.78rem;
    font-family: inherit;
    white-space: nowrap;
    padding: 4px 10px;
    border-radius: 6px;
    pointer-events: none;
    z-index: 50;
    direction: rtl;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

/* Arrow */
.tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: #1e293b;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
}
</style>

```

---

## frontend/components/HintPanel.vue
**Type:** frontend

```vue
<script setup lang="ts">
import type { HintResponse } from '~/types/types';
import { DEMO_HINTS } from '~/services/demoData';

const props = defineProps<{
    userId: string;
    teamId: string;
}>();

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

interface HintLog {
    id: string;
    hint_text: string;
    hint_number: number;
    points_deducted: number;
    task_id: string | null;
    created_at: string;
}

const history = ref<HintLog[]>([]);
const latestHint = ref<HintResponse | null>(null);
const loading = ref(false);
const isOpen = ref(false);

let hintCounter = 0;

async function fetchHistory() {
    const data = await $fetch<HintLog[]>(
        `${base}/hints/history?userId=${props.userId}&teamId=${props.teamId}`,
    ).catch(() => [] as HintLog[]);
    history.value = data;
}

function localHint(taskId?: string): HintResponse {
    hintCounter += 1;
    const idx = (hintCounter - 1) % DEMO_HINTS.length;
    const text = DEMO_HINTS[idx];
    const isFree = hintCounter <= 3;
    const log: HintLog = {
        id: `local-${hintCounter}`,
        hint_text: text,
        hint_number: hintCounter,
        points_deducted: isFree ? 0 : 10,
        task_id: taskId ?? null,
        created_at: new Date().toISOString(),
    };
    history.value = [...history.value, log];
    return {
        hint: text,
        hintNumber: hintCounter,
        hintsRemaining: Math.max(0, 3 - hintCounter),
        pointsDeducted: isFree ? 0 : 10,
        isFree,
    };
}

async function requestHint(taskId?: string) {
    loading.value = true;
    latestHint.value = null;
    try {
        const res = await $fetch<HintResponse>(`${base}/hints`, {
            method: 'POST',
            body: { userId: props.userId, teamId: props.teamId, taskId: taskId ?? null },
        });
        latestHint.value = res;
        isOpen.value = true;
        await fetchHistory();
    } catch (e) {
        // POC: fall back to a curated Hebrew hint pool.
        latestHint.value = localHint(taskId);
        isOpen.value = true;
    } finally {
        loading.value = false;
    }
}

onMounted(fetchHistory);

defineExpose({ requestHint });
</script>

<template>
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden" dir="rtl">
        <!-- Header -->
        <button
            class="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            @click="isOpen = !isOpen"
        >
            <div class="flex items-center gap-2">
                <span class="text-lg">💡</span>
                <span class="font-bold text-gray-800 text-sm">רמזים</span>
                <span
                    v-if="history.length"
                    class="text-xs bg-cyan-100 text-cyan-700 font-semibold px-2 py-0.5 rounded-full"
                >
                    {{ history.length }}
                </span>
            </div>
            <span class="text-gray-400 text-xs">{{ isOpen ? '▲' : '▼' }}</span>
        </button>

        <Transition name="slide">
            <div v-if="isOpen" class="border-t border-gray-100">
                <!-- Latest hint response -->
                <div
                    v-if="latestHint"
                    class="mx-4 mt-4 p-4 rounded-xl text-sm leading-relaxed"
                    :class="latestHint.isFree ? 'bg-cyan-50 border border-cyan-200' : 'bg-amber-50 border border-amber-200'"
                >
                    <div class="flex items-center gap-1.5 mb-2">
                        <span class="font-bold text-cyan-700">רמז #{{ latestHint.hintNumber }}</span>
                        <span v-if="latestHint.isFree" class="text-xs text-emerald-600 font-medium">✓ חינם</span>
                        <span v-else class="text-xs text-amber-600 font-medium">
                            -{{ latestHint.pointsDeducted }} נקודות
                        </span>
                        <span class="text-xs text-gray-400 mr-auto">
                            נותרו {{ latestHint.hintsRemaining }} רמזים חינם
                        </span>
                    </div>
                    <p class="text-gray-700">{{ latestHint.hint }}</p>
                </div>

                <!-- History list -->
                <div class="px-4 pb-4 mt-3 flex flex-col gap-2 max-h-72 overflow-y-auto">
                    <p v-if="!history.length && !latestHint" class="text-xs text-gray-400 text-center py-3">
                        עוד אין רמזים. לחצו על 💡 ליד משימה כדי לבקש רמז.
                    </p>
                    <div
                        v-for="item in [...history].reverse()"
                        :key="item.id"
                        class="bg-gray-50 rounded-lg px-3 py-2.5 text-xs text-gray-600 flex flex-col gap-1"
                    >
                        <div class="flex items-center gap-1.5 text-gray-400">
                            <span class="font-semibold text-gray-700">רמז #{{ item.hint_number }}</span>
                            <span v-if="item.points_deducted > 0" class="text-amber-500">
                                -{{ item.points_deducted }} נקודות
                            </span>
                            <span class="mr-auto">{{ new Date(item.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) }}</span>
                        </div>
                        <p class="leading-relaxed">{{ item.hint_text }}</p>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active { transition: all 0.2s ease; }
.slide-enter-from,
.slide-leave-to { opacity: 0; transform: translateY(-6px); }
</style>

```

---

## frontend/components/Leaderboard.vue
**Type:** frontend

```vue
<script setup lang="ts">
import type { GroupLeaderboardRow } from '~/types/types';

const props = defineProps<{
    rows: GroupLeaderboardRow[];
    highlightTeamId?: string;
}>();

const medals = ['🥇', '🥈', '🥉'];
const maxScore = computed(() =>
    Math.max(1, ...props.rows.map((r) => r.accumulatedScore)),
);
</script>

<template>
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
        <div class="flex items-center gap-2">
            <span class="text-lg">🏆</span>
            <h3 class="font-bold text-gray-800 text-sm">Team Leaderboard</h3>
        </div>

        <div v-if="!rows.length" class="text-xs text-gray-400 text-center py-4">
            No teams yet.
        </div>

        <div v-else class="flex flex-col gap-2">
            <div
                v-for="(row, i) in rows"
                :key="row.id"
                :class="[
                    'rounded-xl px-4 py-3 flex flex-col gap-1.5 transition-colors',
                    row.id === highlightTeamId
                        ? 'bg-indigo-50 border border-indigo-200'
                        : 'bg-gray-50 border border-transparent',
                ]"
            >
                <div class="flex items-center gap-2">
                    <span class="text-base w-6 text-center shrink-0">
                        {{ medals[i] ?? `#${i + 1}` }}
                    </span>
                    <span class="font-semibold text-gray-800 text-sm flex-1 truncate">
                        {{ row.name }}
                        <span v-if="row.id === highlightTeamId" class="text-indigo-500 text-xs ml-1">(you)</span>
                    </span>
                    <span class="text-sm font-bold text-gray-700 shrink-0">
                        {{ row.accumulatedScore }} pts
                    </span>
                </div>
                <!-- Score bar -->
                <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden ml-8">
                    <div
                        class="h-full rounded-full bg-indigo-400 transition-all duration-700"
                        :style="{ width: `${(row.accumulatedScore / maxScore) * 100}%` }"
                    />
                </div>
                <div class="flex gap-3 ml-8 text-xs text-gray-400">
                    <span>{{ row.approvedTaskCount }} tasks approved</span>
                    <span v-if="row.isCompleted" class="text-emerald-500 font-medium">✓ Complete</span>
                </div>
            </div>
        </div>
    </div>
</template>

```

---

## frontend/components/MockMondayBoard.vue
**Type:** frontend

```vue
<script setup lang="ts">
const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

// ── State ─────────────────────────────────────────────────────────────────────
const challenges = ref<{ id: string; title: string; isActive: boolean }[]>([]);
const selectedChallengeId = ref<string | null>(null);
const board = ref<any | null>(null);
const loading = ref(false);
const actionLoading = ref<string | null>(null); // taskId currently being acted on
const toast = ref<{ msg: string; type: 'success' | 'error' } | null>(null);

// ── Boot ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
    challenges.value = await $fetch(`${base}/mock-monday/challenges`);
    if (challenges.value.length > 0) {
        selectedChallengeId.value = challenges.value[0].id;
        await loadBoard();
    }
});

watch(selectedChallengeId, loadBoard);

async function loadBoard() {
    if (!selectedChallengeId.value) return;
    loading.value = true;
    try {
        board.value = await $fetch(`${base}/mock-monday/board/${selectedChallengeId.value}`);
    } finally {
        loading.value = false;
    }
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function kickoff() {
    if (!selectedChallengeId.value) return;
    await act(selectedChallengeId.value, async () => {
        await $fetch(`${base}/mock-monday/kickoff/${selectedChallengeId.value}`, { method: 'POST' });
        showToast('Challenge kicked off for all teams!', 'success');
        await loadBoard();
    });
}

async function approveTask(taskId: string) {
    await act(taskId, async () => {
        await $fetch(`${base}/mock-monday/approve/${taskId}`, { method: 'POST' });
        showToast('Task approved!', 'success');
        await loadBoard();
    });
}

async function rejectTask(taskId: string) {
    await act(taskId, async () => {
        await $fetch(`${base}/mock-monday/reject/${taskId}`, { method: 'POST' });
        showToast('Task returned to PM.', 'error');
        await loadBoard();
    });
}

async function act(id: string, fn: () => Promise<void>) {
    actionLoading.value = id;
    try {
        await fn();
    } catch (e: any) {
        showToast(e?.data?.message ?? 'Something went wrong', 'error');
    } finally {
        actionLoading.value = null;
    }
}

function showToast(msg: string, type: 'success' | 'error') {
    toast.value = { msg, type };
    setTimeout(() => (toast.value = null), 3000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// Internal keys are pm/qa/dev/hardware; display labels match the new mapping.
const roleLabel: Record<string, string> = {
    pm:       'Editor',
    qa:       'QA',
    dev:      'Designer',
    hardware: 'Printer',
};

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
    <div class="bg-gray-50 min-h-full" dir="rtl">

        <!-- ── Top bar ──────────────────────────────────────────────────── -->
        <header class="flex items-center gap-4 px-6 py-4 bg-white border-b border-gray-200">
            <span class="text-sm font-extrabold text-gray-900">לוח משימות</span>

            <!-- Challenge selector -->
            <select
                v-model="selectedChallengeId"
                class="mr-4 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
                <option v-for="c in challenges" :key="c.id" :value="c.id">
                    {{ c.title }} {{ c.isActive ? '🟢' : '⚪' }}
                </option>
            </select>

            <div class="flex-1" />

            <!-- Kickoff button -->
            <button
                class="flex items-center gap-2 bg-[#3CC2EE] hover:bg-[#27b3df] text-white font-bold px-4 py-1.5 rounded-full text-sm transition-colors disabled:opacity-50 shadow-sm"
                :disabled="actionLoading === selectedChallengeId"
                @click="kickoff"
            >
                <span v-if="actionLoading === selectedChallengeId">⏳</span>
                <span v-else>🚀</span>
                הפעל אתגר
            </button>

            <!-- Refresh -->
            <button
                class="text-gray-400 hover:text-gray-700 text-lg transition-colors"
                title="רענן לוח"
                @click="loadBoard"
            >
                ↻
            </button>
        </header>

        <!-- ── Board title ────────────────────────────────────────────────── -->
        <div class="px-6 py-4 flex items-center gap-3">
            <h1 class="text-xl font-extrabold text-gray-900">
                {{ board?.challengeTitle ?? 'טוען...' }}
            </h1>
            <span class="text-xs text-gray-400">לוח מורה</span>
        </div>

        <!-- ── Loading ───────────────────────────────────────────────────── -->
        <div v-if="loading" class="flex justify-center py-20 text-gray-400 text-sm">
            טוען לוח...
        </div>

        <!-- ── Kanban columns ─────────────────────────────────────────────── -->
        <div
            v-else-if="board"
            class="flex gap-3 px-6 pb-8 overflow-x-auto"
        >
            <div
                v-for="col in board.columns"
                :key="col.label"
                class="flex-none w-64 flex flex-col gap-2"
            >
                <!-- Column header -->
                <div class="flex items-center gap-2 mb-1">
                    <span
                        class="w-3 h-3 rounded-full shrink-0"
                        :style="{ background: col.color }"
                    />
                    <span class="text-xs font-bold text-gray-600 uppercase tracking-wide">
                        {{ col.label }}
                    </span>
                    <span class="mr-auto text-xs text-gray-500 bg-gray-100 rounded-full px-2 font-semibold">
                        {{ col.items.length }}
                    </span>
                </div>

                <!-- Items -->
                <div
                    v-for="item in col.items"
                    :key="item.id"
                    class="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2 hover:border-[#3CC2EE]/40 hover:shadow-sm transition-all shadow-sm"
                >
                    <!-- Item title + role badge -->
                    <div class="flex items-start justify-between gap-1">
                        <p class="text-sm font-semibold text-gray-800 leading-snug">{{ item.title }}</p>
                        <span
                            class="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                            :style="{ background: col.color + '20', color: col.color }"
                        >
                            {{ roleLabel[item.assignedRole] ?? item.assignedRole }}
                        </span>
                    </div>

                    <!-- Team + time -->
                    <div class="flex items-center gap-2 text-xs text-gray-400">
                        <span>👥 {{ item.teamName }}</span>
                        <span class="mr-auto">{{ formatTime(item.submittedAt) }}</span>
                    </div>

                    <!-- Submission link -->
                    <a
                        v-if="item.submissionUrl"
                        :href="item.submissionUrl"
                        target="_blank"
                        class="text-xs text-[#3CC2EE] hover:underline truncate"
                    >
                        🔗 צפייה בהגשה
                    </a>

                    <!-- Teacher action buttons — only on Pending Teacher Review column -->
                    <div
                        v-if="item.status === 'teacher_review'"
                        class="flex gap-2 mt-1"
                    >
                        <button
                            class="flex-1 text-xs font-bold py-1 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-40"
                            :disabled="actionLoading === item.id"
                            @click="approveTask(item.id)"
                        >
                            {{ actionLoading === item.id ? '...' : '✓ אשר' }}
                        </button>
                        <button
                            class="flex-1 text-xs font-bold py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-40"
                            :disabled="actionLoading === item.id"
                            @click="rejectTask(item.id)"
                        >
                            {{ actionLoading === item.id ? '...' : '✕ דחה' }}
                        </button>
                    </div>
                </div>

                <!-- Empty state -->
                <div
                    v-if="col.items.length === 0"
                    class="border-2 border-dashed border-gray-200 rounded-xl py-8 text-center text-xs text-gray-300"
                >
                    אין פריטים
                </div>
            </div>
        </div>

        <!-- ── Toast ─────────────────────────────────────────────────────── -->
        <Transition name="toast">
            <div
                v-if="toast"
                class="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm font-bold shadow-xl z-50"
                :class="toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'"
            >
                {{ toast.msg }}
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>

```

---

## frontend/components/QuizModal.vue
**Type:** frontend

```vue
<script setup lang="ts">
import type { AttemptQuestion, QuizPhase, QuizSubmitResult } from '~/types/types';
import { useQuizzes } from '~/composables/useQuizzes';

const props = defineProps<{
    challengeId: string;
    userId: string;
    phase: QuizPhase;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'submitted', result: QuizSubmitResult): void;
}>();

const quizzes = useQuizzes();

// ── Quiz state ────────────────────────────────────────────────────────────────
const loading = ref(true);
const error = ref<string | null>(null);
const questions = ref<AttemptQuestion[]>([]);
const attemptId = ref<string | null>(null);
const currentIndex = ref(0);
const answers = reactive<Record<string, number>>({});   // questionId → selectedIndex
const selectedForCurrent = ref<number | null>(null);    // brief visual selected state
const submitting = ref(false);
const result = ref<QuizSubmitResult | null>(null);

const currentQuestion = computed(() => questions.value[currentIndex.value] ?? null);
const answeredCount = computed(() => Object.keys(answers).length);
const allAnswered = computed(() => questions.value.length > 0 && answeredCount.value === questions.value.length);
const inSummary = computed(() => allAnswered.value && result.value === null && !loading.value && !error.value);
const phaseLabel = computed(() => props.phase === 'pre' ? 'בוחן לפני המשימה' : 'בוחן אחרי המשימה');

const BUBBLE_COLORS = [
    'bg-violet-500 hover:bg-violet-400',
    'bg-amber-500  hover:bg-amber-400',
    'bg-emerald-500 hover:bg-emerald-400',
    'bg-rose-500   hover:bg-rose-400',
    'bg-sky-500    hover:bg-sky-400',
    'bg-pink-500   hover:bg-pink-400',
];

// ── Load ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
    try {
        const data = await quizzes.start(props.challengeId, props.userId, props.phase);
        attemptId.value = data.attempt.id;
        questions.value = data.questions;
        for (const q of data.questions) {
            if (q.selectedIndex !== null) answers[q.questionId] = q.selectedIndex;
        }
        if (data.attempt.submittedAt) {
            result.value = {
                score: data.attempt.score ?? 0,
                total: data.attempt.total,
                learningGain: data.attempt.learningGain,
            };
        } else {
            const firstUnanswered = data.questions.findIndex((q) => q.selectedIndex === null);
            if (firstUnanswered >= 0) currentIndex.value = firstUnanswered;
        }
    } catch (e: any) {
        error.value = e?.data?.message ?? e?.message ?? 'Failed to load quiz';
    } finally {
        loading.value = false;
    }
});

onUnmounted(() => stopBgMusic());

// ── Answer selection ──────────────────────────────────────────────────────────
let bgMusicStarted = false;

function selectAnswer(optionIndex: number) {
    if (!currentQuestion.value || selectedForCurrent.value !== null) return;

    if (!bgMusicStarted) {
        startBgMusic();
        bgMusicStarted = true;
    }

    selectedForCurrent.value = optionIndex;
    setTimeout(() => {
        if (currentQuestion.value) {
            answers[currentQuestion.value.questionId] = optionIndex;
        }
        selectedForCurrent.value = null;
        if (currentIndex.value < questions.value.length - 1) {
            currentIndex.value++;
        }
        // if last question, allAnswered becomes true → inSummary shows
    }, 320);
}

// ── Submit ────────────────────────────────────────────────────────────────────
async function handleSubmit() {
    if (!attemptId.value || !allAnswered.value || submitting.value) return;
    submitting.value = true;
    error.value = null;
    try {
        const payload = questions.value.map((q) => ({
            questionId: q.questionId,
            selectedIndex: answers[q.questionId],
        }));
        const r = await quizzes.submit(attemptId.value, payload);
        stopBgMusic();
        playVictorySound();
        emit('submitted', r);
        if (props.phase === 'post') {
            result.value = r;
        }
    } catch (e: any) {
        error.value = e?.data?.message ?? e?.message ?? 'Submit failed';
    } finally {
        submitting.value = false;
    }
}

// ── Audio — Web Audio API (no external files needed) ─────────────────────────
// To use real audio files instead, replace the startBgMusic / playVictorySound
// implementations with:
//   const bgAudio = new Audio('/audio/quiz-bg.mp3');  bgAudio.loop = true;
//   const winAudio = new Audio('/audio/quiz-victory.mp3');
// Place files at: frontend/public/audio/quiz-bg.mp3 and quiz-victory.mp3

let audioCtx: AudioContext | null = null;
let bgSchedulerTimer: ReturnType<typeof setInterval> | null = null;
let bgNoteIndex = 0;
let bgNextTime = 0;

// Bright C-major pentatonic pattern — loops cheerfully
const BG_SCALE = [523.25, 659.25, 783.99, 880.00, 1046.50, 880.00, 783.99, 659.25];

function getCtx(): AudioContext | null {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    } catch { return null; }
}

function scheduleBgNote(ctx: AudioContext) {
    const now = ctx.currentTime;
    if (bgNextTime < now) bgNextTime = now;
    const NOTE = 0.17;
    const AHEAD = 0.5;
    while (bgNextTime < now + AHEAD) {
        const freq = BG_SCALE[bgNoteIndex % BG_SCALE.length];
        bgNoteIndex++;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.028, bgNextTime);
        gain.gain.exponentialRampToValueAtTime(0.001, bgNextTime + NOTE * 0.85);
        osc.start(bgNextTime);
        osc.stop(bgNextTime + NOTE);
        bgNextTime += NOTE;
    }
}

function startBgMusic() {
    const ctx = getCtx();
    if (!ctx) return;
    bgNextTime = ctx.currentTime;
    bgNoteIndex = 0;
    scheduleBgNote(ctx);
    bgSchedulerTimer = setInterval(() => scheduleBgNote(ctx), 150);
}

function stopBgMusic() {
    if (bgSchedulerTimer) { clearInterval(bgSchedulerTimer); bgSchedulerTimer = null; }
}

function playVictorySound() {
    const ctx = getCtx();
    if (!ctx) return;
    // Rising C-major arpeggio: C5 E5 G5 C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    let t = ctx.currentTime + 0.05;
    for (const freq of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.start(t);
        osc.stop(t + 0.4);
        t += 0.13;
    }
}
</script>

<template>
    <div class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" dir="rtl">
        <div class="w-full max-w-md bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col">

            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-[#3CC2EE] uppercase tracking-wide">{{ phaseLabel }}</span>
                    <span v-if="!loading && questions.length > 0 && !result" class="text-xs text-white/40 mt-0.5">
                        שאלה {{ Math.min(currentIndex + 1, questions.length) }} מתוך {{ questions.length }}
                    </span>
                </div>
                <button class="text-white/40 hover:text-white/90 text-xl leading-none transition-colors" @click="emit('close')">✕</button>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex justify-center py-16">
                <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
            </div>

            <!-- Error -->
            <div v-else-if="error && !result" class="px-6 py-10 text-center flex flex-col items-center gap-4">
                <p class="text-red-400 text-sm">{{ error }}</p>
                <button class="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition-colors" @click="emit('close')">סגור</button>
            </div>

            <!-- Result screen (after submit) -->
            <div v-else-if="result" class="px-6 py-10 flex flex-col items-center gap-5">
                <div class="text-5xl">🏆</div>
                <div class="text-4xl font-extrabold text-white">{{ result.score }} / {{ result.total }}</div>
                <div class="text-sm font-medium">
                    <span v-if="result.learningGain !== null"
                        :class="result.learningGain >= 0 ? 'text-emerald-400' : 'text-amber-400'"
                    >
                        שיפור: {{ result.learningGain >= 0 ? '+' : '' }}{{ result.learningGain }}
                    </span>
                    <span v-else class="text-white/40">הבוחן השני יגלה כמה למדת</span>
                </div>
                <button
                    class="mt-2 px-8 py-3 bg-[#3CC2EE] hover:bg-[#27b3df] text-white rounded-full font-bold transition-colors shadow-lg"
                    @click="emit('close')"
                >
                    חזור למשימה ←
                </button>
            </div>

            <!-- Summary screen (all answered, not yet submitted) -->
            <div v-else-if="inSummary" class="px-6 py-10 flex flex-col items-center gap-5">
                <div class="text-5xl animate-bounce">🎉</div>
                <div class="text-xl font-extrabold text-white text-center">כל הכבוד!</div>
                <div class="text-sm text-white/60 text-center">
                    ענית על {{ questions.length }} מתוך {{ questions.length }} שאלות
                </div>
                <p v-if="error" class="text-red-400 text-xs text-center">{{ error }}</p>
                <button
                    class="mt-2 px-8 py-3 bg-[#3CC2EE] hover:bg-[#27b3df] disabled:opacity-40 text-white rounded-full font-bold transition-colors shadow-lg"
                    :disabled="submitting"
                    @click="handleSubmit"
                >
                    <span v-if="submitting" class="flex items-center gap-2">
                        <span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                        שולח...
                    </span>
                    <span v-else>שלח תשובות ▸</span>
                </button>
            </div>

            <!-- Game — question + answer bubbles -->
            <div v-else-if="currentQuestion" class="px-5 py-6 flex flex-col items-center gap-5">

                <!-- Progress dots -->
                <div class="flex gap-1.5 flex-wrap justify-center">
                    <div
                        v-for="(q, i) in questions"
                        :key="q.id"
                        class="w-2 h-2 rounded-full transition-colors duration-300"
                        :class="i < currentIndex
                            ? 'bg-[#3CC2EE]'
                            : i === currentIndex
                                ? 'bg-white/80 scale-125'
                                : 'bg-white/20'"
                    />
                </div>

                <!-- Question bubble — large circle -->
                <div class="w-52 h-52 rounded-full bg-gradient-to-br from-[#3CC2EE] to-cyan-700 flex items-center justify-center text-center shadow-2xl ring-4 ring-[#3CC2EE]/30 p-7 shrink-0">
                    <p class="text-white font-bold text-sm leading-snug">{{ currentQuestion.prompt }}</p>
                </div>

                <!-- Instruction -->
                <p class="text-white/40 text-xs">בחר את התשובה הנכונה</p>

                <!-- Answer bubbles — 2-column pill grid -->
                <div class="grid grid-cols-2 gap-3 w-full">
                    <button
                        v-for="(opt, i) in currentQuestion.options"
                        :key="i"
                        class="rounded-2xl py-5 px-3 text-white text-xs font-bold text-center leading-snug shadow-lg min-h-[76px] transition-all duration-200 select-none"
                        :class="[
                            BUBBLE_COLORS[i % BUBBLE_COLORS.length],
                            selectedForCurrent === i
                                ? 'opacity-60 scale-95'
                                : selectedForCurrent === null
                                    ? 'hover:scale-105 active:scale-95'
                                    : 'opacity-40 cursor-not-allowed'
                        ]"
                        :disabled="selectedForCurrent !== null"
                        @click="selectAnswer(i)"
                    >
                        {{ opt }}
                    </button>
                </div>
            </div>

        </div>
    </div>
</template>

```

---

## frontend/components/RoleAssignmentPanel.vue
**Type:** frontend

```vue
<script setup lang="ts">
import { ROLE_LABELS, ROLE_PRIORITY } from '~/types/types';
import type { StudentRole, StudentWithRoleHistory } from '~/types/types';
import { useTeacher } from '~/composables/useTeacher';

const props = defineProps<{
    teamId: string;
    challengeId?: string;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'saved'): void;
}>();

const teacher = useTeacher();
const { students, loading } = teacher;

const localStudents = ref<StudentWithRoleHistory[]>([]);
const assignments = reactive<Record<string, StudentRole | ''>>({});
const dirty = ref(false);
const busy = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

watch(
    students,
    (val) => {
        localStudents.value = [...val];
        for (const s of val) {
            if (!assignments[s.id]) assignments[s.id] = s.currentRole ?? '';
        }
    },
    { immediate: true, deep: true },
);

watch(
    () => props.teamId,
    (id) => {
        if (id) teacher.fetchStudents(id);
    },
    { immediate: true },
);

const ROLE_COLOR: Record<string, string> = {
    pm:       'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
    qa:       'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200',
    dev:      'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    hardware: 'bg-green-100 text-green-700 ring-1 ring-green-200',
};

function roleColorClass(role: StudentRole | null) {
    if (!role) return 'bg-gray-100 text-gray-500 ring-1 ring-gray-200';
    return ROLE_COLOR[role] ?? 'bg-gray-100 text-gray-500 ring-1 ring-gray-200';
}

async function handleAutoAssign() {
    busy.value = true;
    errorMsg.value = '';
    successMsg.value = '';
    try {
        const result = await teacher.autoAssignRoles(props.teamId, props.challengeId);
        for (const s of result) assignments[s.id] = s.currentRole ?? '';
        localStudents.value = result;
        dirty.value = false;
        successMsg.value = 'התפקידים שובצו אוטומטית ונשמרו.';
        emit('saved');
    } catch (e: any) {
        errorMsg.value = e?.data?.message ?? 'השיבוץ האוטומטי נכשל';
    } finally {
        busy.value = false;
    }
}

async function handleSave() {
    busy.value = true;
    errorMsg.value = '';
    successMsg.value = '';
    try {
        const payload = {
            assignments: Object.entries(assignments)
                .filter(([, role]) => !!role)
                .map(([userId, role]) => ({ userId, role: role as StudentRole })),
            challengeId: props.challengeId,
        };
        await teacher.assignRoles(props.teamId, payload);
        dirty.value = false;
        successMsg.value = 'השיבוץ נשמר.';
        emit('saved');
    } catch (e: any) {
        errorMsg.value = e?.data?.message ?? 'השמירה נכשלה';
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="bg-white border border-gray-200 rounded-2xl p-6 space-y-5 shadow-sm" dir="rtl">
        <div class="flex items-center justify-between">
            <h2 class="text-lg font-extrabold text-gray-900">שיבוץ תפקידים</h2>
            <button
                class="text-gray-400 hover:text-gray-700 transition-colors text-xl"
                @click="emit('close')"
            >
                ✕
            </button>
        </div>

        <div v-if="loading" class="text-gray-400 text-center py-8 text-sm">
            טוען תלמידים...
        </div>

        <template v-else>
            <div class="flex gap-3 flex-wrap">
                <button
                    :disabled="busy"
                    class="px-4 py-2 bg-[#3CC2EE] hover:bg-[#27b3df] disabled:opacity-50 text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                    @click="handleAutoAssign"
                >
                    ⚡ שיבוץ אוטומטי
                </button>
                <button
                    :disabled="busy || !dirty"
                    class="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                    @click="handleSave"
                >
                    💾 שמור שיבוץ
                </button>
            </div>

            <div class="space-y-3">
                <div
                    v-for="student in localStudents"
                    :key="student.id"
                    class="bg-gray-50 rounded-xl p-4 flex flex-col gap-2 border border-gray-200"
                >
                    <div class="flex items-center justify-between">
                        <span class="text-gray-900 font-semibold">{{ student.name }}</span>
                        <span
                            v-if="student.currentRole"
                            class="text-xs px-2 py-0.5 rounded-full font-medium"
                            :class="roleColorClass(student.currentRole)"
                        >
                            {{ ROLE_LABELS[student.currentRole] ?? student.currentRole }}
                        </span>
                    </div>

                    <div v-if="student.lastRoles.length" class="flex gap-1 flex-wrap items-center">
                        <span class="text-xs text-gray-400">תפקידים אחרונים:</span>
                        <template v-for="(r, i) in student.lastRoles" :key="i">
                            <span class="text-xs text-gray-500">
                                {{ ROLE_LABELS[r] ?? r }}<span v-if="i < student.lastRoles.length - 1">,</span>
                            </span>
                        </template>
                    </div>

                    <select
                        v-model="assignments[student.id]"
                        class="mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                        @change="dirty = true"
                    >
                        <option value="">— בחר תפקיד —</option>
                        <option v-for="role in ROLE_PRIORITY" :key="role" :value="role">
                            {{ ROLE_LABELS[role] }}
                        </option>
                    </select>

                    <div v-if="student.suggestedRole" class="text-xs text-[#3CC2EE]">
                        מומלץ: {{ ROLE_LABELS[student.suggestedRole] }}
                    </div>
                </div>

                <p v-if="!localStudents.length" class="text-sm text-gray-400 text-center py-6">
                    אין תלמידים בצוות הזה.
                </p>
            </div>
        </template>

        <p v-if="errorMsg" class="text-red-600 text-sm">{{ errorMsg }}</p>
        <p v-if="successMsg" class="text-emerald-600 text-sm">{{ successMsg }}</p>
    </div>
</template>

```

---

## frontend/components/RoleInfoPopup.vue
**Type:** frontend

```vue
<script setup lang="ts">
import { getRoleInfo } from '~/utils/roleInfo';

const props = defineProps<{
    roleKey: string;
    roleLabel: string;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

const info = computed(() => getRoleInfo(props.roleKey));

function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) emit('close');
}

onMounted(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close'); };
    window.addEventListener('keydown', handler);
    onUnmounted(() => window.removeEventListener('keydown', handler));
});
</script>

<template>
    <div
        class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        dir="rtl"
        @click="onBackdrop"
    >
        <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

            <!-- Header -->
            <div class="bg-gradient-to-r from-[#3CC2EE] to-cyan-500 px-6 py-5 flex items-start justify-between gap-3">
                <div>
                    <p class="text-white/80 text-xs font-semibold uppercase tracking-wide">מה התפקיד שלי?</p>
                    <h2 class="text-white text-xl font-extrabold mt-0.5">Junior {{ info?.title ?? roleLabel }}</h2>
                    <p v-if="info?.subtitle" class="text-white/80 text-sm mt-0.5">{{ info.subtitle }}</p>
                </div>
                <button class="text-white/60 hover:text-white text-xl leading-none mt-0.5 shrink-0" @click="emit('close')">✕</button>
            </div>

            <!-- Body -->
            <div class="px-6 py-5 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">

                <!-- No info fallback -->
                <p v-if="!info" class="text-sm text-gray-500">אין מידע זמין לתפקיד זה.</p>

                <template v-else>
                    <!-- Junior callout -->
                    <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2">
                        <span class="text-amber-500 text-base shrink-0 mt-0.5">⭐</span>
                        <p class="text-sm text-amber-800 leading-snug">
                            <span class="font-bold">ג׳וניור</span> אומר שאתה בתחילת הדרך בתפקיד הזה.
                            לא מצופה ממך לדעת הכול מראש — המטרה היא ללמוד, לשאול שאלות, להתנסות ולעזור לצוות לפי ההנחיות.
                        </p>
                    </div>

                    <!-- Responsibility bullets -->
                    <div>
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">מה אתה אחראי?</p>
                        <ul class="flex flex-col gap-2">
                            <li
                                v-for="(bullet, i) in info.bullets"
                                :key="i"
                                class="flex gap-2 text-sm text-gray-700 leading-snug"
                            >
                                <span class="text-[#3CC2EE] font-bold shrink-0 mt-0.5">•</span>
                                <span>{{ bullet }}</span>
                            </li>
                        </ul>
                    </div>

                    <!-- Jargon / terms -->
                    <div v-if="info.jargon && info.jargon.length" class="border-t border-gray-100 pt-4">
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">מילון מונחים</p>
                        <dl class="flex flex-col gap-2">
                            <div v-for="item in info.jargon" :key="item.term" class="flex gap-2 text-sm">
                                <dt class="font-bold text-gray-800 shrink-0">{{ item.term }}:</dt>
                                <dd class="text-gray-600 leading-snug">{{ item.explanation }}</dd>
                            </div>
                        </dl>
                    </div>
                </template>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-100 flex items-center">
                <button
                    class="px-6 py-2.5 bg-[#3CC2EE] hover:bg-[#27b3df] text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                    @click="emit('close')"
                >
                    הבנתי ✓
                </button>
            </div>

        </div>
    </div>
</template>

```

---

## frontend/components/SprintProgress.vue
**Type:** frontend

```vue
<script setup lang="ts">
const props = defineProps<{
    sprintTitle: string;
    approved: number;
    total: number;
    score: number;
    sprintStatus: string;
}>();

const pct = computed(() =>
    props.total > 0 ? Math.round((props.approved / props.total) * 100) : 0,
);

const statusColor: Record<string, string> = {
    idle: 'bg-gray-400',
    active: 'bg-indigo-500',
    completed: 'bg-emerald-500',
};
</script>

<template>
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
        <!-- Sprint status + score -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-3">
                <span class="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                    ⭐ {{ score }} pts
                </span>
                <span
                    :class="['text-xs font-medium px-2.5 py-1 rounded-full text-white', statusColor[sprintStatus] ?? 'bg-gray-400']"
                >
                    {{ sprintStatus.charAt(0).toUpperCase() + sprintStatus.slice(1) }}
                </span>
            </div>
        </div>

        <!-- Progress bar -->
        <div>
            <div class="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>Tasks approved</span>
                <span class="font-semibold text-gray-700">{{ approved }} / {{ total }}</span>
            </div>
            <div class="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    class="h-full rounded-full transition-all duration-700"
                    :class="pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'"
                    :style="{ width: `${pct}%` }"
                />
            </div>
            <p v-if="pct === 100" class="text-xs text-emerald-600 font-medium mt-1.5">
                🎉 Sprint complete!
            </p>
        </div>
    </div>
</template>

```

---

## frontend/components/StudentProfileCard.vue
**Type:** frontend

```vue
<script setup lang="ts">
import type { StudentProfile, ProfileSnapshot } from '~/types/types';

const props = defineProps<{
    profile: StudentProfile;
    snapshots?: readonly ProfileSnapshot[];
    userName?: string;
}>();

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('he-IL');
}

function scoreColor(score: number): string {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-500';
}

function scoreBar(score: number): string {
    if (score >= 70) return 'bg-emerald-400';
    if (score >= 40) return 'bg-amber-400';
    return 'bg-red-400';
}

const alertConfig = computed(() => {
    switch (props.profile.alertLevel) {
        case 'high':   return { label: '🔴 דורש תשומת לב', cls: 'bg-red-50 border-red-200 text-red-700' };
        case 'medium': return { label: '🟡 בדוק/י', cls: 'bg-amber-50 border-amber-200 text-amber-700' };
        case 'low':    return { label: '🔵 הערה קלה', cls: 'bg-blue-50 border-blue-200 text-blue-700' };
        default:       return null;
    }
});
</script>

<template>
    <div
        class="bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-4 transition-all"
        :class="profile.alertLevel === 'high' ? 'border-red-300' : profile.alertLevel === 'medium' ? 'border-amber-300' : 'border-gray-200'"
    >
        <!-- Header -->
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {{ (userName ?? 'U').charAt(0) }}
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-800 text-sm">{{ userName ?? 'תלמיד/ה' }}</p>
                <p class="text-xs text-gray-400">{{ profile.messagesAnalyzed }} הודעות נותחו · {{ formatDate(profile.lastAnalyzedAt) }}</p>
            </div>
        </div>

        <!-- Alert banner -->
        <div v-if="alertConfig" :class="['rounded-xl border px-3 py-2 text-xs font-medium', alertConfig.cls]">
            {{ alertConfig.label }}
            <span v-if="profile.lastAlertMessage" class="block font-normal mt-0.5 opacity-80">{{ profile.lastAlertMessage }}</span>
        </div>

        <!-- Scores -->
        <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 rounded-xl p-3">
                <p class="text-xs text-gray-500 mb-1">ז'רגון טכני</p>
                <p :class="['text-2xl font-bold', scoreColor(profile.jargonScore)]">{{ profile.jargonScore.toFixed(0) }}</p>
                <div class="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div :class="['h-full rounded-full transition-all', scoreBar(profile.jargonScore)]" :style="`width: ${profile.jargonScore}%`" />
                </div>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
                <p class="text-xs text-gray-500 mb-1">רכישת כישורים</p>
                <p :class="['text-2xl font-bold', scoreColor(profile.softSkillScore)]">{{ profile.softSkillScore.toFixed(0) }}</p>
                <div class="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div :class="['h-full rounded-full transition-all', scoreBar(profile.softSkillScore)]" :style="`width: ${profile.softSkillScore}%`" />
                </div>
            </div>
        </div>

        <!-- Struggle areas -->
        <div v-if="profile.struggleAreas?.length">
            <p class="text-xs text-gray-500 mb-1.5">⚠️ נושאים שהתקשה בהם</p>
            <div class="flex flex-wrap gap-1.5">
                <span
                    v-for="area in profile.struggleAreas.slice(0, 8)"
                    :key="area"
                    class="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full"
                >
                    {{ area }}
                </span>
                <span v-if="profile.struggleAreas.length > 8" class="text-xs text-gray-400">+{{ profile.struggleAreas.length - 8 }}</span>
            </div>
        </div>

        <!-- Detected terms -->
        <div v-if="profile.detectedTerms.length">
            <p class="text-xs text-gray-500 mb-1.5">✅ מונחים שזוהו</p>
            <div class="flex flex-wrap gap-1.5">
                <span
                    v-for="term in profile.detectedTerms.slice(0, 10)"
                    :key="term"
                    class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full"
                >
                    {{ term }}
                </span>
                <span v-if="profile.detectedTerms.length > 10" class="text-xs text-gray-400">+{{ profile.detectedTerms.length - 10 }}</span>
            </div>
        </div>

        <!-- Progress sparkline -->
        <div v-if="snapshots && snapshots.length > 1" class="flex flex-col gap-1">
            <p class="text-xs text-gray-500">התקדמות ז'רגון לאורך זמן</p>
            <div class="flex items-end gap-0.5 h-10">
                <div
                    v-for="snap in snapshots.slice(-16)"
                    :key="snap.id"
                    class="flex-1 rounded-sm transition-all"
                    :class="scoreBar(snap.jargonScore)"
                    :style="`height: ${Math.max(4, snap.jargonScore)}%`"
                    :title="`${new Date(snap.snapshotAt).toLocaleDateString('he-IL')}: ${snap.jargonScore.toFixed(0)}`"
                />
            </div>
        </div>
    </div>
</template>

```

---

## frontend/components/TeacherChatPanel.vue
**Type:** frontend

```vue
<script setup lang="ts">
import type { ChatChannel, ChatMessage } from '~/types/types';

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

// ── Panel tab ─────────────────────────────────────────────────────────────────
const panelTab = ref<'group' | 'private'>('group');

// ── Group chat ────────────────────────────────────────────────────────────────
const channels       = ref<ChatChannel[]>([]);
const selectedCh     = ref<ChatChannel | null>(null);
const groupMessages  = ref<ChatMessage[]>([]);
const loadingCh      = ref(false);
const analyzingGroup = ref(false);
const groupResult    = ref<{ analyzed: number; summary: string } | null>(null);

async function fetchChannels() {
    loadingCh.value = true;
    try {
        const all = await $fetch<ChatChannel[]>(`${base}/chat/channels`);
        // Deduplicate by name — until all teams have unique channel names
        const seen = new Set<string>();
        channels.value = all.filter((ch) => {
            if (seen.has(ch.name)) return false;
            seen.add(ch.name);
            return true;
        });
        if (channels.value.length && !selectedCh.value) await selectChannel(channels.value[0]);
    } finally { loadingCh.value = false; }
}

async function selectChannel(ch: ChatChannel) {
    selectedCh.value = ch;
    groupResult.value = null;
    groupMessages.value = await $fetch<ChatMessage[]>(`${base}/chat/channels/${ch.id}/messages`).catch(() => []);
}

async function runGroupAnalysis() {
    if (!selectedCh.value) return;
    analyzingGroup.value = true;
    try {
        groupResult.value = await $fetch<{ analyzed: number; summary: string }>(
            `${base}/dude/channels/${selectedCh.value.id}/analyze`, { method: 'POST' },
        );
        showToast('ניתוח קבוצתי הושלם ✅');
    } catch { showToast('ניתוח נכשל — נסה שוב'); }
    finally { analyzingGroup.value = false; }
}

// ── Private chats ─────────────────────────────────────────────────────────────
interface StudentRow { id: string; name: string; email: string }
interface PrivateMsg { id: string; role: 'student' | 'dude'; content: string; createdAt: string }

const students         = ref<StudentRow[]>([]);
const selectedStudent  = ref<StudentRow | null>(null);
const privateMsgs      = ref<PrivateMsg[]>([]);
const loadingStudents  = ref(false);
const loadingPrivate   = ref(false);
const analyzingPrivate = ref(false);
const privateResult    = ref<{ analyzed: number; summary: string } | null>(null);

async function fetchStudents() {
    loadingStudents.value = true;
    try {
        const all = await $fetch<{ id: string; name: string; email: string; account_type: string }[]>(`${base}/users`);
        students.value = all.filter((u) => u.account_type === 'student');
        if (students.value.length && !selectedStudent.value) await selectStudent(students.value[0]);
    } finally { loadingStudents.value = false; }
}

async function selectStudent(s: StudentRow) {
    selectedStudent.value = s;
    privateResult.value = null;
    await fetchPrivateMsgs();
}

const migrationPending = ref(false);

async function fetchPrivateMsgs() {
    if (!selectedStudent.value) return;
    loadingPrivate.value = true;
    migrationPending.value = false;
    try {
        const result = await $fetch<PrivateMsg[]>(`${base}/dude/private/${selectedStudent.value.id}/messages`);
        privateMsgs.value = result;
        migrationPending.value = false;
    } catch (e: any) {
        privateMsgs.value = [];
        if (String(e?.message ?? e).includes('42P01') || String(e?.data ?? '').includes('42P01')) {
            migrationPending.value = true;
        }
    } finally { loadingPrivate.value = false; }
}

async function runPrivateAnalysis() {
    if (!selectedStudent.value) return;
    analyzingPrivate.value = true;
    try {
        privateResult.value = await $fetch<{ analyzed: number; summary: string }>(
            `${base}/dude/private/${selectedStudent.value.id}/analyze`, { method: 'POST' },
        );
        showToast('ניתוח שיחה פרטית הושלם ✅');
    } catch { showToast('ניתוח נכשל — נסה שוב'); }
    finally { analyzingPrivate.value = false; }
}

// ── Shared ────────────────────────────────────────────────────────────────────
const toast = ref<string | null>(null);
function showToast(msg: string) {
    toast.value = msg;
    setTimeout(() => { toast.value = null; }, 3000);
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
    await Promise.all([fetchChannels(), fetchStudents()]);
    pollTimer = setInterval(() => {
        if (panelTab.value === 'group') selectChannel(selectedCh.value!).catch(() => undefined);
        else fetchPrivateMsgs().catch(() => undefined);
    }, 8000);
});

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>

<template>
    <div class="flex h-full gap-4" dir="rtl">

        <!-- ══ LEFT SIDEBAR ══════════════════════════════════════════════════ -->
        <div class="w-52 shrink-0 flex flex-col gap-3">

            <!-- Tab toggle -->
            <div class="flex rounded-xl overflow-hidden border border-gray-700 text-xs font-bold">
                <button
                    :class="['flex-1 py-2 transition-colors', panelTab === 'group' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700']"
                    @click="panelTab = 'group'"
                >
                    💬 קבוצתי
                </button>
                <button
                    :class="['flex-1 py-2 transition-colors', panelTab === 'private' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700']"
                    @click="panelTab = 'private'"
                >
                    🤖 פרטי
                </button>
            </div>

            <!-- Group: channel list -->
            <template v-if="panelTab === 'group'">
                <p class="text-[11px] text-gray-500 font-semibold uppercase tracking-wider px-1">ערוצי צוות</p>
                <div v-if="loadingCh" class="text-xs text-gray-500 px-1">טוען...</div>
                <button
                    v-for="ch in channels"
                    :key="ch.id"
                    :class="['text-right px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full',
                        selectedCh?.id === ch.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700']"
                    @click="selectChannel(ch)"
                >
                    💬 {{ ch.name }}
                </button>
                <div v-if="!channels.length && !loadingCh" class="text-xs text-gray-500 px-1">אין צ'אטים פעילים.</div>
            </template>

            <!-- Private: student list -->
            <template v-else>
                <p class="text-[11px] text-gray-500 font-semibold uppercase tracking-wider px-1">תלמידים</p>
                <div v-if="loadingStudents" class="text-xs text-gray-500 px-1">טוען...</div>
                <button
                    v-for="s in students"
                    :key="s.id"
                    :class="['text-right px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full',
                        selectedStudent?.id === s.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700']"
                    @click="selectStudent(s)"
                >
                    🤖 {{ s.name }}
                </button>
                <div v-if="!students.length && !loadingStudents" class="text-xs text-gray-500 px-1">אין תלמידים.</div>
            </template>
        </div>

        <!-- ══ MAIN PANEL ════════════════════════════════════════════════════ -->

        <!-- GROUP CHAT panel -->
        <div v-if="panelTab === 'group'" class="flex-1 flex flex-col gap-3 min-w-0">

            <!-- Header + analyze button -->
            <div class="flex items-center gap-3 flex-wrap">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0" />
                    <span class="font-semibold text-white text-sm">{{ selectedCh?.name ?? 'בחר ערוץ' }}</span>
                </div>
                <span class="text-[11px] text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">🔇 DUDE שקט</span>
                <button
                    v-if="selectedCh"
                    class="mr-auto flex items-center gap-2 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50"
                    :disabled="analyzingGroup"
                    @click="runGroupAnalysis"
                >
                    <span v-if="analyzingGroup" class="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>{{ analyzingGroup ? 'מנתח...' : '🧠 נתח שיחה' }}</span>
                </button>
            </div>

            <!-- Group analysis result -->
            <div v-if="groupResult" class="bg-indigo-900/60 border border-indigo-600 rounded-xl px-4 py-3 text-xs flex items-start gap-3">
                <span class="text-base shrink-0">✅</span>
                <div class="text-indigo-200">
                    <p class="font-bold text-indigo-100 mb-0.5">{{ groupResult.analyzed }} הודעות נותחו</p>
                    <p>{{ groupResult.summary }}</p>
                    <p class="text-indigo-500 mt-1">פרופילי תלמידים עודכנו ← "DUDE Insights"</p>
                </div>
            </div>

            <!-- Messages -->
            <div class="flex-1 overflow-y-auto flex flex-col gap-2 bg-gray-800 rounded-2xl p-4 min-h-0" style="max-height: 480px">
                <div v-if="!groupMessages.length" class="text-center text-sm text-gray-500 py-10">
                    אין הודעות בערוץ זה.
                </div>
                <div v-for="msg in groupMessages" :key="msg.id" class="flex items-start gap-2">
                    <div :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white',
                        msg.isBot ? 'bg-indigo-600' : 'bg-gray-600']">
                        {{ msg.isBot ? '🤖' : msg.senderName.charAt(0) }}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-2">
                            <span :class="['text-xs font-semibold', msg.isBot ? 'text-indigo-400' : 'text-gray-300']">{{ msg.senderName }}</span>
                            <span class="text-xs text-gray-500">{{ formatTime(msg.createdAt) }}</span>
                        </div>
                        <p class="text-sm text-gray-200 mt-0.5 break-words">{{ msg.content }}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- PRIVATE DUDE panel -->
        <div v-else class="flex-1 flex flex-col gap-3 min-w-0">

            <!-- Header + analyze button -->
            <div class="flex items-center gap-3 flex-wrap">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0" />
                    <span class="font-semibold text-white text-sm">
                        {{ selectedStudent ? `${selectedStudent.name} ← מנטור פרטי` : 'בחר תלמיד' }}
                    </span>
                </div>
                <span class="text-[11px] text-violet-300 border border-violet-700 bg-violet-900/40 px-2 py-0.5 rounded-full">🤖 1-on-1 DUDE</span>
                <button
                    v-if="selectedStudent"
                    class="mr-auto flex items-center gap-2 bg-violet-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-violet-500 active:scale-95 transition-all disabled:opacity-50"
                    :disabled="analyzingPrivate"
                    @click="runPrivateAnalysis"
                >
                    <span v-if="analyzingPrivate" class="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>{{ analyzingPrivate ? 'מנתח...' : '🧠 נתח שיחה פרטית' }}</span>
                </button>
            </div>

            <!-- Private analysis result -->
            <div v-if="privateResult" class="bg-violet-900/60 border border-violet-600 rounded-xl px-4 py-3 text-xs flex items-start gap-3">
                <span class="text-base shrink-0">✅</span>
                <div class="text-violet-200">
                    <p class="font-bold text-violet-100 mb-0.5">{{ privateResult.analyzed }} הודעות נותחו (שיחה פרטית)</p>
                    <p>{{ privateResult.summary }}</p>
                    <p class="text-violet-500 mt-1">פרופיל תלמיד עודכן ← "DUDE Insights"</p>
                </div>
            </div>

            <!-- Migration pending warning -->
            <div v-if="migrationPending" class="bg-amber-900/50 border border-amber-600 rounded-xl px-4 py-3 text-xs text-amber-200 flex items-start gap-2">
                <span class="shrink-0">⚠️</span>
                <span>טבלת השיחות הפרטיות עוד לא נוצרה — הרץ את migration 007 בסואפאבייס.</span>
            </div>

            <!-- Private messages -->
            <div
                v-if="loadingPrivate"
                class="flex-1 flex items-center justify-center bg-gray-800 rounded-2xl"
                style="max-height: 480px"
            >
                <div class="w-6 h-6 border-4 border-violet-700 border-t-violet-400 rounded-full animate-spin" />
            </div>
            <div
                v-else
                class="flex-1 overflow-y-auto flex flex-col gap-2 rounded-2xl p-4 min-h-0 border border-violet-800/50"
                style="max-height: 480px; background: #1a1025"
            >
                <div v-if="!privateMsgs.length" class="text-center text-sm text-gray-500 py-10">
                    {{ selectedStudent ? 'עדיין אין שיחה פרטית עם DUDE.' : 'בחר תלמיד משמאל.' }}
                </div>
                <div v-for="msg in privateMsgs" :key="msg.id"
                    class="flex items-start gap-2"
                    :class="msg.role === 'student' ? 'flex-row-reverse' : ''"
                >
                    <!-- Avatar -->
                    <div :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white',
                        msg.role === 'dude' ? 'bg-violet-600' : 'bg-gray-600']">
                        {{ msg.role === 'dude' ? '🤖' : (selectedStudent?.name.charAt(0) ?? '?') }}
                    </div>
                    <!-- Bubble -->
                    <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-2" :class="msg.role === 'student' ? 'flex-row-reverse' : ''">
                            <span :class="['text-xs font-semibold', msg.role === 'dude' ? 'text-violet-400' : 'text-gray-300']">
                                {{ msg.role === 'dude' ? 'DUDE 🤖' : selectedStudent?.name }}
                            </span>
                            <span class="text-xs text-gray-500">{{ formatTime(msg.createdAt) }}</span>
                        </div>
                        <p :class="['text-sm mt-0.5 break-words', msg.role === 'dude' ? 'text-violet-100' : 'text-gray-200']">
                            {{ msg.content }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Toast -->
        <Teleport to="body">
            <Transition name="toast">
                <div
                    v-if="toast"
                    :class="['fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-none',
                        panelTab === 'group' ? 'bg-indigo-700 text-white' : 'bg-violet-700 text-white']"
                >
                    {{ toast }}
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>

```

---

## frontend/components/TechSchoolSidebar.vue
**Type:** frontend

```vue
<script setup lang="ts">
export interface TeamMember {
    id: string;
    name: string;
    role: string | null;
}

defineProps<{
    schoolLabel?: string;
    onLogout?: () => void;
    teamMembers?: TeamMember[];
    hideMentorBot?: boolean;
}>();

const TS_LOGO_URL =
    'https://il-lms.techschool.org/wp-content/themes/techschool-IL/assets/img/tech_school_logo.png';

interface NavItem {
    label: string;
    icon: string;
    onClick?: () => void;
}

const navItems: NavItem[] = [
    { label: 'המצב שלי',     icon: '🟦' },
    { label: 'האתגרים שלי',  icon: '🏆' },
    { label: 'לוח אירועים',   icon: '📅' },
    { label: 'תפעול מדפסת',  icon: '🛠️' },
    { label: 'המעבדה',       icon: '🧪' },
];

const ROLE_DISPLAY: Record<string, string> = {
    pm:       'Editor',
    qa:       'QA',
    dev:      'Designer',
    hardware: 'Printer',
};

const ROLE_CHIP: Record<string, string> = {
    pm:       'bg-violet-100 text-violet-700',
    qa:       'bg-amber-100  text-amber-700',
    dev:      'bg-blue-100   text-blue-700',
    hardware: 'bg-emerald-100 text-emerald-700',
};

const INITIAL_BG: Record<string, string> = {
    pm:       'bg-violet-400',
    qa:       'bg-amber-400',
    dev:      'bg-blue-400',
    hardware: 'bg-emerald-400',
};

function initials(name: string): string {
    return name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}
</script>

<template>
    <aside class="w-[200px] bg-[#3CC2EE] flex flex-col items-stretch py-5 px-4 gap-3 shrink-0 min-h-screen">
        <!-- Logo -->
        <div class="bg-white rounded-xl p-2 shadow-md flex items-center justify-center">
            <img
                :src="TS_LOGO_URL"
                alt="TechSchool"
                class="max-h-12 object-contain"
                referrerpolicy="no-referrer"
            />
        </div>

        <!-- School label -->
        <p
            v-if="schoolLabel"
            class="text-white text-xs font-semibold text-center mt-1 mb-2"
        >
            {{ schoolLabel }}
        </p>

        <!-- Nav buttons -->
        <button
            v-for="item in navItems"
            :key="item.label"
            class="bg-white hover:bg-gray-50 rounded-full px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm flex items-center justify-between gap-2 transition-colors"
            @click="item.onClick"
        >
            <span>{{ item.label }}</span>
            <span>{{ item.icon }}</span>
        </button>

        <!-- "הכר את הצוות" panel — shown only when teamMembers prop is passed -->
        <div v-if="teamMembers && teamMembers.length" class="mt-2 bg-white/20 rounded-2xl p-3 flex flex-col gap-2">
            <p class="text-white text-xs font-extrabold text-center tracking-wide">הכר את הצוות</p>
            <div
                v-for="member in teamMembers"
                :key="member.id"
                class="flex items-center gap-2"
            >
                <!-- Initials circle -->
                <div
                    class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    :class="member.role ? (INITIAL_BG[member.role] ?? 'bg-gray-400') : 'bg-gray-400'"
                >
                    {{ initials(member.name) }}
                </div>
                <!-- Name + role -->
                <div class="flex flex-col min-w-0">
                    <span class="text-white text-xs font-semibold leading-tight truncate">{{ member.name }}</span>
                    <span
                        v-if="member.role"
                        class="text-xs font-bold px-1.5 py-0.5 rounded-full mt-0.5 self-start leading-tight"
                        :class="ROLE_CHIP[member.role] ?? 'bg-gray-100 text-gray-600'"
                    >
                        {{ ROLE_DISPLAY[member.role] ?? member.role }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Bot avatar -->
        <div v-if="!hideMentorBot" class="mt-4 flex flex-col items-center gap-2">
            <div class="w-16 h-16 rounded-2xl bg-yellow-300 flex items-center justify-center text-3xl shadow-md">
                🤖
            </div>
            <p class="text-white text-xs font-bold">מנטור הבוט</p>
        </div>

        <div class="flex-1" />

        <!-- Logout -->
        <button
            v-if="onLogout"
            class="bg-white/90 hover:bg-white rounded-full px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm flex items-center justify-center gap-2 transition-colors"
            @click="onLogout"
        >
            <span>↩</span><span>התנתק</span>
        </button>
    </aside>
</template>

```

---

## frontend/composables/useChat.ts
**Type:** frontend

```typescript
import type { ChatChannel, ChatMessage } from '~/types/types';

export function useChat(teamId: Ref<string>, userId: Ref<string>, userName: Ref<string>, teamName: Ref<string> = ref('')) {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    const channel = ref<ChatChannel | null>(null);
    const messages = ref<ChatMessage[]>([]);
    const loading = ref(false);
    const sending = ref(false);
    const error = ref<string | null>(null);

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function initChannel(): Promise<void> {
        if (!teamId.value) return;
        loading.value = true;
        try {
            const existing = await $fetch<ChatChannel | null>(
                `${base}/chat/teams/${teamId.value}/channel`,
            ).catch(() => null);

            if (existing) {
                channel.value = existing;
            } else {
                channel.value = await $fetch<ChatChannel>(
                    `${base}/chat/teams/${teamId.value}/channel?teamName=${encodeURIComponent(teamName.value || teamId.value)}`,
                    { method: 'POST' },
                );
            }
            await fetchMessages();
        } catch (e) {
            error.value = (e as Error).message;
        } finally {
            loading.value = false;
        }
    }

    async function fetchMessages(): Promise<void> {
        if (!channel.value) return;
        try {
            messages.value = await $fetch<ChatMessage[]>(
                `${base}/chat/channels/${channel.value.id}/messages`,
            );
        } catch {
            // silent — keep existing messages on poll failure
        }
    }

    async function sendMessage(content: string): Promise<void> {
        if (!channel.value || !content.trim()) return;
        sending.value = true;
        try {
            // Route through DUDE endpoint so the bot can respond
            await $fetch(`${base}/dude/channels/${channel.value.id}/messages`, {
                method: 'POST',
                body: {
                    senderId: userId.value,
                    senderName: userName.value,
                    content: content.trim(),
                },
            });
            await fetchMessages();
        } catch (e) {
            error.value = (e as Error).message;
        } finally {
            sending.value = false;
        }
    }

    function startPolling(intervalMs = 5000): void {
        stopPolling();
        pollTimer = setInterval(fetchMessages, intervalMs);
    }

    function stopPolling(): void {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    return {
        channel: readonly(channel),
        messages: readonly(messages),
        loading: readonly(loading),
        sending: readonly(sending),
        error: readonly(error),
        initChannel,
        fetchMessages,
        sendMessage,
        startPolling,
        stopPolling,
    };
}

```

---

## frontend/composables/useLeaderboard.ts
**Type:** frontend

```typescript
import type { GroupLeaderboardRow, IndividualLeaderboardRow } from '~/types/types';

export function useLeaderboard() {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    const rows = ref<GroupLeaderboardRow[]>([]);
    const topIndividuals = ref<IndividualLeaderboardRow[]>([]);
    const loading = ref(false);

    async function fetchLeaderboard() {
        loading.value = true;
        try {
            const [groupRaw, indivRaw] = await Promise.all([
                $fetch<Record<string, unknown>[]>(`${base}/teams/leaderboard/group`),
                $fetch<Record<string, unknown>[]>(`${base}/teams/leaderboard/individual`).catch(() => []),
            ]);

            rows.value = groupRaw.map((r) => ({
                id: r.id as string,
                name: r.name as string,
                accumulatedScore: (r.accumulated_score as number) ?? 0,
                sprintStatus: r.sprint_status as string,
                isCompleted: r.is_completed as boolean,
                approvedTaskCount: (r.approved_task_count as number) ?? 0,
            }));

            topIndividuals.value = (indivRaw as Record<string, unknown>[]).map((r) => ({
                id: r.id as string,
                name: r.name as string,
                currentTeamId: (r.current_team_id as string) ?? null,
                currentRole: (r.current_role as IndividualLeaderboardRow['currentRole']) ?? null,
                approvedTasks: (r.approved_tasks as number) ?? 0,
                totalActiveTime: (r.total_active_time as number) ?? 0,
                rank: (r.rank as number) ?? 0,
            }));
        } catch {
            // silently fail — non-critical
        } finally {
            loading.value = false;
        }
    }

    return {
        rows: readonly(rows),
        topIndividuals: readonly(topIndividuals),
        loading: readonly(loading),
        fetchLeaderboard,
    };
}

```

---

## frontend/composables/usePrivateDude.ts
**Type:** frontend

```typescript
import type { ChatMessage } from '~/types/types';

interface HistoryItem {
    role: 'user' | 'assistant';
    content: string;
}

export function usePrivateDude(userId: Ref<string>, userName: Ref<string>) {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    const messages = ref<ChatMessage[]>([]);
    const sending = ref(false);

    function makeId() {
        return Math.random().toString(36).slice(2);
    }

    async function sendMessage(content: string): Promise<void> {
        if (!content.trim() || !userId.value) return;

        const userMsg: ChatMessage = {
            id: makeId(),
            channelId: 'private',
            senderId: userId.value,
            senderName: userName.value,
            isBot: false,
            content: content.trim(),
            createdAt: new Date().toISOString(),
        };
        messages.value = [...messages.value, userMsg];

        sending.value = true;
        try {
            const history: HistoryItem[] = messages.value
                .slice(-12)
                .map((m) => ({ role: m.isBot ? 'assistant' : 'user', content: m.content }));

            const { reply } = await $fetch<{ reply: string }>(`${base}/dude/private/${userId.value}/chat`, {
                method: 'POST',
                body: { message: content.trim(), history },
            });

            const botMsg: ChatMessage = {
                id: makeId(),
                channelId: 'private',
                senderId: null,
                senderName: 'DUDE 🤖',
                isBot: true,
                content: reply,
                createdAt: new Date().toISOString(),
            };
            messages.value = [...messages.value, botMsg];
        } catch {
            const errMsg: ChatMessage = {
                id: makeId(),
                channelId: 'private',
                senderId: null,
                senderName: 'DUDE 🤖',
                isBot: true,
                content: 'שגיאה זמנית — נסה שוב בעוד רגע.',
                createdAt: new Date().toISOString(),
            };
            messages.value = [...messages.value, errMsg];
        } finally {
            sending.value = false;
        }
    }

    return {
        messages: readonly(messages),
        sending: readonly(sending),
        sendMessage,
    };
}

```

---

## frontend/composables/useQuizzes.ts
**Type:** frontend

```typescript
/**
 * POC composable — quiz state lives in-memory using DEMO_QUIZ_QUESTIONS.
 * No backend round-trip; learning_gain is computed locally from the paired
 * pre-attempt's score.
 */

import type {
    AttemptQuestion,
    AttemptWithQuestions,
    QuizAttempt,
    QuizPhase,
    QuizSubmitResult,
    StudentRole,
} from '~/types/types';
import { DEMO_QUIZ_QUESTIONS, DEMO_USERS } from '~/services/demoData';

interface InternalAttempt extends QuizAttempt {
    questions: AttemptQuestion[];
}

const attemptsStore = new Map<string, InternalAttempt>();

function attemptKey(userId: string, challengeId: string, phase: QuizPhase) {
    return `${userId}|${challengeId}|${phase}`;
}

function userRole(userId: string): StudentRole {
    const u = DEMO_USERS.find((u) => u.id === userId);
    return (u?.current_role ?? 'dev') as StudentRole;
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function nextId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useQuizzes() {
    async function start(
        challengeId: string,
        userId: string,
        phase: QuizPhase,
    ): Promise<AttemptWithQuestions> {
        const k = attemptKey(userId, challengeId, phase);
        const existing = attemptsStore.get(k);
        if (existing) return { attempt: existing, questions: existing.questions };

        let questions: AttemptQuestion[];
        if (phase === 'pre') {
            // 5 task questions (role-knowledge + mission-specific) + 2 teamwork = 7 total
            const role = userRole(userId);
            const rolePool = DEMO_QUIZ_QUESTIONS.filter(
                (q) => q.scope === 'role' && q.role === role,
            );
            const missionPool = DEMO_QUIZ_QUESTIONS.filter(
                (q) => q.scope === 'mission' && q.missionId === challengeId,
            );
            const teamworkPool = DEMO_QUIZ_QUESTIONS.filter(
                (q) => q.scope === 'teamwork',
            );

            const taskSampled = shuffle([...rolePool, ...missionPool]).slice(0, 5);
            const teamworkSampled = shuffle(teamworkPool).slice(0, 2);
            const sampled = shuffle([...taskSampled, ...teamworkSampled]);

            questions = sampled.map((q, idx) => ({
                id: nextId('aq'),
                questionId: q.id,
                orderIndex: idx,
                prompt: q.prompt,
                options: q.options,
                selectedIndex: null,
                isCorrect: null,
            }));
        } else {
            const pre = attemptsStore.get(attemptKey(userId, challengeId, 'pre'));
            if (!pre) {
                throw new Error('יש להשלים בוחן לפני המשימה לפני הבוחן השני');
            }
            questions = pre.questions.map((q) => ({
                id: nextId('aq'),
                questionId: q.questionId,
                orderIndex: q.orderIndex,
                prompt: q.prompt,
                options: q.options,
                selectedIndex: null,
                isCorrect: null,
            }));
        }

        const attempt: InternalAttempt = {
            id: nextId('att'),
            userId,
            teamId: null,
            challengeId,
            phase,
            startedAt: new Date().toISOString(),
            submittedAt: null,
            score: null,
            total: questions.length,
            pairedAttemptId: phase === 'post'
                ? attemptsStore.get(attemptKey(userId, challengeId, 'pre'))?.id ?? null
                : null,
            learningGain: null,
            questions,
        };
        attemptsStore.set(k, attempt);
        return { attempt, questions };
    }

    async function submit(
        attemptId: string,
        answers: { questionId: string; selectedIndex: number }[],
    ): Promise<QuizSubmitResult> {
        let target: InternalAttempt | undefined;
        for (const a of attemptsStore.values()) {
            if (a.id === attemptId) { target = a; break; }
        }
        if (!target) throw new Error('Attempt not found');

        let score = 0;
        for (const ans of answers) {
            const aq = target.questions.find((q) => q.questionId === ans.questionId);
            if (!aq) continue;
            const orig = DEMO_QUIZ_QUESTIONS.find((q) => q.id === ans.questionId);
            const isCorrect = !!orig && orig.correctIndex === ans.selectedIndex;
            aq.selectedIndex = ans.selectedIndex;
            aq.isCorrect = isCorrect;
            if (isCorrect) score++;
        }

        let learningGain: number | null = null;
        if (target.phase === 'post' && target.pairedAttemptId) {
            const pre = [...attemptsStore.values()].find((a) => a.id === target!.pairedAttemptId);
            if (pre && pre.score !== null) learningGain = score - pre.score;
        }

        target.submittedAt = new Date().toISOString();
        target.score = score;
        target.learningGain = learningGain;

        return { score, total: target.total, learningGain };
    }

    async function getMine(
        challengeId: string,
        userId: string,
        phase: QuizPhase,
    ): Promise<AttemptWithQuestions | null> {
        const a = attemptsStore.get(attemptKey(userId, challengeId, phase));
        return a ? { attempt: a, questions: a.questions } : null;
    }

    async function results(_challengeId: string): Promise<unknown[]> {
        return [...attemptsStore.values()];
    }

    function resetAttempts(challengeId: string, userId: string): void {
        attemptsStore.delete(attemptKey(userId, challengeId, 'pre'));
        attemptsStore.delete(attemptKey(userId, challengeId, 'post'));
    }

    return { start, submit, getMine, results, resetAttempts };
}

```

---

## frontend/composables/useStudentProfile.ts
**Type:** frontend

```typescript
import type { StudentProfile, ProfileSnapshot, TeacherAlert } from '~/types/types';

export function useStudentProfile() {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    const profile = ref<StudentProfile | null>(null);
    const snapshots = ref<ProfileSnapshot[]>([]);
    const allProfiles = ref<StudentProfile[]>([]);
    const alerts = ref<TeacherAlert[]>([]);
    const loading = ref(false);

    async function fetchMyProfile(userId: string): Promise<void> {
        loading.value = true;
        try {
            profile.value = await $fetch<StudentProfile>(`${base}/student-profiles/${userId}`).catch(() => null);
        } finally {
            loading.value = false;
        }
    }

    async function fetchSnapshots(userId: string): Promise<void> {
        try {
            snapshots.value = await $fetch<ProfileSnapshot[]>(`${base}/student-profiles/${userId}/snapshots`);
        } catch {
            snapshots.value = [];
        }
    }

    async function fetchAllProfiles(): Promise<void> {
        loading.value = true;
        try {
            allProfiles.value = await $fetch<StudentProfile[]>(`${base}/student-profiles`);
        } finally {
            loading.value = false;
        }
    }

    async function fetchAlerts(): Promise<void> {
        try {
            alerts.value = await $fetch<TeacherAlert[]>(`${base}/student-profiles/alerts`);
        } catch {
            alerts.value = [];
        }
    }

    async function markAlertRead(alertId: string): Promise<void> {
        await $fetch(`${base}/student-profiles/alerts/${alertId}/read`, { method: 'PATCH' }).catch(() => null);
        alerts.value = alerts.value.filter((a) => a.id !== alertId);
    }

    async function markAllAlertsRead(): Promise<void> {
        await $fetch(`${base}/student-profiles/alerts/read-all`, { method: 'PATCH' }).catch(() => null);
        alerts.value = [];
    }

    async function triggerAnalysis(channelId: string): Promise<{ analyzed: number; summary: string }> {
        return $fetch(`${base}/dude/channels/${channelId}/analyze`, { method: 'POST' });
    }

    return {
        profile: readonly(profile),
        snapshots: readonly(snapshots),
        allProfiles: readonly(allProfiles),
        alerts: readonly(alerts),
        loading: readonly(loading),
        fetchMyProfile,
        fetchSnapshots,
        fetchAllProfiles,
        fetchAlerts,
        markAlertRead,
        markAllAlertsRead,
        triggerAnalysis,
    };
}

```

---

## frontend/composables/useTasks.ts
**Type:** frontend

```typescript
import type { Task, QaChecklist, HintResponse } from '~/types/types';

function mapTask(r: Record<string, unknown>): Task {
    return {
        id:                r.id as string,
        sprintId:          r.sprint_id as string,
        teamId:            r.team_id as string,
        assignedRole:      r.assigned_role as Task['assignedRole'],
        title:             r.title as string,
        description:       (r.description ?? null) as string | null,
        status:            r.status as Task['status'],
        submissionUrl:     (r.submission_url ?? null) as string | null,
        submissionImageUrl:(r.submission_image_url ?? null) as string | null,
        mondayItemId:      (r.monday_item_id ?? null) as number | null,
        qaChecklist:       (r.qa_checklist ?? null) as QaChecklist | null,
        qaNotes:           (r.qa_notes ?? null) as string | null,
        pmNotes:           (r.pm_notes ?? null) as string | null,
        submittedBy:       (r.submitted_by ?? null) as string | null,
        reviewedByQa:      (r.reviewed_by_qa ?? null) as string | null,
        reviewedByPm:      (r.reviewed_by_pm ?? null) as string | null,
        createdAt:         r.created_at as string,
        updatedAt:         r.updated_at as string,
    };
}

export function useTasks(teamId: Ref<string>, userId: Ref<string>) {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    const tasks = ref<Task[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function fetchTasks() {
        loading.value = true;
        error.value = null;
        try {
            const raw = await $fetch<Record<string, unknown>[]>(`${base}/tasks/team/${teamId.value}`);
            tasks.value = raw.map(mapTask);
        } catch (e) {
            error.value = (e as Error).message;
        } finally {
            loading.value = false;
        }
    }

    async function submitTask(payload: {
        taskId: string;
        submissionUrl: string;
        submissionImageUrl: string;
    }) {
        await $fetch(`${base}/tasks/submit`, {
            method: 'POST',
            body: { ...payload, userId: userId.value },
        });
        await fetchTasks();
    }

    async function qaReview(payload: {
        taskId: string;
        decision: 'approve' | 'reject';
        checklist: QaChecklist;
        notes: string;
    }) {
        await $fetch(`${base}/tasks/qa-review`, {
            method: 'POST',
            body: { ...payload, userId: userId.value },
        });
        await fetchTasks();
    }

    async function pmReview(payload: {
        taskId: string;
        decision: 'approve' | 'reject';
        notes: string;
    }) {
        await $fetch(`${base}/tasks/pm-review`, {
            method: 'POST',
            body: { ...payload, userId: userId.value },
        });
        await fetchTasks();
    }

    async function requestHint(payload: {
        taskId: string;
        taskDescription: string;
    }): Promise<HintResponse> {
        return $fetch<HintResponse>(`${base}/hints`, {
            method: 'POST',
            body: {
                userId: userId.value,
                teamId: teamId.value,
                taskId: payload.taskId,
                taskDescription: payload.taskDescription,
            },
        });
    }

    return {
        tasks: readonly(tasks),
        loading: readonly(loading),
        error: readonly(error),
        fetchTasks,
        submitTask,
        qaReview,
        pmReview,
        requestHint,
    };
}

```

---

## frontend/composables/useTeacher.ts
**Type:** frontend

```typescript
/**
 * POC composable — returns hardcoded demo data instead of hitting the API.
 * Re-introduce $fetch calls when wiring back to the live backend.
 */

import type {
    Challenge,
    Team,
    StudentRole,
    StudentWithRoleHistory,
    TeacherPublishPayload,
    TeacherAssignRolesPayload,
} from '~/types/types';
import {
    DEMO_MISSIONS,
    DEMO_TEAMS,
    DEMO_STUDENTS_BY_TEAM,
} from '~/services/demoData';

export function useTeacher() {
    const challenges = ref<Challenge[]>([...DEMO_MISSIONS]);
    const teams = ref<Team[]>([...DEMO_TEAMS]);
    const students = ref<StudentWithRoleHistory[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function fetchChallenges() {
        challenges.value = [...DEMO_MISSIONS];
    }

    async function fetchTeams() {
        teams.value = [...DEMO_TEAMS];
    }

    async function fetchStudents(teamId: string) {
        loading.value = true;
        await new Promise((r) => setTimeout(r, 120));
        students.value = (DEMO_STUDENTS_BY_TEAM[teamId] ?? []).map((s) => ({ ...s }));
        loading.value = false;
    }

    async function publishChallenge(
        challengeId: string,
        payload: TeacherPublishPayload,
    ) {
        const team = teams.value.find((t) => t.id === payload.teamId);
        if (team) {
            (team as any).currentChallengeId = challengeId;
            (team as any).current_challenge_id = challengeId;
            (team as any).sprintStatus = 'active';
            (team as any).isCompleted = false;
        }
        for (const c of challenges.value) {
            const stillUsed = teams.value.some(
                (t: any) => (t.currentChallengeId ?? t.current_challenge_id) === c.id,
            );
            (c as any).isActive = stillUsed;
        }
        return { ok: true, challengeId, teamId: payload.teamId };
    }

    /** Open a mission for a team — alias of publishChallenge with clearer semantics. */
    async function openMission(challengeId: string, teamId: string) {
        return publishChallenge(challengeId, { teamId });
    }

    /** Close the team's current mission (mark completed). */
    async function closeMission(teamId: string) {
        const team = teams.value.find((t) => t.id === teamId);
        if (!team) return { ok: false };
        (team as any).sprintStatus = 'completed';
        (team as any).isCompleted = true;
        return { ok: true, teamId };
    }

    /** Re-open a previously completed mission for the team. */
    async function reopenMission(teamId: string) {
        const team = teams.value.find((t) => t.id === teamId);
        if (!team) return { ok: false };
        (team as any).sprintStatus = 'active';
        (team as any).isCompleted = false;
        return { ok: true, teamId };
    }

    /** Take a team off any mission (idle). */
    async function clearTeamMission(teamId: string) {
        const team = teams.value.find((t) => t.id === teamId);
        if (!team) return { ok: false };
        (team as any).currentChallengeId = null;
        (team as any).current_challenge_id = null;
        (team as any).sprintStatus = 'idle';
        (team as any).isCompleted = false;
        for (const c of challenges.value) {
            const stillUsed = teams.value.some(
                (t: any) => (t.currentChallengeId ?? t.current_challenge_id) === c.id,
            );
            (c as any).isActive = stillUsed;
        }
        return { ok: true };
    }

    async function assignRoles(
        teamId: string,
        payload: TeacherAssignRolesPayload,
    ) {
        const list = students.value;
        for (const a of payload.assignments) {
            const s = list.find((x) => x.id === a.userId);
            if (s) {
                if (s.currentRole) s.lastRoles = [s.currentRole, ...s.lastRoles].slice(0, 3);
                s.currentRole = a.role;
                (s.roleCount as any)[a.role] = ((s.roleCount as any)[a.role] ?? 0) + 1;
            }
        }
        return { ok: true, assigned: payload.assignments.length };
    }

    async function autoAssignRoles(_teamId: string, _challengeId?: string) {
        const ROLES: StudentRole[] = ['pm', 'qa', 'dev', 'hardware'];
        const list = students.value;
        const used = new Set<StudentRole>();

        for (const s of list) {
            const candidates = ROLES.filter((r) => !used.has(r));
            const preferred = candidates.find((r) => r !== s.lastRoles[0]) ?? candidates[0];
            if (s.currentRole) s.lastRoles = [s.currentRole, ...s.lastRoles].slice(0, 3);
            s.currentRole = preferred;
            s.suggestedRole = preferred;
            used.add(preferred);
        }
        return [...list];
    }

    return {
        challenges,
        teams,
        students,
        loading,
        error,
        fetchChallenges,
        fetchTeams,
        fetchStudents,
        publishChallenge,
        openMission,
        closeMission,
        reopenMission,
        clearTeamMission,
        assignRoles,
        autoAssignRoles,
    };
}

```

---

## frontend/composables/useUser.ts
**Type:** frontend

```typescript
import type { UserRole } from '~/types/types';

export interface UserSession {
    id: string;
    name: string;
    email: string;
    currentTeamId: string | null;
    currentRole: UserRole | null;
}

const SESSION_KEY = 'tsu_user_session';

export function useUser() {
    const user = useState<UserSession | null>('current_user', () => {
        if (import.meta.client) {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? (JSON.parse(raw) as UserSession) : null;
        }
        return null;
    });

    function login(session: UserSession) {
        user.value = session;
        if (import.meta.client) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
    }

    function logout() {
        user.value = null;
        if (import.meta.client) {
            localStorage.removeItem(SESSION_KEY);
        }
    }

    const isLoggedIn = computed(() => !!user.value);

    return { user: readonly(user), isLoggedIn, login, logout };
}

```

---

## frontend/error.vue
**Type:** frontend

```vue
<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number; message: string } }>();
useHead({ title: `${props.error.statusCode} — TeamSprintUp` });
const handleError = () => clearError({ redirect: '/' });
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 p-6">
        <div class="text-6xl">{{ error.statusCode === 404 ? '🔍' : '⚠️' }}</div>
        <div class="text-center">
            <h1 class="text-3xl font-extrabold text-gray-800 mb-2">
                {{ error.statusCode === 404 ? 'Page not found' : `Error ${error.statusCode}` }}
            </h1>
            <p class="text-gray-400 text-sm max-w-xs">{{ error.message }}</p>
        </div>
        <button
            class="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors"
            @click="handleError"
        >
            ← Back to home
        </button>
    </div>
</template>

```

---

## frontend/middleware/auth.ts
**Type:** frontend

```typescript
const SESSION_KEY = 'tsu_user_session';

export default defineNuxtRouteMiddleware((to) => {
    // Pages that don't require login
    if (to.path === '/' || to.path === '/teacher') return;

    // Server-side: can't read localStorage — skip (client will redirect if needed)
    if (import.meta.server) return;

    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
        return navigateTo('/');
    }
});

```

---

## frontend/nuxt.config.ts
**Type:** frontend

```typescript
export default defineNuxtConfig({
    modules: ['@nuxtjs/tailwindcss'],

    ssr: true,

    // Netlify preset — set NITRO_PRESET=netlify in Netlify env vars
    // (netlify.toml sets this automatically)

    runtimeConfig: {
        public: {
            apiBaseUrl: 'http://localhost:3001/api', // set via NUXT_PUBLIC_API_BASE_URL
            supabaseUrl: '', // set via NUXT_PUBLIC_SUPABASE_URL
            supabaseAnonKey: '', // set via NUXT_PUBLIC_SUPABASE_ANON_KEY
        },
    },


    typescript: {
        strict: true,
    },
});
```

---

## frontend/pages/index.vue
**Type:** frontend

```vue
<script setup lang="ts">
import type { UserRole } from '~/types/types';
import { useUser } from '~/composables/useUser';
import { DEMO_USERS } from '~/services/demoData';

useHead({ title: 'TechSchool — התחברות' });

const TS_LOGO_URL =
    'https://il-lms.techschool.org/wp-content/themes/techschool-IL/assets/img/tech_school_logo.png';

const { login } = useUser();
const router = useRouter();

interface ApiUser {
    id: string;
    name: string;
    email: string;
    current_team_id: string | null;
    current_role: string | null;
    account_type?: string;
}

// POC: hardcoded demo users — no backend dependency.
const users = ref<ApiUser[]>([...DEMO_USERS]);
const loading = ref(false);
const error = ref<string | null>(null);
const selecting = ref<string | null>(null);

type View = 'landing' | 'students' | 'teachers';
const view = ref<View>('landing');

const filteredUsers = computed(() =>
    view.value === 'students'
        ? users.value.filter(u => u.account_type === 'student')
        : view.value === 'teachers'
            ? users.value.filter(u => u.account_type === 'teacher' || u.account_type === 'admin')
            : [],
);

async function selectUser(u: ApiUser) {
    selecting.value = u.id;
    login({
        id: u.id,
        name: u.name,
        email: u.email,
        currentTeamId: u.current_team_id,
        currentRole: u.current_role as UserRole | null,
    });
    // teachers/admins land on the teacher dashboard, students on /student
    if (u.account_type === 'teacher' || u.account_type === 'admin') {
        await router.push('/teacher');
    } else {
        await router.push('/student');
    }
}
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
        <div class="w-full max-w-3xl">
            <!-- Logo -->
            <div class="flex flex-col items-center mb-8">
                <div class="bg-white rounded-2xl px-6 py-4 shadow-md mb-4">
                    <img
                        :src="TS_LOGO_URL"
                        alt="TechSchool"
                        class="h-14 object-contain"
                        referrerpolicy="no-referrer"
                    />
                </div>
                <h1 class="text-2xl font-extrabold text-gray-800 tracking-tight">SprintUp</h1>
                <p class="text-gray-500 mt-1.5 text-sm">
                    <span v-if="view === 'landing'">ברוכים הבאים — בחר/י את סוג הממשק</span>
                    <span v-else-if="view === 'students'">ממשק תלמיד — בחר/י משתמש</span>
                    <span v-else>ממשק מורה — בחר/י משתמש</span>
                </p>
            </div>

            <!-- ── Landing: two big cards ── -->
            <div v-if="view === 'landing'" class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <button
                    class="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-[#3CC2EE]/60 p-10 flex flex-col items-center gap-4 transition-all"
                    @click="view = 'students'"
                >
                    <span class="text-5xl">🎒</span>
                    <span class="text-xl font-bold text-gray-800">תלמיד/ה</span>
                </button>

                <button
                    class="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-rose-300 p-10 flex flex-col items-center gap-4 transition-all"
                    @click="view = 'teachers'"
                >
                    <span class="text-5xl">🎓</span>
                    <span class="text-xl font-bold text-gray-800">מורה</span>
                </button>
            </div>

            <!-- ── User selection grid (students or teachers) ── -->
            <template v-else>
                <!-- Back button -->
                <button
                    class="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                    @click="view = 'landing'; selecting = null"
                >
                    <span>→</span> חזרה
                </button>

                <!-- Loading -->
                <div v-if="loading" class="flex flex-col items-center gap-3 text-gray-400 py-10">
                    <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
                    <p class="text-sm">טוען משתמשים...</p>
                </div>

                <!-- Error -->
                <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-4 text-sm max-w-sm text-center mx-auto">
                    {{ error }}
                </div>

                <!-- Empty -->
                <div v-else-if="!filteredUsers.length" class="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-gray-400 max-w-md mx-auto">
                    אין משתמשים במאגר. הרץ <code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">npm run seed</code>.
                </div>

                <!-- User grid -->
                <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    <button
                        v-for="u in filteredUsers"
                        :key="u.id"
                        :disabled="selecting !== null"
                        class="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-[#3CC2EE]/50 p-5 flex flex-col items-center gap-3 transition-all disabled:opacity-60 text-center"
                        :class="{ 'border-[#3CC2EE] shadow-[#3CC2EE]/20 scale-95': selecting === u.id }"
                        @click="selectUser(u)"
                    >
                        <!-- Avatar -->
                        <div class="w-14 h-14 rounded-full bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center text-white text-xl font-bold shadow-inner select-none">
                            {{ u.name.charAt(0) }}
                        </div>

                        <!-- Name -->
                        <div>
                            <p class="font-semibold text-gray-800 text-sm leading-tight">{{ u.name }}</p>
                            <p class="text-gray-400 text-xs mt-0.5 truncate max-w-[120px]">{{ u.email }}</p>
                        </div>

                        <!-- Account type badge (teachers/admins only) -->
                        <span v-if="u.account_type === 'teacher'" class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            🎓 מורה
                        </span>
                        <span v-else-if="u.account_type === 'admin'" class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-200 text-gray-700">
                            🛡️ אדמין
                        </span>

                        <!-- Spinner on select -->
                        <div v-if="selecting === u.id" class="w-4 h-4 border-2 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
                    </button>
                </div>
            </template>

            <p class="mt-10 text-xs text-gray-300 text-center">
                TechSchool · SprintUp v1.1 · monday.com Foundation
            </p>
        </div>
    </div>
</template>

```

---

## frontend/pages/student.vue
**Type:** frontend

```vue
<script setup lang="ts">
import type { Task, QaChecklist, StudentRole } from '~/types/types';
import { ROLE_LABELS } from '~/types/types';
import { useUser } from '~/composables/useUser';
import { useLeaderboard } from '~/composables/useLeaderboard';
import { useChat } from '~/composables/useChat';
import { useStudentProfile } from '~/composables/useStudentProfile';
import { usePrivateDude } from '~/composables/usePrivateDude';

useHead({ title: 'TechSchool — לוח תלמיד' });

const { user, logout } = useUser();
const router = useRouter();
const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

// ── Team + sprint data ────────────────────────────────────────────────────────
interface TeamDetail {
    id: string;
    name: string;
    accumulated_score: number;
    sprint_status: string;
    is_completed: boolean;
    current_challenge_id: string | null;
    current_sprint_id: string | null;
    sprints: { id: string; title: string; description: string | null } | null;
}
const team = ref<TeamDetail | null>(null);
const sprintProgress = ref({ total: 0, approved: 0 });

async function fetchTeam() {
    if (!user.value?.currentTeamId) return;
    team.value = await $fetch<TeamDetail>(`${base}/teams/${user.value.currentTeamId}`).catch(() => null);
    if (team.value?.current_sprint_id) {
        const prog = await $fetch<{ total: number; approved: number }>(
            `${base}/teams/${user.value.currentTeamId}/sprint-progress?sprintId=${team.value.current_sprint_id}`,
        ).catch(() => ({ total: 0, approved: 0 }));
        sprintProgress.value = prog;
    }
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
const { tasks, loading: tasksLoading, fetchTasks, submitTask, qaReview, pmReview } = useTasks(
    computed(() => user.value?.currentTeamId ?? ''),
    computed(() => user.value?.id ?? ''),
);

// ── Leaderboard ───────────────────────────────────────────────────────────────
const { rows: leaderboardRows, topIndividuals, fetchLeaderboard } = useLeaderboard();

// ── Auto-refresh every 20 s ───────────────────────────────────────────────────
let refreshTimer: ReturnType<typeof setInterval> | null = null;
const lastRefreshed = ref<Date | null>(null);

async function refreshAll() {
    await Promise.all([fetchTasks(), fetchTeam()]);
    lastRefreshed.value = new Date();
}

// ── Hint panel ref ────────────────────────────────────────────────────────────
const hintPanel = ref<{ requestHint: (taskId?: string) => Promise<void> } | null>(null);

async function onRequestHint(payload: { taskId: string }) {
    await hintPanel.value?.requestHint(payload.taskId);
}

// ── Modal state ───────────────────────────────────────────────────────────────
const activeTaskId = ref<string | null>(null);
const activeModal = ref<'submit' | 'qa' | 'pm' | 'image' | null>(null);

const submitUrl = ref('');
const submitImageUrl = ref('');
const qaChecklist = reactive<QaChecklist>({ isCompleted: false, hasErrors: false, improvements: [] });
const qaImprovementInput = ref('');
const qaNotes = ref('');
const pmNotes = ref('');
const actionLoading = ref(false);
const toast = ref<{ msg: string; type: 'success' | 'error' } | null>(null);

function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toast.value = { msg, type };
    setTimeout(() => { toast.value = null; }, 3500);
}

function openModal(taskId: string, modal: typeof activeModal.value) {
    activeTaskId.value = taskId;
    activeModal.value = modal;
    submitUrl.value = '';
    submitImageUrl.value = '';
    qaChecklist.isCompleted = false;
    qaChecklist.hasErrors = false;
    qaChecklist.improvements = [];
    qaImprovementInput.value = '';
    qaNotes.value = '';
    pmNotes.value = '';
}
function closeModal() { activeTaskId.value = null; activeModal.value = null; }

const activeTask = computed(() => tasks.value.find((t) => t.id === activeTaskId.value) ?? null);

async function handleSubmit() {
    if (!activeTaskId.value) return;
    actionLoading.value = true;
    try {
        await submitTask({ taskId: activeTaskId.value, submissionUrl: submitUrl.value, submissionImageUrl: submitImageUrl.value });
        showToast('Work submitted!');
        closeModal();
        await refreshAll();
    } catch { showToast('Submit failed — try again.', 'error'); }
    finally { actionLoading.value = false; }
}

async function handleQaReview(decision: 'approve' | 'reject') {
    if (!activeTaskId.value) return;
    actionLoading.value = true;
    try {
        await qaReview({
            taskId: activeTaskId.value, decision,
            checklist: { ...qaChecklist, improvements: [...qaChecklist.improvements] },
            notes: qaNotes.value,
        });
        showToast(decision === 'approve' ? 'QA approved ✓' : 'Sent back to dev');
        closeModal();
        await refreshAll();
    } catch { showToast('Review failed — try again.', 'error'); }
    finally { actionLoading.value = false; }
}

async function handlePmReview(decision: 'approve' | 'reject') {
    if (!activeTaskId.value) return;
    actionLoading.value = true;
    try {
        await pmReview({ taskId: activeTaskId.value, decision, notes: pmNotes.value });
        showToast(decision === 'approve' ? 'Sent to teacher ✓' : 'Sent back to QA');
        closeModal();
        await refreshAll();
    } catch { showToast('Review failed — try again.', 'error'); }
    finally { actionLoading.value = false; }
}

function addImprovement() {
    const v = qaImprovementInput.value.trim();
    if (v) { qaChecklist.improvements.push(v); qaImprovementInput.value = ''; }
}

// ── Task card navigation ──────────────────────────────────────────────────────
function navigateToTask(taskId: string, event: MouseEvent, locked: boolean) {
    if (locked) return;
    if ((event.target as HTMLElement).closest('button, a')) return;
    router.push(`/tasks/${taskId}`);
}

// ── Role helpers ──────────────────────────────────────────────────────────────
const role = computed(() => user.value?.currentRole ?? null);
function canSubmit(t: Task) { return (role.value === 'dev' || role.value === 'hardware') && (t.status === 'pending' || t.status === 'rejected'); }
function canQaReview(t: Task) { return role.value === 'qa' && t.status === 'qa_review'; }
function canPmReview(t: Task) { return role.value === 'pm' && t.status === 'pm_review'; }
function canHint(t: Task) { return t.status !== 'approved' && t.status !== 'teacher_review'; }

// ── Status display ────────────────────────────────────────────────────────────
const statusLabels: Record<string, string> = {
    pending: 'Pending', qa_review: 'QA Review', pm_review: 'PM Review',
    teacher_review: 'Teacher Review', approved: 'Approved', rejected: 'Rejected',
};
const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    qa_review: 'bg-yellow-100 text-yellow-800',
    pm_review: 'bg-blue-100 text-blue-800',
    teacher_review: 'bg-purple-100 text-purple-800',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-600',
};
const roleColors: Record<string, string> = {
    pm:       'bg-purple-500',
    qa:       'bg-yellow-500',
    dev:      'bg-blue-500',
    hardware: 'bg-green-500',
};
const roleEmoji: Record<string, string> = {
    pm:       '✂️',
    qa:       '🔍',
    dev:      '📐',
    hardware: '🖨️',
};

function roleDisplay(role: string | null | undefined): string {
    if (!role) return '';
    return ROLE_LABELS[role as StudentRole] ?? role.toUpperCase();
}

// ── Chat (DUDE) ───────────────────────────────────────────────────────────────
const {
    channel,
    messages: chatMessages,
    sending: chatSending,
    initChannel,
    sendMessage,
    startPolling: startChatPolling,
    stopPolling: stopChatPolling,
} = useChat(
    computed(() => user.value?.currentTeamId ?? ''),
    computed(() => user.value?.id ?? ''),
    computed(() => user.value?.name ?? 'תלמיד'),
    computed(() => team.value?.name ?? ''),
);

// ── Student profile ───────────────────────────────────────────────────────────
const { profile: myProfile, snapshots: mySnapshots, fetchMyProfile, fetchSnapshots } = useStudentProfile();

// ── Private DUDE mentor chat ──────────────────────────────────────────────────
const {
    messages: dudeMessages,
    sending: dudeSending,
    sendMessage: dudeSendMessage,
} = usePrivateDude(
    computed(() => user.value?.id ?? ''),
    computed(() => user.value?.name ?? 'תלמיד'),
);

// ── Tabs ──────────────────────────────────────────────────────────────────────
const activeTab = ref<'tasks' | 'leaderboard' | 'chat' | 'mentor' | 'progress'>('tasks');

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
    if (!user.value) { router.replace('/'); return; }
    await Promise.all([fetchTeam(), fetchTasks(), fetchLeaderboard()]);
    lastRefreshed.value = new Date();
    refreshTimer = setInterval(refreshAll, 20_000);
    // Init chat channel and profile in background
    if (user.value.currentTeamId) {
        initChannel().then(() => startChatPolling(5000));
    }
    if (user.value.id) {
        fetchMyProfile(user.value.id);
        fetchSnapshots(user.value.id);
    }
});

onUnmounted(() => {
    if (refreshTimer) clearInterval(refreshTimer);
    stopChatPolling();
});

async function handleLogout() { logout(); await router.replace('/'); }

// ── Relative time helper ──────────────────────────────────────────────────────
const refreshLabel = computed(() => {
    if (!lastRefreshed.value) return '';
    const sec = Math.floor((Date.now() - lastRefreshed.value.getTime()) / 1000);
    return sec < 5 ? 'just now' : `${sec}s ago`;
});

// Keep label ticking (client-only — setInterval is not allowed in SSR)
const now = ref(Date.now());
let tickTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
    tickTimer = setInterval(() => { now.value = Date.now(); }, 5000);
});
onUnmounted(() => { if (tickTimer) clearInterval(tickTimer); });

</script>

<template>
    <div class="min-h-screen bg-gray-50 flex" dir="rtl">
        <!-- Right cyan TS sidebar (first in DOM = right side in RTL flex) -->
        <TechSchoolSidebar school-label="School Test 01" :on-logout="handleLogout" :hide-mentor-bot="true" />

        <!-- Page content (fills the rest, on the left in RTL flex) -->
        <div class="flex-1 flex flex-col min-w-0">

        <!-- ── Top nav (TS-style) ──────────────────────────────────────── -->
        <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div class="px-6 h-16 flex items-center gap-3">
                <!-- Score chips -->
                <div class="flex items-center gap-2">
                    <span v-if="team" class="text-sm text-gray-700 font-semibold">{{ team.name }}</span>
                    <span v-if="team" class="text-xs font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-100 px-2.5 py-1 rounded-full">
                        ⭐ {{ team.accumulated_score }} נק'
                    </span>
                </div>

                <div class="flex-1" />

                <!-- Auto-refresh indicator -->
                <button
                    class="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    title="לחץ כדי לרענן"
                    @click="refreshAll"
                >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {{ refreshLabel }}
                </button>

                <!-- User identity -->
                <div class="flex items-center gap-2 mr-2">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {{ user?.name?.charAt(0) }}
                    </div>
                    <span class="text-sm text-gray-700 font-medium hidden sm:inline">{{ user?.name }}</span>
                </div>
            </div>
        </header>

        <!-- ── Main ────────────────────────────────────────────────────── -->
        <main class="flex-1 w-full px-6 py-6 flex flex-col gap-5 max-w-6xl mx-auto">

            <div v-if="!user?.currentTeamId" class="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
                ⚠️ אינך משויך/ת לצוות. בקש/י מהמורה להקצות אותך לצוות.
            </div>

            <SprintProgress
                v-if="team?.sprints"
                :sprint-title="team.sprints.title"
                :approved="sprintProgress.approved"
                :total="sprintProgress.total"
                :score="team.accumulated_score"
                :sprint-status="team.sprint_status"
            />

            <!-- Tabs -->
            <div class="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
                <button :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', activeTab === 'tasks' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700']" @click="activeTab = 'tasks'">
                    📋 My Tasks
                </button>
                <button :class="['px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors', activeTab === 'leaderboard' ? 'bg-white shadow-sm text-[#3CC2EE]' : 'text-gray-500 hover:text-gray-700']" @click="activeTab = 'leaderboard'">
                    🏆 לוח דירוג
                </button>
                <button :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', activeTab === 'chat' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700']" @click="activeTab = 'chat'">
                    💬 צ'אט קבוצתי
                </button>
                <button :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', activeTab === 'mentor' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700']" @click="activeTab = 'mentor'">
                    🤖 מנטור פרטי
                </button>
                <button :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', activeTab === 'progress' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700']" @click="activeTab = 'progress'">
                    📈 ההתקדמות שלי
                </button>
            </div>

            <!-- ── Tasks tab ──────────────────────────────────────────── -->
            <div v-if="activeTab === 'tasks'" class="flex flex-col gap-5">
                <div v-if="tasksLoading" class="flex justify-center py-12">
                    <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
                </div>

                <div v-else-if="!tasks.length" class="text-center py-16 text-gray-400 text-sm">
                    עדיין לא הוקצו משימות לצוות שלך.
                </div>

                <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <article
                        v-for="(task, index) in tasks"
                        :key="task.id"
                        class="rounded-2xl border shadow-sm flex flex-col overflow-hidden transition-all"
                        :class="index === 0
                            ? 'bg-white border-[#3CC2EE]/30 hover:shadow-md hover:border-[#3CC2EE]/60 cursor-pointer'
                            : 'bg-gray-50 border-gray-200 opacity-55 cursor-not-allowed'"
                        @click="navigateToTask(task.id, $event, index !== 0)"
                    >
                        <!-- Challenge header strip -->
                        <div
                            class="flex items-center justify-between px-4 py-2.5"
                            :class="index === 0
                                ? 'bg-gradient-to-r from-[#3CC2EE] to-cyan-500 text-white'
                                : 'bg-gray-200 text-gray-500'"
                        >
                            <span class="text-sm font-extrabold tracking-wide">
                                אתגר מספר {{ index + 1 }}
                            </span>
                            <span v-if="index > 0" class="text-xs font-semibold flex items-center gap-1 opacity-80">
                                🔒 נעול
                            </span>
                            <span v-else class="text-xs font-semibold opacity-80">פעיל ▸</span>
                        </div>

                        <!-- Card body -->
                        <div class="flex flex-col p-4 gap-3">

                        <!-- Header -->
                        <div class="flex items-start justify-between gap-2">
                            <h3 class="font-semibold text-sm leading-snug flex-1" :class="index === 0 ? 'text-gray-800' : 'text-gray-400'">{{ task.title }}</h3>
                            <span :class="['text-xs font-medium px-2 py-0.5 rounded-full shrink-0', index === 0 ? statusColors[task.status] : 'bg-gray-100 text-gray-400']">
                                <EnglishTerm :term="statusLabels[task.status]" />
                            </span>
                        </div>

                        <p v-if="task.description" class="text-xs text-gray-500 leading-relaxed">{{ task.description }}</p>

                        <!-- Submission image preview -->
                        <button
                            v-if="task.submissionImageUrl"
                            class="rounded-lg overflow-hidden border border-gray-200 hover:border-[#3CC2EE]/40 transition-colors"
                            @click="openModal(task.id, 'image')"
                        >
                            <img :src="task.submissionImageUrl" :alt="`${task.title} submission`" class="w-full h-28 object-cover" />
                        </button>
                        <a v-else-if="task.submissionUrl" :href="task.submissionUrl" target="_blank" class="text-xs text-[#3CC2EE] hover:underline truncate">
                            🔗 צפייה בהגשה
                        </a>

                        <!-- QA notes for PM -->
                        <div v-if="task.qaNotes && role === 'pm' && task.status === 'pm_review'" class="bg-yellow-50 rounded-lg px-3 py-2 text-xs text-yellow-800">
                            💬 QA: {{ task.qaNotes }}
                        </div>

                        <div class="text-xs text-gray-400">
                            תפקיד: <EnglishTerm :term="ROLE_LABELS[task.assignedRole as StudentRole] ?? task.assignedRole" />
                        </div>

                        <!-- Actions -->
                        <div class="mt-auto flex flex-wrap gap-2">
                            <button v-if="canSubmit(task)" class="btn btn-primary" @click="openModal(task.id, 'submit')">
                                <EnglishTerm term="Submit" /> עבודה
                            </button>
                            <button v-if="canQaReview(task)" class="btn btn-yellow" @click="openModal(task.id, 'qa')">
                                QA <EnglishTerm term="Review" />
                            </button>
                            <button v-if="canPmReview(task)" class="btn btn-blue" @click="openModal(task.id, 'pm')">
                                <EnglishTerm term="Editor" /> <EnglishTerm term="Review" />
                            </button>
                            <button v-if="canHint(task)" class="btn btn-ghost mr-auto" @click="onRequestHint({ taskId: task.id })">
                                💡 רמז
                            </button>
                        </div>

                        </div><!-- end card body -->
                    </article>
                </div>

                <HintPanel v-if="user" ref="hintPanel" :user-id="user.id" :team-id="user.currentTeamId ?? ''" />
            </div>

            <!-- ── Chat (DUDE) tab ───────────────────────────────────── -->
            <div v-if="activeTab === 'chat'" class="flex flex-col" style="height: 580px">
                <div v-if="!channel" class="text-center py-12 text-gray-400 text-sm">
                    <div class="w-6 h-6 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
                    מתחבר לצ'אט הצוות...
                </div>
                <ChatChannel
                    v-else
                    class="h-full"
                    :channel-name="channel.name"
                    :messages="chatMessages"
                    :sending="chatSending"
                    :current-user-id="user?.id ?? ''"
                    @send="sendMessage"
                />
            </div>

            <!-- ── Mentor (private DUDE) tab ─────────────────────────── -->
            <div v-if="activeTab === 'mentor'" class="flex flex-col" style="height: 580px">
                <ChatChannel
                    class="h-full"
                    channel-name="DUDE — מנטור אישי 🤖"
                    :messages="dudeMessages"
                    :sending="dudeSending"
                    :current-user-id="user?.id ?? ''"
                    @send="dudeSendMessage"
                />
            </div>

            <!-- ── Progress tab ───────────────────────────────────────── -->
            <div v-if="activeTab === 'progress'" class="flex flex-col gap-5">
                <div v-if="!myProfile" class="text-center py-12 text-gray-400 text-sm">
                    אין עדיין פרופיל לימודי. שלח הודעות בצ'אט כדי לאסוף נתונים.
                </div>
                <StudentProfileCard
                    v-else
                    :profile="myProfile"
                    :snapshots="mySnapshots"
                    :user-name="user?.name"
                />
            </div>

            <!-- ── Leaderboard tab ────────────────────────────────────── -->
            <div v-if="activeTab === 'leaderboard'" class="grid gap-5 lg:grid-cols-2">
                <Leaderboard :rows="leaderboardRows" :highlight-team-id="user?.currentTeamId ?? undefined" />

                <!-- Individual top 3 -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
                    <div class="flex items-center gap-2">
                        <span class="text-lg">⚡</span>
                        <h3 class="font-bold text-gray-800 text-sm">תלמידים מובילים</h3>
                        <span class="text-xs text-gray-400">(טופ 3)</span>
                    </div>

                    <div v-if="!topIndividuals.length" class="text-xs text-gray-400 text-center py-4">
                        אין נתונים עדיין.
                    </div>

                    <div v-else class="flex flex-col gap-3">
                        <div
                            v-for="p in topIndividuals.slice(0, 3)"
                            :key="p.id"
                            class="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                            :class="{ 'bg-cyan-50 border border-cyan-200': p.id === user?.id }"
                        >
                            <span class="text-xl w-8 text-center">{{ ['🥇','🥈','🥉'][p.rank - 1] ?? `#${p.rank}` }}</span>
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-sm text-gray-800 truncate">
                                    {{ p.name }}
                                    <span v-if="p.id === user?.id" class="text-[#3CC2EE] text-xs mr-1">(אתה)</span>
                                </p>
                                <p class="text-xs text-gray-400">{{ p.approvedTasks }} משימות אושרו</p>
                            </div>
                            <span v-if="p.currentRole" class="text-xs text-gray-500 font-medium">{{ roleDisplay(p.currentRole) }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        </div>

        <!-- ── Toast ──────────────────────────────────────────────────── -->
        <Teleport to="body">
            <Transition name="toast">
                <div
                    v-if="toast"
                    :class="['fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-none', toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white']"
                >
                    {{ toast.msg }}
                </div>
            </Transition>
        </Teleport>

        <!-- ── Modal ──────────────────────────────────────────────────── -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div
                    v-if="activeModal && (activeTask || activeModal === 'image')"
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    @click.self="closeModal"
                >
                    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">

                        <!-- Image preview modal -->
                        <template v-if="activeModal === 'image' && activeTask">
                            <div class="flex items-center justify-between">
                                <h2 class="font-bold text-gray-800">תצוגת הגשה</h2>
                                <button class="text-gray-400 hover:text-gray-700" @click="closeModal">✕</button>
                            </div>
                            <img :src="activeTask.submissionImageUrl ?? ''" :alt="activeTask.title" class="rounded-xl w-full object-contain max-h-80" />
                            <a :href="activeTask.submissionUrl ?? '#'" target="_blank" class="text-xs text-[#3CC2EE] hover:underline text-center">
                                פתח קישור הגשה ↗
                            </a>
                        </template>

                        <!-- Submit modal -->
                        <template v-else-if="activeModal === 'submit' && activeTask">
                            <h2 class="text-lg font-bold">
                                הגשת עבודה
                                <span class="text-sm font-normal text-gray-500 mr-2">{{ activeTask.title }}</span>
                            </h2>
                            <label class="field">
                                <span>קישור הגשה</span>
                                <input v-model="submitUrl" type="url" placeholder="https://..." class="input" />
                            </label>
                            <label class="field">
                                <span>קישור תמונה <span class="text-gray-400">(אופציונלי)</span></span>
                                <input v-model="submitImageUrl" type="url" placeholder="https://..." class="input" />
                            </label>
                            <div v-if="submitImageUrl" class="rounded-xl overflow-hidden border border-gray-200">
                                <img :src="submitImageUrl" alt="תצוגה" class="w-full h-32 object-cover" />
                            </div>
                            <div class="flex gap-2 justify-end">
                                <button class="btn btn-ghost" :disabled="actionLoading" @click="closeModal">ביטול</button>
                                <button class="btn btn-primary" :disabled="actionLoading || !submitUrl" @click="handleSubmit">
                                    <span v-if="actionLoading" class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    <span v-else>הגש</span>
                                </button>
                            </div>
                        </template>

                        <!-- QA Review modal -->
                        <template v-else-if="activeModal === 'qa' && activeTask">
                            <h2 class="text-lg font-bold">סקירת QA <span class="text-sm font-normal text-gray-500 mr-2">{{ activeTask.title }}</span></h2>
                            <div v-if="activeTask.submissionUrl" class="bg-cyan-50 rounded-lg px-3 py-2 text-xs text-cyan-700">
                                🔗 <a :href="activeTask.submissionUrl" target="_blank" class="underline">צפייה בהגשה</a>
                            </div>
                            <div v-if="activeTask.submissionImageUrl" class="rounded-xl overflow-hidden border border-gray-200">
                                <img :src="activeTask.submissionImageUrl" alt="Submission" class="w-full h-32 object-cover" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="flex items-center gap-2 text-sm">
                                    <input v-model="qaChecklist.isCompleted" type="checkbox" class="accent-[#3CC2EE]" />
                                    דרישות המשימה הושלמו?
                                </label>
                                <label class="flex items-center gap-2 text-sm">
                                    <input v-model="qaChecklist.hasErrors" type="checkbox" class="accent-red-500" />
                                    נמצאו שגיאות?
                                </label>
                            </div>
                            <div class="field">
                                <span class="label">שיפורים</span>
                                <div class="flex gap-2">
                                    <input v-model="qaImprovementInput" class="input flex-1" placeholder="הוסף שיפור..." @keyup.enter="addImprovement" />
                                    <button class="btn btn-ghost" @click="addImprovement">+</button>
                                </div>
                                <ul v-if="qaChecklist.improvements.length" class="mt-1 space-y-1">
                                    <li v-for="(imp, i) in qaChecklist.improvements" :key="i" class="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                                        {{ imp }}
                                        <button class="text-red-400 hover:text-red-600 mr-2" @click="qaChecklist.improvements.splice(i, 1)">✕</button>
                                    </li>
                                </ul>
                            </div>
                            <label class="field">
                                <span>הערות</span>
                                <textarea v-model="qaNotes" class="input" rows="2" placeholder="הערות אופציונליות..." />
                            </label>
                            <div class="flex gap-2 justify-end">
                                <button class="btn btn-ghost" :disabled="actionLoading" @click="closeModal">ביטול</button>
                                <button class="btn btn-red" :disabled="actionLoading" @click="handleQaReview('reject')">דחה</button>
                                <button class="btn btn-green" :disabled="actionLoading" @click="handleQaReview('approve')">
                                    <span v-if="actionLoading" class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    <span v-else>אשר ✓</span>
                                </button>
                            </div>
                        </template>

                        <!-- Editor Review modal -->
                        <template v-else-if="activeModal === 'pm' && activeTask">
                            <h2 class="text-lg font-bold">סקירת Editor <span class="text-sm font-normal text-gray-500 mr-2">{{ activeTask.title }}</span></h2>
                            <div v-if="activeTask.qaChecklist" class="bg-gray-50 rounded-xl p-3 text-xs space-y-1 border border-gray-200">
                                <p class="font-semibold text-gray-600 mb-1">צ'קליסט QA</p>
                                <p>✅ הושלם: <b>{{ activeTask.qaChecklist.isCompleted ? 'כן' : 'לא' }}</b></p>
                                <p>🐛 שגיאות: <b>{{ activeTask.qaChecklist.hasErrors ? 'כן' : 'לא' }}</b></p>
                                <p v-if="activeTask.qaChecklist.improvements.length">📝 {{ activeTask.qaChecklist.improvements.join(' · ') }}</p>
                                <p v-if="activeTask.qaNotes">💬 {{ activeTask.qaNotes }}</p>
                            </div>
                            <label class="field">
                                <span>הערות Editor</span>
                                <textarea v-model="pmNotes" class="input" rows="2" placeholder="הוסף הערות..." />
                            </label>
                            <div class="flex gap-2 justify-end">
                                <button class="btn btn-ghost" :disabled="actionLoading" @click="closeModal">ביטול</button>
                                <button class="btn btn-red" :disabled="actionLoading" @click="handlePmReview('reject')">→ חזור ל-QA</button>
                                <button class="btn btn-green" :disabled="actionLoading" @click="handlePmReview('approve')">
                                    <span v-if="actionLoading" class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    <span v-else>שלח למורה ←</span>
                                </button>
                            </div>
                        </template>

                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.btn { @apply inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed; }
.btn-primary { @apply bg-[#3CC2EE] text-white hover:bg-[#27b3df] focus:ring-cyan-300; }
.btn-yellow  { @apply bg-yellow-400 text-yellow-900 hover:bg-yellow-500 focus:ring-yellow-400; }
.btn-blue    { @apply bg-purple-500 text-white hover:bg-purple-600 focus:ring-purple-400; }
.btn-green   { @apply bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-400; }
.btn-red     { @apply bg-red-500 text-white hover:bg-red-600 focus:ring-red-400; }
.btn-ghost   { @apply bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300; }
.field { @apply flex flex-col gap-1 text-sm text-gray-700; }
.label { @apply text-sm text-gray-700; }
.input { @apply border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300; }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>

```

---

## frontend/pages/tasks/[taskId].vue
**Type:** frontend

```vue
<script setup lang="ts">
import type { StudentRole } from '~/types/types';
import { ROLE_LABELS } from '~/types/types';
import { useUser } from '~/composables/useUser';
import { useQuizzes } from '~/composables/useQuizzes';
import { useChat } from '~/composables/useChat';
import { usePrivateDude } from '~/composables/usePrivateDude';
import type { TeamMember } from '~/components/TechSchoolSidebar.vue';
import { getRoleInfo } from '~/utils/roleInfo';

useHead({ title: 'פרטי משימה — TeamSprintUp' });

const route = useRoute();
const router = useRouter();
const { user } = useUser();
const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

const { tasks, loading, fetchTasks } = useTasks(
    computed(() => user.value?.currentTeamId ?? ''),
    computed(() => user.value?.id ?? ''),
);

interface TeamDetail {
    id: string;
    name: string;
    current_challenge_id: string | null;
    is_completed: boolean;
}
const team = ref<TeamDetail | null>(null);
const teamMembers = ref<TeamMember[]>([]);

// ── Quiz state ────────────────────────────────────────────────────────────────
const { getMine, resetAttempts } = useQuizzes();
const preQuizDone = ref(false);
const postQuizDone = ref(false);
const resetting = ref(false);

onMounted(async () => {
    if (!user.value) { router.replace('/'); return; }
    await fetchTasks();
    if (user.value.currentTeamId) {
        team.value = await $fetch<TeamDetail>(`${base}/teams/${user.value.currentTeamId}`).catch(() => null);
    }
    loadStepProgress();
    // Load team members (filter all users by current team)
    if (user.value.currentTeamId) {
        try {
            const allUsers = await $fetch<{ id: string; name: string; current_team_id: string | null; current_role: string | null }[]>(`${base}/users`);
            teamMembers.value = allUsers
                .filter((u) => u.current_team_id === user.value!.currentTeamId)
                .map((u) => ({ id: u.id, name: u.name, role: u.current_role }));
        } catch { /* silently skip if users endpoint unavailable */ }
    }
    if (team.value?.current_challenge_id && user.value?.id) {
        const [pre, post] = await Promise.all([
            getMine(team.value.current_challenge_id, user.value.id, 'pre'),
            getMine(team.value.current_challenge_id, user.value.id, 'post'),
        ]);
        preQuizDone.value = pre?.attempt.submittedAt != null;
        postQuizDone.value = post?.attempt.submittedAt != null;
    }
});

const task = computed(() => tasks.value.find((t) => t.id === route.params.taskId) ?? null);

const statusLabels: Record<string, string> = {
    pending: 'Pending',
    qa_review: 'QA Review',
    pm_review: 'PM Review',
    teacher_review: 'Teacher Review',
    approved: 'Approved',
    rejected: 'Rejected',
};

const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    qa_review: 'bg-yellow-100 text-yellow-800',
    pm_review: 'bg-blue-100 text-blue-800',
    teacher_review: 'bg-purple-100 text-purple-800',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-600',
};

const roleChipColors: Record<string, string> = {
    pm:       'bg-violet-100 text-violet-700 ring-violet-200',
    qa:       'bg-amber-100  text-amber-700  ring-amber-200',
    dev:      'bg-blue-100   text-blue-700   ring-blue-200',
    hardware: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

// ── Role info popup ───────────────────────────────────────────────────────────
const roleInfoOpen = ref(false);

function openRoleInfo() {
    roleInfoOpen.value = true;
}

// ── Quiz modal ────────────────────────────────────────────────────────────────
const quizModal = ref<{ open: boolean; phase: 'pre' | 'post' }>({ open: false, phase: 'pre' });
function openQuiz(phase: 'pre' | 'post') {
    quizModal.value = { open: true, phase };
}

const toast = ref<{ msg: string; type: 'success' | 'error' } | null>(null);
function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toast.value = { msg, type };
    setTimeout(() => { toast.value = null; }, 3500);
}
function onQuizSubmitted(r: { score: number; total: number; learningGain: number | null }) {
    const wasPreQuiz = quizModal.value.phase === 'pre';
    if (wasPreQuiz) preQuizDone.value = true;
    else postQuizDone.value = true;
    quizModal.value.open = false;
    if (wasPreQuiz) roleInfoOpen.value = true;
    if (wasPreQuiz) {
        showToast('הבוחן הושלם בהצלחה', 'success');
    } else {
        showToast(
            r.learningGain !== null
                ? `Quiz done — score ${r.score}/${r.total} (gain ${r.learningGain >= 0 ? '+' : ''}${r.learningGain})`
                : `Quiz done — score ${r.score}/${r.total}`,
            'success',
        );
    }
}

// ── Reset task ────────────────────────────────────────────────────────────────
async function resetTask() {
    if (!confirm('האם לאפס את המשימה? כל ההתקדמות בבוחנים ובשלבי המשימה תימחק.')) return;
    resetting.value = true;
    try {
        // Clear checklist from localStorage
        try { localStorage.removeItem(storageKey()); } catch { /* ignore */ }
        // Clear in-memory quiz attempts
        if (team.value?.current_challenge_id && user.value?.id) {
            resetAttempts(team.value.current_challenge_id, user.value.id);
        }
        // Reset all local state
        completed.value = new Set();
        preQuizDone.value = false;
        postQuizDone.value = false;
        showToast('המשימה אופסה בהצלחה.', 'success');
    } catch {
        showToast('האיפוס נכשל — נסה שוב.', 'error');
    } finally {
        resetting.value = false;
    }
}

// ── Step checklist ────────────────────────────────────────────────────────────
interface Step { id: number; title: string; explanation: string; }

const DEFAULT_STEPS: Step[] = [
    { id: 1, title: 'הבנת המשימה',           explanation: 'קרא את תיאור המשימה וודא שאתה מבין מה המוצר הסופי הצפוי.' },
    { id: 2, title: 'תכנון האובייקט',         explanation: 'החלט איזה אובייקט תרצה לעצב ואילו חלקים הוא צריך לכלול.' },
    { id: 3, title: 'יצירת המודל התלת-ממדי', explanation: 'בנה את הצורה הבסיסית בתוכנת Fusion 360 / CAD.' },
    { id: 4, title: 'בדיקת מידות וסבילויות', explanation: 'ודא שהגודל, העובי, והחיבורים מתאימים להדפסה תלת-ממדית.' },
    { id: 5, title: 'ייצוא והכנה להדפסה',    explanation: 'ייצא קובץ STL והכן אותו ב-Slicer.' },
    { id: 6, title: 'בדיקה ושיפור',           explanation: 'בחן את התוצאה, תקן בעיות ושפר את העיצוב.' },
];

const completed = ref<Set<number>>(new Set());

function storageKey(): string {
    return `task-steps:${user.value?.id ?? 'anon'}:${route.params.taskId as string}`;
}

function loadStepProgress() {
    if (typeof localStorage === 'undefined') return;
    try {
        const raw = localStorage.getItem(storageKey());
        if (raw) completed.value = new Set(JSON.parse(raw) as number[]);
    } catch { /* ignore */ }
}

function toggleStep(id: number) {
    if (!preQuizDone.value) return;
    if (completed.value.has(id)) completed.value.delete(id);
    else completed.value.add(id);
    completed.value = new Set(completed.value);
    try { localStorage.setItem(storageKey(), JSON.stringify([...completed.value])); } catch { /* ignore */ }
}

const completedCount = computed(() => completed.value.size);
const totalSteps = DEFAULT_STEPS.length;
const allStepsDone = computed(() => completedCount.value === totalSteps);
const nextStepId = computed(() => DEFAULT_STEPS.find((s) => !completed.value.has(s.id))?.id ?? null);

// ── Chat panels ───────────────────────────────────────────────────────────────
const chatTab = ref<'group' | 'private'>('group');

const {
    channel,
    messages: groupMessages,
    sending: groupSending,
    initChannel,
    sendMessage: groupSend,
    startPolling: startChatPolling,
    stopPolling: stopChatPolling,
} = useChat(
    computed(() => user.value?.currentTeamId ?? ''),
    computed(() => user.value?.id ?? ''),
    computed(() => user.value?.name ?? 'תלמיד'),
    computed(() => team.value?.name ?? ''),
);

const {
    messages: privateMessages,
    sending: privateSending,
    sendMessage: privateSend,
} = usePrivateDude(
    computed(() => user.value?.id ?? ''),
    computed(() => user.value?.name ?? 'תלמיד'),
);

onMounted(async () => {
    if (user.value?.currentTeamId) {
        await initChannel();
        startChatPolling(5000);
    }
});
onUnmounted(() => stopChatPolling());

// ── Scroll-to-chat ────────────────────────────────────────────────────────────
const chatSection = ref<HTMLElement | null>(null);
function scrollToChat() {
    chatSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex" dir="rtl">
        <TechSchoolSidebar school-label="School Test 01" :team-members="teamMembers" :hide-mentor-bot="true" />

        <div class="flex-1 flex flex-col min-w-0">
        <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div class="px-6 h-14 flex items-center gap-3">
                <button
                    class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                    @click="router.back()"
                >
                    ← חזור
                </button>
                <span class="text-gray-300">|</span>
                <span class="text-sm font-semibold text-gray-700 truncate flex-1">{{ task?.title ?? 'פרטי משימה' }}</span>
                <button
                    v-if="task"
                    class="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-40"
                    :disabled="resetting"
                    @click="resetTask"
                >
                    <span>↺</span>
                    <span>איפוס משימה</span>
                </button>
            </div>
        </header>

        <main class="flex-1 w-full max-w-2xl mx-auto px-6 py-8">
            <div v-if="loading" class="flex justify-center py-16">
                <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
            </div>

            <div v-else-if="!task" class="text-center py-16 text-gray-400 text-sm">
                המשימה לא נמצאה.
            </div>

            <div v-else class="flex flex-col gap-4">

                <!-- ① Main task card ─────────────────────────────────────── -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
                    <div class="flex items-start justify-between gap-3">
                        <h1 class="text-xl font-bold text-gray-800 leading-snug">{{ task.title }}</h1>
                        <span :class="['text-xs font-medium px-2.5 py-1 rounded-full shrink-0', statusColors[task.status]]">
                            {{ statusLabels[task.status] }}
                        </span>
                    </div>

                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs text-gray-400 font-medium">תפקיד למשימה זו:</span>
                        <span :class="['text-xs font-bold px-3 py-1 rounded-full ring-1', roleChipColors[task.assignedRole] ?? 'bg-gray-100 text-gray-600 ring-gray-200']">
                            {{ ROLE_LABELS[task.assignedRole as StudentRole] ?? task.assignedRole }}
                        </span>
                        <!-- Info icon — opens role explanation popup -->
                        <button
                            class="w-5 h-5 rounded-full bg-[#3CC2EE]/15 hover:bg-[#3CC2EE]/30 text-[#3CC2EE] flex items-center justify-center transition-colors shrink-0"
                            title="הסבר על התפקיד"
                            @click="openRoleInfo"
                        >
                            <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none">
                                <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
                                <path d="M8 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                <circle cx="8" cy="5" r="0.75" fill="currentColor"/>
                            </svg>
                        </button>
                    </div>

                    <div v-if="task.description" class="border-t border-gray-100 pt-4">
                        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">הסבר המשימה</h2>
                        <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{{ task.description }}</p>
                    </div>
                    <p v-else class="text-sm text-gray-400 italic">אין הסבר למשימה זו.</p>

                    <a v-if="task.submissionUrl" :href="task.submissionUrl" target="_blank" class="text-sm text-[#3CC2EE] hover:underline">
                        🔗 צפייה בהגשה
                    </a>
                    <div v-if="task.submissionImageUrl" class="rounded-xl overflow-hidden border border-gray-200">
                        <img :src="task.submissionImageUrl" :alt="task.title" class="w-full object-cover max-h-64" />
                    </div>
                </div>

                <!-- ② Before-task quiz ───────────────────────────────────── -->
                <div v-if="team?.current_challenge_id && user?.id" class="bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3"
                    :class="preQuizDone ? 'border-emerald-200' : 'border-[#3CC2EE]/40'"
                >
                    <div class="flex items-center gap-2">
                        <span class="text-base">📝</span>
                        <h2 class="font-bold text-gray-800 text-sm">בוחן לפני המשימה</h2>
                        <span v-if="preQuizDone" class="mr-auto text-xs font-bold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full">
                            הושלם ✓
                        </span>
                    </div>

                    <!-- Completed state -->
                    <div v-if="preQuizDone" class="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
                        <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        בוחן לפני המשימה הושלם — ניתן להתחיל את שלבי המשימה.
                    </div>

                    <!-- Available state -->
                    <template v-else>
                        <p class="text-xs text-gray-500">יש לבצע את הבוחן לפני שמתחילים את המשימה.</p>
                        <button
                            class="self-start px-5 py-2 bg-[#3CC2EE] hover:bg-[#27b3df] text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                            @click="openQuiz('pre')"
                        >
                            התחל בוחן לפני המשימה ▸
                        </button>
                    </template>
                </div>

                <!-- ③ Step checklist ─────────────────────────────────────── -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
                    <div class="flex items-center justify-between gap-2">
                        <h2 class="font-bold text-gray-800 text-sm">שלבי המשימה</h2>
                        <span class="text-xs font-semibold px-2.5 py-1 rounded-full"
                            :class="allStepsDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'"
                        >
                            הושלמו {{ completedCount }} מתוך {{ totalSteps }} שלבים
                        </span>
                    </div>

                    <!-- Lock banner -->
                    <div v-if="!preQuizDone" class="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <span class="text-base shrink-0">🔒</span>
                        יש לבצע את הבוחן לפני המשימה כדי לפתוח את שלבי המשימה.
                    </div>

                    <!-- Progress bar -->
                    <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            class="h-full bg-emerald-400 rounded-full transition-all duration-500"
                            :style="{ width: `${(completedCount / totalSteps) * 100}%` }"
                        />
                    </div>

                    <!-- Steps -->
                    <ol class="flex flex-col gap-2">
                        <li
                            v-for="step in DEFAULT_STEPS"
                            :key="step.id"
                            class="flex gap-3 rounded-xl px-4 py-3.5 select-none transition-all duration-200 border"
                            :class="[
                                !preQuizDone
                                    ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                                    : completed.has(step.id)
                                        ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                                        : step.id === nextStepId
                                            ? 'bg-[#3CC2EE]/5 border-[#3CC2EE]/30 hover:bg-[#3CC2EE]/10 cursor-pointer'
                                            : 'bg-gray-50 border-gray-100 hover:bg-gray-100 cursor-pointer'
                            ]"
                            :aria-disabled="!preQuizDone"
                            @click="toggleStep(step.id)"
                        >
                            <div
                                class="mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                                :class="completed.has(step.id)
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : step.id === nextStepId && preQuizDone
                                        ? 'border-[#3CC2EE] text-[#3CC2EE]'
                                        : 'border-gray-300 text-transparent'"
                            >
                                <svg class="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>

                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-xs font-bold text-gray-400">{{ step.id }}.</span>
                                    <span class="text-sm font-semibold"
                                        :class="completed.has(step.id) ? 'text-emerald-600 line-through decoration-emerald-400/60' : 'text-gray-800'"
                                    >{{ step.title }}</span>
                                    <span v-if="step.id === nextStepId && preQuizDone"
                                        class="text-xs font-bold text-[#3CC2EE] px-2 py-0.5 rounded-full bg-[#3CC2EE]/10"
                                    >הצעד הבא ▸</span>
                                    <span v-if="completed.has(step.id)"
                                        class="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full"
                                    >בוצע ✓</span>
                                </div>
                                <p class="text-xs mt-0.5 leading-relaxed"
                                    :class="completed.has(step.id) ? 'text-emerald-500/70' : 'text-gray-500'"
                                >{{ step.explanation }}</p>
                            </div>
                        </li>
                    </ol>
                </div>

                <!-- ④ After-task quiz ─────────────────────────────────────── -->
                <div v-if="team?.current_challenge_id && user?.id" class="bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3"
                    :class="postQuizDone ? 'border-emerald-200' : 'border-gray-200'"
                >
                    <div class="flex items-center gap-2">
                        <span class="text-base">🎯</span>
                        <h2 class="font-bold text-gray-800 text-sm">בוחן אחרי המשימה</h2>
                        <span v-if="postQuizDone" class="mr-auto text-xs font-bold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full">
                            הושלם ✓
                        </span>
                    </div>

                    <!-- Completed state -->
                    <div v-if="postQuizDone" class="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
                        <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        בוחן אחרי המשימה הושלם.
                    </div>

                    <!-- Locked: steps not done yet -->
                    <template v-else-if="!allStepsDone">
                        <div class="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                            <span class="text-base shrink-0">🔒</span>
                            יש להשלים את כל שלבי המשימה לפני ביצוע הבוחן אחרי המשימה.
                        </div>
                        <button disabled class="self-start px-5 py-2 bg-gray-200 text-gray-400 rounded-full text-sm font-bold cursor-not-allowed opacity-60">
                            בוחן אחרי המשימה
                        </button>
                    </template>

                    <!-- Available state -->
                    <template v-else>
                        <p class="text-xs text-gray-500">כל השלבים הושלמו — ניתן לבצע את הבוחן.</p>
                        <button
                            class="self-start px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                            @click="openQuiz('post')"
                        >
                            התחל בוחן אחרי המשימה ▸
                        </button>
                    </template>
                </div>

                <!-- ⑤ Chat panels ──────────────────────────────────────── -->
                <div ref="chatSection" class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style="height: 480px">
                    <!-- Tab switcher -->
                    <div class="flex border-b border-gray-100">
                        <button
                            :class="['flex-1 py-2.5 text-xs font-semibold transition-colors', chatTab === 'group' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700']"
                            @click="chatTab = 'group'"
                        >
                            💬 צ'אט צוותי
                        </button>
                        <button
                            :class="['flex-1 py-2.5 text-xs font-semibold transition-colors', chatTab === 'private' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700']"
                            @click="chatTab = 'private'"
                        >
                            🤖 מנטור פרטי
                        </button>
                    </div>

                    <!-- Group chat -->
                    <div v-if="chatTab === 'group'" class="flex-1 min-h-0">
                        <div v-if="!channel" class="flex items-center justify-center h-full text-sm text-gray-400">
                            <div class="w-5 h-5 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mr-2" />
                            מתחבר לצ'אט...
                        </div>
                        <ChatChannel
                            v-else
                            class="h-full"
                            :channel-name="channel.name"
                            :messages="groupMessages"
                            :sending="groupSending"
                            :current-user-id="user?.id ?? ''"
                            @send="groupSend"
                        />
                    </div>

                    <!-- Private DUDE chat -->
                    <div v-else class="flex-1 min-h-0">
                        <ChatChannel
                            class="h-full"
                            channel-name="DUDE — מנטור אישי 🤖"
                            :messages="privateMessages"
                            :sending="privateSending"
                            :current-user-id="user?.id ?? ''"
                            @send="privateSend"
                        />
                    </div>
                </div>

            </div>
        </main>

        </div><!-- end flex-1 column -->

        <!-- Role info popup -->
        <RoleInfoPopup
            v-if="roleInfoOpen && task"
            :role-key="task.assignedRole"
            :role-label="ROLE_LABELS[task.assignedRole as StudentRole] ?? task.assignedRole"
            @close="roleInfoOpen = false"
        />

        <!-- Quiz modal -->
        <QuizModal
            v-if="quizModal.open && team?.current_challenge_id && user?.id"
            :challenge-id="team.current_challenge_id"
            :user-id="user.id"
            :phase="quizModal.phase"
            @close="quizModal.open = false"
            @submitted="onQuizSubmitted"
        />

        <!-- Toast -->
        <Teleport to="body">
            <Transition name="toast">
                <div
                    v-if="toast"
                    :class="['fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-none',
                        toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white']"
                >
                    {{ toast.msg }}
                </div>
            </Transition>
        </Teleport>

        <!-- Floating scroll-to-chat button -->
        <Teleport to="body">
            <button
                v-if="task"
                class="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg transition-all"
                title="גלול לצ'אט"
                @click="scrollToChat"
            >
                <span>💬</span>
                <span>צ'אט</span>
                <svg class="w-3.5 h-3.5 rotate-90" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </Teleport>
    </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>

```

---

## frontend/pages/teacher-group/[teamId].vue
**Type:** frontend

```vue
<script setup lang="ts">
import { DEMO_TEAMS, DEMO_STUDENTS_BY_TEAM, DEMO_MISSIONS } from '~/services/demoData';

useHead({ title: 'ניתוח קבוצה — TeamSprintUp' });

const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

const teamId = route.params.teamId as string;

// ── Static demo data ──────────────────────────────────────────────────────────
const team = DEMO_TEAMS.find((t) => t.id === teamId) ?? null;
const challenge = DEMO_MISSIONS.find((c) => c.id === team?.currentChallengeId) ?? null;
const demoStudents = DEMO_STUDENTS_BY_TEAM[teamId] ?? [];

// ── API response shapes ───────────────────────────────────────────────────────
interface ApiTask {
    id: string;
    title: string;
    status: string;
    assigned_role: string;
    created_at: string;
    updated_at: string;
}

interface ApiStudentInsight {
    userId: string;
    teamId: string | null;
    role: string | null;
    totalActiveTimeSeconds: number;
    totalTasks: number;
    approvedTasks: number;
    riskLevel: 'ok' | 'watch' | 'needs_attention';
    insightReason: string;
}

interface ApiNote {
    id: string;
    team_id: string;
    teacher_id: string | null;
    note: string;
    created_at: string;
}

// ── Reactive state ────────────────────────────────────────────────────────────
const tasks = ref<ApiTask[]>([]);
const studentInsights = ref<ApiStudentInsight[]>([]);
const notes = ref<ApiNote[]>([]);
const newNote = ref('');
const savingNote = ref(false);
const loading = ref(true);

onMounted(async () => {
    await Promise.allSettled([
        $fetch<ApiTask[]>(`${base}/tasks/team/${teamId}`)
            .then((data) => { tasks.value = Array.isArray(data) ? data : []; })
            .catch(() => {}),
        $fetch<{ students: ApiStudentInsight[] }>(`${base}/teams/analytics/teacher-dashboard`)
            .then((data) => {
                studentInsights.value = (data?.students ?? []).filter((s) => s.teamId === teamId);
            })
            .catch(() => {}),
        $fetch<ApiNote[]>(`${base}/teams/${teamId}/notes`)
            .then((data) => { notes.value = Array.isArray(data) ? data : []; })
            .catch(() => {}),
    ]);
    loading.value = false;
});

// ── Role / risk helpers ───────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
    pm: 'Editor',
    qa: 'QA',
    dev: 'Designer',
    hardware: 'Printer',
};

const RISK_LABEL: Record<string, string> = {
    ok: 'תקין',
    watch: 'לשים לב',
    needs_attention: 'דורש התערבות',
};

const RISK_CLS: Record<string, string> = {
    ok: 'bg-emerald-100 text-emerald-700',
    watch: 'bg-amber-100 text-amber-700',
    needs_attention: 'bg-red-100 text-red-700',
};

// ── Analytics computations ────────────────────────────────────────────────────

// Earliest task created_at as sprint-start proxy
const sprintStartMs = computed(() => {
    if (!tasks.value.length) return null;
    const ms = tasks.value.map((t) => new Date(t.created_at).getTime()).filter(isFinite);
    return ms.length ? Math.min(...ms) : null;
});

const taskDuration = computed(() => {
    if (!sprintStartMs.value) return null;
    const diff = Date.now() - sprintStartMs.value;
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return h > 0 ? `${h} שעות ו-${m} דקות` : `${m} דקות`;
});

const taskStartDate = computed(() => {
    if (!sprintStartMs.value) return null;
    return new Date(sprintStartMs.value).toLocaleDateString('he-IL', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
});

const totalTasks = computed(() => tasks.value.length);
const approvedTasks = computed(() => tasks.value.filter((t) => t.status === 'approved').length);
const completionPercent = computed(() =>
    totalTasks.value > 0 ? Math.round((approvedTasks.value / totalTasks.value) * 100) : 0,
);

const statusLabel = computed(() => {
    if (!team) return 'אין נתון זמין';
    if (team.isCompleted) return 'הושלם';
    if (team.sprintStatus === 'idle') return 'לא התחיל';
    return 'בתהליך';
});

const taskBlockedAt = computed(() => {
    if (!tasks.value.length) return 'אין פעולה פתוחה כרגע';
    // Check by priority — most urgent first
    const checks: Array<[string, string]> = [
        ['teacher_review', 'ממתין לאישור מורה'],
        ['pm_review', 'ממתין לאישור Editor (PM)'],
        ['qa_review', 'ממתין לבדיקת QA'],
    ];
    for (const [status, label] of checks) {
        if (tasks.value.some((t) => t.status === status)) return label;
    }
    const pending = tasks.value.find((t) => t.status === 'pending');
    if (pending) return `ממתין להגשה מ-${ROLE_LABELS[pending.assigned_role] ?? pending.assigned_role}`;
    if (tasks.value.every((t) => t.status === 'approved')) return 'כל המשימות אושרו ✓';
    return 'אין פעולה פתוחה כרגע';
});

// ── Per-student rows (merge demo list + backend insights) ─────────────────────
const studentRows = computed(() =>
    demoStudents.map((s) => {
        const insight = studentInsights.value.find((i) => i.userId === s.id);
        const sec = insight?.totalActiveTimeSeconds ?? null;
        const activeTime = sec !== null
            ? sec < 60 ? `${sec} שניות` : `${Math.floor(sec / 60)} דקות`
            : 'אין נתון זמין';
        return {
            id: s.id,
            name: s.name,
            role: s.currentRole ? (ROLE_LABELS[s.currentRole] ?? s.currentRole) : '—',
            activeTime,
            approved: insight ? String(insight.approvedTasks) : 'אין נתון',
            riskLevel: insight?.riskLevel ?? null,
            insightReason: insight?.insightReason ?? null,
        };
    }),
);

// ── Notes ─────────────────────────────────────────────────────────────────────
async function saveNote() {
    if (!newNote.value.trim() || savingNote.value) return;
    savingNote.value = true;
    try {
        const saved = await $fetch<ApiNote>(`${base}/teams/${teamId}/notes`, {
            method: 'POST',
            body: { note: newNote.value.trim() },
        });
        notes.value = [saved, ...notes.value];
        newNote.value = '';
    } catch {
        // fail silently in POC mode
    } finally {
        savingNote.value = false;
    }
}

function formatNoteDate(iso: string) {
    return new Date(iso).toLocaleString('he-IL', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}
</script>

<template>
    <div class="min-h-screen bg-gray-100" dir="rtl">

        <!-- Header -->
        <header class="bg-white border-b border-gray-200 px-6 h-14 flex items-center gap-4">
            <button
                class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                @click="router.push('/teacher')"
            >
                <span>→</span>
                <span>חזור</span>
            </button>
            <div class="w-px h-5 bg-gray-200 shrink-0" />
            <span class="font-bold text-gray-900 text-sm">ניתוח קבוצה</span>
            <span v-if="team" class="text-sm text-gray-500 truncate">— {{ team.name }}</span>
        </header>

        <main class="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">

            <!-- Page title -->
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-black text-gray-900">{{ team?.name ?? 'קבוצה לא נמצאה' }}</h1>
                    <p v-if="challenge" class="text-sm text-gray-500 mt-1">📋 {{ challenge.title }}</p>
                    <p v-else class="text-sm text-gray-400 mt-1">אין אתגר פעיל</p>
                </div>
                <span
                    v-if="team"
                    :class="[
                        'text-xs font-bold px-3 py-1.5 rounded-full shrink-0 mt-1',
                        team.isCompleted ? 'bg-emerald-100 text-emerald-700' :
                        team.sprintStatus === 'active' ? 'bg-cyan-100 text-cyan-700' :
                        'bg-gray-100 text-gray-500'
                    ]"
                >
                    {{ team.isCompleted ? '✓ הושלם' : team.sprintStatus === 'active' ? '● פעיל' : 'ממתין' }}
                </span>
            </div>

            <!-- Loading spinner -->
            <div v-if="loading" class="flex justify-center py-10">
                <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
            </div>

            <template v-else>

                <!-- Analytics summary cards -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

                    <!-- Task duration — cyan accent -->
                    <div class="bg-white rounded-2xl border border-cyan-100 shadow-sm p-5 flex flex-col gap-1.5 border-r-4 border-r-cyan-400">
                        <div class="flex items-center gap-1.5 mb-0.5">
                            <span class="text-base">⏱</span>
                            <span class="text-[10px] font-bold text-cyan-600 uppercase tracking-wide">זמן פעילות</span>
                        </div>
                        <span v-if="taskDuration" class="text-base font-black text-gray-900 leading-snug">{{ taskDuration }}</span>
                        <span v-else class="text-sm text-gray-400">אין נתון זמין</span>
                        <span v-if="taskStartDate" class="text-[10px] text-gray-400">מ-{{ taskStartDate }}</span>
                    </div>

                    <!-- Completion — SVG circular progress -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col items-center gap-2">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide self-start">אחוז השלמה</span>
                        <!-- Radial progress: r=15.9155 → circumference ≈ 100 -->
                        <svg viewBox="0 0 36 36" class="w-20 h-20 -rotate-90">
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" stroke-width="3" />
                            <circle
                                cx="18" cy="18" r="15.9155" fill="none"
                                stroke-width="3"
                                stroke-linecap="round"
                                :stroke="completionPercent >= 70 ? '#10b981' : completionPercent >= 40 ? '#f59e0b' : '#ef4444'"
                                :stroke-dasharray="`${completionPercent} ${100 - completionPercent}`"
                            />
                        </svg>
                        <!-- percentage label overlaid via absolute positioning substitute -->
                        <span
                            :class="[
                                'text-2xl font-black -mt-16 mb-8',
                                completionPercent >= 70 ? 'text-emerald-600' : completionPercent >= 40 ? 'text-amber-500' : 'text-red-500'
                            ]"
                        >{{ completionPercent }}%</span>
                        <span class="text-[10px] text-gray-400">{{ approvedTasks }} / {{ totalTasks }} משימות</span>
                    </div>

                    <!-- Status — color by state -->
                    <div
                        :class="[
                            'rounded-2xl border shadow-sm p-5 flex flex-col gap-1.5 border-r-4',
                            team?.isCompleted
                                ? 'bg-emerald-50 border-emerald-100 border-r-emerald-500'
                                : team?.sprintStatus === 'active'
                                    ? 'bg-blue-50 border-blue-100 border-r-blue-500'
                                    : 'bg-gray-50 border-gray-200 border-r-gray-400'
                        ]"
                    >
                        <div class="flex items-center gap-1.5 mb-0.5">
                            <span class="text-base">📊</span>
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">סטטוס</span>
                        </div>
                        <span
                            :class="[
                                'text-base font-black',
                                team?.isCompleted ? 'text-emerald-700' :
                                team?.sprintStatus === 'active' ? 'text-blue-700' : 'text-gray-600'
                            ]"
                        >{{ statusLabel }}</span>
                    </div>

                    <!-- Who has task — amber if stuck, emerald if done -->
                    <div
                        :class="[
                            'rounded-2xl border shadow-sm p-5 flex flex-col gap-1.5 border-r-4',
                            taskBlockedAt.includes('אושרו')
                                ? 'bg-emerald-50 border-emerald-100 border-r-emerald-500'
                                : taskBlockedAt.includes('מורה')
                                    ? 'bg-purple-50 border-purple-100 border-r-purple-500'
                                    : 'bg-amber-50 border-amber-100 border-r-amber-400'
                        ]"
                    >
                        <div class="flex items-center gap-1.5 mb-0.5">
                            <span class="text-base">🎯</span>
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">אצל מי</span>
                        </div>
                        <span
                            :class="[
                                'text-sm font-bold leading-snug',
                                taskBlockedAt.includes('אושרו') ? 'text-emerald-700' :
                                taskBlockedAt.includes('מורה') ? 'text-purple-700' : 'text-amber-700'
                            ]"
                        >{{ taskBlockedAt }}</span>
                    </div>

                </div>

                <!-- Student progress table -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        <span class="text-base">👥</span>
                        <h2 class="font-black text-gray-800 text-sm">התקדמות תלמידים</h2>
                    </div>
                    <div v-if="!studentRows.length" class="px-6 py-8 text-sm text-gray-400 text-center">
                        אין תלמידים בקבוצה זו.
                    </div>
                    <div v-else class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                                <tr>
                                    <th class="text-right px-5 py-3">תלמיד</th>
                                    <th class="text-right px-5 py-3">תפקיד</th>
                                    <th class="text-right px-5 py-3">זמן פעיל</th>
                                    <th class="text-right px-5 py-3">משימות שאושרו</th>
                                    <th class="text-right px-5 py-3">סטטוס</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                <tr
                                    v-for="s in studentRows"
                                    :key="s.id"
                                    class="hover:bg-gray-50 transition-colors"
                                    :class="s.riskLevel === 'needs_attention' ? 'bg-red-50/40' : ''"
                                >
                                    <td class="px-5 py-3">
                                        <span class="font-semibold text-gray-800">{{ s.name }}</span>
                                    </td>
                                    <td class="px-5 py-3">
                                        <span
                                            :class="[
                                                'text-[11px] font-bold px-2 py-0.5 rounded-full',
                                                s.role === 'QA' ? 'bg-amber-100 text-amber-700' :
                                                s.role === 'Editor' ? 'bg-purple-100 text-purple-700' :
                                                s.role === 'Designer' ? 'bg-sky-100 text-sky-700' :
                                                s.role === 'Printer' ? 'bg-orange-100 text-orange-700' :
                                                'bg-gray-100 text-gray-500'
                                            ]"
                                        >{{ s.role }}</span>
                                    </td>
                                    <td class="px-5 py-3 text-gray-600">{{ s.activeTime }}</td>
                                    <td class="px-5 py-3">
                                        <span
                                            :class="[
                                                'font-bold',
                                                s.approved !== 'אין נתון' && Number(s.approved) > 0
                                                    ? 'text-emerald-600' : 'text-gray-400'
                                            ]"
                                        >{{ s.approved }}</span>
                                    </td>
                                    <td class="px-5 py-3">
                                        <span
                                            v-if="s.riskLevel"
                                            :class="['text-[11px] font-bold px-2.5 py-0.5 rounded-full', RISK_CLS[s.riskLevel]]"
                                            :title="s.insightReason ?? ''"
                                        >
                                            {{ RISK_LABEL[s.riskLevel] }}
                                        </span>
                                        <span v-else class="text-gray-300 text-xs">—</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Teacher notes -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-5">
                    <div class="flex items-center gap-2">
                        <span class="text-base">📝</span>
                        <h2 class="font-black text-gray-900 text-sm">הערות מורה</h2>
                    </div>

                    <!-- Add note -->
                    <div class="flex flex-col gap-2">
                        <textarea
                            v-model="newNote"
                            rows="3"
                            placeholder="הוסף הערה לקבוצה..."
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#3CC2EE]/40 focus:border-[#3CC2EE] transition-all"
                        />
                        <button
                            :disabled="!newNote.trim() || savingNote"
                            class="self-end px-5 py-2 bg-[#3CC2EE] hover:bg-[#27b3df] disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                            @click="saveNote"
                        >
                            <span v-if="savingNote">שומר...</span>
                            <span v-else>שמור הערה</span>
                        </button>
                    </div>

                    <!-- Notes list -->
                    <div v-if="!notes.length" class="text-sm text-gray-400 text-center py-4">
                        אין הערות עדיין.
                    </div>
                    <ul v-else class="flex flex-col gap-3">
                        <li
                            v-for="n in notes"
                            :key="n.id"
                            class="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex flex-col gap-1"
                        >
                            <p class="text-sm text-gray-800 whitespace-pre-wrap leading-snug">{{ n.note }}</p>
                            <span class="text-xs text-gray-400">{{ formatNoteDate(n.created_at) }}</span>
                        </li>
                    </ul>
                </div>

            </template>
        </main>
    </div>
</template>

```

---

## frontend/pages/teacher-student/[studentId].vue
**Type:** frontend

```vue
<script setup lang="ts">
import { DEMO_USERS, DEMO_TEAMS, DEMO_MISSIONS, DEMO_STUDENTS_BY_TEAM } from '~/services/demoData';
import type { StudentProfile } from '~/types/types';

useHead({ title: 'ניתוח תלמיד — TeamSprintUp' });

const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

const studentId = route.params.studentId as string;

// ── Static demo data ──────────────────────────────────────────────────────────
const demoUser = DEMO_USERS.find((u) => u.id === studentId) ?? null;
const team = DEMO_TEAMS.find((t) => t.id === demoUser?.current_team_id) ?? null;
const challenge = DEMO_MISSIONS.find((c) => c.id === team?.currentChallengeId) ?? null;
const demoStudent = team
    ? (DEMO_STUDENTS_BY_TEAM[team.id] ?? []).find((s) => s.id === studentId) ?? null
    : null;

const ROLE_LABELS: Record<string, string> = {
    pm: 'Editor (PM)',
    qa: 'QA',
    dev: 'Designer',
    hardware: 'Printer',
};

// ── API shapes ────────────────────────────────────────────────────────────────
interface QuizResult {
    user_id: string;
    phase: 'pre' | 'post';
    score: number | null;
    total: number;
    submitted_at: string | null;
    learning_gain: number | null;
}

interface StudentInsight {
    userId: string;
    totalActiveTimeSeconds: number;
    totalTasks: number;
    approvedTasks: number;
    hintCount: number;
    riskLevel: 'ok' | 'watch' | 'needs_attention';
    insightReason: string;
}

interface StudentNote {
    id: string;
    student_id: string;
    teacher_id: string | null;
    note: string;
    created_at: string;
}

// ── Reactive state ────────────────────────────────────────────────────────────
const profile = ref<StudentProfile | null>(null);
const quizResults = ref<QuizResult[]>([]);
const insight = ref<StudentInsight | null>(null);
const notes = ref<StudentNote[]>([]);
const newNote = ref('');
const savingNote = ref(false);
const loading = ref(true);

onMounted(async () => {
    const fetches: Promise<void>[] = [
        $fetch<StudentProfile>(`${base}/student-profiles/${studentId}`)
            .then((d) => { profile.value = d; })
            .catch(() => {}),
        $fetch<{ students: StudentInsight[] }>(`${base}/teams/analytics/teacher-dashboard`)
            .then((d) => {
                insight.value = (d?.students ?? []).find((s) => s.userId === studentId) ?? null;
            })
            .catch(() => {}),
        $fetch<StudentNote[]>(`${base}/teams/students/${studentId}/notes`)
            .then((d) => { notes.value = Array.isArray(d) ? d : []; })
            .catch(() => {}),
    ];

    if (challenge) {
        fetches.push(
            $fetch<QuizResult[]>(`${base}/quizzes/missions/${challenge.id}/results`)
                .then((d) => {
                    quizResults.value = (Array.isArray(d) ? d : []).filter(
                        (r) => r.user_id === studentId,
                    );
                })
                .catch(() => {}),
        );
    }

    await Promise.allSettled(fetches);
    loading.value = false;
});

// ── Computed analytics ────────────────────────────────────────────────────────
const preQuiz = computed(() =>
    quizResults.value.find((r) => r.phase === 'pre' && r.submitted_at) ?? null,
);
const postQuiz = computed(() =>
    quizResults.value.find((r) => r.phase === 'post' && r.submitted_at) ?? null,
);

function fmtScore(result: QuizResult | null): string {
    if (!result || result.score === null) return 'אין נתון זמין';
    return `${result.score} / ${result.total}`;
}

// Deterministic demo scores per student — stable hash of ID, not saved to DB
function demoQuizScore(id: string, phase: 'pre' | 'post'): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
        h = ((h << 5) - h + id.charCodeAt(i)) | 0;
    }
    const base = Math.abs(h) % 26; // 0–25 → stable per student
    return phase === 'pre' ? 40 + base : 70 + base; // pre: 40–65, post: 70–95
}

const activeTimeLabel = computed(() => {
    const sec = insight.value?.totalActiveTimeSeconds ?? null;
    if (sec === null) return 'אין נתון זמין';
    if (sec < 60) return `${sec} שניות`;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h} שעות ו-${m} דקות` : `${m} דקות`;
});

const RISK_LABEL: Record<string, string> = {
    ok: 'תקין',
    watch: 'לשים לב',
    needs_attention: 'דורש התערבות',
};

const RISK_CLS: Record<string, string> = {
    ok: 'bg-emerald-100 text-emerald-700',
    watch: 'bg-amber-100 text-amber-700',
    needs_attention: 'bg-red-100 text-red-700',
};

function scoreColor(score: number): string {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-500';
}

// Returns a real CSS color so the bar is never purged by Tailwind's JIT
function barColor(pct: number): string {
    if (pct >= 70) return '#10b981'; // emerald-500
    if (pct >= 40) return '#f59e0b'; // amber-500
    return '#ef4444';                // red-500
}

function clampPct(v: number): number {
    return Math.max(0, Math.min(100, Math.round(v)));
}

// ── Notes ─────────────────────────────────────────────────────────────────────
async function saveNote() {
    if (!newNote.value.trim() || savingNote.value) return;
    savingNote.value = true;
    try {
        const saved = await $fetch<StudentNote>(`${base}/teams/students/${studentId}/notes`, {
            method: 'POST',
            body: { note: newNote.value.trim() },
        });
        notes.value = [saved, ...notes.value];
        newNote.value = '';
    } catch {
        // fail silently in POC mode
    } finally {
        savingNote.value = false;
    }
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('he-IL', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}
</script>

<template>
    <div class="min-h-screen bg-gray-50" dir="rtl">

        <!-- Header -->
        <header class="bg-white border-b border-gray-200 px-6 h-14 flex items-center gap-4">
            <button
                class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                @click="router.push('/teacher')"
            >
                <span>→</span>
                <span>חזור</span>
            </button>
            <div class="w-px h-5 bg-gray-200 shrink-0" />
            <span class="font-bold text-gray-900 text-sm">ניתוח תלמיד</span>
            <span v-if="demoUser" class="text-sm text-gray-500 truncate">— {{ demoUser.name }}</span>
        </header>

        <main class="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8">

            <!-- Student header -->
            <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
                    {{ (demoUser?.name ?? '?').charAt(0) }}
                </div>
                <div>
                    <h1 class="text-2xl font-black text-gray-900">{{ demoUser?.name ?? 'תלמיד לא נמצא' }}</h1>
                    <div class="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                        <span v-if="team">👥 {{ team.name }}</span>
                        <span v-if="demoStudent?.currentRole">🎯 {{ ROLE_LABELS[demoStudent.currentRole] ?? demoStudent.currentRole }}</span>
                        <span v-if="challenge">📋 {{ challenge.title }}</span>
                    </div>
                </div>
                <div v-if="insight" class="mr-auto">
                    <span :class="['text-xs font-bold px-3 py-1.5 rounded-full', RISK_CLS[insight.riskLevel]]">
                        {{ RISK_LABEL[insight.riskLevel] }}
                    </span>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex justify-center py-10">
                <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
            </div>

            <template v-else>

                <!-- Analytics cards grid -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

                    <!-- Pre-quiz score -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">ציון שאלון ראשוני</span>
                        <span v-if="preQuiz" :class="['text-2xl font-black', scoreColor(clampPct((preQuiz.score ?? 0) / preQuiz.total * 100))]">
                            {{ fmtScore(preQuiz) }}
                        </span>
                        <span v-else :class="['text-2xl font-black', scoreColor(demoQuizScore(studentId, 'pre'))]">
                            {{ demoQuizScore(studentId, 'pre') }}%
                        </span>
                        <span v-if="preQuiz?.submitted_at" class="text-[10px] text-gray-400">{{ formatDate(preQuiz.submitted_at) }}</span>
                        <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div
                                class="h-full rounded-full transition-all"
                                :style="{
                                    width: (preQuiz
                                        ? clampPct((preQuiz.score ?? 0) / preQuiz.total * 100)
                                        : demoQuizScore(studentId, 'pre')) + '%',
                                    backgroundColor: barColor(preQuiz
                                        ? clampPct((preQuiz.score ?? 0) / preQuiz.total * 100)
                                        : demoQuizScore(studentId, 'pre'))
                                }"
                            />
                        </div>
                    </div>

                    <!-- Post-quiz score -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">ציון שאלון שני</span>
                        <span v-if="postQuiz" :class="['text-2xl font-black', scoreColor(clampPct((postQuiz.score ?? 0) / postQuiz.total * 100))]">
                            {{ fmtScore(postQuiz) }}
                        </span>
                        <span v-else :class="['text-2xl font-black', scoreColor(demoQuizScore(studentId, 'post'))]">
                            {{ demoQuizScore(studentId, 'post') }}%
                        </span>
                        <span v-if="postQuiz?.learning_gain !== null && postQuiz?.learning_gain !== undefined" class="text-[10px]" :class="(postQuiz.learning_gain ?? 0) >= 0 ? 'text-emerald-500' : 'text-amber-500'">
                            שיפור: {{ (postQuiz.learning_gain ?? 0) >= 0 ? '+' : '' }}{{ postQuiz.learning_gain }}
                        </span>
                        <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div
                                class="h-full rounded-full transition-all"
                                :style="{
                                    width: (postQuiz
                                        ? clampPct((postQuiz.score ?? 0) / postQuiz.total * 100)
                                        : demoQuizScore(studentId, 'post')) + '%',
                                    backgroundColor: barColor(postQuiz
                                        ? clampPct((postQuiz.score ?? 0) / postQuiz.total * 100)
                                        : demoQuizScore(studentId, 'post'))
                                }"
                            />
                        </div>
                    </div>

                    <!-- Jargon score (0–100 scale) -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">ציון ז'רגון טכני</span>
                        <span v-if="profile" :class="['text-2xl font-black', scoreColor(profile.jargonScore)]">
                            {{ profile.jargonScore.toFixed(0) }}
                        </span>
                        <span v-else class="text-sm text-gray-400">אין נתון זמין</span>
                        <div v-if="profile" class="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div
                                class="h-full rounded-full transition-all"
                                :style="{
                                    width: clampPct(profile.jargonScore) + '%',
                                    backgroundColor: barColor(profile.jargonScore)
                                }"
                            />
                        </div>
                    </div>

                    <!-- Soft skill score (0–100 scale) -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">רכישת כישורים</span>
                        <span v-if="profile" :class="['text-2xl font-black', scoreColor(profile.softSkillScore)]">
                            {{ profile.softSkillScore.toFixed(0) }}
                        </span>
                        <span v-else class="text-sm text-gray-400">אין נתון זמין</span>
                        <div v-if="profile" class="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div
                                class="h-full rounded-full transition-all"
                                :style="{
                                    width: clampPct(profile.softSkillScore) + '%',
                                    backgroundColor: barColor(profile.softSkillScore)
                                }"
                            />
                        </div>
                    </div>

                    <!-- Hints used -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">כמות רמזים</span>
                        <span v-if="insight !== null" class="text-2xl font-black text-gray-900">{{ insight.hintCount }}</span>
                        <span v-else class="text-sm text-gray-400">אין נתון זמין</span>
                    </div>

                    <!-- Tasks completed -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">משימות שבוצעו</span>
                        <span v-if="insight !== null" class="text-2xl font-black text-gray-900">{{ insight.approvedTasks }}</span>
                        <span v-else class="text-sm text-gray-400">אין נתון זמין</span>
                        <span v-if="insight && insight.totalTasks > 0" class="text-[10px] text-gray-400">מתוך {{ insight.totalTasks }} משימות</span>
                    </div>

                    <!-- Active time (proxy for task time — no dedicated completion timestamp) -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">זמן פעיל במערכת</span>
                        <span class="text-base font-black text-gray-900 leading-snug">{{ activeTimeLabel }}</span>
                        <span class="text-[10px] text-gray-400">זמן השלמת משימה ספציפי אינו זמין</span>
                    </div>

                    <!-- Messages analyzed -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">הודעות שנותחו</span>
                        <span v-if="profile" class="text-2xl font-black text-gray-900">{{ profile.messagesAnalyzed }}</span>
                        <span v-else class="text-sm text-gray-400">אין נתון זמין</span>
                    </div>

                </div>

                <!-- Struggle areas & detected terms -->
                <div v-if="profile && (profile.struggleAreas.length || profile.detectedTerms.length)" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-5">
                    <h2 class="font-black text-gray-900 text-sm">פירוט נושאים</h2>

                    <div v-if="profile.struggleAreas.length">
                        <p class="text-xs font-bold text-gray-400 mb-2">⚠️ נושאים שהתקשה בהם</p>
                        <div class="flex flex-wrap gap-1.5">
                            <span
                                v-for="area in profile.struggleAreas"
                                :key="area"
                                class="text-xs bg-red-50 text-red-700 border border-red-100 px-2.5 py-0.5 rounded-full"
                            >
                                {{ area }}
                            </span>
                        </div>
                    </div>

                    <div v-if="profile.detectedTerms.length">
                        <p class="text-xs font-bold text-gray-400 mb-2">✅ מונחים שזוהו</p>
                        <div class="flex flex-wrap gap-1.5">
                            <span
                                v-for="term in profile.detectedTerms"
                                :key="term"
                                class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full"
                            >
                                {{ term }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Teacher notes -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-5">
                    <h2 class="font-black text-gray-900 text-sm">הערות מורה</h2>

                    <div class="flex flex-col gap-2">
                        <textarea
                            v-model="newNote"
                            rows="3"
                            placeholder="הוסף הערה לתלמיד..."
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#3CC2EE]/40 focus:border-[#3CC2EE] transition-all"
                        />
                        <button
                            :disabled="!newNote.trim() || savingNote"
                            class="self-end px-5 py-2 bg-[#3CC2EE] hover:bg-[#27b3df] disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                            @click="saveNote"
                        >
                            <span v-if="savingNote">שומר...</span>
                            <span v-else>שמור הערה</span>
                        </button>
                    </div>

                    <div v-if="!notes.length" class="text-sm text-gray-400 text-center py-4">
                        אין הערות עדיין.
                    </div>
                    <ul v-else class="flex flex-col gap-3">
                        <li
                            v-for="n in notes"
                            :key="n.id"
                            class="bg-gray-50 rounded-xl px-4 py-3 flex flex-col gap-1"
                        >
                            <p class="text-sm text-gray-800 whitespace-pre-wrap leading-snug">{{ n.note }}</p>
                            <span class="text-xs text-gray-400">{{ formatDate(n.created_at) }}</span>
                        </li>
                    </ul>
                </div>

            </template>
        </main>
    </div>
</template>

```

---

## frontend/pages/teacher.vue
**Type:** frontend

```vue
<script setup lang="ts">
import { useTeacher } from '~/composables/useTeacher';
import { useUser } from '~/composables/useUser';
import type { Challenge, StudentProfile } from '~/types/types';
import { LESSONS_PER_MISSION, DEMO_STUDENTS_BY_TEAM } from '~/services/demoData';
import { useStudentProfile } from '~/composables/useStudentProfile';

useHead({ title: 'Teacher Dashboard — TeamSprintUp' });

const { logout } = useUser();
const router = useRouter();
const activeTab = ref<'missions' | 'board' | 'analytics' | 'chats' | 'profiles'>('missions');

const teacherData = useTeacher();
const { 
    allProfiles, 
    alerts, 
    fetchAllProfiles, 
    fetchAlerts, 
    markAlertRead, 
    markAllAlertsRead 
} = useStudentProfile();

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

onMounted(() => {
    teacherData.fetchChallenges();
    teacherData.fetchTeams();
    fetchAlerts();
    loadProfiles();
});

// ── Inline role panel state ────────────────────────────────────────────
const rolePanel = ref<{ teamId: string; challengeId: string } | null>(null);

function openRolePanel(teamId: string, challengeId: string) {
    rolePanel.value = { teamId, challengeId };
    teacherData.fetchStudents(teamId);
}
function closeRolePanel() {
    rolePanel.value = null;
}

// ── Toast ──────────────────────────────────────────────────────────────
const toast = ref<{ msg: string; type: 'success' | 'error' } | null>(null);
function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toast.value = { msg, type };
    setTimeout(() => { toast.value = null; }, 2800);
}

// ── Mission helpers ────────────────────────────────────────────────────
type TeamMissionState = 'idle' | 'active' | 'completed';

function teamMissionState(team: any, missionId: string): TeamMissionState {
    const onMission = (team.currentChallengeId ?? team.current_challenge_id) === missionId;
    if (!onMission) return 'idle';
    if (team.isCompleted ?? team.is_completed) return 'completed';
    return 'active';
}

function stateBadge(state: TeamMissionState) {
    if (state === 'active') {
        return { text: 'פעיל', cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' };
    }
    if (state === 'completed') {
        return { text: 'הושלם', cls: 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200' };
    }
    return { text: 'לא התחיל', cls: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200' };
}

function missionOverallState(c: Challenge): TeamMissionState {
    const states = teacherData.teams.value.map((t) => teamMissionState(t, c.id));
    if (states.some((s) => s === 'active')) return 'active';
    if (states.some((s) => s === 'completed')) return 'completed';
    return 'idle';
}

function lessonsFor(c: Challenge): number {
    return LESSONS_PER_MISSION[c.id] ?? 0;
}

function dateFor(c: Challenge): Date {
    const raw = (c as any).createdAt ?? (c as any).created_at;
    return raw ? new Date(raw) : new Date();
}

// ── Mission lifecycle handlers ─────────────────────────────────────────
async function handleOpen(challengeId: string, teamId: string, teamName: string) {
    await teacherData.openMission(challengeId, teamId);
    showToast(`המשימה נפתחה ל${teamName}`);
}

async function handleClose(teamId: string, teamName: string) {
    if (!confirm(`לסגור את המשימה הנוכחית של ${teamName}?`)) return;
    await teacherData.closeMission(teamId);
    showToast(`המשימה של ${teamName} נסגרה`);
    if (rolePanel.value?.teamId === teamId) closeRolePanel();
}

async function handleReopen(teamId: string, teamName: string) {
    await teacherData.reopenMission(teamId);
    showToast(`המשימה של ${teamName} נפתחה מחדש`);
}

// ── Profile Enrichment (from recent master) ───────────────────────────
const enrichedProfiles = ref<Array<StudentProfile & { name: string }>>([]);

async function loadProfiles() {
    await Promise.all([fetchAllProfiles(), fetchAlerts()]);
    const users = await $fetch<Array<{ id: string; name: string }>>(`${base}/users`).catch(() => []);

    const nameMap = new Map(users.map((u) => [u.id, u.name]));
    
    enrichedProfiles.value = allProfiles.value.map((p) => ({
        ...p,
        // Convert readonly array to mutable array to satisfy StudentProfile interface
        detectedTerms: [...p.detectedTerms],
        struggleAreas: [...p.struggleAreas],
        name: nameMap.get(p.userId) ?? 'תלמיד לא מזוהה',
    }));
}

const highAlerts = computed(() => alerts.value.filter((a) => !a.isRead));

watch(activeTab, (tab) => {
    if (tab === 'profiles') {
        loadProfiles();
    }
});
</script>

<template>
    <div class="min-h-screen bg-gray-900 flex flex-col" dir="rtl">
        <!-- Header -->
        <header class="border-b border-gray-700 px-6 h-14 flex items-center gap-4">
            <span class="text-xl">🚀</span>
            <span class="font-bold text-white text-sm tracking-tight">TeamSprintUp</span>
            <span class="text-xs text-gray-400 font-medium px-2 py-0.5 rounded-full bg-gray-800 uppercase tracking-wide">Teacher</span>

            <div class="flex-1" />

            <!-- Tabs -->
            <div class="flex gap-1 bg-gray-800 p-1 rounded-xl flex-wrap">
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'missions' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'missions'"
                >
                    🎯 משימות
                </button>
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'board' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'board'"
                >
                    📊 Monday Board
                </button>

                <button
                    :class="[
                        'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        activeTab === 'chats'
                            ? 'bg-gray-700 text-white'
                            : 'text-gray-400 hover:text-gray-200',
                    ]"
                    @click="activeTab = 'chats'"
                >
                    💬 DUDE Chats
                </button>

                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors relative', activeTab === 'profiles' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'profiles'"
                >
                    🧠 אנליזה
                    <span v-if="highAlerts.length" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                        {{ highAlerts.length > 9 ? '9+' : highAlerts.length }}
                    </span>
                </button>
            </div>
        </header>

        <!-- Main Content Area -->
        <main class="flex-1 overflow-auto bg-gray-50 flex flex-col">
            
            <!-- 1. Missions Tab -->
            <div v-if="activeTab === 'missions'" class="flex-1 px-8 py-10">
                <div class="max-w-6xl mx-auto">
                    <div class="mb-8">
                        <h1 class="text-3xl font-black text-gray-900 tracking-tight">ניהול משימות וצוותים</h1>
                        <p class="text-sm text-gray-500 mt-1">פתחו משימה לצוות, שבצו תפקידים, וסגרו את המשימה כשהיא הושלמה.</p>
                    </div>

                    <!-- Mission cards -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div
                            v-for="c in teacherData.challenges.value"
                            :key="c.id"
                            class="bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md"
                        >
                            <!-- Header strip -->
                            <div class="px-6 py-4 bg-gradient-to-l from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <span class="text-2xl">🏆</span>
                                    <span class="text-[11px] uppercase font-black tracking-widest text-gray-400">Mission</span>
                                </div>
                                <span :class="['text-[11px] font-bold px-3 py-1 rounded-full shadow-sm', stateBadge(missionOverallState(c)).cls]">
                                    {{ stateBadge(missionOverallState(c)).text }}
                                </span>
                            </div>

                            <!-- Body -->
                            <div class="p-6 flex flex-col gap-4">
                                <h3 class="text-xl font-black text-gray-900 leading-tight">{{ c.title }}</h3>
                                <p class="text-sm text-gray-500 leading-relaxed line-clamp-3">{{ c.description }}</p>

                                <div class="flex items-center gap-4 text-xs text-gray-400 font-bold">
                                    <span class="flex items-center gap-1.5">
                                        <span>📅</span>
                                        <span>{{ dateFor(c).toLocaleDateString('he-IL') }}</span>
                                    </span>
                                    <span class="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    <span>{{ lessonsFor(c) }} שיעורי האתגר</span>
                                </div>

                                <!-- Per-team rows -->
                                <div class="mt-4 space-y-3">
                                    <div
                                        v-for="t in teacherData.teams.value"
                                        :key="t.id"
                                        class="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3"
                                    >
                                        <div class="flex flex-col">
                                            <span class="text-sm font-black text-gray-900">👥 {{ t.name }}</span>
                                            <span :class="['mt-1 w-fit text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider', stateBadge(teamMissionState(t, c.id)).cls]">
                                                {{ stateBadge(teamMissionState(t, c.id)).text }}
                                            </span>
                                        </div>

                                        <div class="flex-1" />

                                        <!-- IDLE: open -->
                                        <button
                                            v-if="teamMissionState(t, c.id) === 'idle'"
                                            class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-100"
                                            @click="handleOpen(c.id, t.id, t.name)"
                                        >
                                            🚀 פתח לצוות
                                        </button>

                                        <!-- ACTIVE: assign roles + close -->
                                        <template v-else-if="teamMissionState(t, c.id) === 'active'">
                                            <button
                                                class="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-100"
                                                @click="openRolePanel(t.id, c.id)"
                                            >
                                                👥 שבץ תפקידים
                                            </button>
                                            <button
                                                class="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-100"
                                                @click="handleClose(t.id, t.name)"
                                            >
                                                🏁 סגור משימה
                                            </button>
                                        </template>

                                        <!-- COMPLETED: reopen -->
                                        <button
                                            v-else
                                            class="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-100"
                                            @click="handleReopen(t.id, t.name)"
                                        >
                                            🔄 פתח מחדש
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Inline role assignment panel -->
                            <div
                                v-if="rolePanel && rolePanel.challengeId === c.id"
                                class="border-t border-gray-100 bg-gray-50/50 p-6"
                            >
                                <RoleAssignmentPanel
                                    :team-id="rolePanel.teamId"
                                    :challenge-id="rolePanel.challengeId"
                                    @close="closeRolePanel"
                                    @saved="showToast('שיבוץ התפקידים נשמר')"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. Board Tab -->
            <div v-else-if="activeTab === 'board'" class="flex-1 flex flex-col p-6">
                <div class="max-w-6xl mx-auto w-full">
                    <MockMondayBoard />
                </div>
            </div>

            <!-- 3. DUDE Chats Tab -->
            <div v-else-if="activeTab === 'chats'" class="flex-1 p-6" style="min-height: 0">
                <div class="max-w-6xl mx-auto h-full" style="height: calc(100vh - 140px)">
                    <TeacherChatPanel />
                </div>
            </div>

            <!-- 5. Student Profiles Tab -->
            <div v-else-if="activeTab === 'profiles'" class="flex-1 p-6">
                <div class="max-w-6xl mx-auto">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <h1 class="text-2xl font-black text-gray-900 tracking-tight italic uppercase">DUDE Insights</h1>
                            <p class="text-sm text-gray-500 mt-1">ניתוח מעמיק של דפוסי עבודה וכישורים רכים.</p>
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="text-xs font-bold text-gray-400 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">{{ enrichedProfiles.length }} פרופילים נטענו</span>
                            <button
                                class="text-xs bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:translate-y-0"
                                @click="loadProfiles"
                            >
                                רענן נתונים
                            </button>
                        </div>
                    </div>

                    <!-- Alerts banner -->
                    <div v-if="highAlerts.length" class="mb-8 bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
                        <span class="text-2xl shrink-0">⚠️</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-base font-black text-red-900 mb-3">{{ highAlerts.length }} התראות הדורשות התערבות</p>
                            <ul class="flex flex-col gap-2">
                                <li
                                    v-for="alert in highAlerts.slice(0, 5)"
                                    :key="alert.id"
                                    class="flex items-center gap-3 text-sm text-red-800 bg-white/50 p-2 rounded-lg border border-red-100"
                                >
                                    <span class="shrink-0 font-bold px-2 py-0.5 rounded-md bg-red-100">{{ alert.alertType === 'stuck' ? 'תקוע' : 'התראה' }}</span>
                                    <span class="flex-1">{{ alert.message }}</span>
                                    <button class="shrink-0 text-red-400 hover:text-red-600 transition-colors" @click="markAlertRead(alert.id)">סמן כנקרא</button>
                                </li>
                            </ul>
                            <button
                                v-if="highAlerts.length > 1"
                                class="mt-4 text-xs text-red-600 font-bold hover:text-red-800 underline uppercase tracking-widest"
                                @click="markAllAlertsRead"
                            >
                                סמן הכל כנקרא
                            </button>
                        </div>
                    </div>

                    <h2 class="text-base font-black text-gray-900 mb-4">תלמידים</h2>

                    <div v-if="!enrichedProfiles.length" class="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                        <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-3xl">📭</div>
                        <p class="text-gray-400 font-medium">טרם נותחו פרופילי למידה עבור תלמידים אלו.</p>
                    </div>

                    <div v-else class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <NuxtLink
                            v-for="p in enrichedProfiles"
                            :key="p.id"
                            :to="`/teacher-student/${p.userId}`"
                            class="block hover:scale-[1.01] transition-transform"
                        >
                            <StudentProfileCard
                                :profile="p"
                                :user-name="p.name"
                            />
                        </NuxtLink>
                    </div>

                    <h2 class="text-base font-black text-gray-900 mt-10 mb-4">קבוצות</h2>

                    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <NuxtLink
                            v-for="t in teacherData.teams.value"
                            :key="t.id"
                            :to="`/teacher-group/${t.id}`"
                            class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-3 hover:shadow-md hover:border-[#3CC2EE]/40 transition-all cursor-pointer"
                        >
                            <div class="flex items-start justify-between gap-2">
                                <span class="font-black text-gray-900 text-sm leading-tight">{{ t.name }}</span>
                                <span :class="['text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0', stateBadge(t.sprintStatus as TeamMissionState).cls]">
                                    {{ stateBadge(t.sprintStatus as TeamMissionState).text }}
                                </span>
                            </div>
                            <p class="text-sm text-gray-500">{{ DEMO_STUDENTS_BY_TEAM[t.id]?.length ?? 0 }} תלמידים</p>
                            <p v-if="t.currentChallengeId" class="text-sm text-gray-700">
                                <span class="font-semibold text-gray-500">אתגר פעיל:</span>
                                {{ teacherData.challenges.value.find(c => c.id === t.currentChallengeId)?.title ?? '' }}
                            </p>
                            <p v-else class="text-sm text-gray-400">אין אתגר פעיל</p>
                        </NuxtLink>
                    </div>
                </div>
            </div>
        </main>

        <!-- Toast -->
        <Teleport to="body">
            <Transition name="toast">
                <div
                    v-if="toast"
                    :class="['fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-black pointer-events-none transition-all', toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white']"
                    dir="rtl"
                >
                    {{ toast.msg }}
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.toast-enter-active,
.toast-leave-active {
    transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    transform: translate(-50%, 12px);
}
</style>
```

---

## frontend/services/demoData.ts
**Type:** frontend

```typescript
/**
 * POC demo fixtures — used by composables when running without a backend.
 * Internal role keys: pm/qa/dev/hardware (matches DB).
 * Display labels: Editor / QA / Designer / Printer (via ROLE_LABELS).
 */

import type {
    Challenge,
    Team,
    StudentRole,
    StudentWithRoleHistory,
} from '~/types/types';

// ── Mission ids ────────────────────────────────────────────────────────
export const MISSION_IDS = {
    gift:   'aaaa0001-0000-0000-0000-000000000000',
    puzzle: 'aaaa0002-0000-0000-0000-000000000000',
    style:  'aaaa0003-0000-0000-0000-000000000000',
} as const;

// ── Missions (challenges) — 3 real TechSchool missions ─────────────────
export const DEMO_MISSIONS: Challenge[] = [
    {
        id: MISSION_IDS.gift,
        title: 'אתגר מספר 1 – מתנה',
        description:
            'מגנים, מדליות ומתנות מודפסות. נלמד טכניקות מידול בסיסיות ומתקדמות, נעצב פריט אישי בעל ' +
            'משמעות, ונדפיס אותו ב-3D. דגש על דיוק, גימור, וייחוד אישי.',
        mondayBoardId: null,
        isActive: false,
        orderIndex: 1,
        createdAt: '2026-04-01T08:00:00Z',
    },
    {
        id: MISSION_IDS.puzzle,
        title: 'אתגר אישי: פאזל — פאזלים לכבדי ראייה',
        description:
            'יצירת פאזלים תלת-ממדיים נגישים לילדים עם לקויות ראייה. שפה של מגע, חיבורים חכמים עם ' +
            'מרווח סובלנות 0.2-0.4 מ"מ, וצורות מעולם התוכן של הילדים. גודל 10-16 ס"מ, גובה 10 מ"מ. ' +
            'יעד: 2-6 חלקי פאזל אחד.',
        mondayBoardId: null,
        isActive: true,
        orderIndex: 2,
        createdAt: '2026-05-05T08:00:00Z',
    },
    {
        id: MISSION_IDS.style,
        title: 'אתגר מספר 3 – סטייל אישי',
        description:
            'אביזרי אופנה ועיצוב מודפסים: טבעות, צמידים, תליונים, משקפיים, מסכות וחלקים זזים. ' +
            'דגש על קולקציה אחידה, יצירתיות, מורכבות טכנית וגימור.',
        mondayBoardId: null,
        isActive: false,
        orderIndex: 3,
        createdAt: '2026-04-19T08:00:00Z',
    },
];

export const LESSONS_PER_MISSION: Record<string, number> = {
    [MISSION_IDS.gift]:   5,
    [MISSION_IDS.puzzle]: 3,
    [MISSION_IDS.style]:  7,
};

// ── Teams — both currently on the puzzle mission ───────────────────────
export const DEMO_TEAMS: Team[] = [
    {
        id: 'cccc0001-0000-0000-0000-000000000000',
        name: 'Team Alpha — נבחרת אלפא',
        accumulatedScore: 150,
        sprintStatus: 'active',
        isCompleted: false,
        currentChallengeId: MISSION_IDS.puzzle,
        currentSprintId: null,
        createdAt: '2026-04-01T08:00:00Z',
        updatedAt: '2026-05-07T12:00:00Z',
    },
    {
        id: 'cccc0002-0000-0000-0000-000000000000',
        name: 'Team Beta — נבחרת בטא',
        accumulatedScore: 120,
        sprintStatus: 'active',
        isCompleted: false,
        currentChallengeId: MISSION_IDS.puzzle,
        currentSprintId: null,
        createdAt: '2026-04-01T08:00:00Z',
        updatedAt: '2026-05-07T12:00:00Z',
    },
];

// ── Users ──────────────────────────────────────────────────────────────
export interface DemoApiUser {
    id: string;
    name: string;
    email: string;
    current_team_id: string | null;
    current_role: StudentRole | null;
    account_type: 'student' | 'teacher' | 'admin';
}

export const DEMO_USERS: DemoApiUser[] = [
    { id: 'dddd0001-0000-0000-0000-000000000000', name: 'Yael Mizrahi',  email: 'yael@techschool.demo',    current_team_id: 'cccc0001-0000-0000-0000-000000000000', current_role: 'pm',       account_type: 'student' },
    { id: 'dddd0002-0000-0000-0000-000000000000', name: 'David Cohen',   email: 'david@techschool.demo',   current_team_id: 'cccc0001-0000-0000-0000-000000000000', current_role: 'qa',       account_type: 'student' },
    { id: 'dddd0003-0000-0000-0000-000000000000', name: 'Noa Ben-David', email: 'noa@techschool.demo',     current_team_id: 'cccc0001-0000-0000-0000-000000000000', current_role: 'dev',      account_type: 'student' },
    { id: 'dddd0004-0000-0000-0000-000000000000', name: 'Ariel Levy',    email: 'ariel@techschool.demo',   current_team_id: 'cccc0001-0000-0000-0000-000000000000', current_role: 'hardware', account_type: 'student' },
    { id: 'dddd0005-0000-0000-0000-000000000000', name: 'Maya Shapiro',  email: 'maya@techschool.demo',    current_team_id: 'cccc0002-0000-0000-0000-000000000000', current_role: 'pm',       account_type: 'student' },
    { id: 'dddd0006-0000-0000-0000-000000000000', name: 'Omer Peretz',   email: 'omer@techschool.demo',    current_team_id: 'cccc0002-0000-0000-0000-000000000000', current_role: 'qa',       account_type: 'student' },
    { id: 'dddd0007-0000-0000-0000-000000000000', name: 'Lior Katz',     email: 'lior@techschool.demo',    current_team_id: 'cccc0002-0000-0000-0000-000000000000', current_role: 'dev',      account_type: 'student' },
    { id: 'dddd0008-0000-0000-0000-000000000000', name: 'Tal Friedman',  email: 'tal@techschool.demo',     current_team_id: 'cccc0002-0000-0000-0000-000000000000', current_role: 'hardware', account_type: 'student' },
    { id: 'dddd0009-0000-0000-0000-000000000000', name: 'Teacher Demo',  email: 'teacher@techschool.demo', current_team_id: null,                                    current_role: null,       account_type: 'teacher' },
    { id: 'dddd000a-0000-0000-0000-000000000000', name: 'Admin Demo',    email: 'admin@techschool.demo',   current_team_id: null,                                    current_role: null,       account_type: 'admin'   },
];

function emptyRoleCount() { return { pm: 0, qa: 0, dev: 0, hardware: 0 }; }

export const DEMO_STUDENTS_BY_TEAM: Record<string, StudentWithRoleHistory[]> = {
    'cccc0001-0000-0000-0000-000000000000': [
        { id: 'dddd0001-0000-0000-0000-000000000000', name: 'Yael Mizrahi',  email: 'yael@techschool.demo',  currentRole: 'pm',       lastRoles: ['qa', 'dev'], roleCount: { ...emptyRoleCount(), pm: 1, qa: 1, dev: 1 }, suggestedRole: null },
        { id: 'dddd0002-0000-0000-0000-000000000000', name: 'David Cohen',   email: 'david@techschool.demo', currentRole: 'qa',       lastRoles: ['hardware'],  roleCount: { ...emptyRoleCount(), qa: 1, hardware: 1 },     suggestedRole: null },
        { id: 'dddd0003-0000-0000-0000-000000000000', name: 'Noa Ben-David', email: 'noa@techschool.demo',   currentRole: 'dev',      lastRoles: ['pm'],         roleCount: { ...emptyRoleCount(), dev: 1, pm: 1 },           suggestedRole: null },
        { id: 'dddd0004-0000-0000-0000-000000000000', name: 'Ariel Levy',    email: 'ariel@techschool.demo', currentRole: 'hardware', lastRoles: ['dev'],        roleCount: { ...emptyRoleCount(), hardware: 1, dev: 1 },     suggestedRole: null },
    ],
    'cccc0002-0000-0000-0000-000000000000': [
        { id: 'dddd0005-0000-0000-0000-000000000000', name: 'Maya Shapiro',  email: 'maya@techschool.demo', currentRole: 'pm',       lastRoles: ['hardware'],  roleCount: { ...emptyRoleCount(), pm: 1, hardware: 1 },     suggestedRole: null },
        { id: 'dddd0006-0000-0000-0000-000000000000', name: 'Omer Peretz',   email: 'omer@techschool.demo', currentRole: 'qa',       lastRoles: ['pm'],         roleCount: { ...emptyRoleCount(), qa: 1, pm: 1 },           suggestedRole: null },
        { id: 'dddd0007-0000-0000-0000-000000000000', name: 'Lior Katz',     email: 'lior@techschool.demo', currentRole: 'dev',      lastRoles: ['qa'],         roleCount: { ...emptyRoleCount(), dev: 1, qa: 1 },           suggestedRole: null },
        { id: 'dddd0008-0000-0000-0000-000000000000', name: 'Tal Friedman',  email: 'tal@techschool.demo', currentRole: 'hardware', lastRoles: ['dev'],        roleCount: { ...emptyRoleCount(), hardware: 1, dev: 1 },     suggestedRole: null },
    ],
};

// ─── Quiz question pool — Hebrew ────────────────────────────────────────
export interface DemoQuizQuestion {
    id: string;
    scope: 'role' | 'mission' | 'teamwork';
    role: StudentRole | null;        // when scope='role'
    missionId: string | null;        // when scope='mission'
    prompt: string;
    options: string[];
    correctIndex: number;
}

let _qid = 0;
const qRole = (role: StudentRole, prompt: string, options: string[], correctIndex: number): DemoQuizQuestion => ({
    id: `qq-${(++_qid).toString().padStart(4, '0')}`,
    scope: 'role',
    role,
    missionId: null,
    prompt,
    options,
    correctIndex,
});
const qMission = (missionId: string, prompt: string, options: string[], correctIndex: number): DemoQuizQuestion => ({
    id: `qq-${(++_qid).toString().padStart(4, '0')}`,
    scope: 'mission',
    role: null,
    missionId,
    prompt,
    options,
    correctIndex,
});
const qTeamwork = (prompt: string, options: string[], correctIndex: number): DemoQuizQuestion => ({
    id: `qq-${(++_qid).toString().padStart(4, '0')}`,
    scope: 'teamwork',
    role: null,
    missionId: null,
    prompt,
    options,
    correctIndex,
});

export const DEMO_QUIZ_QUESTIONS: DemoQuizQuestion[] = [
    // ───────── Role-knowledge: dev = Designer ─────────
    qRole('dev', 'ב-Fusion 360, איזו פעולה מסירה חומר מתוך גוף מוצק?',
        ['Extrude — Join', 'Extrude — Cut', 'Sketch — Trim', 'Patch'], 1),
    qRole('dev', 'מהו "פרוטוטיפ" באתגרי הדפסה תלת-ממדית?',
        ['התוצר הסופי המגומר', 'גרסה ראשונית של מודל לבדיקת התכנון', 'שקף במצגת', 'רשימת חומרים'], 1),
    qRole('dev', 'מהו עובי דופן מינימלי מומלץ להדפסת FDM?',
        ['0.1 מ"מ', '1.2 מ"מ', '5 מ"מ', '10 מ"מ'], 1),
    qRole('dev', 'איזה פורמט קובץ הוא הסטנדרט לייצוא mesh להדפסה תלת-ממדית?',
        ['PNG', 'STL', 'CSV', 'PSD'], 1),

    // ───────── Role-knowledge: pm = Editor (slicer / pre-print) ─────────
    qRole('pm', 'בסליסר, מה ה-"infill" קובע?',
        ['מהירות הדפסה', 'את צפיפות הפנים של החלק', 'טמפרטורת המשטח', 'צבע הפילמנט'], 1),
    qRole('pm', 'מהו גובה שכבה אופייני להדפסת FDM מאוזנת?',
        ['0.02 מ"מ', '0.20 מ"מ', '2.00 מ"מ', '20 מ"מ'], 1),
    qRole('pm', 'למה מייצרים "תמיכות" (supports) בסליסר?',
        ['כדי להכביד על המודל', 'כדי להחזיק overhangs וגשרים בזמן ההדפסה', 'כדי לחסוך פילמנט', 'כדי לתרגם טקסט'], 1),
    qRole('pm', 'מהו "G-code"?',
        ['רובריקת ציון', 'ההוראות שהמדפסת מבצעת שכבה-שכבה', 'סוג של פלסטיק', 'פורמט של תמונה'], 1),

    // ───────── Role-knowledge: qa ─────────
    qRole('qa', 'מה המשמעות של "להגיש ל-QA"?',
        ['שמישהו יבנה עבורך', 'שמישהו יזרוק', 'שמישהו יבדוק שעמדת בדרישות', 'שמישהו יתרגם'], 2),
    qRole('qa', 'מהו "באג" שנמצא בסקירת QA?',
        ['חרק על המדפסת', 'פגם שצריך לתקן לפני אישור', 'בקשה לפיצ\'ר חדש', 'איחור באספקה'], 1),
    qRole('qa', 'מה משמעות "אושר" בפייפליין המשימות?',
        ['ממתין לבדיקה', 'הוחזר לתיקון', 'אושרר כהושלם', 'בוטל'], 2),
    qRole('qa', 'אם חלק נכשל בבדיקת מימדים, הפעולה הנכונה היא…',
        ['לאשר בכל זאת', 'לסמן needs-fix ולתעד בהערות', 'למחוק את הצוות', 'להתעלם'], 1),

    // ───────── Role-knowledge: hardware = Printer ─────────
    qRole('hardware', 'כשלי הדבקה למשטח קורים בדרך כלל בגלל…',
        ['הפילמנט קר מדי או שהמשטח לא מיושר/נקי', 'ה-WiFi איטי', 'יותר מדי פוליגונים במודל', 'תמיכות כבויות'], 0),
    qRole('hardware', 'מה זה "stringing" בהדפסה תלת-ממדית?',
        ['חוטי פלסטיק דקים בין חלקים שנגרמים מנזילה', 'כבלי שמע במדפסת', 'סוג של infill', 'קוד סטטוס'], 0),
    qRole('hardware', 'מתי כדאי לכייל את משטח ההדפסה?',
        ['אף פעם — תמיד אוטומטי', 'כשהדפסות מתחילות להיכשל או שהמדפסת זזה', 'רק ביום הראשון', 'פעם בשנה'], 1),
    qRole('hardware', 'מה הצעד הבטוח הראשון כשהדפסה נכשלת באמצע?',
        ['להכות במדפסת', 'להשהות, לבדוק, ובמידת הצורך לחתוך מחדש', 'להריץ אותו דבר ולקוות', 'למחוק את הקובץ'], 1),

    // ───────── Mission-specific: gift (אתגר מספר 1 – מתנה) ─────────
    qMission(MISSION_IDS.gift, 'מה הגודל המומלץ למחזיק מפתחות אישי?',
        ['מתחת ל-2 ס"מ', 'גובה מקסימלי של ~8 ס"מ עם חור 6 מ"מ לטבעת', 'מעל 20 ס"מ', 'אין הגבלה'], 1),
    qMission(MISSION_IDS.gift, 'איזו טכניקה מתאימה ליצירת חריטה (טקסט בולט) על מגן?',
        ['Sketch + Extrude עם גובה 0.5–1 מ"מ', 'Boolean רנדומלי', 'Patch על משטח', 'Slicer ניקוי'], 0),
    qMission(MISSION_IDS.gift, 'מה הופך מגן הוקרה ל"מורכב" יותר ממגן פשוט?',
        ['גודל גדול יותר', 'קימורים, הבלטות, ועומקים מודלים', 'יותר תמיכות', 'צבע אדום'], 1),
    qMission(MISSION_IDS.gift, 'באיזו טכניקה נשתמש ליצירת מדליה בעלת אופי אישי?',
        ['חריטה (engrave) של שם או צורה אישית', 'Boolean רנדומלי', 'הגדלת infill', 'הסרת תמיכות'], 0),

    // ───────── Mission-specific: puzzle (פאזלים לכבדי ראייה) ─────────
    qMission(MISSION_IDS.puzzle, 'מה גודל מומלץ לפאזל המכיל 2-3 חלקים?',
        ['5–7 ס"מ', '10–13 ס"מ', '15–20 ס"מ', 'מעל 25 ס"מ'], 1),
    qMission(MISSION_IDS.puzzle, 'מה מרווח הסובלנות (Tolerance) המומלץ בין חלקי פאזל מודפסים?',
        ['0.0 מ"מ — להדק חזק', '0.2–0.4 מ"מ — שייכנסו בקלות', '1–2 מ"מ — רחב מאוד', '5 מ"מ ומעלה'], 1),
    qMission(MISSION_IDS.puzzle, 'איך ילד עם לקות ראייה ידע אם הוא מחזיק חלק הפוך?',
        ['לפי הצבע', 'לפי סימן מוסכם — פינה קטומה או שקע קטן ל"למעלה"', 'לפי המשקל', 'הוא לא יכול לדעת'], 1),
    qMission(MISSION_IDS.puzzle, 'מה הגובה המינימלי המומלץ לפאזל בהדפסה?',
        ['2 מ"מ', '5 מ"מ', '10 מ"מ', '50 מ"מ'], 2),
    qMission(MISSION_IDS.puzzle, 'מה היתרון בשימוש בטקסטורות (נקודות / פסים) על חלקי הפאזל?',
        ['פחות חומר', 'מאפשר לזהות חלקים במגע ולא רק בראייה', 'מקצר זמן הדפסה', 'מוסיף משקל'], 1),

    // ───────── Teamwork / collaboration (2 sampled per quiz) ─────────
    qTeamwork(
        'כשנתקלת בקושי ואינך מצליח להתקדם לבד, מה עליך לעשות?',
        ['לשמור לעצמך ולנסות שוב מאוחר יותר', 'לעדכן את הצוות ולבקש עזרה', 'לוותר על המשימה', 'לחכות שהמורה ישים לב'],
        1,
    ),
    qTeamwork(
        'סיימת את המשימה שלך מוקדם. מה עדיף לעשות?',
        ['לשחק בטלפון', 'לבדוק אם מישהו בצוות צריך עזרה', 'לצאת מוקדם', 'לחכות בשקט שיגמר השיעור'],
        1,
    ),
    qTeamwork(
        'מה תפקידו של ה-PM (Editor) בצוות?',
        ['להדפיס את קובץ ה-STL', 'לנהל לוח זמנים ולוודא שהצוות עומד בדדליין', 'לאשר קוד', 'לצייר את העיצוב הראשוני'],
        1,
    ),
    qTeamwork(
        'כשיש חילוקי דעות בצוות, מה הדרך הטובה ביותר לפתור אותם?',
        ['להמשיך ולהתעלם', 'לדון יחד ולתת לכולם להביע דעה לפני ההחלטה', 'לבקש מהחלש להחליט', 'לבקש מהמורה להכריע מיד'],
        1,
    ),
    qTeamwork(
        'מה חשוב לעשות לפני שמגישים משימה לסקירת QA?',
        ['להגיש ישר מבלי לבדוק', 'לבדוק בעצמך שעמדת בכל דרישות המשימה', 'לשאול רק את ה-PM', 'להמתין שה-QA יבקש'],
        1,
    ),

    // ───────── Mission-specific: style (סטייל אישי) ─────────
    qMission(MISSION_IDS.style, 'מה זה "Print in Place"?',
        ['הדפסה במקום הלקוח', 'מנגנון עם חלקים זזים שנדפס בבת אחת ללא הרכבה', 'הדפסה ללא תמיכות', 'הדפסה דו-צבעונית'], 1),
    qMission(MISSION_IDS.style, 'מה חשוב לתת תשומת לב כשמדפסים טבעת לילד?',
        ['גודל פנימי מדויק (perimeter) להתאמה לאצבע', 'infill של 90%', 'גובה שכבה גדול', 'אין חשיבות לגודל'], 0),
    qMission(MISSION_IDS.style, 'איך מקבלים "קולקציה" טובה של אבזרי אופנה?',
        ['פריטים זהים', 'אלמנט עיצובי משותף שחוזר בין הפריטים', 'הרבה צבעים שונים', 'כל פריט בנפרד'], 1),
    qMission(MISSION_IDS.style, 'איזה גימור מתאים למסכה אופנתית?',
        ['השארת תמיכות', 'שיוף קל וצביעה — ולפעמים השלמה ידנית', 'השארה כמו שיצא מהמדפסת', 'הדפסה בלי infill'], 1),
];

// ─── Hardcoded Hebrew hints (used by HintPanel when offline) ────────────
export const DEMO_HINTS: string[] = [
    'נסו להתחיל מהצורה הבסיסית הגדולה ביותר. אילו צורות 3D פשוטות יכולות להוות בסיס למודל שלכם?',
    'אם החלקים לא נכנסים — בדקו את ה-Tolerance בסליסר. נסו 0.2-0.4 מ"מ.',
    'בדקו עובי דפנות לפני ייצוא ל-STL. דפנות דקות מ-1.2 מ"מ עלולות להישבר.',
    'בעיות overhang? הוסיפו תמיכות אוטומטיות בסליסר או שנו את כיוון ההדפסה.',
    'לפני שמגישים — אמתו שהמודל נסגר (closed mesh). פתחים גורמים לכשלים בהדפסה.',
    'שכבה ראשונה לא נדבקת? נקו את המשטח ובדקו את גובה הפיה.',
    'נסו להוסיף chamfer קטן (0.5 מ"מ) לפינות חדות — הדפסה תיראה הרבה יותר נקייה.',
    'אם המודל גדול מדי — שקלו לחלק אותו לחלקים שיתחברו אחרי ההדפסה.',
    'שאלה מכוונת: איפה הסטרטוס של המשימה כרגע? מה השלב הבא בפייפליין?',
    'תזכורת: סקירת QA מתחילה אחרי שהמשימה במצב qa_review. אל תפסחו על הצ\'קליסט.',
];

```

---

## frontend/services/mockService.ts
**Type:** frontend

```typescript
import type {
    User,
    Activity,
    AIAnalysisResult,
    AIActivity,
    MondayActivity,
} from '~/types/types';

// ============================================================
// Mock data — replace each function with a real API call
// once the backend / Supabase is ready.
// ============================================================

export const mockUsers: User[] = [
    {
        id: 'usr-001',
        name: 'Alice Cohen',
        email: 'alice@example.com',
        currentTeamId: null,
        currentRole: 'dev',
        totalActiveTime: 0,
        lastLoginAt: '2026-04-28T10:30:00Z',
        createdAt: '2026-04-01T08:00:00Z',
        updatedAt: '2026-04-28T10:30:00Z',
    },
    {
        id: 'usr-002',
        name: 'Bob Levi',
        email: 'bob@example.com',
        currentTeamId: null,
        currentRole: 'pm',
        totalActiveTime: 0,
        lastLoginAt: '2026-04-29T11:00:00Z',
        createdAt: '2026-04-03T09:15:00Z',
        updatedAt: '2026-04-29T11:00:00Z',
    },
];

const mockAIActivities: AIActivity[] = [
    {
        id: 'act-ai-001',
        userId: 'usr-001',
        actionType: 'ai.jargon_scored',
        createdAt: '2026-04-29T14:00:00Z',
        payload: {
            jargonScore: 72,
            softSkillScore: 55,
            detectedTerms: ['MVP', 'sprint', 'stakeholder alignment'],
            suggestions: [
                'Try replacing "leverage synergies" with "work together".',
                'Clarify what "MVP" means for non-technical listeners.',
            ],
        },
    },
];

const mockMondayActivities: MondayActivity[] = [
    {
        id: 'act-monday-001',
        userId: 'usr-001',
        actionType: 'monday.item_created',
        createdAt: '2026-04-30T09:00:00Z',
        payload: {
            eventType: 'create_pulse',
            boardId: 987654321,
            itemId: 111222333,
            itemName: 'Onboarding Task #1',
        },
    },
];

// ============================================================
// Service API — mirrors what real API calls will look like
// ============================================================

export const mockService = {
    /** GET /users/:id */
    async getUser(id: string): Promise<User | undefined> {
        return mockUsers.find((u) => u.id === id);
    },

    /** GET /users */
    async listUsers(): Promise<User[]> {
        return mockUsers;
    },

    /** GET /activities?userId=:id */
    async listActivities(userId: string): Promise<Activity[]> {
        const all: Activity[] = [...mockAIActivities, ...mockMondayActivities];
        return all.filter((a) => a.userId === userId);
    },

    /** POST /ai/analyze  (mocked — returns canned result) */
    async analyzeText(_text: string): Promise<AIAnalysisResult> {
        return {
            jargonScore: 68,
            softSkillScore: 61,
            detectedTerms: ['agile', 'bandwidth', 'circle back'],
            suggestions: [
                '"Circle back" → "follow up later"',
                'Good use of active voice — keep it up.',
            ],
        };
    },
};
```

---

## frontend/tailwind.config.ts
**Type:** frontend

```typescript
import type { Config } from 'tailwindcss';

export default {
    content: [
        './components/**/*.{vue,ts}',
        './layouts/**/*.vue',
        './pages/**/*.vue',
        './plugins/**/*.ts',
        './app.vue',
    ],
    theme: {
        extend: {
            colors: {
                // Brand palette — swap freely
                brand: {
                    50: '#f0f9ff',
                    500: '#0ea5e9',
                    900: '#0c4a6e',
                },
            },
        },
    },
    plugins: [],
} satisfies Config;
```

---

## frontend/types/types.ts
**Type:** frontend

```typescript
// ============================================================
// TeamSprintUp — Shared Domain Types
// ============================================================

// Internal role keys stay as the original DB taxonomy. Display labels
// ("Designer", "Editor", "QA", "Printer") are mapped via ROLE_LABELS below.
export type StudentRole = 'pm' | 'qa' | 'dev' | 'hardware';

// Kept as alias so existing code (Task.assignedRole, etc.) still type-checks.
export type UserRole = StudentRole;

export const ROLE_PRIORITY: StudentRole[] = ['pm', 'qa', 'dev', 'hardware'];

// Mapping: pm → Editor, qa → QA, dev → Designer, hardware → Printer
export const ROLE_LABELS: Record<StudentRole, string> = {
    pm:       'Editor',
    qa:       'QA',
    dev:      'Designer',
    hardware: 'Printer',
};

export const ROLE_EMOJI: Record<StudentRole, string> = {
    pm:       '✂️',
    qa:       '🔍',
    dev:      '📐',
    hardware: '🖨️',
};

export interface RoleCount {
    pm: number;
    qa: number;
    dev: number;
    hardware: number;
}

export interface StudentWithRoleHistory {
    id: string;
    name: string;
    email: string;
    currentRole: StudentRole | null;
    lastRoles: StudentRole[];
    roleCount: RoleCount;
    suggestedRole: StudentRole | null;
}

export interface TeacherPublishPayload {
    teamId: string;
}

export interface TeacherAssignRolesPayload {
    assignments: { userId: string; role: StudentRole }[];
    challengeId?: string;
    assignedBy?: string;
}

// ── Pre/post-mission quizzes ───────────────────────────────────────────────
export type QuizPhase = 'pre' | 'post';

export interface QuizAttempt {
    id: string;
    userId: string;
    teamId: string | null;
    challengeId: string;
    phase: QuizPhase;
    startedAt: string;
    submittedAt: string | null;
    score: number | null;
    total: number;
    pairedAttemptId: string | null;
    learningGain: number | null;
}

export interface AttemptQuestion {
    id: string;
    questionId: string;
    orderIndex: number;
    prompt: string;
    options: string[];
    selectedIndex: number | null;
    isCorrect: boolean | null;
}

export interface AttemptWithQuestions {
    attempt: QuizAttempt;
    questions: AttemptQuestion[];
}

export interface QuizSubmitResult {
    score: number;
    total: number;
    learningGain: number | null;
}

export interface User {
    id: string;
    name: string;
    email: string;
    currentTeamId: string | null;
    currentRole: UserRole | null;
    totalActiveTime: number;  // seconds
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
}

// ------------------------------------------------------------

export interface Team {
    id: string;
    name: string;
    accumulatedScore: number;
    sprintStatus: 'idle' | 'active' | 'completed';
    isCompleted: boolean;
    currentChallengeId: string | null;
    currentSprintId: string | null;
    createdAt: string;
    updatedAt: string;
}

// ------------------------------------------------------------

export interface Challenge {
    id: string;
    title: string;
    description: string | null;
    mondayBoardId: number | null;
    isActive: boolean;
    orderIndex: number;
    createdAt: string;
}

// ------------------------------------------------------------

export interface Sprint {
    id: string;
    challengeId: string;
    title: string;
    description: string | null;
    orderIndex: number;
    createdAt: string;
}

// ------------------------------------------------------------

export type TaskStatus =
    | 'pending'
    | 'qa_review'
    | 'pm_review'
    | 'teacher_review'
    | 'approved'
    | 'rejected';

export interface QaChecklist {
    isCompleted: boolean;
    hasErrors: boolean;
    improvements: string[];
}

export interface Task {
    id: string;
    sprintId: string;
    teamId: string;
    assignedRole: UserRole;
    title: string;
    description: string | null;
    status: TaskStatus;
    submissionUrl: string | null;
    submissionImageUrl: string | null;
    mondayItemId: number | null;
    qaChecklist: QaChecklist | null;
    qaNotes: string | null;
    pmNotes: string | null;
    submittedBy: string | null;
    reviewedByQa: string | null;
    reviewedByPm: string | null;
    createdAt: string;
    updatedAt: string;
}

// ------------------------------------------------------------

export interface HintResponse {
    hint: string;
    hintNumber: number;
    hintsRemaining: number;
    pointsDeducted: number;
    isFree: boolean;
}

// ------------------------------------------------------------

export interface GroupLeaderboardRow {
    id: string;
    name: string;
    accumulatedScore: number;
    sprintStatus: string;
    isCompleted: boolean;
    approvedTaskCount: number;
}

export interface IndividualLeaderboardRow {
    id: string;
    name: string;
    currentTeamId: string | null;
    currentRole: UserRole | null;
    approvedTasks: number;
    totalActiveTime: number;
    rank: number;
}

// ------------------------------------------------------------

export interface AIAnalysisResult {
    jargonScore: number;
    softSkillScore: number;
    detectedTerms: string[];
    suggestions: string[];
    rawResponse?: unknown;
}

// ------------------------------------------------------------

export interface BaseActivity {
    id: string;
    userId: string;
    actionType: string;
    createdAt: string;
}

export interface AIActivity extends BaseActivity {
    actionType: 'ai.jargon_scored' | string;
    payload: {
        jargonScore: number;
        softSkillScore: number;
        detectedTerms: string[];
        suggestions: string[];
    };
}

export interface MondayActivity extends BaseActivity {
    actionType: 'monday.item_created' | string;
    payload: {
        eventType: string;
        boardId: number;
        itemId: number;
        itemName: string;
    };
}

export type Activity = AIActivity | MondayActivity;

// ── DUDE — Chat & Student Profiles ─────────────────────────────────────────

export interface ChatChannel {
    id: string;
    teamId: string;
    name: string;
    createdAt: string;
}

export interface ChatMessage {
    id: string;
    channelId: string;
    senderId: string | null;
    senderName: string;
    isBot: boolean;
    content: string;
    createdAt: string;
}

export interface StudentProfile {
    id: string;
    userId: string;
    jargonScore: number;
    softSkillScore: number;
    detectedTerms: string[];
    struggleAreas: string[];
    alertLevel: 'none' | 'low' | 'medium' | 'high';
    lastAlertMessage: string | null;
    messagesAnalyzed: number;
    lastAnalyzedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ProfileSnapshot {
    id: string;
    userId: string;
    jargonScore: number;
    softSkillScore: number;
    detectedTerms: string[];
    snapshotAt: string;
}

export interface TeacherAlert {
    id: string;
    userId: string | null;
    channelId: string | null;
    alertType: 'knowledge_gap' | 'low_engagement' | 'stuck';
    message: string;
    isRead: boolean;
    createdAt: string;
}

// ── Teacher Analytics Dashboard ──────────────────────────────────────

export interface TeacherDashboardSummary {
    totalStudents: number;
    totalTeams: number;
    activeTeams: number;
    approvedTasks: number;
    totalTasks: number;
    averageProgressPercent: number;
}

export interface StudentInsight {
    userId: string;
    name: string;
    email: string;
    teamId: string | null;
    teamName: string | null;
    role: UserRole | null;
    totalActiveTimeSeconds: number;
    totalTasks: number;
    approvedTasks: number;
    hintCount: number;
    tasksPerHour: number | null;
    riskLevel: 'ok' | 'watch' | 'needs_attention';
    insightReason: string;
}

export interface TeamProgress {
    teamId: string;
    teamName: string;
    score: number;
    sprintStatus: string;
    isCompleted: boolean;
    totalTasks: number;
    approvedTasks: number;
    progressPercent: number;
    totalHints: number;
}

export interface DifficultTask {
    taskId: string;
    title: string;
    teamName: string;
    hintCount: number;
    status: string;
}

export interface TeacherDashboardResponse {
    summary: TeacherDashboardSummary;
    students: StudentInsight[];
    teams: TeamProgress[];
    difficultTasks: DifficultTask[];
}

```

---

## frontend/utils/roleInfo.ts
**Type:** frontend

```typescript
export interface RoleInfo {
    title: string;
    subtitle: string;
    bullets: string[];
    jargon?: { term: string; explanation: string }[];
}

export const ROLE_INFO: Record<string, RoleInfo> = {
    dev: {
        title: 'Designer',
        subtitle: 'מעצב/ת המודל התלת-ממדי',
        bullets: [
            'תפקידך לתכנן איך האובייקט ייראה.',
            'אתה אחראי לחשוב על הצורה, הגודל והחלקים של המודל.',
            'אתה יוצר את המודל בתוכנת CAD ומוודא שהעיצוב מתאים להדפסה.',
            'לפני שמגישים — בדוק שאין פתחים במודל ושהמידות הגיוניות.',
        ],
        jargon: [
            { term: 'מודל', explanation: 'הצורה התלת-ממדית שאתה מעצב במחשב' },
            { term: 'CAD / Fusion 360', explanation: 'תוכנה המאפשרת ליצור עיצובים תלת-ממדיים מדויקים' },
            { term: 'STL', explanation: 'פורמט קובץ שהמדפסת יכולה לקרוא' },
            { term: 'Overhang', explanation: 'חלק של המודל שתלוי באוויר — צריך לדאוג שהמדפסת תצליח להדפיס אותו' },
        ],
    },
    qa: {
        title: 'QA',
        subtitle: 'בודק/ת איכות',
        bullets: [
            'QA פירושו בדיקת איכות (Quality Assurance).',
            'תפקידך לבדוק אם העבודה עומדת בדרישות המשימה.',
            'אתה מחפש טעויות, בעיות או דברים שצריך לשפר.',
            'אחרי הבדיקה, אתה מחליט — לאשר את העבודה או להחזיר לתיקון.',
        ],
        jargon: [
            { term: 'באג', explanation: 'שגיאה או בעיה שנמצאה בעבודה' },
            { term: 'אישור', explanation: 'החלטה שהעבודה עומדת בסטנדרט הנדרש' },
            { term: 'Checklist', explanation: 'רשימת דרישות לבדיקה' },
        ],
    },
    pm: {
        title: 'Editor',
        subtitle: 'עורך/ת — מכין/ה את הקובץ להדפסה',
        bullets: [
            'תפקידך לעבד ולהכין את קובץ המודל להדפסה.',
            'אתה עובד עם ה-Slicer כדי להגדיר איך המדפסת תדפיס את המודל.',
            'אתה קובע הגדרות כמו מהירות, עובי שכבה ומילוי.',
            'אתה מוודא שה-G-code מוכן ושולח להדפסה.',
        ],
        jargon: [
            { term: 'Slicer', explanation: 'תוכנה שמכינה את המודל להדפסה ע"י פריסתו לשכבות' },
            { term: 'G-code', explanation: 'קובץ ההוראות שהמדפסת מבצעת שכבה-שכבה' },
            { term: 'Infill', explanation: 'כמות המילוי הפנימי של המודל, בדרך כלל באחוזים' },
            { term: 'Support', explanation: 'תמיכות זמניות שהמדפסת מוסיפה לאזורים התלויים באוויר' },
        ],
    },
    hardware: {
        title: 'Printer',
        subtitle: 'מפעיל/ת המדפסת',
        bullets: [
            'תפקידך לדאוג לשלב ההדפסה הפיזי.',
            'אתה בודק שהקובץ מוכן, שהמדפסת תקינה ושיש מספיק חומר הדפסה.',
            'אתה מפעיל את המדפסת ועוקב אחרי ההדפסה.',
            'אחרי ההדפסה — אתה בודק אם התוצאה יצאה כמצופה ומדווח לצוות.',
        ],
        jargon: [
            { term: 'פילמנט', explanation: 'חומר הגלם הפלסטי שמוזן למדפסת' },
            { term: 'כיול', explanation: 'הגדרת המדפסת כך שהיא תדפיס בדיוק במקום הנכון' },
            { term: 'Stringing', explanation: 'חוטי פלסטיק דקים שנוצרים בטעות בין חלקי המודל' },
            { term: 'Bed Adhesion', explanation: 'הדבקת שכבת ההדפסה הראשונה למשטח — חשוב מאוד להצלחת ההדפסה' },
        ],
    },
};

export function getRoleInfo(roleKey: string): RoleInfo | null {
    return ROLE_INFO[roleKey] ?? null;
}

```

---

## supabase/schema.sql
**Type:** migration

```sql
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
-- STUDENT ROLE HISTORY (teacher workflow)
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

-- ============================================================
-- QUIZZES (pre/post-mission knowledge measurement)
-- ============================================================
create table if not exists public.quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  scope         text not null check (scope in ('role','mission')),
  "role"        text check ("role" in ('pm','qa','dev','hardware')),
  challenge_id  uuid references public.challenges(id) on delete cascade,
  prompt        text not null,
  options       jsonb not null,
  correct_index integer not null check (correct_index >= 0),
  created_at    timestamptz not null default now(),
  constraint quiz_questions_scope_consistency check (
    (scope = 'role'    and "role" is not null)
    or
    (scope = 'mission' and challenge_id is not null)
  )
);

create index if not exists idx_quiz_questions_role      on public.quiz_questions("role")       where scope = 'role';
create index if not exists idx_quiz_questions_challenge on public.quiz_questions(challenge_id) where scope = 'mission';

create table if not exists public.quiz_attempts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  team_id           uuid references public.teams(id) on delete set null,
  challenge_id      uuid not null references public.challenges(id) on delete cascade,
  phase             text not null check (phase in ('pre','post')),
  started_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  score             integer,
  total             integer not null,
  paired_attempt_id uuid references public.quiz_attempts(id) on delete set null,
  learning_gain     integer,
  constraint quiz_attempts_unique_phase unique (user_id, challenge_id, phase)
);

create index if not exists idx_quiz_attempts_user      on public.quiz_attempts(user_id);
create index if not exists idx_quiz_attempts_challenge on public.quiz_attempts(challenge_id);

create table if not exists public.quiz_attempt_questions (
  id              uuid primary key default gen_random_uuid(),
  attempt_id      uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id     uuid not null references public.quiz_questions(id) on delete restrict,
  order_index     integer not null,
  selected_index  integer,
  is_correct      boolean,
  answered_at     timestamptz,
  constraint quiz_attempt_questions_unique unique (attempt_id, order_index)
);

create index if not exists idx_qaq_attempt on public.quiz_attempt_questions(attempt_id);

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
  u.id   as user_id,
  u.name,
  u.email,
  u.current_team_id,
  u."current_role",
  u.total_active_time,
  count(tk.id)                                         as total_tasks,
  count(tk.id) filter (where tk.status = 'approved')   as approved_tasks,
  round(
    count(tk.id) filter (where tk.status = 'approved')::numeric
    / nullif(u.total_active_time, 0) * 3600,
    2
  ) as tasks_per_hour   -- proxy for execution speed
from public.users u
left join public.tasks tk on tk.submitted_by = u.id
group by u.id;

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

```

---
