/**
 * AdminService — user management for production school deployments.
 *
 * Every mutation writes to audit_logs and revokes outstanding refresh
 * tokens for the affected user when their security state changes
 * (password reset, account disabled, account_type changed).
 *
 * @version 1.00
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../audit/audit-log.service';
import { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { EmailAlreadyTakenError } from '../common/errors/domain-errors';
import {
    AccountType,
    AuthenticatedUser,
    WorkRole,
} from '../common/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import {
    AssignTeamDto,
    ResetPasswordDto,
    UpdateUserDto,
} from './dto/update-user.dto';

export interface AdminUserView {
    id: string;
    name: string;
    email: string;
    accountType: AccountType;
    isActive: boolean;
    authProvider: 'local' | 'firebase' | 'google';
    currentTeamId: string | null;
    currentRole: WorkRole | null;
    totalActiveTime: number;
    lastLoginAt: string | null;
    createdAt: string;
}

interface UserRow {
    id: string;
    name: string;
    email: string;
    account_type: AccountType;
    is_active: boolean;
    auth_provider: 'local' | 'firebase' | 'google';
    current_team_id: string | null;
    current_role: WorkRole | null;
    total_active_time: number;
    last_login_at: string | null;
    created_at: string;
}

@Injectable()
export class AdminService {
    constructor(
        private readonly supabase: SupabaseService,
        private readonly audit: AuditLogService,
        private readonly local: LocalAuthProvider,
        private readonly refresh: RefreshTokenService,
    ) {}

    async listUsers(): Promise<AdminUserView[]> {
        const { data } = await this.supabase.db
            .from('users')
            .select('id, name, email, account_type, is_active, auth_provider, current_team_id, current_role, total_active_time, last_login_at, created_at')
            .order('name');
        return ((data ?? []) as UserRow[]).map(this.toView);
    }

    async getUser(id: string): Promise<AdminUserView> {
        const { data } = await this.supabase.db
            .from('users')
            .select('id, name, email, account_type, is_active, auth_provider, current_team_id, current_role, total_active_time, last_login_at, created_at')
            .eq('id', id)
            .maybeSingle();
        if (!data) throw new NotFoundException(`User ${id} not found`);
        return this.toView(data as UserRow);
    }

    async createUser(dto: CreateUserDto, actor: AuthenticatedUser): Promise<AdminUserView> {
        const email = dto.email.toLowerCase().trim();

        const { data: existing } = await this.supabase.db
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();
        if (existing) throw new EmailAlreadyTakenError();

        const passwordHash = await this.local.hashPassword(dto.password);

        const { data: row, error } = await this.supabase.db
            .from('users')
            .insert({
                name: dto.name,
                email,
                password_hash: passwordHash,
                account_type: dto.accountType,
                auth_provider: 'local',
                current_team_id: dto.teamId ?? null,
                current_role: dto.workRole ?? null,
                is_active: true,
            })
            .select('id, name, email, account_type, is_active, auth_provider, current_team_id, current_role, total_active_time, last_login_at, created_at')
            .single();

        if (error) throw new Error(error.message);

        await this.audit.write({
            userId: actor.userId,
            actorEmail: actor.email,
            action: 'admin.user.created',
            entityType: 'user',
            entityId: (row as UserRow).id,
            metadata: { newUserEmail: (row as UserRow).email, accountType: (row as UserRow).account_type },
        });
        return this.toView(row as UserRow);
    }

    async updateUser(id: string, dto: UpdateUserDto, actor: AuthenticatedUser): Promise<AdminUserView> {
        const before = await this.getUser(id);

        const updates: Record<string, unknown> = {};
        if (dto.name !== undefined) updates['name'] = dto.name;
        if (dto.email !== undefined) updates['email'] = dto.email.toLowerCase().trim();
        if (dto.accountType !== undefined) updates['account_type'] = dto.accountType;
        if (dto.teamId !== undefined) updates['current_team_id'] = dto.teamId;
        if (dto.workRole !== undefined) updates['current_role'] = dto.workRole;
        if (dto.isActive !== undefined) updates['is_active'] = dto.isActive;

        if (Object.keys(updates).length === 0) return before;

        await this.supabase.db
            .from('users')
            .update(updates)
            .eq('id', id);

        const updated = await this.getUser(id);

        // Security-relevant changes invalidate sessions
        const securityChanged =
            (dto.accountType !== undefined && dto.accountType !== before.accountType) ||
            (dto.isActive !== undefined && dto.isActive === false);
        if (securityChanged) {
            await this.refresh.revokeAllForUser(id, 'admin_update');
        }

        await this.audit.write({
            userId: actor.userId,
            actorEmail: actor.email,
            action: dto.isActive === false ? 'admin.user.disabled' : 'admin.user.updated',
            entityType: 'user',
            entityId: id,
            metadata: { changes: dto },
        });
        return updated;
    }

    async resetPassword(id: string, dto: ResetPasswordDto, actor: AuthenticatedUser): Promise<void> {
        await this.getUser(id); // 404 if missing
        const hash = await this.local.hashPassword(dto.newPassword);
        await this.supabase.db
            .from('users')
            .update({ password_hash: hash })
            .eq('id', id);
        await this.refresh.revokeAllForUser(id, 'password_reset');
        await this.audit.write({
            userId: actor.userId,
            actorEmail: actor.email,
            action: 'admin.user.password_reset',
            entityType: 'user',
            entityId: id,
        });
    }

    async assignTeam(id: string, dto: AssignTeamDto, actor: AuthenticatedUser): Promise<AdminUserView> {
        await this.getUser(id);
        await this.supabase.db
            .from('users')
            .update({ current_team_id: dto.teamId, current_role: dto.workRole })
            .eq('id', id);
        await this.audit.write({
            userId: actor.userId,
            actorEmail: actor.email,
            action: 'admin.user.team_assigned',
            entityType: 'user',
            entityId: id,
            metadata: { teamId: dto.teamId, workRole: dto.workRole },
        });
        return this.getUser(id);
    }

    async disableUser(id: string, actor: AuthenticatedUser): Promise<AdminUserView> {
        return this.updateUser(id, { isActive: false }, actor);
    }

    private toView(r: UserRow): AdminUserView {
        return {
            id: r.id,
            name: r.name,
            email: r.email,
            accountType: r.account_type,
            isActive: r.is_active,
            authProvider: r.auth_provider,
            currentTeamId: r.current_team_id,
            currentRole: r.current_role,
            totalActiveTime: r.total_active_time,
            lastLoginAt: r.last_login_at,
            createdAt: r.created_at,
        };
    }
}
