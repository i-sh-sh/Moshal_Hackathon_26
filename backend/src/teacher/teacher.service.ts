/**
 * Teacher workflow — publish a challenge to a single team and assign
 * professional roles, with history tracking and fair auto-assignment.
 *
 * @version 1.00
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
    ROLE_PRIORITY,
    RoleCount,
    StudentRole,
    StudentWithRoleHistory,
} from './teacher.types';
import { PublishChallengeDto } from './dto/publish-challenge.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

@Injectable()
export class TeacherService {
    private readonly logger = new Logger(TeacherService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async getChallenges(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('challenges')
            .select('id, title, description, is_active, order_index, created_at')
            .order('order_index', { ascending: true });
        return data ?? [];
    }

    async getTeams(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('teams')
            .select('id, name, sprint_status, is_completed, current_challenge_id')
            .order('name', { ascending: true });
        return data ?? [];
    }

    async getStudentsWithRoleHistory(
        teamId: string,
    ): Promise<StudentWithRoleHistory[]> {
        const { data: students } = await this.supabase.db
            .from('users')
            .select('id, name, email, current_role')
            .eq('current_team_id', teamId)
            .eq('account_type', 'student')
            .order('name', { ascending: true });

        const results: StudentWithRoleHistory[] = [];
        for (const s of students ?? []) {
            const { data: history } = await this.supabase.db
                .from('student_role_history')
                .select('role, created_at')
                .eq('user_id', s.id)
                .order('created_at', { ascending: false })
                .limit(20);

            const roleCount = Object.fromEntries(
                ROLE_PRIORITY.map((r) => [r, 0]),
            ) as unknown as RoleCount;
            for (const h of history ?? []) {
                roleCount[h.role as StudentRole]++;
            }

            const lastRoles = (history ?? [])
                .slice(0, 3)
                .map((h: { role: string }) => h.role as StudentRole);

            results.push({
                id: s.id,
                name: s.name,
                email: s.email,
                currentRole: s.current_role as StudentRole | null,
                lastRoles,
                roleCount,
                suggestedRole: null,
            });
        }
        return results;
    }

    async publishChallenge(
        challengeId: string,
        dto: PublishChallengeDto,
    ): Promise<{ ok: true; challengeId: string; teamId: string }> {
        const { data: challenge } = await this.supabase.db
            .from('challenges')
            .select('id')
            .eq('id', challengeId)
            .maybeSingle();
        if (!challenge) throw new BadRequestException('Challenge not found');

        const { data: team } = await this.supabase.db
            .from('teams')
            .select('id')
            .eq('id', dto.teamId)
            .maybeSingle();
        if (!team) throw new BadRequestException('Team not found');

        await this.supabase.db
            .from('teams')
            .update({
                current_challenge_id: challengeId,
                sprint_status: 'active',
                is_completed: false,
            })
            .eq('id', dto.teamId);

        await this.supabase.db
            .from('challenges')
            .update({ is_active: true })
            .eq('id', challengeId);

        this.logger.log(
            `Published challenge ${challengeId} to team ${dto.teamId}`,
        );
        return { ok: true, challengeId, teamId: dto.teamId };
    }

    async assignRoles(
        teamId: string,
        dto: AssignRolesDto,
    ): Promise<{ ok: true; assigned: number }> {
        for (const item of dto.assignments) {
            const { data: user } = await this.supabase.db
                .from('users')
                .select('id, current_team_id')
                .eq('id', item.userId)
                .maybeSingle();

            if (!user || user.current_team_id !== teamId) {
                throw new BadRequestException(
                    `User ${item.userId} does not belong to team ${teamId}`,
                );
            }

            await this.applyRoleAssignment(
                item.userId,
                teamId,
                item.role,
                'manual',
                dto.assignedBy ?? null,
                dto.challengeId ?? null,
            );
        }
        return { ok: true, assigned: dto.assignments.length };
    }

    async autoAssignRoles(
        teamId: string,
        challengeId?: string,
    ): Promise<StudentWithRoleHistory[]> {
        const students = await this.getStudentsWithRoleHistory(teamId);
        const assignments = this.computeAutoAssignment(students);

        for (const item of assignments) {
            await this.applyRoleAssignment(
                item.userId,
                teamId,
                item.role,
                'automatic',
                'auto',
                challengeId ?? null,
            );
        }

        const refreshed = await this.getStudentsWithRoleHistory(teamId);
        const suggested = new Map(assignments.map((a) => [a.userId, a.role]));
        return refreshed.map((s) => ({
            ...s,
            suggestedRole: suggested.get(s.id) ?? null,
        }));
    }

    private async applyRoleAssignment(
        userId: string,
        teamId: string,
        role: StudentRole,
        source: 'manual' | 'automatic',
        assignedBy: string | null,
        challengeId: string | null,
    ): Promise<void> {
        await this.supabase.db
            .from('users')
            .update({ current_role: role })
            .eq('id', userId);

        await this.supabase.db.from('student_role_history').insert({
            user_id: userId,
            team_id: teamId,
            challenge_id: challengeId,
            role,
            assignment_source: source,
            assigned_by: assignedBy,
        });
    }

    private computeAutoAssignment(
        students: Pick<StudentWithRoleHistory, 'id' | 'roleCount' | 'lastRoles'>[],
    ): { userId: string; role: StudentRole }[] {
        const n = students.length;
        const availableRoles = ROLE_PRIORITY.slice(0, n) as StudentRole[];

        const assigned = new Set<string>();
        const result: { userId: string; role: StudentRole }[] = [];

        for (const role of availableRoles) {
            let bestStudent: string | null = null;
            let bestScore = Infinity;

            for (const student of students) {
                if (assigned.has(student.id)) continue;
                const timesHad = student.roleCount[role] ?? 0;
                const recencyPenalty = student.lastRoles[0] === role ? 2 : 0;
                const score = timesHad * 2 + recencyPenalty;
                if (score < bestScore) {
                    bestScore = score;
                    bestStudent = student.id;
                }
            }

            if (bestStudent) {
                result.push({ userId: bestStudent, role });
                assigned.add(bestStudent);
            }
        }
        return result;
    }
}
