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
import { SupabaseService } from '../supabase/supabase.service';
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
        private readonly supabase: SupabaseService,
        private readonly jwt: JwtService,
        private readonly audit: AuditLogService,
    ) {}

    async issue(userId: string, ctx: { userAgent?: string; ip?: string }): Promise<string> {
        const { raw, hash, expiresAt } = this.jwt.generateRefreshToken();
        await this.supabase.db.from('refresh_tokens').insert({
            user_id: userId,
            token_hash: hash,
            expires_at: expiresAt.toISOString(),
            user_agent: ctx.userAgent ?? null,
            ip_address: ctx.ip ?? null,
        });
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

        const { data: stored } = await this.supabase.db
            .from('refresh_tokens')
            .select('id, user_id, expires_at, revoked_at, replaced_by')
            .eq('token_hash', presentedHash)
            .maybeSingle();

        if (!stored) throw new InvalidRefreshTokenError();

        const now = Date.now();
        if (new Date((stored as StoredToken).expires_at).getTime() < now) {
            throw new InvalidRefreshTokenError();
        }

        if ((stored as StoredToken).revoked_at) {
            // Theft signal — token was revoked but is being presented.
            this.logger.warn(
                `Refresh-token theft signal for user=${(stored as StoredToken).user_id} ` +
                `(token id=${(stored as StoredToken).id})`,
            );
            await this.revokeAllForUser((stored as StoredToken).user_id, 'theft_detected');
            await this.audit.write({
                userId: (stored as StoredToken).user_id,
                action: 'auth.refresh.theft_detected',
                metadata: { presentedTokenId: (stored as StoredToken).id },
                ipAddress: ctx.ip,
                userAgent: ctx.userAgent,
            });
            throw new InvalidRefreshTokenError();
        }

        // Generate a new token, revoke the old one, link them
        const fresh = this.jwt.generateRefreshToken();

        const { data: inserted } = await this.supabase.db
            .from('refresh_tokens')
            .insert({
                user_id: (stored as StoredToken).user_id,
                token_hash: fresh.hash,
                expires_at: fresh.expiresAt.toISOString(),
                user_agent: ctx.userAgent ?? null,
                ip_address: ctx.ip ?? null,
            })
            .select('id')
            .single();

        await this.supabase.db
            .from('refresh_tokens')
            .update({ revoked_at: new Date().toISOString(), replaced_by: (inserted as { id: string }).id })
            .eq('id', (stored as StoredToken).id);

        await this.audit.write({
            userId: (stored as StoredToken).user_id,
            action: 'auth.refresh.rotated',
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
        });
        return { raw: fresh.raw, userId: (stored as StoredToken).user_id };
    }

    async revoke(rawToken: string): Promise<void> {
        const hash = this.jwt.hashRefreshToken(rawToken);
        await this.supabase.db
            .from('refresh_tokens')
            .update({ revoked_at: new Date().toISOString() })
            .eq('token_hash', hash)
            .is('revoked_at', null);
    }

    async revokeAllForUser(userId: string, _reason: string): Promise<void> {
        await this.supabase.db
            .from('refresh_tokens')
            .update({ revoked_at: new Date().toISOString() })
            .eq('user_id', userId)
            .is('revoked_at', null);
    }
}
