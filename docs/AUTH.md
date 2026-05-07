# Authentication & Authorization

**Status:** local-provider design ready; Firebase + Google providers stubbed for tomorrow's credentials.

This is what makes TeamSprintUp safe to deploy to real schools. Read this before touching anything in `backend/src/auth/` or `backend/src/admin/`.

---

## Goals

- Real password authentication (no "pick a user from a list" demo mode in production).
- Token-based, stateless API — friendly to mobile clients, edge deployments, and SSR.
- Provider-agnostic — swap from local credentials to Firebase / Google SSO without touching feature code.
- Role-based access control with three account types: **student**, **teacher**, **admin**.
- Auditable — every login, password change, and admin-driven user mutation lands in `audit_logs`.

---

## Token strategy

Two tokens, two lifetimes, two storage stories:

| Token | Lifetime | Where it lives | Purpose |
|---|---|---|---|
| **Access token** (JWT, RS256/HS256) | 15 min | Authorization header (`Bearer ...`) | Authorises every API call |
| **Refresh token** (opaque, 256-bit random) | 7 days | HttpOnly secure cookie | Mints new access tokens; rotated on every use |

**Why both:** short-lived access tokens limit the blast radius of a leak; refresh tokens give users seamless continuity without re-entering passwords. Refresh tokens are stored **hashed at rest** in the `refresh_tokens` table — a database leak does not surrender live sessions.

**Rotation:** every successful refresh issues a new refresh token and revokes the old one. If a refresh token is presented after it has been rotated, we treat that as a token-theft signal and revoke the entire chain for that user.

**Revocation:** logout, password change, and admin-disable all flip `revoked_at` on every refresh token row for the user. Access tokens still work until they expire (≤ 15 min) — that's the deliberate trade-off for stateless JWTs.

---

## Provider abstraction

Every auth provider implements a single interface:

```typescript
interface AuthProvider {
  readonly name: 'local' | 'firebase' | 'google';
  verify(credentials: LoginCredentials): Promise<AuthenticatedUser>;
  register?(input: RegisterInput): Promise<AuthenticatedUser>;
}
```

The active provider is chosen at boot from `AUTH_PROVIDER` env var:

| `AUTH_PROVIDER=` | What runs | When |
|---|---|---|
| `local` | bcrypt against `users.password_hash` | **today** (default) |
| `firebase` | Firebase Admin SDK verifies an ID token from the client | tomorrow, after creds |
| `google` | OAuth 2.0 code flow via Google Identity | tomorrow, after creds |

**Important:** the rest of the app (controllers, services, guards, audit logging) does not know which provider was used. It only sees `AuthenticatedUser` after `verify()` returns.

---

## Local provider details

- **Password hashing:** bcrypt, cost factor 12. Tunable via `BCRYPT_COST` env var.
- **Brute-force protection:** failed-login counter per email; after 5 failures in 15 min, lockout for 15 min. Audit-logged.
- **Password requirements:** ≥ 8 chars, at least one letter and one digit. Enforced in `RegisterDto` via `class-validator`.
- **Self-registration:** disabled in production (`ALLOW_SELF_REGISTRATION=false`). Only admins create users via the admin API. The `/auth/register` endpoint is mounted but returns 403 unless the flag is on (useful in local dev).

---

## Firebase / Google providers (tomorrow)

Stub files exist with clear `// TODO(creds-day): wire firebase-admin` markers. The flip looks like:

```bash
# 1. Add new env vars (already declared in .env.example)
FIREBASE_SERVICE_ACCOUNT_JSON=...
FIREBASE_PROJECT_ID=...
AUTH_PROVIDER=firebase

# 2. uv-equivalent — install the SDK
cd backend && npm install firebase-admin

# 3. Implement `firebase-auth.provider.ts.verify()` — the contract is fixed
# 4. Restart. No other code changes.
```

The frontend keeps calling `POST /auth/login` either way — for Firebase we send `{ idToken }`, for local we send `{ email, password }`. The DTO's a discriminated union.

---

## Account types & RBAC

`users.account_type` is one of `student | teacher | admin`. This is **distinct from `users.current_role`** which is the in-team work role (`pm | qa | dev | hardware`). Two orthogonal axes.

| Account type | Can do |
|---|---|
| `student` | Submit tasks, request hints, see own team, see leaderboard |
| `teacher` | Everything `student` can, plus approve teacher-review tasks, see teacher analytics, kick off challenges |
| `admin` | Everything `teacher` can, plus user CRUD, team membership management, password resets, view audit logs |

Decorators:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Post('users')
createUser(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) { ... }

@Public()  // opts out of the global JwtAuthGuard during the additive-auth phase
@Post('login')
login(@Body() dto: LoginDto) { ... }
```

---

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | `@Public()` (gated by `ALLOW_SELF_REGISTRATION`) | Self-register (dev only) |
| `POST` | `/api/auth/login` | `@Public()` | Exchange credentials for token pair |
| `POST` | `/api/auth/refresh` | `@Public()` (uses refresh cookie) | Rotate refresh token, issue new access token |
| `POST` | `/api/auth/logout` | JWT | Revoke refresh token |
| `GET`  | `/api/auth/me` | JWT | Current user's profile + roles |

Admin-side user management lives under `/api/admin/users/*` — see the admin module.

---

## Migration plan (today → tomorrow)

| Stage | Auth requirement |
|---|---|
| **Today** (Phase 1) | Auth module mounted, `/api/auth/*` works. Existing `/api/tasks/*`, `/api/hints/*` etc. **stay public** so the frontend keeps working unchanged. |
| **Tomorrow** (Phase 2) | Frontend integrates `useAuth()` composable + interceptor. Once integrated, we add `@UseGuards(JwtAuthGuard)` at the module level for tasks/hints/teams. |
| **Production** | All non-`@Public()` endpoints require JWT. Self-registration disabled. CORS allowlist locked to the production origin. |

This staged approach is the reason existing controllers don't break today.

---

## Threats explicitly addressed

| Threat | Mitigation |
|---|---|
| SQL injection | Parameterised queries via porsager/postgres tagged templates — enforced project-wide |
| Password leak | bcrypt cost 12; passwords never logged; never returned in any response DTO |
| Brute force | Per-email rate limit + lockout; bot-friendly responses (consistent timing for unknown vs. wrong-password to avoid enumeration) |
| Token theft | Short access TTL (15 min) + refresh rotation + chain-revocation on rotation conflict |
| CSRF | Refresh tokens in HttpOnly+SameSite=Strict cookie; access tokens via Authorization header (not cookie) so traditional CSRF doesn't apply |
| XSS-driven token exfiltration | Refresh in HttpOnly cookie; access token in memory only (frontend should not persist to `localStorage`) |
| Privilege escalation | RolesGuard checks `account_type` from the JWT payload, which is signed at issue time. Admin promotion requires DB write + new token. |
| Audit gaps | Every auth-relevant action goes through `AuditService` |

---

## Open questions for tomorrow

- **Email delivery for password resets** — pick SES (AWS) vs. SendGrid vs. Postmark. Decide when AWS account lands.
- **MFA** — not in scope for the hackathon, but the JWT payload already includes an `mfa: boolean` claim so we can add it later without a token format change.
- **Single-school vs. multi-school** — `users.school_id` is not in scope today. If this goes to production at multiple schools, that's a Phase 3 schema change.
