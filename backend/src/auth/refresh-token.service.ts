/**
 * Refresh token persistence.
 *
 * Refresh tokens are stored as SHA-256 hashes — a database read does not
 * leak live sessions. Tokens are rotated on every successful refresh, and
 * a presented-after-rotation token is treated as a theft signal: the entire
 * chain for that user is revoked.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { JwtService } from './jwt.service';
import { InvalidRefreshTokenError } from '../common/errors/domain-errors';
import { AuditLogService } from '../audit/audit-log.service';

interface StoredToken {
    id: string;
    user_id: string;
    expires_at: string;
    revoked_at: string | null;
    replaced_by: string | null;
}

@Injectable()
export class RefreshTokenService {
    private readonly logger = new Logger(RefreshTokenService.name);

    constructor(
        private readonly db: DbService,
        private readonly jwt: JwtService,
        private readonly audit: AuditLogService,
    ) {}

    async issue(userId: string, ctx: { userAgent?: string; ip?: string }): Promise<string> {
        const { raw, hash, expiresAt } = this.jwt.generateRefreshToken();
        await this.db.sql`
            insert into refresh_tokens
                (user_id, token_hash, expires_at, user_agent, ip_address)
            values
                (${userId}, ${hash}, ${expiresAt}, ${ctx.userAgent ?? null}, ${ctx.ip ?? null})
        `;
        return raw;
    }

    /**
     * Rotate a refresh token. Returns a new raw token. Throws if the input
     * token is unknown, expired, or already revoked. If revoked, treat as
     * theft and revoke the entire chain.
     */
    async rotate(
        rawToken: string,
        ctx: { userAgent?: string; ip?: string },
    ): Promise<{ raw: string; userId: string }> {
        const presentedHash = this.jwt.hashRefreshToken(rawToken);
        const [stored] = await this.db.sql<StoredToken[]>`
            select id, user_id, expires_at, revoked_at, replaced_by
            from refresh_tokens
            where token_hash = ${presentedHash}
            limit 1
        `;
        if (!stored) throw new InvalidRefreshTokenError();

        const now = Date.now();
        if (new Date(stored.expires_at).getTime() < now) {
            throw new InvalidRefreshTokenError();
        }

        if (stored.revoked_at) {
            // Theft signal — token was revoked but is being presented.
            this.logger.warn(
                `Refresh-token theft signal for user=${stored.user_id} ` +
                `(token id=${stored.id})`,
            );
            await this.revokeAllForUser(stored.user_id, 'theft_detected');
            await this.audit.write({
                userId: stored.user_id,
                action: 'auth.refresh.theft_detected',
                metadata: { presentedTokenId: stored.id },
                ipAddress: ctx.ip,
                userAgent: ctx.userAgent,
            });
            throw new InvalidRefreshTokenError();
        }

        // Generate a new token, revoke the old one, link them
        const fresh = this.jwt.generateRefreshToken();
        await this.db.sql.begin(async (tx) => {
            const [inserted] = await tx<{ id: string }[]>`
                insert into refresh_tokens
                    (user_id, token_hash, expires_at, user_agent, ip_address)
                values
                    (${stored.user_id}, ${fresh.hash}, ${fresh.expiresAt},
                     ${ctx.userAgent ?? null}, ${ctx.ip ?? null})
                returning id
            `;
            await tx`
                update refresh_tokens
                set revoked_at = now(), replaced_by = ${inserted.id}
                where id = ${stored.id}
            `;
        });
        await this.audit.write({
            userId: stored.user_id,
            action: 'auth.refresh.rotated',
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
        });
        return { raw: fresh.raw, userId: stored.user_id };
    }

    async revoke(rawToken: string): Promise<void> {
        const hash = this.jwt.hashRefreshToken(rawToken);
        await this.db.sql`
            update refresh_tokens
            set revoked_at = coalesce(revoked_at, now())
            where token_hash = ${hash} and revoked_at is null
        `;
    }

    async revokeAllForUser(userId: string, _reason: string): Promise<void> {
        await this.db.sql`
            update refresh_tokens
            set revoked_at = coalesce(revoked_at, now())
            where user_id = ${userId} and revoked_at is null
        `;
    }
}
