import { ActivityService } from './activity.service';
import { MAX_DELTA_SECONDS } from './dto/heartbeat.dto';
import { SupabaseService } from '../supabase/supabase.service';

describe('ActivityService', () => {
    const buildService = (
        fetchRow: { id: string; total_active_time: number; last_login_at: string | null } | null,
        updateRow: { id: string; total_active_time: number; last_login_at: string | null } | null = fetchRow,
    ): { svc: ActivityService; capturedUpdate: { newTime?: number } } => {
        const capturedUpdate: { newTime?: number } = {};

        const maybeSingleFetch = jest.fn().mockResolvedValue({ data: fetchRow, error: null });
        const singleUpdate = jest.fn().mockResolvedValue({ data: updateRow, error: null });

        const selectChain = { eq: jest.fn().mockReturnValue({ maybeSingle: maybeSingleFetch }) };
        const updateChain = {
            eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({ single: singleUpdate }),
            }),
            update: jest.fn(),
        };

        // Intercept the update call to capture newTime
        const updateFn = jest.fn().mockImplementation((vals: Record<string, unknown>) => {
            capturedUpdate.newTime = vals['total_active_time'] as number;
            return { eq: updateChain.eq };
        });

        const mockDb = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue(selectChain),
                update: updateFn,
            }),
        };

        const supabase = { db: mockDb } as unknown as SupabaseService;
        return { svc: new ActivityService(supabase), capturedUpdate };
    };

    it('clamps deltaSeconds at MAX_DELTA_SECONDS', async () => {
        const { svc, capturedUpdate } = buildService(
            { id: 'u1', total_active_time: 0, last_login_at: null },
            { id: 'u1', total_active_time: MAX_DELTA_SECONDS, last_login_at: null },
        );
        await svc.heartbeat('u1', MAX_DELTA_SECONDS + 1000);
        expect(capturedUpdate.newTime).toBe(MAX_DELTA_SECONDS);
    });

    it('clamps lower bound at 1', async () => {
        const { svc, capturedUpdate } = buildService(
            { id: 'u1', total_active_time: 0, last_login_at: null },
            { id: 'u1', total_active_time: 1, last_login_at: null },
        );
        await svc.heartbeat('u1', 0);
        expect(capturedUpdate.newTime).toBe(1);
    });

    it('returns the snapshot from the row', async () => {
        const { svc } = buildService(
            { id: 'u1', total_active_time: 1174, last_login_at: '2026-05-06T00:00:00Z' },
            { id: 'u1', total_active_time: 1234, last_login_at: '2026-05-06T00:00:00Z' },
        );
        const snap = await svc.heartbeat('u1', 60);
        expect(snap.userId).toBe('u1');
        expect(snap.totalActiveTime).toBe(1234);
        expect(snap.lastLoginAt).toBe('2026-05-06T00:00:00Z');
    });

    it('throws on unknown user', async () => {
        const { svc } = buildService(null);
        await expect(svc.heartbeat('ghost', 60)).rejects.toThrow();
    });
});
