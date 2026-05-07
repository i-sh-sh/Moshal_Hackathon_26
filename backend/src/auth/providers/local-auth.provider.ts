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
import { DbService } from '../../db/db.service';
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
        private readonly db: DbService,
        private readonly config: ConfigService,
        private readonly audit: AuditLogService,
    ) {}

    async verify(input: LoginInput, ctx: { ip?: string; userAgent?: string }): Promise<AuthenticatedUser> {
        if (input.kind !== 'local') {
            throw new InvalidCredentialsError();
        }
        const email = input.email.toLowerCase().trim();
        await this.assertNotLocked(email);

        const [row] = await this.db.sql<UserRow[]>`
            select id, email, name, password_hash, account_type, is_active,
                   auth_provider, current_team_id, current_role
            from users
            where lower(email) = ${email}
            limit 1
        `;
        if (!row || !row.password_hash || row.auth_provider !== 'local') {
            await this.recordFailure(email);
            await this.audit.write({
                action: 'auth.login.failed',
                actorEmail: email,
                ipAddress: ctx.ip,
                userAgent: ctx.userAgent,
            });
            throw new InvalidCredentialsError();
        }
        if (!row.is_active) throw new AccountDisabledError();

        const ok = await bcrypt.compare(input.password, row.password_hash);
        if (!ok) {
            await this.recordFailure(email);
            await this.audit.write({
                userId: row.id,
                action: 'auth.login.failed',
                actorEmail: email,
                ipAddress: ctx.ip,
                userAgent: ctx.userAgent,
            });
            throw new InvalidCredentialsError();
        }

        await this.clearFailures(email);
        return this.toAuthenticated(row);
    }

    async register(input: RegisterInput): Promise<AuthenticatedUser> {
        if (!PASSWORD_RX.test(input.password)) throw new WeakPasswordError();
        const email = input.email.toLowerCase().trim();
        const [existing] = await this.db.sql<{ id: string }[]>`
            select id from users where lower(email) = ${email} limit 1
        `;
        if (existing) throw new EmailAlreadyTakenError();

        const hash = await bcrypt.hash(input.password, this.config.auth.bcryptCost);
        const [row] = await this.db.sql<UserRow[]>`
            insert into users (name, email, password_hash, account_type, auth_provider)
            values (${input.name}, ${email}, ${hash}, 'student', 'local')
            returning id, email, name, password_hash, account_type, is_active,
                      auth_provider, current_team_id, current_role
        `;
        return this.toAuthenticated(row);
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
        const [row] = await this.db.sql<{ locked_until: string | null }[]>`
            select locked_until from failed_login_attempts where email = ${email}
        `;
        if (row?.locked_until) {
            const remaining = Math.ceil(
                (new Date(row.locked_until).getTime() - Date.now()) / 1000,
            );
            if (remaining > 0) {
                await this.audit.write({
                    action: 'auth.login.locked',
                    actorEmail: email,
                });
                throw new AccountLockedError(remaining);
            }
        }
    }

    private async recordFailure(email: string): Promise<void> {
        const { maxFailedLogins, lockoutWindowSeconds } = this.config.auth;
        await this.db.sql`
            insert into failed_login_attempts (email, attempts, last_attempt_at)
            values (${email}, 1, now())
            on conflict (email) do update
            set attempts = case
                    when failed_login_attempts.last_attempt_at <
                         now() - (${lockoutWindowSeconds} || ' seconds')::interval
                    then 1
                    else failed_login_attempts.attempts + 1
                end,
                last_attempt_at = now(),
                locked_until = case
                    when failed_login_attempts.attempts + 1 >= ${maxFailedLogins}
                    then now() + (${lockoutWindowSeconds} || ' seconds')::interval
                    else failed_login_attempts.locked_until
                end
        `.catch((e: Error) =>
            this.logger.error(`recordFailure failed: ${e.message}`),
        );
    }

    private async clearFailures(email: string): Promise<void> {
        await this.db.sql`
            delete from failed_login_attempts where email = ${email}
        `.catch(() => undefined);
    }
}
