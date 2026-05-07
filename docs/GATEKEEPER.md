# Gatekeeper — Outbound API Chokepoint

**Status:** designed; implementation scheduled for Day 0 (today).

Every outbound HTTP call and every external SDK call from the backend goes through `GatekeeperService`. No exceptions. This document explains why and what the contract is.

---

## Why a single chokepoint

Without a gatekeeper, every service that talks to a third party reinvents:

- Rate-limit handling (429s)
- Retry with backoff
- Timeouts
- Circuit-breaking on outages
- Structured logging
- Cost / quota observability

Each reinvention is slightly different, and we end up with sprawling, untestable HTTP code. A central gatekeeper:

- Lets us tune per-provider behaviour from one config file.
- Makes outbound traffic observable in one place — logs, metrics, error counts.
- Provides a natural insertion point for a FIFO queue when we exceed a provider's rate limit, instead of dropping requests on the floor.
- Makes mocking trivial in tests — replace the gatekeeper, and no service notices.

---

## Contract

```typescript
@Injectable()
class GatekeeperService {
  /**
   * Run `fn` against the named provider. Handles rate limiting,
   * retries, timeouts, structured logging, and FIFO queueing on overflow.
   *
   * @throws  GatekeeperError on permanent failure (final retry exhausted,
   *          provider misconfigured, request never reaches provider)
   */
  execute<T>(providerName: ProviderName, fn: () => Promise<T>): Promise<T>;
}
```

That's the only entry point. Services do not call `fetch`, `axios`, or any third-party SDK directly. They wrap the call:

```typescript
// in AIService
async generateHint(ctx: HintContext): Promise<string> {
  const response = await this.gatekeeper.execute('anthropic', () =>
    this.client.messages.create({ model: this.model, ... }),
  );
  return extractText(response);
}
```

---

## Per-provider configuration

Each provider has a static config (in `gatekeeper/providers.config.ts`) that controls its policy:

```typescript
type ProviderConfig = {
  name: ProviderName;
  rateLimitPerMinute: number;   // token bucket capacity
  burstSize: number;            // initial tokens
  timeoutMs: number;            // hard timeout per attempt
  maxRetries: number;
  retryBackoffMs: number;       // base for exponential backoff
  retryOnStatus: number[];      // e.g. [429, 502, 503, 504]
  queueOverflowStrategy: 'fifo' | 'reject';
};
```

Tentative defaults:

| Provider | RPM | Timeout | Retries | Notes |
|---|---|---|---|---|
| `anthropic` | 50 | 30 s | 2 | Hint generation; long timeout for long completions |
| `monday` | 60 | 10 s | 3 | GraphQL mutations; idempotent updates |
| `firebase` | 600 | 5 s | 1 | Token verification; should fail fast |
| `s3` | 200 | 30 s | 3 | Uploads can be slow |
| `techschool` | 30 | 10 s | 2 | LMS read; conservative until we know real limits |

These are tuneable from `app-config.ts` via env override (e.g. `GATEKEEPER_ANTHROPIC_RPM=100`).

---

## Queue + rate-limit behaviour

We use a **token-bucket** rate limiter per provider:

- Bucket fills at `rateLimitPerMinute / 60` tokens per second.
- Each `execute()` call consumes one token.
- If no token is available, the request is enqueued in a per-provider FIFO and waits.
- The FIFO is drained as tokens become available.
- If queue depth exceeds a hard cap (default 100), behaviour follows `queueOverflowStrategy`:
  - `fifo` — reject the oldest (default; protects callers from unbounded latency).
  - `reject` — reject the new request immediately with `GatekeeperError('queue_full')`.

**Why FIFO over rejection-by-default:** the professor's rules call this out specifically — fairness matters when one client (a teacher kicking off a challenge) is making lots of dependent calls, you don't want a later-arriving QA review to leapfrog it.

**In-memory only.** This is a hackathon-scale system; we run a single instance. If we scale to multiple instances, the queue moves to Redis. The interface doesn't change.

---

## Retry policy

Exponential backoff with jitter:

```
attempt N delay = retryBackoffMs * 2^(N-1) + random(0, retryBackoffMs)
```

Retries trigger on:
- Network errors (DNS, connection reset, timeout).
- HTTP statuses in `retryOnStatus` (default: 429, 502, 503, 504).

Retries do **not** trigger on:
- 4xx other than 429 (caller's fault, retrying won't help).
- 5xx other than configured ones (defensive — we don't auto-retry destructive calls on 500).

If 429 returns a `Retry-After` header, we honour it instead of using our backoff formula.

---

## Logging

Every `execute()` produces one structured log entry:

```json
{
  "evt": "gatekeeper.call",
  "provider": "anthropic",
  "duration_ms": 1240,
  "attempts": 1,
  "outcome": "ok",
  "queue_wait_ms": 0,
  "request_id": "..."
}
```

On failure:

```json
{
  "evt": "gatekeeper.call",
  "provider": "monday",
  "duration_ms": 8002,
  "attempts": 3,
  "outcome": "error",
  "error_class": "TimeoutError",
  "error_msg": "...",
  "request_id": "..."
}
```

These ride on top of NestJS's `Logger` so they show up in Render / Railway logs without extra work.

---

## What does NOT go through the gatekeeper

- **Database calls** — `DbService.sql` is intra-VPC and has its own pooling. Wrapping it would add latency for nothing.
- **In-process work** — bcrypt, JWT signing, RAG context assembly. Not network calls.
- **Inbound webhooks** — by definition, the other side called us. We log them in the controller; nothing to gate.

---

## Testing

`GatekeeperService` is itself trivially testable: pass a `fn` that returns a fixed value, assert the value comes back; pass a `fn` that throws 429s, assert retries; pass many `fn`s to a provider with RPM=10, assert FIFO ordering.

Services that depend on the gatekeeper inject a fake in their unit tests — see `auth.service.spec.ts` and `ai.service.spec.ts` for the pattern.

---

## Migration plan

Day 0 (today):
1. Build `GatekeeperService` + queue + retry.
2. Refactor `MondayApiService` to wrap its `fetch` call.
3. Refactor `AIService` to wrap its Anthropic SDK calls.
4. Add unit tests covering happy / 429 / queue-overflow paths.

Day 1+ (when integrations land):
- Firebase, S3, Tech School adapters use the gatekeeper from day one.
