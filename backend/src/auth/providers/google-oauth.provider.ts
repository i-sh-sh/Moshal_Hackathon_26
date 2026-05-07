/**
 * Google OAuth provider — stub for tomorrow's credentials.
 *
 * TODO(creds-day): wire `google-auth-library`.
 *   1. `npm i google-auth-library`
 *   2. Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` env vars
 *   3. Implement the code → tokens exchange and JWT verification.
 *   4. Set AUTH_PROVIDER=google.
 *
 * @version 0.10
 */

import { Injectable } from '@nestjs/common';
import { AuthProvider, LoginInput } from './auth-provider.interface';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Injectable()
export class GoogleOAuthProvider implements AuthProvider {
    readonly name = 'google' as const;

    async verify(_input: LoginInput): Promise<AuthenticatedUser> {
        throw new Error(
            'GoogleOAuthProvider not implemented. See TODO(creds-day) in google-oauth.provider.ts',
        );
    }
}
