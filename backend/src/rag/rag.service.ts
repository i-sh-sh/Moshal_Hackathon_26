import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { SYLLABUS_BY_SPRINT, GENERIC_SYLLABUS, SprintSyllabus } from './syllabus';

export interface TeamProgress {
    approvedCount: number;
    totalCount: number;
    sprintTitle: string;
}

export interface HintContext {
    taskTitle: string;
    taskDescription: string;
    assignedRole: string;
    syllabus: SprintSyllabus;
    teamProgress: TeamProgress;
    hintNumber: number;
    hintsUsedSoFar: number;
    isLastFreeHint: boolean;
    isOverFreeLimit: boolean;
}

@Injectable()
export class RagService {
    private readonly logger = new Logger(RagService.name);

    constructor(private readonly db: DbService) {}

    async buildContext(taskId: string, userId: string, teamId: string): Promise<HintContext> {
        const [task, hintCount] = await Promise.all([
            this.fetchTask(taskId),
            this.fetchHintCount(userId, teamId),
        ]);

        const syllabus = task?.sprint_id
            ? (SYLLABUS_BY_SPRINT[task.sprint_id] ?? GENERIC_SYLLABUS)
            : GENERIC_SYLLABUS;

        const teamProgress = task?.sprint_id
            ? await this.fetchTeamProgress(teamId, task.sprint_id, syllabus.hebrewTitle)
            : { approvedCount: 0, totalCount: 0, sprintTitle: syllabus.hebrewTitle };

        const hintNumber = hintCount + 1;
        const FREE_LIMIT = 3;

        return {
            taskTitle: task?.title ?? 'Unknown task',
            taskDescription: task?.description ?? '',
            assignedRole: task?.assigned_role ?? 'dev',
            syllabus,
            teamProgress,
            hintNumber,
            hintsUsedSoFar: hintCount,
            isLastFreeHint: hintNumber === FREE_LIMIT,
            isOverFreeLimit: hintNumber > FREE_LIMIT,
        };
    }

    private async fetchTask(taskId: string) {
        if (!taskId) return null;
        const [row] = await this.db.sql<{ title: string; description: string | null; assigned_role: string; sprint_id: string }[]>`
            SELECT title, description, assigned_role, sprint_id FROM tasks WHERE id = ${taskId}
        `.catch((e: Error) => {
            this.logger.warn(`fetchTask failed for ${taskId}: ${e.message}`);
            return [];
        });
        return row ?? null;
    }

    private async fetchHintCount(userId: string, teamId: string): Promise<number> {
        const [row] = await this.db.sql<{ hint_count: number }[]>`
            SELECT hint_count FROM team_hint_counters WHERE user_id = ${userId} AND team_id = ${teamId}
        `.catch(() => []);
        return row?.hint_count ?? 0;
    }

    private async fetchTeamProgress(teamId: string, sprintId: string, sprintTitle: string): Promise<TeamProgress> {
        const tasks = await this.db.sql<{ status: string }[]>`
            SELECT status FROM tasks WHERE team_id = ${teamId} AND sprint_id = ${sprintId}
        `.catch(() => []);
        return {
            approvedCount: tasks.filter((t) => t.status === 'approved').length,
            totalCount: tasks.length,
            sprintTitle,
        };
    }
}
