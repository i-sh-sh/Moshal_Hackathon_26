/**
 * Firebase integration contract — what the rest of the app expects from any
 * Firebase implementation (mock or real).
 *
 * Used by FirebaseAuthProvider in the auth module to verify ID tokens
 * minted by the Firebase JS SDK on the client.
 *
 * @version 1.00
 */

export const FIREBASE_PROVIDER_TOKEN = Symbol('FIREBASE_PROVIDER');

export interface FirebaseUser {
    readonly uid: string;
    readonly email: string;
    readonly emailVerified: boolean;
    readonly displayName?: string;
}

export interface FirebaseProvider {
    /**
     * Verify a Firebase ID token. Throws if the token is invalid, expired,
     * or signed for a different Firebase project.
     */
    verifyIdToken(token: string): Promise<FirebaseUser>;
}
