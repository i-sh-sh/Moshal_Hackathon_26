/**
 * Typed accessor for the loaded application config.
 *
 * Inject this anywhere config is needed instead of reading `process.env`
 * directly. The underlying AppConfig is loaded once at module init.
 *
 * @version 1.00
 */

import { Injectable } from '@nestjs/common';
import {
    AppConfig,
    AuthConfig,
    DatabaseConfig,
    IntegrationsConfig,
    JwtConfig,
    ServerConfig,
    GatekeeperOverrides,
} from './app-config';

@Injectable()
export class ConfigService {
    constructor(private readonly cfg: AppConfig) {}

    get version(): string { return this.cfg.version; }
    get server(): ServerConfig { return this.cfg.server; }
    get database(): DatabaseConfig { return this.cfg.database; }
    get jwt(): JwtConfig { return this.cfg.jwt; }
    get auth(): AuthConfig { return this.cfg.auth; }
    get integrations(): IntegrationsConfig { return this.cfg.integrations; }
    get gatekeeper(): GatekeeperOverrides { return this.cfg.gatekeeper; }

    get isProduction(): boolean { return this.cfg.server.nodeEnv === 'production'; }
    get isTest(): boolean { return this.cfg.server.nodeEnv === 'test'; }

    /** Snapshot suitable for /health responses — strips secrets. */
    publicSummary(): Record<string, unknown> {
        return {
            version: this.cfg.version,
            nodeEnv: this.cfg.server.nodeEnv,
            authProvider: this.cfg.auth.provider,
            integrations: {
                firebase: this.cfg.integrations.firebase,
                storage: this.cfg.integrations.storage,
                techschool: this.cfg.integrations.techschool,
                monday: this.cfg.integrations.mondayApiToken ? 'configured' : 'mock',
                azure: this.cfg.integrations.azureOpenAiApiKey ? 'configured' : 'mock',
            },
        };
    }
}
