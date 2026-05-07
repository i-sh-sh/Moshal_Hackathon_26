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
