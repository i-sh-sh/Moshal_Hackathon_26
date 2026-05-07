/**
 * AuthService — orchestrates login / register / refresh / logout.
 *
 * Delegates credential verification to the active AuthProvider, issues
 * access + refresh tokens, writes audit log entries, and updates the user's
 * `last_login_at` timestamp on success. (`total_active_time` is incremented
 * by the activity module's heartbeat endpoint, separately.)
 *
 * @version 1.00
 */

import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../audit/audit-log.service';
import { JwtService } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';
import {
    AUTH_PROVIDER_TOKEN,
    AuthProvider,
    LoginInput,
    RegisterInput,
} from './providers/auth-provider.interface';
import {
    AccountType,
    AuthenticatedUser,
    WorkRole,
} from '../common/types/authenticated-user';
import { LocalAuthProvider } from './providers/local-auth.provider';

export interface TokenPair {
    accessToken: string;
    accessTokenExpiresAt: Date;
    refreshToken: string;
    user: AuthenticatedUser;
}

interface UserStateRow {
    id: string;
    email: string;
    account_type: AccountType;
    current_team_id: string | null;
    current_role: WorkRole | null;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly config: ConfigService,
        private readonly supabase: SupabaseService,
        private readonly jwt: JwtService,
        private readonly refresh: RefreshTokenService,
        private readonly audit: AuditLogService,
        @Inject(AUTH_PROVIDER_TOKEN) private readonly provider: AuthProvider,
        private readonly localProvider: LocalAuthProvider,
    ) {}

    async login(input: LoginInput, ctx: { ip?: string; userAgent?: string }): Promise<TokenPair> {
        const user = await this.provider.verify(input, ctx);
        await this.markLoggedIn(user.userId);
        const access = this.jwt.signAccessToken(user);
        const refreshToken = await this.refresh.issue(user.userId, ctx);
        await this.audit.write({
            userId: user.userId,
            actorEmail: user.email,
            action: 'auth.login.success',
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
            metadata: { provider: this.provider.name },
        });
        return {
            accessToken: access.token,
            accessTokenExpiresAt: access.expiresAt,
            refreshToken,
            user,
        };
    }

    async register(input: RegisterInput, ctx: { ip?: string; userAgent?: string }): Promise<TokenPair> {
        if (!this.config.auth.allowSelfRegistration) {
            throw new ForbiddenException(
                'Self-registration is disabled. Ask an administrator to create your account.',
            );
        }
        // Self-registration is local-only, regardless of the active provider
        const user = await this.localProvider.register(input);
        await this.markLoggedIn(user.userId);
        const access = this.jwt.signAccessToken(user);
        const refreshToken = await this.refresh.issue(user.userId, ctx);
        await this.audit.write({
            userId: user.userId,
            actorEmail: user.email,
            action: 'auth.register.success',
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
        });
        return {
            accessToken: access.token,
            accessTokenExpiresAt: access.expiresAt,
            refreshToken,
            user,
        };
    }

    async refreshTokens(rawRefresh: string, ctx: { ip?: string; userAgent?: string }): Promise<TokenPair> {
        const rotated = await this.refresh.rotate(rawRefresh, ctx);

        const { data: row } = await this.supabase.db
            .from('users')
            .select('id, email, account_type, current_team_id, current_role')
            .eq('id', rotated.userId)
            .eq('is_active', true)
            .maybeSingle();

        if (!row) throw new ForbiddenException('User no longer active');

        const authUser: AuthenticatedUser = {
            userId: (row as UserStateRow).id,
            email: (row as UserStateRow).email,
            accountType: (row as UserStateRow).account_type,
            currentRole: (row as UserStateRow).current_role,
            currentTeamId: (row as UserStateRow).current_team_id,
        };
        const access = this.jwt.signAccessToken(authUser);
        return {
            accessToken: access.token,
            accessTokenExpiresAt: access.expiresAt,
            refreshToken: rotated.raw,
            user: authUser,
        };
    }

    async logout(rawRefresh: string, actor: AuthenticatedUser | undefined): Promise<void> {
        await this.refresh.revoke(rawRefresh);
        await this.audit.write({
            userId: actor?.userId ?? null,
            actorEmail: actor?.email ?? null,
            action: 'auth.logout',
        });
    }

    private async markLoggedIn(userId: string): Promise<void> {
        await this.supabase.db
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', userId);
    }
}
