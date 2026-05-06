# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TeamSprintUp — a hi-tech-workplace simulation for students. Teams act as PM / QA / Dev / Hardware, push tasks through an approval pipeline, and request AI-generated hints. A teacher dashboard mimics Monday.com to drive challenges.

The Hebrew `README.md` is the authoritative product spec — it is more detailed than this file and mostly up to date, but **be aware it is partly stale on the storage layer** (see "Important divergences" below).

## Stack & layout

Three top-level pieces, deployed independently:

```
backend/    NestJS 10 (TypeScript)        port 3001 — API only
frontend/   Nuxt 3 (Vue 3) + Tailwind     port 3000 — SSR app
supabase/   schema.sql                    DB schema (also used with Neon)
```

`project-structure.json` is a generated snapshot — do not hand-edit; it will drift.

## Common commands

Backend (`cd backend`):
```bash
npm install
npm run start:dev      # nest start --watch
npm run start:prod     # node dist/main (after `npm run build`)
npm run build          # nest build → dist/
npm run seed           # ts-node src/seed.ts — idempotent, safe to re-run
npm run format         # prettier
```

Frontend (`cd frontend`):
```bash
npm install
npm run dev            # nuxt dev — http://localhost:3000
npm run build
npm run generate
npm run preview
```

There is **no test runner, no linter, and no CI configured** in either workspace. Don't invent test commands.

## Architecture — the parts that span files

### Task state machine (the core domain)

Single status column on `tasks` drives everything. Transitions live in `backend/src/tasks/tasks.service.ts`; each transition both checks the user's `current_role` against the allowed roles and mutates status:

```
pending ──submitTask (dev|hardware)──▶ qa_review
qa_review ──qaReview approve (qa)────▶ pm_review
qa_review ──qaReview reject (qa)─────▶ pending
pm_review ──pmReview approve (pm)────▶ teacher_review   (+ Monday push, GREEN_LED log)
pm_review ──pmReview reject  (pm)────▶ qa_review
teacher_review ──teacherApprove──────▶ approved         (+ team-completion check)
```

`teacherApprove` is the only transition with no role check — it is invoked either by the real Monday webhook (`webhooks/`) or by the teacher simulator (`mock-monday/`). Both call the **same** `TasksService.teacherApprove`; the simulator is purely a different trigger, not a different code path. When changing approval logic, change it once.

After `approved`, `TeamsService.checkAndCompleteTeam` runs: if every task in the sprint is `approved`, the team's `is_completed` flips and the next sprint becomes available.

### Hints — RAG → Claude → score deduction

`HintsService.requestHint` (`backend/src/hints/hints.service.ts`):

1. `RagService.buildContext` assembles task + syllabus (`rag/syllabus.ts`, keyed by sprint UUID, falls back to `GENERIC_SYLLABUS`) + team progress + hint number.
2. `AIService.generateHint` calls Claude (`@anthropic-ai/sdk`, model `claude-sonnet-4-6`) with depth conditioned on hint number: 1 = nudge, 2 = name the tool, 3+ = concrete step.
3. First 3 hints per (user, team) are free; hint #4 onward calls SQL function `deduct_team_score(team_id, 10)` and writes `points_deducted = 10` on the row.
4. Every call is logged in `hint_logs`; `team_hint_counters` (unique on user_id+team_id) holds the running count and resets per team.

Constants `FREE_HINTS = 3` and `POINTS_PER_EXTRA_HINT = 10` are in-file — change there if the rule changes.

### Module wiring

`AppModule` (`backend/src/app.module.ts`) imports modules in dependency order; `DbModule` is `@Global` so `DbService` is injectable everywhere without re-exporting. `TasksModule` imports `TeamsModule` and `MondayApiModule` — additions like score side-effects belong in `TeamsService`, not in `TasksService`.

### Bootstrapping

`backend/src/main.ts`:
- Global API prefix `/api` — every controller path is prefixed automatically; do not hardcode `/api` in controllers.
- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` — DTOs must declare every accepted field with `class-validator` decorators or requests are rejected.
- CORS allowlist comes from `CORS_ORIGINS` (comma-separated); defaults to `http://localhost:3000`.

### Frontend ↔ backend contract

- `frontend/types/types.ts` is the shared TypeScript shape. The codebase has no codegen — when a backend DTO changes, **manually update `types.ts` and any `useX` composable that consumes it**.
- All HTTP calls funnel through composables (`useUser`, `useTasks`, `useLeaderboard`); pages do not call `$fetch` directly. Add new endpoints there, not inline in components.
- Base URL comes from `runtimeConfig.public.apiBaseUrl` (env: `NUXT_PUBLIC_API_BASE_URL`), default `http://localhost:3001/api`.
- Session is held in `localStorage` via `useUser` (`useState` + `onMounted` sync) — there is no auth on the backend, the user id comes in request bodies. Any new mutation endpoint must include `userId` and validate role via `TasksService.assertUserRole`-style checks.

### Database access

- Backend uses **`postgres` (porsager/postgres)** via `DbService` (`backend/src/db/db.service.ts`), reading `DATABASE_URL` with `ssl: 'require'`. Queries are written as tagged-template SQL; bind values get parameterised automatically — **never string-concatenate user input into the template**.
- `supabase/schema.sql` contains tables, views (`group_leaderboard`, `individual_leaderboard`, `teacher_analytics`), the `deduct_team_score` function, and RLS policies. The same SQL is applied to a Supabase project or a Neon DB depending on the deploy target.
- RLS exists in the schema but the backend uses a privileged connection that bypasses it. The frontend never talks to the DB directly — only the backend does — so RLS is currently belt-and-suspenders, not enforced by the running stack.

## Important divergences (don't get tripped up)

- **README says "Supabase" / `src/supabase/`. The actual backend uses Neon (or any Postgres) via `src/db/`.** The `.env.example` and `DEPLOYMENT.md` are correct — the env var is `DATABASE_URL`, not `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`. The README's env section is out of date; trust `backend/.env.example`.
- Two deploy guides exist and target different stacks: `DEPLOY.md` (Railway + Vercel + Supabase) and `DEPLOYMENT.md` (Render + Netlify + Neon). `DEPLOYMENT.md` matches the current code (`DATABASE_URL`, `netlify.toml`, `render.yaml`). Prefer it.
- The README enumerates a Monday-related env var (`MONDAY_API_TOKEN`) that the real Monday integration needs; for the demo path the simulator (`mock-monday/`) is sufficient and Monday calls become no-ops.

## Environment

`backend/.env` (see `backend/.env.example`):
- `DATABASE_URL` — Postgres connection string with `?sslmode=require`
- `ANTHROPIC_API_KEY` — required for hints + analysis
- `CORS_ORIGINS` — comma-separated frontend origins
- `MONDAY_API_TOKEN`, `MONDAY_WEBHOOK_SECRET` — only needed for real Monday, optional for the simulator
- `PORT` — default 3001

`frontend/.env`:
- `NUXT_PUBLIC_API_BASE_URL` — must end in `/api`
- `NITRO_PRESET=netlify` for Netlify deploys (see `netlify.toml`)

## Conventions worth preserving

- The codebase uses **4-space indentation** in TypeScript (both backend and frontend). Match it; Prettier is configured implicitly through `format` but no config file is checked in.
- Hebrew strings appear in user-facing copy and in some doc comments. Don't translate them when editing surrounding code.
- Logger lines like `[HARDWARE_EVENT] GREEN_LED on | ...` in `tasks.service.ts` are intentional demo signals (they're the integration point for a physical hardware mockup) — keep them when refactoring.
