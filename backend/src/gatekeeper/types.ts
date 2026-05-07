/**
 * Gatekeeper types — provider configuration, request shape, log entry.
 *
 * See docs/GATEKEEPER.md for the design rationale.
 *
 * @version 1.00
 */

export type ProviderName =
    | 'anthropic'
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
