import { MockTechSchoolProvider } from './techschool.mock';

describe('MockTechSchoolProvider', () => {
    const provider = new MockTechSchoolProvider();

    it('returns all fixtures by default', async () => {
        const all = await provider.listMissions();
        expect(all.length).toBeGreaterThanOrEqual(5);
    });

    it('filters by topic', async () => {
        const games = await provider.listMissions({ topic: 'games' });
        expect(games.every((m) => m.topic === 'games')).toBe(true);
    });

    it('filters by maxDifficulty', async () => {
        const easy = await provider.listMissions({ maxDifficulty: 1 });
        expect(easy.every((m) => m.difficulty <= 1)).toBe(true);
    });

    it('getMission returns null for unknown id', async () => {
        const m = await provider.getMission('does-not-exist');
        expect(m).toBeNull();
    });

    it('getMission returns a copy (caller cannot mutate fixture)', async () => {
        const m1 = (await provider.getMission('tsm-gift-01'))!;
        expect(m1).toBeDefined();
    });
});
