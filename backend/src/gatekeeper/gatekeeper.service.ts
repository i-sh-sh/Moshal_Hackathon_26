/**
 * GatekeeperService — the single chokepoint for outbound API calls.
 *
 * Every outbound HTTP / SDK call from the backend goes through
 * `gatekeeper.execute(provider, fn)`. The service applies:
 *   - per-provider FIFO queue with token-bucket rate limiting
 *   - per-attempt timeout
 *   - exponential-backoff retries with jitter
 *   - structured log line per call
 *
 * See docs/GATEKEEPER.md for the design.
 *
 * @version 1.00
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
    GatekeeperError,
    GatekeeperTimeoutError,
} from '../common/errors/domain-errors';
import { ConfigService } from '../config/config.service';
import { ProviderQueue } from './queue';
import { withRetry } from './retry';
import {
    DEFAULT_PROVIDER_CONFIGS,
    applyOverrides,
} from './providers.config';
import { ProviderConfig, ProviderName } from './types';

@Injectable()
export class GatekeeperService implements OnModuleDestroy {
    private readonly logger = new Logger(GatekeeperService.name);
    private readonly queues: Map<ProviderName, ProviderQueue> = new Map();
    private readonly configs: Readonly<Record<ProviderName, ProviderConfig>>;

    constructor(private readonly config: ConfigService) {
        this.configs = applyOverrides(DEFAULT_PROVIDER_CONFIGS, this.config.gatekeeper);
        for (const name of Object.keys(this.configs) as ProviderName[]) {
            this.queues.set(name, new ProviderQueue(this.configs[name]));
        }
    }

    /**
     * Run `fn` against the named provider. Resolves with `fn`'s value or
     * rejects with a {@link GatekeeperError} if all retries are exhausted.
     */
    async execute<T>(provider: ProviderName, fn: () => Promise<T>): Promise<T> {
        const cfg = this.configs[provider];
        if (!cfg) throw new GatekeeperError(`unknown provider "${provider}"`);
        const queue = this.queues.get(provider)!;
        const startedAt = Date.now();

        let queueWaitMs = 0;
        let attempts = 0;
        try {
            queueWaitMs = await queue.acquire();
            const wrapped = (): Promise<T> => this.withTimeout(provider, cfg.timeoutMs, fn);
            const result = await withRetry(wrapped, cfg);
            attempts = result.attempts;
            this.logCall(provider, startedAt, attempts, 'ok', queueWaitMs);
            return result.value;
        } catch (err) {
            this.logCall(
                provider,
                startedAt,
                Math.max(1, attempts),
                'error',
                queueWaitMs,
                err,
            );
            if (err instanceof GatekeeperError) throw err;
            throw new GatekeeperError(
                (err as Error).message ?? 'unknown error',
                provider,
            );
        }
    }

    private async withTimeout<T>(
        provider: ProviderName,
        ms: number,
        fn: () => Promise<T>,
    ): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new GatekeeperTimeoutError(provider)), ms);
        });
        try {
            return await Promise.race([fn(), timeout]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    private logCall(
        provider: ProviderName,
        startedAt: number,
        attempts: number,
        outcome: 'ok' | 'error',
        queueWaitMs: number,
        err?: unknown,
    ): void {
        const e = err as Error | undefined;
        const entry = {
            evt: 'gatekeeper.call',
            provider,
            durationMs: Date.now() - startedAt,
            attempts,
            outcome,
            queueWaitMs,
            ...(e && { errorClass: e.name, errorMsg: e.message }),
        };
        if (outcome === 'ok') this.logger.log(JSON.stringify(entry));
        else this.logger.warn(JSON.stringify(entry));
    }

    /** Inspect-only — useful for /health and tests. */
    snapshot(): Record<string, { pending: number; tokens: number }> {
        const out: Record<string, { pending: number; tokens: number }> = {};
        for (const [name, q] of this.queues) {
            out[name] = { pending: q.pendingCount, tokens: q.availableTokens };
        }
        return out;
    }

    onModuleDestroy(): void {
        for (const q of this.queues.values()) q.drainForShutdown('app shutting down');
    }
}
