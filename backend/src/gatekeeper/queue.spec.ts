/**
 * Tests for ProviderQueue (token-bucket FIFO).
 */

import { ProviderQueue } from './queue';
import { ProviderConfig } from './types';
import { GatekeeperQueueFullError } from '../common/errors/domain-errors';

const cfg = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
    name: 'monday',
    rateLimitPerMinute: 60,
    burstSize: 2,
    timeoutMs: 1000,
    maxRetries: 0,
    retryBackoffMs: 100,
    retryOnStatus: [],
    queueOverflowStrategy: 'fifo',
    maxQueueDepth: 5,
    ...overrides,
});

describe('ProviderQueue', () => {
    it('returns immediately while tokens are available', async () => {
        const q = new ProviderQueue(cfg({ burstSize: 3 }));
        const w1 = await q.acquire();
        const w2 = await q.acquire();
        expect(w1).toBe(0);
        expect(w2).toBe(0);
        expect(q.availableTokens).toBeLessThanOrEqual(1);
    });

    it('FIFO ordering when overflowing', async () => {
        const q = new ProviderQueue(cfg({ burstSize: 1, maxQueueDepth: 2 }));
        await q.acquire(); // consumes token
        const order: number[] = [];
        const p1 = q.acquire().then(() => order.push(1));
        const p2 = q.acquire().then(() => order.push(2));
        await Promise.all([p1, p2]);
        expect(order).toEqual([1, 2]);
    });

    it('drops oldest when queue overflows under fifo strategy', async () => {
        const q = new ProviderQueue(
            cfg({ burstSize: 1, maxQueueDepth: 2, rateLimitPerMinute: 6000 }),
        );
        await q.acquire(); // burn token

        const dropped = q.acquire().catch((e) => e);
        const second = q.acquire(); // pushes the queue to 2 — still under cap
        const third = q.acquire(); // overflow → drops oldest (the `dropped` promise)

        const droppedErr = await dropped;
        expect(droppedErr).toBeInstanceOf(GatekeeperQueueFullError);
        await expect(second).resolves.toBeGreaterThanOrEqual(0);
        await expect(third).resolves.toBeGreaterThanOrEqual(0);
    });

    it('reject strategy throws synchronously on overflow', async () => {
        const q = new ProviderQueue(
            cfg({ burstSize: 1, maxQueueDepth: 1, queueOverflowStrategy: 'reject' }),
        );
        await q.acquire();
        q.acquire().catch(() => undefined); // queue depth 1 (at the cap)
        await expect(q.acquire()).rejects.toBeInstanceOf(GatekeeperQueueFullError);
    });

    it('drainForShutdown rejects pending waiters', async () => {
        const q = new ProviderQueue(cfg({ burstSize: 1 }));
        await q.acquire();
        const waiting = q.acquire();
        q.drainForShutdown('test');
        await expect(waiting).rejects.toThrow('test');
    });
});
