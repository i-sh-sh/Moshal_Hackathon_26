/**
 * ActivityService — tracks per-user time-on-platform.
 *
 * The spec mandates per-week active-time measurement for the teacher
 * analytics view (`teacher_analytics`). This service is the only place
 * `users.last_login_at` and `users.total_active_time` are written.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MAX_DELTA_SECONDS } from './dto/heartbeat.dto';

export interface ActivitySnapshot {
    userId: string;
    totalActiveTime: number;
    lastLoginAt: string | null;
}

@Injectable()
export class ActivityService {
    private readonly logger = new Logger(ActivityService.name);

    constructor(private readonly supabase: SupabaseService) {}

    /** Called from the auth flow on successful login. */
    async recordLogin(userId: string): Promise<void> {
        await this.supabase.db
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', userId);
    }

    /**
     * Add `deltaSeconds` to the user's `total_active_time`. The value is
     * clamped at {@link MAX_DELTA_SECONDS} to bound abuse from a malicious
     * client that ignores the DTO validator.
     */
    async heartbeat(userId: string, deltaSeconds: number): Promise<ActivitySnapshot> {
        const clamped = Math.max(1, Math.min(deltaSeconds, MAX_DELTA_SECONDS));

        // Fetch current value, increment in JS, then update
        const { data: current } = await this.supabase.db
            .from('users')
            .select('id, total_active_time, last_login_at')
            .eq('id', userId)
            .maybeSingle();

        if (!current) throw new Error(`Heartbeat for unknown user ${userId}`);

        const newTime = (current.total_active_time ?? 0) + clamped;

        const { data: row } = await this.supabase.db
            .from('users')
            .update({
                total_active_time: newTime,
                last_login_at: current.last_login_at ?? new Date().toISOString(),
            })
            .eq('id', userId)
            .select('id, total_active_time, last_login_at')
            .single();

        return {
            userId: (row as any).id,
            totalActiveTime: (row as any).total_active_time,
            lastLoginAt: (row as any).last_login_at,
        };
    }

    async getActivity(userId: string): Promise<ActivitySnapshot> {
        const { data: row } = await this.supabase.db
            .from('users')
            .select('id, total_active_time, last_login_at')
            .eq('id', userId)
            .maybeSingle();

        if (!row) throw new Error(`Unknown user ${userId}`);
        return {
            userId: (row as any).id,
            totalActiveTime: (row as any).total_active_time,
            lastLoginAt: (row as any).last_login_at,
        };
    }
}
