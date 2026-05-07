import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
    SYLLABUS_BY_SPRINT,
    GENERIC_SYLLABUS,
    SprintSyllabus,
} from './syllabus';

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

    constructor(private readonly supabase: SupabaseService) {}

    async buildContext(
        taskId: string,
        userId: string,
        teamId: string,
    ): Promise<HintContext> {
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

        const hintNumber    = hintCount + 1;
        const FREE_LIMIT    = 3;

        return {
            taskTitle:       task?.title       ?? 'Unknown task',
            taskDescription: task?.description ?? '',
            assignedRole:    task?.assigned_role ?? 'designer',
            syllabus,
            teamProgress,
            hintNumber,
            hintsUsedSoFar:   hintCount,
            isLastFreeHint:   hintNumber === FREE_LIMIT,
            isOverFreeLimit:  hintNumber > FREE_LIMIT,
        };
    }

    private async fetchTask(taskId: string) {
        if (!taskId) return null;

        const { data, error } = await this.supabase.db
            .from('tasks')
            .select('title, description, assigned_role, sprint_id')
            .eq('id', taskId)
            .maybeSingle();

        if (error) {
            this.logger.warn(`fetchTask failed for ${taskId}: ${error.message}`);
            return null;
        }
        return data;
    }

    private async fetchHintCount(userId: string, teamId: string): Promise<number> {
        const { data } = await this.supabase.db
            .from('team_hint_counters')
            .select('hint_count')
            .eq('user_id', userId)
            .eq('team_id', teamId)
            .maybeSingle();

        return data?.hint_count ?? 0;
    }

    private async fetchTeamProgress(
        teamId: string,
        sprintId: string,
        sprintTitle: string,
    ): Promise<TeamProgress> {
        const { data: tasks } = await this.supabase.db
            .from('tasks')
            .select('status')
            .eq('team_id', teamId)
            .eq('sprint_id', sprintId);

        return {
            approvedCount: tasks?.filter((t) => t.status === 'approved').length ?? 0,
            totalCount: tasks?.length ?? 0,
            sprintTitle,
        };
    }
}
