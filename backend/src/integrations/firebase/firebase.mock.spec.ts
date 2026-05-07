import { MockFirebaseProvider } from './firebase.mock';

describe('MockFirebaseProvider', () => {
    const provider = new MockFirebaseProvider();

    it('parses well-formed mock token', async () => {
        const u = await provider.verifyIdToken('mock-uid:alice@example.com');
        expect(u.email).toBe('alice@example.com');
        expect(u.uid).toBe('mock-alice@example.com');
        expect(u.emailVerified).toBe(true);
    });

    it('rejects malformed token', async () => {
        await expect(provider.verifyIdToken('not-a-valid-token')).rejects.toThrow();
    });
});
