/**
 * Typed configuration for the TeamSprintUp backend.
 *
 * Single source of truth — every env var the app cares about is declared here
 * and validated at boot. Direct `process.env.X` reads outside this module are
 * a code smell (see docs/ARCHITECTURE.md).
 *
 * @version 1.00
 */

export const APP_CONFIG_VERSION = '1.00';

export type AuthProviderName = 'local' | 'firebase' | 'google';
export type IntegrationMode = 'mock' | 'real';

export interface ServerConfig {
    readonly port: number;
    readonly corsOrigins: readonly string[];
    readonly nodeEnv: 'development' | 'production' | 'test';
}

export interface DatabaseConfig {
    readonly url: string;
    readonly ssl: 'require' | 'disable';
    readonly poolMax: number;
}

export interface JwtConfig {
    readonly accessSecret: string;
    readonly accessTtlSeconds: number;
    readonly refreshTtlSeconds: number;
    readonly issuer: string;
}

export interface AuthConfig {
    readonly provider: AuthProviderName;
    readonly bcryptCost: number;
    readonly allowSelfRegistration: boolean;
    readonly maxFailedLogins: number;
    readonly lockoutWindowSeconds: number;
}

export interface IntegrationsConfig {
    readonly firebase: IntegrationMode;
    readonly storage: IntegrationMode;
    readonly techschool: IntegrationMode;
    readonly mondayApiToken: string;
    readonly mondayWebhookSecret: string;
    readonly azureOpenAiEndpoint: string;
    readonly azureOpenAiApiKey: string;
    readonly azureOpenAiDeployment: string;
    readonly azureOpenAiApiVersion: string;
}

export interface GatekeeperOverrides {
    readonly anthropicRpm?: number;
    readonly mondayRpm?: number;
}

export interface AppConfig {
    readonly version: string;
    readonly server: ServerConfig;
    readonly database: DatabaseConfig;
    readonly jwt: JwtConfig;
    readonly auth: AuthConfig;
    readonly integrations: IntegrationsConfig;
    readonly gatekeeper: GatekeeperOverrides;
}

export class ConfigError extends Error {
    constructor(missingVars: string[]) {
        super(
            `Missing or invalid required env vars: ${missingVars.join(', ')}. ` +
            `See backend/.env.example.`,
        );
        this.name = 'ConfigError';
    }
}

const requiredEnv = (key: string, errors: string[]): string => {
    const v = process.env[key];
    if (!v || v.trim() === '') { errors.push(key); return ''; }
    return v;
};

const intEnv = (key: string, fallback: number): number => {
    const v = process.env[key];
    if (!v) return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
};

const boolEnv = (key: string, fallback: boolean): boolean => {
    const v = process.env[key]?.toLowerCase();
    if (v === undefined) return fallback;
    return v === 'true' || v === '1' || v === 'yes';
};

const enumEnv = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const v = process.env[key];
    return (v && (allowed as readonly string[]).includes(v)) ? (v as T) : fallback;
};

export function loadAppConfig(): AppConfig {
    const errors: string[] = [];
    const isTest = process.env.NODE_ENV === 'test';

    const databaseUrl = isTest
        ? (process.env.DATABASE_URL ?? 'postgresql://test@localhost/test?sslmode=disable')
        : requiredEnv('DATABASE_URL', errors);

    const accessSecret = isTest
        ? (process.env.JWT_ACCESS_SECRET ?? 'test-secret-not-for-production-do-not-ship')
        : requiredEnv('JWT_ACCESS_SECRET', errors);

    if (errors.length > 0) throw new ConfigError(errors);

    return {
        version: APP_CONFIG_VERSION,
        server: {
            port: intEnv('PORT', 3001),
            corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
                .split(',').map((o) => o.trim()).filter(Boolean),
            nodeEnv: enumEnv('NODE_ENV', ['development', 'production', 'test'] as const, 'development'),
        },
        database: {
            url: databaseUrl,
            ssl: databaseUrl.includes('sslmode=disable') ? 'disable' : 'require',
            poolMax: intEnv('DB_POOL_MAX', 5),
        },
        jwt: {
            accessSecret,
            accessTtlSeconds: intEnv('JWT_ACCESS_TTL_SECONDS', 15 * 60),
            refreshTtlSeconds: intEnv('JWT_REFRESH_TTL_SECONDS', 7 * 24 * 60 * 60),
            issuer: process.env.JWT_ISSUER ?? 'teamsprintup',
        },
        auth: {
            provider: enumEnv('AUTH_PROVIDER', ['local', 'firebase', 'google'] as const, 'local'),
            bcryptCost: intEnv('BCRYPT_COST', 12),
            allowSelfRegistration: boolEnv('ALLOW_SELF_REGISTRATION', false),
            maxFailedLogins: intEnv('AUTH_MAX_FAILED_LOGINS', 5),
            lockoutWindowSeconds: intEnv('AUTH_LOCKOUT_WINDOW_SECONDS', 15 * 60),
        },
        integrations: {
            firebase: enumEnv('FIREBASE_PROVIDER', ['mock', 'real'] as const, 'mock'),
            storage: enumEnv('STORAGE_PROVIDER', ['mock', 'real'] as const, 'mock'),
            techschool: enumEnv('TECHSCHOOL_PROVIDER', ['mock', 'real'] as const, 'mock'),
            mondayApiToken: process.env.MONDAY_API_TOKEN ?? '',
            mondayWebhookSecret: process.env.MONDAY_WEBHOOK_SECRET ?? '',
            azureOpenAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',
            azureOpenAiApiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
            azureOpenAiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o',
            azureOpenAiApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-02-15-preview',
        },
        gatekeeper: {
            anthropicRpm: process.env.GATEKEEPER_AZURE_RPM ? intEnv('GATEKEEPER_AZURE_RPM', 60) : undefined,
            mondayRpm: process.env.GATEKEEPER_MONDAY_RPM ? intEnv('GATEKEEPER_MONDAY_RPM', 60) : undefined,
        },
    };
}
