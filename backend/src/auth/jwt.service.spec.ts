/**
 * Tests for JwtService — sign, verify, refresh-token hashing.
 */

import { JwtService } from './jwt.service';
import { ConfigService } from '../config/config.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

const fakeConfig = (overrides: Partial<{ accessTtlSeconds: number }> = {}): ConfigService =>
    ({
        get jwt() {
            return {
                accessSecret: 'test-secret-32-bytes-or-more-here-please-yes',
                accessTtlSeconds: overrides.accessTtlSeconds ?? 900,
                refreshTtlSeconds: 60 * 60 * 24,
                issuer: 'teamsprintup-test',
            };
        },
    }) as unknown as ConfigService;

const sampleUser: AuthenticatedUser = {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'test@example.com',
    accountType: 'student',
    currentRole: 'designer',
    currentTeamId: '22222222-2222-2222-2222-222222222222',
};

describe('JwtService', () => {
    it('signs and verifies an access token round-trip', () => {
        const svc = new JwtService(fakeConfig());
        const { token } = svc.signAccessToken(sampleUser);
        const decoded = svc.verifyAccessToken(token);
        expect(decoded.userId).toBe(sampleUser.userId);
        expect(decoded.email).toBe(sampleUser.email);
        expect(decoded.accountType).toBe('student');
    });

    it('rejects a tampered token', () => {
        const svc = new JwtService(fakeConfig());
        const { token } = svc.signAccessToken(sampleUser);
        const tampered = token.slice(0, -2) + 'XX';
        expect(() => svc.verifyAccessToken(tampered)).toThrow();
    });

    it('rejects an expired token', async () => {
        const svc = new JwtService(fakeConfig({ accessTtlSeconds: -1 }));
        const { token } = svc.signAccessToken(sampleUser);
        // Immediately expired
        expect(() => svc.verifyAccessToken(token)).toThrow();
    });

    it('refresh token: raw and hash differ; hash is reproducible', () => {
        const svc = new JwtService(fakeConfig());
        const { raw, hash } = svc.generateRefreshToken();
        expect(hash).not.toBe(raw);
        expect(svc.hashRefreshToken(raw)).toBe(hash);
    });
});
