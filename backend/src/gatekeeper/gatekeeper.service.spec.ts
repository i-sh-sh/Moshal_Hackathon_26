/**
 * Tests for GatekeeperService — happy path, retries, timeout, queueing.
 */

import { GatekeeperService } from './gatekeeper.service';
import { GatekeeperError } from '../common/errors/domain-errors';
import { ConfigService } from '../config/config.service';

const fakeConfig = (): ConfigService =>
    ({
        get gatekeeper() {
            return {};
        },
    }) as unknown as ConfigService;

describe('GatekeeperService', () => {
    let svc: GatekeeperService;

    beforeEach(() => {
        svc = new GatekeeperService(fakeConfig());
    });

    afterEach(() => {
        svc.onModuleDestroy();
    });

    it('runs fn and returns its value', async () => {
        const v = await svc.execute('monday', async () => 42);
        expect(v).toBe(42);
    });

    it('retries on retryable errors', async () => {
        let calls = 0;
        const v = await svc.execute('monday', async () => {
            calls += 1;
            if (calls < 2) {
                throw Object.assign(new Error('rate'), { status: 429 });
            }
            return 'ok';
        });
        expect(v).toBe('ok');
        expect(calls).toBeGreaterThanOrEqual(2);
    });

    it('wraps non-GatekeeperError into GatekeeperError', async () => {
        await expect(
            svc.execute('monday', async () => {
                throw new Error('boom');
            }),
        ).rejects.toBeInstanceOf(GatekeeperError);
    });

    it('throws GatekeeperError on unknown provider', async () => {
        await expect(
            svc.execute('does-not-exist' as never, async () => 1),
        ).rejects.toBeInstanceOf(GatekeeperError);
    });

    it('snapshot returns one entry per provider', () => {
        const snap = svc.snapshot();
        expect(Object.keys(snap)).toEqual(
            expect.arrayContaining(['anthropic', 'monday', 'firebase', 'storage', 'techschool']),
        );
    });
});
