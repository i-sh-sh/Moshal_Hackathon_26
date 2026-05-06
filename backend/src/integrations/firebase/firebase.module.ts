/**
 * Firebase integration module.
 *
 * Selects the active provider (mock vs. real) based on
 * `config.integrations.firebase`. Default is mock so dev/CI runs without creds.
 *
 * @version 1.00
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';
import { FIREBASE_PROVIDER_TOKEN } from './firebase.interface';
import { MockFirebaseProvider } from './firebase.mock';
import { RealFirebaseProvider } from './firebase.real';

@Module({
    providers: [
        {
            provide: FIREBASE_PROVIDER_TOKEN,
            inject: [ConfigService, GatekeeperService],
            useFactory: (cfg: ConfigService, gk: GatekeeperService) =>
                cfg.integrations.firebase === 'real'
                    ? new RealFirebaseProvider(gk)
                    : new MockFirebaseProvider(),
        },
    ],
    exports: [FIREBASE_PROVIDER_TOKEN],
})
export class FirebaseIntegrationModule {}
