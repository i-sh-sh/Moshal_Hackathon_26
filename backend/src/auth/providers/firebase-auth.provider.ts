/**
 * Firebase auth provider — verifies a Firebase ID token via the Firebase
 * integration adapter (mock or real, chosen by FIREBASE_PROVIDER env var).
 *
 * On first sign-in for a previously-unknown email, we DO NOT auto-provision
 * a user — production schools provision users via the admin API. The
 * Firebase token must already correspond to an existing `users.email`.
 *
 * @version 1.00
 */

import { Inject, Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import {
    AccountDisabledError,
    InvalidCredentialsError,
} from '../../common/errors/domain-errors';
import {
    AccountType,
    AuthenticatedUser,
    WorkRole,
} from '../../common/types/authenticated-user';
import {
    FIREBASE_PROVIDER_TOKEN,
    FirebaseProvider,
} from '../../integrations/firebase/firebase.interface';
import { AuthProvider, LoginInput } from './auth-provider.interface';

interface UserRow {
    id: string;
    email: string;
    account_type: AccountType;
    is_active: boolean;
    current_team_id: string | null;
    current_role: WorkRole | null;
}

@Injectable()
export class FirebaseAuthProvider implements AuthProvider {
    readonly name = 'firebase' as const;

    constructor(
        private readonly db: DbService,
        @Inject(FIREBASE_PROVIDER_TOKEN) private readonly firebase: FirebaseProvider,
    ) {}

    async verify(input: LoginInput): Promise<AuthenticatedUser> {
        if (input.kind !== 'firebase') throw new InvalidCredentialsError();

        const decoded = await this.firebase.verifyIdToken(input.idToken);
        const email = decoded.email.toLowerCase().trim();

        const [row] = await this.db.sql<UserRow[]>`
            select id, email, account_type, is_active, current_team_id, current_role
            from users
            where lower(email) = ${email} and auth_provider = 'firebase'
            limit 1
        `;
        if (!row) throw new InvalidCredentialsError();
        if (!row.is_active) throw new AccountDisabledError();

        return {
            userId: row.id,
            email: row.email,
            accountType: row.account_type,
            currentRole: row.current_role,
            currentTeamId: row.current_team_id,
        };
    }
}
