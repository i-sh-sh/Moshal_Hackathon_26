/**
 * Per-provider gatekeeper policy.
 *
 * Tuneable via env vars (see app-config.ts) — these are the defaults used
 * when no override is set.
 *
 * @version 1.00
 */

import { ProviderConfig, ProviderName } from './types';

const def = (
    name: ProviderName,
    overrides: Partial<ProviderConfig>,
): ProviderConfig => ({
    name,
    rateLimitPerMinute: 60,
    burstSize: 10,
    timeoutMs: 30_000,
    maxRetries: 2,
    retryBackoffMs: 500,
    retryOnStatus: [429, 502, 503, 504],
    queueOverflowStrategy: 'fifo',
    maxQueueDepth: 100,
    ...overrides,
});

export const DEFAULT_PROVIDER_CONFIGS: Readonly<Record<ProviderName, ProviderConfig>> = {
    azure:      def('azure',      { rateLimitPerMinute: 60, timeoutMs: 30_000, maxRetries: 2 }),
    monday:     def('monday',     { rateLimitPerMinute: 60, timeoutMs: 10_000, maxRetries: 3 }),
    firebase:   def('firebase',   { rateLimitPerMinute: 600, timeoutMs: 5_000, maxRetries: 1 }),
    storage:    def('storage',    { rateLimitPerMinute: 200, timeoutMs: 30_000, maxRetries: 3 }),
    techschool: def('techschool', { rateLimitPerMinute: 30, timeoutMs: 10_000, maxRetries: 2 }),
};

export function applyOverrides(
    base: Readonly<Record<ProviderName, ProviderConfig>>,
    overrides: { anthropicRpm?: number; mondayRpm?: number },
): Readonly<Record<ProviderName, ProviderConfig>> {
    const out: Record<ProviderName, ProviderConfig> = { ...base };
    if (overrides.anthropicRpm) {
        out.azure = { ...out.azure, rateLimitPerMinute: overrides.anthropicRpm };
    }
    if (overrides.mondayRpm) {
        out.monday = { ...out.monday, rateLimitPerMinute: overrides.mondayRpm };
    }
    return out;
}
