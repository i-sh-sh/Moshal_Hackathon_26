/**
 * Tests for retry helper.
 */

import { nextDelayMs, shouldRetry, withRetry } from './retry';
import { ProviderConfig } from './types';

const cfg: ProviderConfig = {
    name: 'monday',
    rateLimitPerMinute: 60,
    burstSize: 1,
    timeoutMs: 1000,
    maxRetries: 2,
    retryBackoffMs: 10,
    retryOnStatus: [429, 503],
    queueOverflowStrategy: 'fifo',
    maxQueueDepth: 5,
};

describe('shouldRetry', () => {
    it('retries on listed HTTP status', () => {
        const err = Object.assign(new Error('rate'), { status: 429 });
        expect(shouldRetry(err, cfg)).toBe(true);
    });
    it('does not retry on 400', () => {
        const err = Object.assign(new Error('bad'), { status: 400 });
        expect(shouldRetry(err, cfg)).toBe(false);
    });
    it('retries on network errors', () => {
        const err = Object.assign(new Error('reset'), { code: 'ECONNRESET' });
        expect(shouldRetry(err, cfg)).toBe(true);
    });
});

describe('nextDelayMs', () => {
    it('honours Retry-After when present', () => {
        const err = Object.assign(new Error('429'), { retryAfterSeconds: 2 });
        expect(nextDelayMs(1, cfg, err)).toBe(2000);
    });
    it('exponential backoff with jitter, bounded above by 2^(n-1) * base', () => {
        for (let i = 0; i < 50; i += 1) {
            const d = nextDelayMs(3, cfg);
            expect(d).toBeGreaterThanOrEqual(0);
            expect(d).toBeLessThanOrEqual(cfg.retryBackoffMs * 4);
        }
    });
});

describe('withRetry', () => {
    it('returns value on first try when no error', async () => {
        const r = await withRetry(async () => 'ok', cfg);
        expect(r.value).toBe('ok');
        expect(r.attempts).toBe(1);
    });
    it('retries up to maxRetries+1 attempts on retryable errors', async () => {
        let calls = 0;
        const r = await withRetry(async () => {
            calls += 1;
            if (calls < 3) {
                throw Object.assign(new Error('429'), { status: 429 });
            }
            return 'ok';
        }, cfg);
        expect(r.attempts).toBe(3);
        expect(r.value).toBe('ok');
    });
    it('rethrows non-retryable error immediately', async () => {
        let calls = 0;
        await expect(
            withRetry(async () => {
                calls += 1;
                throw Object.assign(new Error('bad'), { status: 400 });
            }, cfg),
        ).rejects.toThrow('bad');
        expect(calls).toBe(1);
    });
});
