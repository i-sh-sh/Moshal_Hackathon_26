/**
 * Shape attached to `req.user` after the JwtAuthGuard verifies a request.
 *
 * The contents of this object are signed into the JWT payload at issue time,
 * so they reflect the user's state at login. Mutations to the user (role
 * change, account disabled) only take effect on the next access-token refresh.
 *
 * @version 1.00
 */

export type AccountType = 'student' | 'teacher' | 'admin';

export type WorkRole = 'pm' | 'qa' | 'dev' | 'hardware';

export interface AuthenticatedUser {
    /** users.id */
    readonly userId: string;
    /** users.email */
    readonly email: string;
    /** App-level role for RBAC. Distinct from work role. */
    readonly accountType: AccountType;
    /** Current in-team role. May be null for admins/teachers not on a team. */
    readonly currentRole: WorkRole | null;
    /** Currently active team. May be null for admins/teachers. */
    readonly currentTeamId: string | null;
}

export interface JwtAccessPayload extends AuthenticatedUser {
    /** issued-at, seconds since epoch */
    readonly iat: number;
    /** expiry, seconds since epoch */
    readonly exp: number;
    readonly iss: string;
    /** subject — user id, duplicated from userId for JWT-spec compatibility */
    readonly sub: string;
}
