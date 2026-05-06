/**
 * Storage integration module — picks mock vs. real adapter.
 *
 * @version 1.00
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';
import { STORAGE_PROVIDER_TOKEN } from './storage.interface';
import { MockStorageProvider } from './storage.mock';
import { RealStorageProvider } from './storage.real';

@Module({
    providers: [
        {
            provide: STORAGE_PROVIDER_TOKEN,
            inject: [ConfigService, GatekeeperService],
            useFactory: (cfg: ConfigService, gk: GatekeeperService) =>
                cfg.integrations.storage === 'real'
                    ? new RealStorageProvider(gk)
                    : new MockStorageProvider(),
        },
    ],
    exports: [STORAGE_PROVIDER_TOKEN],
})
export class StorageIntegrationModule {}
