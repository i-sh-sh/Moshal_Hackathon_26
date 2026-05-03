import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface GroupLeaderboardRow {
    id: string;
    name: string;
    accumulated_score: number;
    sprint_status: string;
    is_completed: boolean;
    approved_task_count: number;
}

export interface IndividualLeaderboardRow {
    id: string;
    name: string;
    current_team_id: string | null;
    current_role: string | null;
    approved_tasks: number;
    total_active_time: number;
    rank: number;
}

@Injectable()
export class TeamsService {
    private readonly logger = new Logger(TeamsService.name);

    constructor(private readonly supabase: SupabaseService) {}

    /**
     * Called after a task is approved by the teacher.
     * Sets is_completed = true when ALL tasks in the sprint are approved.
     */
    async checkAndCompleteTeam(teamId: string, sprintId: string): Promise<void> {
        const { data: tasks, error } = await this.supabase.db
            .from('tasks')
            .select('status')
            .eq('team_id', teamId)
            .eq('sprint_id', sprintId);

        if (error) {
            this.logger.error('checkAndCompleteTeam query failed', error.message);
            return;
        }

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

    async getGroupLeaderboard(): Promise<GroupLeaderboardRow[]> {
        const { data, error } = await this.supabase.db
            .from('group_leaderboard')
            .select('*');

        if (error) throw new InternalServerErrorException(error.message);
        return (data as GroupLeaderboardRow[]) ?? [];
    }

    /** Returns only the top 3 to maintain student confidence */
    async getIndividualLeaderboard(): Promise<IndividualLeaderboardRow[]> {
        const { data, error } = await this.supabase.db
            .from('individual_leaderboard')
            .select('*')
            .lte('rank', 3);

        if (error) throw new InternalServerErrorException(error.message);
        return (data as IndividualLeaderboardRow[]) ?? [];
    }

    async getTeacherAnalytics(): Promise<unknown[]> {
        const { data, error } = await this.supabase.db
            .from('teacher_analytics')
            .select('*');

        if (error) throw new InternalServerErrorException(error.message);
        return data ?? [];
    }
}
