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
import { SupabaseService } from '../supabase/supabase.service';

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

    constructor(private readonly supabase: SupabaseService) {}

    async write(entry: AuditEntry): Promise<void> {
        try {
            await this.supabase.db.from('audit_logs').insert({
                user_id: entry.userId ?? null,
                actor_email: entry.actorEmail ?? null,
                action: entry.action,
                entity_type: entry.entityType ?? null,
                entity_id: entry.entityId ?? null,
                metadata: entry.metadata ?? null,
                ip_address: entry.ipAddress ?? null,
                user_agent: entry.userAgent ?? null,
            });
        } catch (err) {
            this.logger.error(
                `Failed to write audit log (action=${entry.action}): ${(err as Error).message}`,
            );
        }
    }

    async recent(limit: number = 100): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('audit_logs')
            .select('id, user_id, actor_email, action, entity_type, entity_id, metadata, ip_address, created_at')
            .order('created_at', { ascending: false })
            .limit(Math.min(Math.max(limit, 1), 500));
        return data ?? [];
    }

    async forUser(userId: string, limit: number = 50): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('audit_logs')
            .select('id, action, entity_type, entity_id, metadata, ip_address, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(Math.min(Math.max(limit, 1), 200));
        return data ?? [];
    }
}
