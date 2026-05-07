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
import { DbService } from '../db/db.service';
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
        private readonly db: DbService,
        private readonly audit: AuditLogService,
        private readonly local: LocalAuthProvider,
        private readonly refresh: RefreshTokenService,
    ) {}

    async listUsers(): Promise<AdminUserView[]> {
        const rows = await this.db.sql<UserRow[]>`
            select id, name, email, account_type, is_active, auth_provider,
                   current_team_id, current_role, total_active_time,
                   last_login_at, created_at
            from users
            order by name
        `;
        return rows.map(this.toView);
    }

    async getUser(id: string): Promise<AdminUserView> {
        const [row] = await this.db.sql<UserRow[]>`
            select id, name, email, account_type, is_active, auth_provider,
                   current_team_id, current_role, total_active_time,
                   last_login_at, created_at
            from users where id = ${id}
        `;
        if (!row) throw new NotFoundException(`User ${id} not found`);
        return this.toView(row);
    }

    async createUser(dto: CreateUserDto, actor: AuthenticatedUser): Promise<AdminUserView> {
        const email = dto.email.toLowerCase().trim();
        const [existing] = await this.db.sql<{ id: string }[]>`
            select id from users where lower(email) = ${email}
        `;
        if (existing) throw new EmailAlreadyTakenError();

        const passwordHash = await this.local.hashPassword(dto.password);
        const [row] = await this.db.sql<UserRow[]>`
            insert into users
                (name, email, password_hash, account_type, auth_provider,
                 current_team_id, current_role, is_active)
            values
                (${dto.name}, ${email}, ${passwordHash}, ${dto.accountType}, 'local',
                 ${dto.teamId ?? null}, ${dto.workRole ?? null}, true)
            returning id, name, email, account_type, is_active, auth_provider,
                      current_team_id, current_role, total_active_time,
                      last_login_at, created_at
        `;
        await this.audit.write({
            userId: actor.userId,
            actorEmail: actor.email,
            action: 'admin.user.created',
            entityType: 'user',
            entityId: row.id,
            metadata: { newUserEmail: row.email, accountType: row.account_type },
        });
        return this.toView(row);
    }

    async updateUser(id: string, dto: UpdateUserDto, actor: AuthenticatedUser): Promise<AdminUserView> {
        const before = await this.getUser(id);

        // Build the SET clause incrementally — only touched fields are updated
        const sets: { col: string; val: unknown }[] = [];
        if (dto.name !== undefined) sets.push({ col: 'name', val: dto.name });
        if (dto.email !== undefined) sets.push({ col: 'email', val: dto.email.toLowerCase().trim() });
        if (dto.accountType !== undefined) sets.push({ col: 'account_type', val: dto.accountType });
        if (dto.teamId !== undefined) sets.push({ col: 'current_team_id', val: dto.teamId });
        if (dto.workRole !== undefined) sets.push({ col: 'current_role', val: dto.workRole });
        if (dto.isActive !== undefined) sets.push({ col: 'is_active', val: dto.isActive });

        if (sets.length === 0) return before;

        // postgres tagged-template lets us interpolate identifiers via sql.unsafe — but
        // since the column names come from a closed allowlist above, that's safe.
        for (const s of sets) {
            await this.db.sql.unsafe(
                `update users set ${s.col} = $1, updated_at = now() where id = $2`,
                [s.val, id] as never,
            );
        }
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
        await this.db.sql`
            update users set password_hash = ${hash}, updated_at = now()
            where id = ${id}
        `;
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
        await this.db.sql`
            update users
            set current_team_id = ${dto.teamId},
                current_role = ${dto.workRole},
                updated_at = now()
            where id = ${id}
        `;
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
