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
