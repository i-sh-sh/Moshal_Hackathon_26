# Integrations — Adapter Pattern

**Status:** Monday + Anthropic are real (controlled by env-set tokens). Firebase, S3, Tech School are stubbed; ready for tomorrow's credentials.

This document explains how external systems are abstracted and how to flip a stub to a real implementation when credentials arrive.

---

## The pattern

For every external system we depend on:

```
backend/src/integrations/<provider>/
├── <provider>.module.ts        Picks the active impl based on env
├── <provider>.interface.ts     Contract — what our app expects
├── <provider>.mock.ts          Self-contained fake; default in dev
└── <provider>.real.ts          Hits the real third party (TODO until creds land)
```

`<provider>.module.ts` reads the relevant env var and binds the interface token to either the mock or the real class:

```typescript
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useClass: process.env.STORAGE_PROVIDER === 'real'
        ? S3StorageProvider
        : MockStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
```

Services inject `@Inject(STORAGE_PROVIDER) private storage: StorageProvider` and never know which one they got.

**Critical rule:** real implementations call **through `GatekeeperService`** for every outbound request. They never bypass it.

---

## Inventory

| Provider | Status | What it does | Env switch |
|---|---|---|---|
| `monday` | **real available** (gracefully no-ops if `MONDAY_API_TOKEN` unset) | GraphQL mutations to push status changes back to Monday boards | `MONDAY_API_TOKEN` |
| `anthropic` | **real available** | Hint generation, text analysis (Claude) | `ANTHROPIC_API_KEY` |
| `firebase` | **stubbed** | Verifies Firebase ID tokens for the Firebase auth provider | `FIREBASE_PROVIDER=mock\|real` + service account JSON |
| `storage` | **stubbed** | File uploads (task submissions, profile pictures) | `STORAGE_PROVIDER=mock\|real` + AWS creds |
| `techschool` | **stubbed** | Pulls mission/lesson metadata from the Tech School LMS | `TECHSCHOOL_PROVIDER=mock\|real` + API base URL + token |

---

## Tomorrow's swap procedure (per integration)

When credentials for X arrive:

1. **Add the env vars** to `backend/.env` (real values) and `backend/.env.example` (placeholder + comment). Don't commit the real values.
2. **Install the SDK** if not already in `package.json`. (`firebase-admin`, `@aws-sdk/client-s3`, etc.)
3. **Implement the real adapter** — replace the `// TODO(creds-day):` block in `<provider>.real.ts` with the actual SDK call. Wrap every outbound call in `gatekeeper.execute('<provider>', () => sdkCall())`.
4. **Flip the env switch** — `<PROVIDER>_PROVIDER=real`.
5. **Update the smoke test** — every real adapter has a `<provider>.real.spec.ts` that runs only when `INTEGRATION_TESTS=1` is set, hitting a sandbox account.
6. **Deploy.** Mock keeps working as a fallback if the env var is unset.

This is a < 1-hour task per provider once SDKs and creds are in hand.

---

## Per-integration details

### Monday (`integrations/monday/`)

**Real client exists.** Currently lives at `src/monday/monday-api.service.ts` — moving to `src/integrations/monday/monday.real.ts` as part of the Day-0 refactor. The current implementation:

- Uses GraphQL via raw `fetch`.
- Already gracefully no-ops when `MONDAY_API_TOKEN` is missing — that becomes the mock behaviour.
- Will be wrapped by the gatekeeper for rate limiting and retries.

**Mock impl:** logs the call and returns a synthetic item ID. Useful for local dev without a Monday workspace.

### Anthropic (`integrations/ai/`)

**Real client exists.** Currently lives at `src/ai/ai.service.ts` — moving to `src/integrations/ai/ai.service.ts`. Wrapped by the gatekeeper.

The two domain methods (`generateHint`, `analyze`) stay on the same class — they're both Claude calls with different prompts.

**Mock impl:** returns a deterministic fake hint based on hint number for offline development.

### Firebase (`integrations/firebase/`)

**Status:** stub.

**Interface:**
```typescript
export interface FirebaseProvider {
  verifyIdToken(token: string): Promise<{ uid: string; email: string; emailVerified: boolean }>;
}
```

**Mock:** parses `mock-uid:<email>` tokens for tests.

**Real (tomorrow):** `firebase-admin` initialised with the service account JSON, calling `auth().verifyIdToken(token)`.

Used by `FirebaseAuthProvider` in the auth module — see [`AUTH.md`](AUTH.md).

### Storage (`integrations/storage/`)

**Status:** stub.

**Interface:**
```typescript
export interface StorageProvider {
  uploadFile(input: { key: string; contentType: string; body: Buffer }): Promise<{ url: string }>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteFile(key: string): Promise<void>;
}
```

**Mock:** writes to `./tmp/uploads/` and serves them from a static route in dev.

**Real (tomorrow):** AWS S3 via `@aws-sdk/client-s3`. Bucket per environment, signed URLs for download.

Used today by: nothing yet (task submissions still take a `submission_url` string from the user). Used tomorrow when we add file-upload support to task submission.

### Tech School (`integrations/techschool/`)

**Status:** stub.

**Interface:**
```typescript
export interface TechSchoolProvider {
  listMissions(filters: { ageGroup?: string; topic?: string }): Promise<TechSchoolMission[]>;
  getMission(id: string): Promise<TechSchoolMission>;
}

export interface TechSchoolMission {
  id: string;
  title: string;
  description: string;
  englishTerms: string[];
  difficulty: 1 | 2 | 3;
  estimatedMinutes: number;
}
```

**Mock:** returns 5 fixture missions covering the three sprint themes (gift / games / branding) — enough to drive the hint RAG system in offline mode.

**Real (tomorrow):** HTTP client against the Tech School demo API. Auth via API key in header. Wrapped by gatekeeper.

Used by: nothing yet. Future use: replacing the static `rag/syllabus.ts` with live syllabus pulls.

---

## What if creds never arrive?

For the hackathon, every flow that matters has a working mock. We can demo end-to-end with `STORAGE_PROVIDER=mock`, `FIREBASE_PROVIDER=mock`, `TECHSCHOOL_PROVIDER=mock` and `MONDAY_API_TOKEN` unset — the real Monday webhook receiver still works (it's incoming traffic), and the simulator board (`mock-monday/`) covers the teacher experience.

For production, every mock is fine to leave as a fallback. They write loud `[MOCK]` log lines so it's obvious in production logs if something is misconfigured.

---

## Why `mock-monday/` is not in this directory

`backend/src/mock-monday/` is **not** an integration adapter. It's a teacher-facing dashboard implemented as a Monday-style UI to fill the gap until the real Monday workspace is provisioned. It reads and writes our own database; it does not pretend to be Monday over the wire.

When the real Monday workspace is fully wired (post-hackathon), `mock-monday/` can probably be retired — the teacher uses the real Monday UI, and our backend only sees the inbound webhook.
