/**
 * Auth provider contract.
 *
 * Implementations: LocalAuthProvider (bcrypt + DB), FirebaseAuthProvider
 * (verifies Firebase ID token), GoogleOAuthProvider (OAuth 2.0 code flow).
 *
 * The active provider is selected by `config.auth.provider` at boot.
 *
 * @version 1.00
 */

import { AuthenticatedUser } from '../../common/types/authenticated-user';

export const AUTH_PROVIDER_TOKEN = Symbol('AUTH_PROVIDER');

export interface LocalLoginInput {
    readonly kind: 'local';
    readonly email: string;
    readonly password: string;
}

export interface FirebaseLoginInput {
    readonly kind: 'firebase';
    readonly idToken: string;
}

export interface GoogleLoginInput {
    readonly kind: 'google';
    readonly authorizationCode: string;
}

export type LoginInput = LocalLoginInput | FirebaseLoginInput | GoogleLoginInput;

export interface RegisterInput {
    readonly email: string;
    readonly password: string;
    readonly name: string;
}

export interface AuthProvider {
    readonly name: 'local' | 'firebase' | 'google';
    /** Verify credentials and return the authenticated user. Throws on failure. */
    verify(input: LoginInput, ctx: { ip?: string; userAgent?: string }): Promise<AuthenticatedUser>;
    /** Optional — only LocalAuthProvider supports self-registration. */
    register?(input: RegisterInput): Promise<AuthenticatedUser>;
}
