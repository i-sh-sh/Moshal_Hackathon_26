# Architecture — TeamSprintUp Backend

**Status:** target shape, May 2026. Some pieces are scaffolded with mocks until external credentials land.

This document describes how the backend is organised, the layer separation we enforce, and where new code goes. If you are about to add a feature, read this first.

---

## Layered model

```
┌───────────────────────────────────────────────────────────────┐
│  HTTP layer  —  controllers, request DTOs, guards             │
│  (no business logic — translates HTTP ↔ SDK calls)            │
└─────────────────────────────┬─────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│  SDK layer (services)  —  the business rules                  │
│  Single entry point for HTTP, webhooks, CLI, future GraphQL   │
└──────┬──────────────────────────┬───────────────────────────┬─┘
       │                          │                           │
┌──────▼────────┐    ┌────────────▼────────────┐    ┌─────────▼───────┐
│  Database     │    │  Gatekeeper             │    │  Domain helpers │
│  (DbService,  │    │  (single chokepoint     │    │  (RAG, scoring, │
│  parameterised│    │   for ALL outbound      │    │   syllabus,     │
│  SQL)         │    │   API calls)            │    │   etc.)         │
└───────────────┘    └────────────┬────────────┘    └─────────────────┘
                                  │
                     ┌────────────┴────────────┐
                     │  Integration adapters   │
                     │  (interface + mock +    │
                     │   real, swapped by env) │
                     └─────────────────────────┘
                       Monday · Anthropic ·
                       Firebase · S3 · Tech School
```

**Rule:** controllers must not call the database, the gatekeeper, or third-party SDKs directly. They call a service. Services do all the work. This makes every feature reachable from any future consumer (CLI, GraphQL, webhook, scheduled job) without duplicating logic.

---

## Module map

```
backend/src/
├── main.ts                   bootstrap, global pipes, CORS, Swagger
├── app.module.ts             root composition
│
├── config/                   typed env config — single source of truth
├── common/                   shared types, errors, decorators
│
├── auth/                     login, register, JWT, refresh, RBAC
│   ├── providers/            local (bcrypt) + firebase + google stubs
│   ├── guards/               jwt-auth, roles
│   └── decorators/           @Public, @Roles, @CurrentUser
│
├── admin/                    admin user CRUD (account_type='admin' only)
│
├── gatekeeper/               outbound-call chokepoint (queue, retry, rate-limit)
│
├── integrations/             external system adapters
│   ├── monday/               (moved from src/monday/) — real GraphQL client
│   ├── ai/                   (moved from src/ai/)    — Anthropic Claude
│   ├── firebase/             stub today, real tomorrow
│   ├── storage/              stub today, S3 tomorrow
│   └── techschool/           stub today, real tomorrow
│
├── tasks/                    task pipeline (pending → approved)
├── teams/                    leaderboards, completion checks
├── users/                    user reads (writes go through admin)
├── hints/                    hint requests, billing, history
├── rag/                      hint context builder + syllabus
├── mock-monday/              teacher dashboard (Monday-style UI, not an integration)
├── webhooks/                 inbound webhook handlers (Monday)
├── db/                       postgres connection (porsager/postgres)
└── seed.ts                   demo data
```

`backend/migrations/` — numbered SQL files applied by `scripts/migrate.ts`.
`docs/` — this directory.

---

## Conventions

### Database access

- All SQL goes through `DbService.sql` (postgres tagged templates). Bind values are parameterised automatically — **never string-concatenate user input**.
- New schema changes go in `backend/migrations/NNN_description.sql`. The runner records applied migrations in a `_migrations` table.
- The original `supabase/schema.sql` stays as the v1 baseline so existing setups work; everything new is migration-on-top.

### External calls

- Every outbound HTTP / SDK call goes through `GatekeeperService.execute(providerName, fn)`. Direct `fetch` or SDK calls from a service are a code smell.
- See [`GATEKEEPER.md`](GATEKEEPER.md) for the rate-limit / retry / queue policy.

### Integrations

- Each external system has an interface, a mock implementation, and a real implementation. The active one is selected by an env var (`MONDAY_PROVIDER=mock|real`, etc.).
- See [`INTEGRATIONS.md`](INTEGRATIONS.md) for what's mocked today and tomorrow's swap procedure.

### Configuration

- All config is read once into a typed `AppConfig` object in `src/config/app-config.ts`. Services inject `ConfigService` and read typed properties. Direct `process.env.X` reads outside `config/` are a code smell.
- Required vars are validated at boot — the app refuses to start if anything is missing.

### Auth & authorization

- See [`AUTH.md`](AUTH.md). Briefly: JWT access (15 min) + hashed refresh tokens (7 d, rotated on use). Three account types: `student`, `teacher`, `admin`. RBAC via `@Roles()` decorator.
- During the additive-auth phase, existing routes stay public. Once frontend integrates login, we add `@UseGuards(JwtAuthGuard)` to the modules that need it.

### Errors

- Use NestJS HTTP exceptions (`UnauthorizedException`, `ForbiddenException`, etc.) at the boundary. Domain-specific errors live in `src/common/errors/`.

### Logging

- Use NestJS `Logger`. Structured log lines for outbound calls go through the gatekeeper, not ad-hoc.
- Audit-logable actions (login, user created, task approved, hint over free limit) write to `audit_logs` via `AuditService`.

### Versioning

- Each module carries a `version` constant starting at `'1.00'` so we can grep for module-level changes during reviews.

### File size

- Aim small (≤150 LOC excluding blanks/comments) for new modules. When splitting, extract helpers, constants, or mixins — never compress to fit.
- Existing files (`tasks.service.ts`, `seed.ts`) exceed this; we don't refactor them just for the cap.

---

## Frontend contract

The frontend (Nuxt 3) consumes the backend over HTTP only. Every endpoint is prefixed `/api`. The contract for new endpoints is published via Swagger at `/api/docs`. When adding an endpoint:

1. Define request/response DTOs with `class-validator` decorators.
2. Add `@nestjs/swagger` decorators so the spec stays accurate.
3. Coordinate the matching composable in `frontend/composables/` and the type in `frontend/types/types.ts` — there is no codegen.

---

## Data flow examples

**Student requests a hint** — `HintsController.requestHint` → `HintsService.requestHint` → `RagService.buildContext` (DB reads) → `AIService.generateHint` → `GatekeeperService.execute('anthropic', ...)` → Anthropic SDK → score deduction RPC → `audit_logs` write → response.

**Teacher approves a task in the simulator** — `MockMondayController.approve` → `MockMondayService.approveTask` → `TasksService.teacherApprove` → DB update → `TeamsService.checkAndCompleteTeam` → optional sprint advance. The exact same `TasksService.teacherApprove` is invoked by the real Monday webhook in `webhooks/monday.controller.ts` — one code path, two triggers.

**Admin creates a user** — `AdminController.createUser` → `RolesGuard` (must be admin) → `AdminService.createUser` → `LocalAuthProvider.hashPassword` → DB insert → `audit_logs` write → response with the new user (no password hash echoed).
