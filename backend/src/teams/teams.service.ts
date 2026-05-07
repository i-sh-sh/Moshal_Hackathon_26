import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class TeamsService {
    private readonly logger = new Logger(TeamsService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async checkAndCompleteTeam(teamId: string, sprintId: string): Promise<void> {
        const { data: tasks } = await this.supabase.db
            .from('tasks')
            .select('status')
            .eq('team_id', teamId)
            .eq('sprint_id', sprintId);

        if (!tasks || tasks.length === 0) return;

        const allApproved = tasks.every((t) => t.status === 'approved');

        if (allApproved) {
            await this.supabase.db
                .from('teams')
                .update({ is_completed: true, sprint_status: 'completed' })
                .eq('id', teamId);

            this.logger.log(`Team ${teamId} completed sprint ${sprintId}`);
        }
    }

    async getGroupLeaderboard(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('group_leaderboard')
            .select('*');
        return data ?? [];
    }

    async getIndividualLeaderboard(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('individual_leaderboard')
            .select('*')
            .lte('rank', 3);
        return data ?? [];
    }

    async getTeacherAnalytics(): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('teacher_analytics')
            .select('*');
        return data ?? [];
    }

    async getTeamById(id: string): Promise<unknown> {
        const { data } = await this.supabase.db
            .from('teams')
            .select(`
                id, name, accumulated_score, sprint_status, is_completed,
                current_challenge_id, current_sprint_id,
                sprints:current_sprint_id (id, title, description)
            `)
            .eq('id', id)
            .maybeSingle();

        return data ?? null;
    }

    async getSprintProgress(teamId: string, sprintId: string): Promise<unknown> {
        const { data: tasks } = await this.supabase.db
            .from('tasks')
            .select('status')
            .eq('team_id', teamId)
            .eq('sprint_id', sprintId);

        const total = tasks?.length ?? 0;
        const approved = tasks?.filter((t) => t.status === 'approved').length ?? 0;
        return { total, approved };
    }
}
