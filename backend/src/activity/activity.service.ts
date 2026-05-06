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
import { DbService } from '../db/db.service';
import { MAX_DELTA_SECONDS } from './dto/heartbeat.dto';

export interface ActivitySnapshot {
    userId: string;
    totalActiveTime: number;
    lastLoginAt: string | null;
}

@Injectable()
export class ActivityService {
    private readonly logger = new Logger(ActivityService.name);

    constructor(private readonly db: DbService) {}

    /** Called from the auth flow on successful login. */
    async recordLogin(userId: string): Promise<void> {
        await this.db.sql`
            update users set last_login_at = now(), updated_at = now()
            where id = ${userId}
        `.catch((e: Error) =>
            this.logger.error(`recordLogin failed for ${userId}: ${e.message}`),
        );
    }

    /**
     * Add `deltaSeconds` to the user's `total_active_time`. The value is
     * clamped at {@link MAX_DELTA_SECONDS} to bound abuse from a malicious
     * client that ignores the DTO validator.
     */
    async heartbeat(userId: string, deltaSeconds: number): Promise<ActivitySnapshot> {
        const clamped = Math.max(1, Math.min(deltaSeconds, MAX_DELTA_SECONDS));
        const [row] = await this.db.sql<
            { id: string; total_active_time: number; last_login_at: string | null }[]
        >`
            update users
            set total_active_time = total_active_time + ${clamped},
                last_login_at = coalesce(last_login_at, now()),
                updated_at = now()
            where id = ${userId}
            returning id, total_active_time, last_login_at
        `;
        if (!row) {
            throw new Error(`Heartbeat for unknown user ${userId}`);
        }
        return {
            userId: row.id,
            totalActiveTime: row.total_active_time,
            lastLoginAt: row.last_login_at,
        };
    }

    async getActivity(userId: string): Promise<ActivitySnapshot> {
        const [row] = await this.db.sql<
            { id: string; total_active_time: number; last_login_at: string | null }[]
        >`
            select id, total_active_time, last_login_at from users where id = ${userId}
        `;
        if (!row) throw new Error(`Unknown user ${userId}`);
        return {
            userId: row.id,
            totalActiveTime: row.total_active_time,
            lastLoginAt: row.last_login_at,
        };
    }
}
