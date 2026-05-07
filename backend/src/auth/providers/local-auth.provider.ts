/**
 * Local auth provider — bcrypt password verification against `users.password_hash`.
 *
 * Includes brute-force protection: tracks failed attempts in
 * `failed_login_attempts` and locks accounts for `lockoutWindowSeconds`
 * after `maxFailedLogins` consecutive failures within the window.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '../../config/config.service';
import { SupabaseService } from '../../supabase/supabase.service';
import {
    AccountDisabledError,
    AccountLockedError,
    EmailAlreadyTakenError,
    InvalidCredentialsError,
    WeakPasswordError,
} from '../../common/errors/domain-errors';
import {
    AccountType,
    AuthenticatedUser,
    WorkRole,
} from '../../common/types/authenticated-user';
import { AuditLogService } from '../../audit/audit-log.service';
import {
    AuthProvider,
    LoginInput,
    RegisterInput,
} from './auth-provider.interface';

interface UserRow {
    id: string;
    email: string;
    name: string;
    password_hash: string | null;
    account_type: AccountType;
    is_active: boolean;
    auth_provider: 'local' | 'firebase' | 'google';
    current_team_id: string | null;
    current_role: WorkRole | null;
}

const PASSWORD_RX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

@Injectable()
export class LocalAuthProvider implements AuthProvider {
    readonly name = 'local' as const;
    private readonly logger = new Logger(LocalAuthProvider.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly config: ConfigService,
        private readonly audit: AuditLogService,
    ) {}

    async verify(input: LoginInput, ctx: { ip?: string; userAgent?: string }): Promise<AuthenticatedUser> {
        if (input.kind !== 'local') {
            throw new InvalidCredentialsError();
        }
        const email = input.email.toLowerCase().trim();
        await this.assertNotLocked(email);

        const { data: row } = await this.supabase.db
            .from('users')
            .select('id, email, name, password_hash, account_type, is_active, auth_provider, current_team_id, current_role')
            .eq('email', email)
            .maybeSingle();

        if (!row || !(row as UserRow).password_hash || (row as UserRow).auth_provider !== 'local') {
            await this.recordFailure(email);
            await this.audit.write({
                action: 'auth.login.failed',
                actorEmail: email,
                ipAddress: ctx.ip,
                userAgent: ctx.userAgent,
            });
            throw new InvalidCredentialsError();
        }
        if (!(row as UserRow).is_active) throw new AccountDisabledError();

        const ok = await bcrypt.compare(input.password, (row as UserRow).password_hash!);
        if (!ok) {
            await this.recordFailure(email);
            await this.audit.write({
                userId: (row as UserRow).id,
                action: 'auth.login.failed',
                actorEmail: email,
                ipAddress: ctx.ip,
                userAgent: ctx.userAgent,
            });
            throw new InvalidCredentialsError();
        }

        await this.clearFailures(email);
        return this.toAuthenticated(row as UserRow);
    }

    async register(input: RegisterInput): Promise<AuthenticatedUser> {
        if (!PASSWORD_RX.test(input.password)) throw new WeakPasswordError();
        const email = input.email.toLowerCase().trim();

        const { data: existing } = await this.supabase.db
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existing) throw new EmailAlreadyTakenError();

        const hash = await bcrypt.hash(input.password, this.config.auth.bcryptCost);

        const { data: row, error } = await this.supabase.db
            .from('users')
            .insert({ name: input.name, email, password_hash: hash, account_type: 'student', auth_provider: 'local' })
            .select('id, email, name, password_hash, account_type, is_active, auth_provider, current_team_id, current_role')
            .single();

        if (error) throw new Error(error.message);
        return this.toAuthenticated(row as UserRow);
    }

    /** Hash a password — used by AdminService when creating/resetting users. */
    async hashPassword(plain: string): Promise<string> {
        if (!PASSWORD_RX.test(plain)) throw new WeakPasswordError();
        return bcrypt.hash(plain, this.config.auth.bcryptCost);
    }

    private toAuthenticated(row: UserRow): AuthenticatedUser {
        return {
            userId: row.id,
            email: row.email,
            accountType: row.account_type,
            currentRole: row.current_role,
            currentTeamId: row.current_team_id,
        };
    }

    private async assertNotLocked(email: string): Promise<void> {
        const { data: row } = await this.supabase.db
            .from('failed_login_attempts')
            .select('locked_until')
            .eq('email', email)
            .maybeSingle();

        if (row?.locked_until) {
            const remaining = Math.ceil(
                (new Date(row.locked_until).getTime() - Date.now()) / 1000,
            );
            if (remaining > 0) {
                await this.audit.write({ action: 'auth.login.locked', actorEmail: email });
                throw new AccountLockedError(remaining);
            }
        }
    }

    private async recordFailure(email: string): Promise<void> {
        const { maxFailedLogins, lockoutWindowSeconds } = this.config.auth;

        try {
            const { data: existing } = await this.supabase.db
                .from('failed_login_attempts')
                .select('attempts, last_attempt_at')
                .eq('email', email)
                .maybeSingle();

            const now = new Date();
            const windowStart = new Date(Date.now() - lockoutWindowSeconds * 1000);
            const withinWindow = existing && new Date(existing.last_attempt_at) > windowStart;
            const newAttempts = withinWindow ? (existing!.attempts + 1) : 1;
            const lockedUntil = newAttempts >= maxFailedLogins
                ? new Date(Date.now() + lockoutWindowSeconds * 1000).toISOString()
                : null;

            await this.supabase.db
                .from('failed_login_attempts')
                .upsert({
                    email,
                    attempts: newAttempts,
                    last_attempt_at: now.toISOString(),
                    locked_until: lockedUntil,
                }, { onConflict: 'email' });
        } catch (e) {
            this.logger.error(`recordFailure failed: ${(e as Error).message}`);
        }
    }

    private async clearFailures(email: string): Promise<void> {
        await this.supabase.db
            .from('failed_login_attempts')
            .delete()
            .eq('email', email);
    }
}
