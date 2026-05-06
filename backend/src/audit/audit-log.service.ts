/**
 * Audit log writer.
 *
 * Append-only record of security-relevant actions: login, logout, password
 * change, user created/disabled, role change, task approved by teacher, hint
 * over free limit, etc.
 *
 * Failures to write are logged but do not fail the originating request —
 * a missed audit entry is preferable to a broken user-facing flow.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';

export type AuditAction =
    | 'auth.login.success'
    | 'auth.login.failed'
    | 'auth.login.locked'
    | 'auth.logout'
    | 'auth.refresh.rotated'
    | 'auth.refresh.theft_detected'
    | 'auth.password.changed'
    | 'auth.register.success'
    | 'admin.user.created'
    | 'admin.user.updated'
    | 'admin.user.disabled'
    | 'admin.user.password_reset'
    | 'admin.user.team_assigned'
    | 'task.teacher_approved'
    | 'task.teacher_rejected'
    | 'hint.over_free_limit';

export interface AuditEntry {
    readonly userId?: string | null;
    readonly actorEmail?: string | null;
    readonly action: AuditAction;
    readonly entityType?: string;
    readonly entityId?: string;
    readonly metadata?: Record<string, unknown>;
    readonly ipAddress?: string;
    readonly userAgent?: string;
}

@Injectable()
export class AuditLogService {
    private readonly logger = new Logger(AuditLogService.name);

    constructor(private readonly db: DbService) {}

    async write(entry: AuditEntry): Promise<void> {
        try {
            await this.db.sql`
                insert into audit_logs
                    (user_id, actor_email, action, entity_type, entity_id,
                     metadata, ip_address, user_agent)
                values
                    (${entry.userId ?? null},
                     ${entry.actorEmail ?? null},
                     ${entry.action},
                     ${entry.entityType ?? null},
                     ${entry.entityId ?? null},
                     ${entry.metadata ? JSON.stringify(entry.metadata) : null}::jsonb,
                     ${entry.ipAddress ?? null},
                     ${entry.userAgent ?? null})
            `;
        } catch (err) {
            this.logger.error(
                `Failed to write audit log (action=${entry.action}): ${(err as Error).message}`,
            );
        }
    }

    async recent(limit: number = 100): Promise<unknown[]> {
        return this.db.sql`
            select id, user_id, actor_email, action, entity_type, entity_id,
                   metadata, ip_address, created_at
            from audit_logs
            order by created_at desc
            limit ${Math.min(Math.max(limit, 1), 500)}
        `;
    }

    async forUser(userId: string, limit: number = 50): Promise<unknown[]> {
        return this.db.sql`
            select id, action, entity_type, entity_id, metadata, ip_address, created_at
            from audit_logs
            where user_id = ${userId}
            order by created_at desc
            limit ${Math.min(Math.max(limit, 1), 200)}
        `;
    }
}
