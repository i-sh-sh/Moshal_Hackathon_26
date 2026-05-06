/**
 * Real Firebase provider — stub.
 *
 * TODO(creds-day): wire `firebase-admin` SDK once we have the service
 * account JSON. Steps:
 *   1. `npm i firebase-admin`
 *   2. Set `FIREBASE_SERVICE_ACCOUNT_JSON` and `FIREBASE_PROJECT_ID` env vars
 *   3. Replace the body of `verifyIdToken` with `admin.auth().verifyIdToken(token)`
 *   4. Wrap the call in `gatekeeper.execute('firebase', () => ...)`
 *   5. Set `FIREBASE_PROVIDER=real`
 *
 * Until the SDK is wired, throwing here at boot is intentional — it forces
 * a clear failure rather than silently falling back to mock when admin
 * thinks they enabled real auth.
 *
 * @version 0.10
 */

import { Injectable, Logger } from '@nestjs/common';
import { FirebaseProvider, FirebaseUser } from './firebase.interface';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';

@Injectable()
export class RealFirebaseProvider implements FirebaseProvider {
    private readonly logger = new Logger(RealFirebaseProvider.name);

    constructor(private readonly _gatekeeper: GatekeeperService) {
        this.logger.warn(
            'RealFirebaseProvider not implemented — install firebase-admin and ' +
            'replace this stub before flipping FIREBASE_PROVIDER=real',
        );
    }

    async verifyIdToken(_token: string): Promise<FirebaseUser> {
        throw new Error(
            'RealFirebaseProvider.verifyIdToken not implemented. See TODO(creds-day) in firebase.real.ts',
        );
    }
}
