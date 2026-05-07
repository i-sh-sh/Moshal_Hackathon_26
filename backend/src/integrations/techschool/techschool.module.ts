/**
 * Tech School integration module — picks mock vs. real adapter.
 *
 * @version 1.00
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';
import { TECHSCHOOL_PROVIDER_TOKEN } from './techschool.interface';
import { MockTechSchoolProvider } from './techschool.mock';
import { RealTechSchoolProvider } from './techschool.real';

@Module({
    providers: [
        {
            provide: TECHSCHOOL_PROVIDER_TOKEN,
            inject: [ConfigService, GatekeeperService],
            useFactory: (cfg: ConfigService, gk: GatekeeperService) =>
                cfg.integrations.techschool === 'real'
                    ? new RealTechSchoolProvider(gk)
                    : new MockTechSchoolProvider(),
        },
    ],
    exports: [TECHSCHOOL_PROVIDER_TOKEN],
})
export class TechSchoolIntegrationModule {}
