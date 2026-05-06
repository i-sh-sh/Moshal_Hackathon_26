# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TeamSprintUp — a hi-tech-workplace simulation for students. Teams act as PM / QA / Dev / Hardware, push tasks through an approval pipeline, and request AI-generated hints. A teacher dashboard mimics Monday.com to drive challenges.

The Hebrew `README.md` is the original product spec — useful but partially out of date on tooling (e.g. it talks about Supabase; the running stack is Postgres via porsager/postgres on Neon). For backend architecture, prefer `docs/`.

## Stack & layout

```
backend/                     NestJS 10 (TypeScript) — port 3001 — API only
frontend/                    Nuxt 3 (Vue 3) + Tailwind — port 3000 — SSR app
supabase/schema.sql          v1 baseline DB schema (also used with Neon)
backend/migrations/          Numbered SQL migrations applied on top of the baseline
docs/                        Architecture docs — read these before changing modules
```

`project-structure.json` is a generated snapshot — do not hand-edit.

## Common commands

Backend (`cd backend`):
```bash
npm install
npm run migrate         # apply pending SQL migrations
npm run seed            # idempotent demo data (8 students + 1 teacher + 1 admin)
npm run start:dev       # nest start --watch — http://localhost:3001/api
npm run start:prod      # node dist/main (after `npm run build`)
npm run build           # tsc + nest build
npm run test            # jest
npm run test:cov        # jest with coverage
npm run lint            # eslint
npm run format          # prettier
```

Frontend (`cd frontend`):
```bash
npm install
npm run dev             # nuxt dev — http://localhost:3000
npm run build
```

## Architecture — start here

Read `docs/ARCHITECTURE.md` for the full picture. The four key invariants:

1. **Layered**. Controllers do HTTP only. Services hold business logic and form an SDK that any consumer (HTTP, webhooks, CLI, future GraphQL) calls. Direct DB or external-API calls from controllers are forbidden.
2. **Gatekeeper-first**. Every outbound HTTP / SDK call goes through `GatekeeperService.execute(provider, fn)`. It owns rate limiting (token bucket), FIFO queue overflow, retries (exp backoff + jitter), and structured logging. See `docs/GATEKEEPER.md`.
3. **Integrations are mock-first**. External systems (Monday, Anthropic, Firebase, S3, Tech School) are abstracted behind `interface + mock + real` adapters. The active impl is selected by env var. The mocks let the whole stack run with zero external creds. See `docs/INTEGRATIONS.md`.
4. **Auth is provider-agnostic**. `LocalAuthProvider` (bcrypt + JWT + refresh) is the default. `FirebaseAuthProvider` and `GoogleOAuthProvider` are stubs filled in when creds arrive. RBAC via `account_type` ∈ `student|teacher|admin`. See `docs/AUTH.md`.

## Module map (backend/src/)

```
config/             Typed env config (loadAppConfig + ConfigService) — single source
common/             Shared types, decorators (@Public, @Roles, @CurrentUser), errors
audit/              AuditLogService — append-only record of security-relevant actions
gatekeeper/         Outbound-call chokepoint (queue + retry + per-provider config)
auth/               Login, register, refresh, logout. JWT + refresh tokens. Provider abstraction.
admin/              Admin user CRUD (account_type='admin' only). Audited. Revokes sessions on security changes.
activity/           Heartbeat + login hook for total_active_time tracking
integrations/
    ai/             Anthropic Claude (real, gracefully no-ops without key)
    monday/         Monday GraphQL client (real, no-ops without token)
    firebase/       Stub today; firebase-admin tomorrow
    storage/        Mock writes to ./tmp/uploads; S3 tomorrow
    techschool/     Fixture missions today; LMS API tomorrow
tasks/              Task pipeline (pending → ... → approved)
teams/              Leaderboards, completion checks
users/              Read-only user listing (writes go through admin)
hints/              Hint requests, billing, history
rag/                Hint context builder + Hebrew/English syllabus
mock-monday/        Teacher dashboard pretending to be Monday — NOT an integration adapter
webhooks/           Inbound webhook handlers (Monday)
db/                 Postgres connection (porsager/postgres, parameterised SQL)
seed.ts             Demo data — bcrypt-hashed shared password
migrate.ts          Migration runner — `npm run migrate`
```

## Conventions

- **No `process.env.X` outside `config/`**. Inject `ConfigService` and read typed properties.
- **No direct `fetch` / SDK calls outside `gatekeeper.execute(...)`**. Add a new provider in `gatekeeper/providers.config.ts` if needed.
- **All SQL via `db.sql` tagged templates**. Never string-concatenate user input. `db.sql.unsafe` is allowed only for column-name interpolation against a closed allowlist (see `admin.service.ts`).
- **DTOs declare every accepted field** with `class-validator` decorators — `forbidNonWhitelisted: true` is on, so unlisted fields are rejected.
- **New modules carry a `@version` constant** at the top so `version: "1.00"` propagates per the team's coding rules.
- **4-space indentation** throughout. Configured in `.prettierrc`.
- **Hebrew strings stay Hebrew.** They appear in user-facing copy (especially `rag/syllabus.ts` and AI prompts) — don't translate when refactoring around them.
- **The `[HARDWARE_EVENT] GREEN_LED on | ...` log line in `tasks.service.ts`** is intentional — it's the hardware-integration trigger.

## Auth migration phase

Right now (Day 0): `/api/auth/*` and `/api/admin/*` and `/api/activity/*` are mounted, but the existing controllers (`/api/tasks/*`, `/api/hints/*`, `/api/teams/*`, etc.) **stay public** so the frontend keeps working unchanged. Tomorrow, the frontend will integrate the JWT flow and we will add `@UseGuards(JwtAuthGuard)` to the controllers that need it.

## Frontend contract

The frontend talks to the backend over HTTP only. Live API spec at `/api/docs` (Swagger). When adding endpoints:

1. Define DTOs with `class-validator` + `@nestjs/swagger` decorators.
2. Update the matching `frontend/composables/useX.ts` and the type in `frontend/types/types.ts` — there is no codegen.

## Demo accounts

After `npm run seed`, every account has password `demo1234` (override with `SEED_DEMO_PASSWORD`):
- `admin@techschool.demo` — admin (full user CRUD)
- `teacher@techschool.demo` — teacher
- 8 students split between `Team Alpha` and `Team Beta` (yael/david/noa/ariel and maya/omer/lior/tal)
