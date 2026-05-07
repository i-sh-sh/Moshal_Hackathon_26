/**
 * Global config module.
 *
 * Loads {@link AppConfig} from environment variables once at application
 * boot, validates required vars, and exposes a typed {@link ConfigService}
 * to every other module via global injection.
 *
 * @version 1.00
 */

import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { AppConfig, loadAppConfig } from './app-config';

const APP_CONFIG = Symbol('APP_CONFIG');

@Global()
@Module({
    providers: [
        {
            provide: APP_CONFIG,
            useFactory: (): AppConfig => loadAppConfig(),
        },
        {
            provide: ConfigService,
            useFactory: (cfg: AppConfig) => new ConfigService(cfg),
            inject: [APP_CONFIG],
        },
    ],
    exports: [ConfigService],
})
export class ConfigModule {}
