/**
 * JWT signing and verification.
 *
 * Access tokens are short-lived (15 min default) and stateless. Refresh
 * tokens are random 256-bit strings stored hashed in `refresh_tokens` —
 * see refresh-token.service.ts.
 *
 * @version 1.00
 */

import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '../config/config.service';
import {
    AuthenticatedUser,
    JwtAccessPayload,
} from '../common/types/authenticated-user';
import { InvalidRefreshTokenError } from '../common/errors/domain-errors';

@Injectable()
export class JwtService {
    constructor(private readonly config: ConfigService) {}

    signAccessToken(user: AuthenticatedUser): { token: string; expiresAt: Date } {
        const { accessSecret, accessTtlSeconds, issuer } = this.config.jwt;
        const now = Math.floor(Date.now() / 1000);
        const payload: Omit<JwtAccessPayload, 'iat' | 'exp' | 'iss' | 'sub'> = {
            userId: user.userId,
            email: user.email,
            accountType: user.accountType,
            currentRole: user.currentRole,
            currentTeamId: user.currentTeamId,
        };
        const token = jwt.sign(payload, accessSecret, {
            algorithm: 'HS256',
            expiresIn: accessTtlSeconds,
            issuer,
            subject: user.userId,
        });
        return { token, expiresAt: new Date((now + accessTtlSeconds) * 1000) };
    }

    verifyAccessToken(token: string): JwtAccessPayload {
        const { accessSecret, issuer } = this.config.jwt;
        try {
            const decoded = jwt.verify(token, accessSecret, {
                algorithms: ['HS256'],
                issuer,
            }) as JwtAccessPayload;
            return decoded;
        } catch {
            throw new InvalidRefreshTokenError();
        }
    }

    /** Generate a fresh refresh token (raw + hash). Caller stores the hash. */
    generateRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
        const raw = randomBytes(32).toString('base64url');
        const hash = this.hashRefreshToken(raw);
        const expiresAt = new Date(
            Date.now() + this.config.jwt.refreshTtlSeconds * 1000,
        );
        return { raw, hash, expiresAt };
    }

    hashRefreshToken(raw: string): string {
        return createHash('sha256').update(raw).digest('hex');
    }
}
