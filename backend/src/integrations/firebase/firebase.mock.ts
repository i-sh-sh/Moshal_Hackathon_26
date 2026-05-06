/**
 * Mock Firebase provider — parses tokens of the shape `mock-uid:<email>`
 * for local development and tests. Logs a loud warning so it's obvious
 * if this ends up running in production.
 *
 * @version 1.00
 */

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { FirebaseProvider, FirebaseUser } from './firebase.interface';

@Injectable()
export class MockFirebaseProvider implements FirebaseProvider {
    private readonly logger = new Logger(MockFirebaseProvider.name);

    async verifyIdToken(token: string): Promise<FirebaseUser> {
        this.logger.warn('[MOCK] verifying Firebase token (set FIREBASE_PROVIDER=real to disable)');
        const match = /^mock-uid:([^:]+@[^:]+)$/.exec(token);
        if (!match) {
            throw new UnauthorizedException(
                'Invalid mock Firebase token. Expected format: "mock-uid:<email>"',
            );
        }
        const email = match[1];
        return {
            uid: `mock-${email}`,
            email,
            emailVerified: true,
        };
    }
}
