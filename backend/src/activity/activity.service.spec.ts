import { ActivityService } from './activity.service';
import { MAX_DELTA_SECONDS } from './dto/heartbeat.dto';
import { DbService } from '../db/db.service';

describe('ActivityService', () => {
    const buildService = (
        rows: { id: string; total_active_time: number; last_login_at: string | null }[],
    ): {
        svc: ActivityService;
        captured: { fragments: TemplateStringsArray[]; values: unknown[][] };
    } => {
        const captured = { fragments: [] as TemplateStringsArray[], values: [] as unknown[][] };
        const sql = ((strings: TemplateStringsArray, ...vals: unknown[]) => {
            captured.fragments.push(strings);
            captured.values.push(vals);
            return Promise.resolve(rows);
        }) as unknown as DbService['sql'];
        const db = { sql } as DbService;
        return { svc: new ActivityService(db), captured };
    };

    it('clamps deltaSeconds at MAX_DELTA_SECONDS', async () => {
        const { svc, captured } = buildService([
            { id: 'u1', total_active_time: 999, last_login_at: null },
        ]);
        await svc.heartbeat('u1', MAX_DELTA_SECONDS + 1000);
        // The bound value passed to the SQL fragment should be MAX_DELTA_SECONDS
        const passed = captured.values[0][0]; // first interpolated value is the clamped delta
        expect(passed).toBe(MAX_DELTA_SECONDS);
    });

    it('clamps lower bound at 1', async () => {
        const { svc, captured } = buildService([
            { id: 'u1', total_active_time: 999, last_login_at: null },
        ]);
        await svc.heartbeat('u1', 0);
        expect(captured.values[0][0]).toBe(1);
    });

    it('returns the snapshot from the row', async () => {
        const { svc } = buildService([
            { id: 'u1', total_active_time: 1234, last_login_at: '2026-05-06T00:00:00Z' },
        ]);
        const snap = await svc.heartbeat('u1', 60);
        expect(snap.userId).toBe('u1');
        expect(snap.totalActiveTime).toBe(1234);
        expect(snap.lastLoginAt).toBe('2026-05-06T00:00:00Z');
    });

    it('throws on unknown user', async () => {
        const { svc } = buildService([]);
        await expect(svc.heartbeat('ghost', 60)).rejects.toThrow();
    });
});
