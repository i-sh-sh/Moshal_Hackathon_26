import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class TeamsService {
    private readonly logger = new Logger(TeamsService.name);

    constructor(private readonly db: DbService) {}

    async checkAndCompleteTeam(teamId: string, sprintId: string): Promise<void> {
        const tasks = await this.db.sql<{ status: string }[]>`
            SELECT status FROM tasks WHERE team_id = ${teamId} AND sprint_id = ${sprintId}
        `;
        if (!tasks.length) return;

        if (tasks.every((t) => t.status === 'approved')) {
            await this.db.sql`
                UPDATE teams SET is_completed = true, sprint_status = 'completed', updated_at = now()
                WHERE id = ${teamId}
            `;
            this.logger.log(`Team ${teamId} completed sprint ${sprintId}`);
        }
    }

    async getGroupLeaderboard(): Promise<unknown[]> {
        return [...await this.db.sql`SELECT * FROM group_leaderboard`];
    }

    async getIndividualLeaderboard(): Promise<unknown[]> {
        return [...await this.db.sql`SELECT * FROM individual_leaderboard WHERE rank <= 3`];
    }

    async getTeacherAnalytics(): Promise<unknown[]> {
        return [...await this.db.sql`SELECT * FROM teacher_analytics`];
    }

    async getTeamById(id: string): Promise<unknown> {
        const [row] = await this.db.sql<Record<string, unknown>[]>`
            SELECT t.id, t.name, t.accumulated_score, t.sprint_status, t.is_completed,
                   t.current_challenge_id, t.current_sprint_id,
                   s.id    AS sprint_id,
                   s.title AS sprint_title,
                   s.description AS sprint_description
            FROM teams t
            LEFT JOIN sprints s ON s.id = t.current_sprint_id
            WHERE t.id = ${id}
        `;
        if (!row) return null;

        return {
            id: row.id,
            name: row.name,
            accumulated_score: row.accumulated_score,
            sprint_status: row.sprint_status,
            is_completed: row.is_completed,
            current_challenge_id: row.current_challenge_id,
            current_sprint_id: row.current_sprint_id,
            sprints: row.sprint_id
                ? { id: row.sprint_id, title: row.sprint_title, description: row.sprint_description }
                : null,
        };
    }

    async getSprintProgress(teamId: string, sprintId: string): Promise<unknown> {
        const tasks = await this.db.sql<{ status: string }[]>`
            SELECT status FROM tasks WHERE team_id = ${teamId} AND sprint_id = ${sprintId}
        `;
        const total = tasks.length;
        const approved = tasks.filter((t) => t.status === 'approved').length;
        return { total, approved };
    }

    async getTeamById(id: string): Promise<unknown> {
        const { data, error } = await this.supabase.db
            .from('teams')
            .select(`
                id, name, accumulated_score, sprint_status, is_completed,
                current_challenge_id, current_sprint_id,
                sprints:current_sprint_id (id, title, description, order_index)
            `)
            .eq('id', id)
            .maybeSingle();

        if (error) throw new InternalServerErrorException(error.message);
        return data ?? null;
    }

    async getSprintProgress(teamId: string, sprintId: string): Promise<unknown> {
        const { data: tasks, error } = await this.supabase.db
            .from('tasks')
            .select('id, status')
            .eq('team_id', teamId)
            .eq('sprint_id', sprintId);

        if (error) throw new InternalServerErrorException(error.message);
        const total = tasks?.length ?? 0;
        const approved = tasks?.filter((t) => t.status === 'approved').length ?? 0;
        return { total, approved };
    }
}
