/**
 * Real Tech School provider — stub.
 *
 * TODO(creds-day): wire to the real Tech School demo API.
 *   1. Set `TECHSCHOOL_API_URL` and `TECHSCHOOL_API_TOKEN` env vars.
 *   2. Replace the stubs below with `fetch` calls wrapped in
 *      `gatekeeper.execute('techschool', () => ...)`.
 *   3. Set `TECHSCHOOL_PROVIDER=real`.
 *
 * @version 0.10
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    ListMissionsFilters,
    TechSchoolMission,
    TechSchoolProvider,
} from './techschool.interface';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';

@Injectable()
export class RealTechSchoolProvider implements TechSchoolProvider {
    private readonly logger = new Logger(RealTechSchoolProvider.name);

    constructor(private readonly _gatekeeper: GatekeeperService) {
        this.logger.warn(
            'RealTechSchoolProvider not implemented — fill in real.ts before ' +
            'flipping TECHSCHOOL_PROVIDER=real',
        );
    }

    async listMissions(_filters?: ListMissionsFilters): Promise<TechSchoolMission[]> {
        throw new Error('RealTechSchoolProvider.listMissions not implemented. See TODO(creds-day).');
    }

    async getMission(_id: string): Promise<TechSchoolMission | null> {
        throw new Error('RealTechSchoolProvider.getMission not implemented. See TODO(creds-day).');
    }
}
