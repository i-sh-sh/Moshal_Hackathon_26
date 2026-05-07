import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MondayApiService } from '../integrations/monday/monday-api.service';
import { TeamsService } from '../teams/teams.service';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { QaReviewDto } from './dto/qa-review.dto';
import { PmReviewDto } from './dto/pm-review.dto';

export type TaskStatus =
    | 'pending'
    | 'qa_review'
    | 'pm_review'
    | 'teacher_review'
    | 'approved'
    | 'rejected';

export interface Task {
    id: string;
    sprint_id: string;
    team_id: string;
    assigned_role: 'pm' | 'qa' | 'dev' | 'hardware';
    title: string;
    description: string | null;
    status: TaskStatus;
    submission_url: string | null;
    submission_image_url: string | null;
    monday_item_id: number | null;
    qa_checklist: unknown;
    qa_notes: string | null;
    pm_notes: string | null;
    submitted_by: string | null;
    reviewed_by_qa: string | null;
    reviewed_by_pm: string | null;
    created_at: string;
    updated_at: string;
}

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly mondayApi: MondayApiService,
        private readonly teamsService: TeamsService,
    ) {}

    async submitTask(dto: SubmitTaskDto): Promise<Task> {
        const task = await this.fetchTask(dto.taskId);

        if (!['pending', 'rejected'].includes(task.status)) {
            throw new BadRequestException(
                `Task cannot be submitted from status "${task.status}"`,
            );
        }

        await this.assertUserRole(dto.userId, task.team_id, ['dev', 'hardware']);

        const { data, error } = await this.supabase.db
            .from('tasks')
            .update({
                status: 'qa_review',
                submission_url: dto.submissionUrl ?? null,
                submission_image_url: dto.submissionImageUrl ?? null,
                submitted_by: dto.userId,
            })
            .eq('id', dto.taskId)
            .select()
            .single();

        if (error) throw new InternalServerErrorException(error.message);
        return data as Task;
    }

    async qaReview(dto: QaReviewDto): Promise<Task> {
        const task = await this.fetchTask(dto.taskId);

        if (task.status !== 'qa_review') {
            throw new BadRequestException(
                `Task is not awaiting QA review (current: "${task.status}")`,
            );
        }
        await this.assertUserRole(dto.userId, task.team_id, ['qa']);

        const newStatus: TaskStatus = dto.decision === 'approve' ? 'pm_review' : 'pending';

        const { data, error } = await this.supabase.db
            .from('tasks')
            .update({
                status: newStatus,
                qa_checklist: dto.checklist ?? null,
                qa_notes: dto.notes ?? null,
                reviewed_by_qa: dto.userId,
            })
            .eq('id', dto.taskId)
            .select()
            .single();

        if (error) throw new InternalServerErrorException(error.message);
        return data as Task;
    }

    async pmReview(dto: PmReviewDto): Promise<Task> {
        const task = await this.fetchTask(dto.taskId);

        if (task.status !== 'pm_review') {
            throw new BadRequestException(
                `Task is not awaiting PM review (current: "${task.status}")`,
            );
        }
        await this.assertUserRole(dto.userId, task.team_id, ['pm']);

        if (dto.decision === 'approve') {
            const { data, error } = await this.supabase.db
                .from('tasks')
                .update({
                    status: 'teacher_review',
                    pm_notes: dto.notes ?? null,
                    reviewed_by_pm: dto.userId,
                })
                .eq('id', dto.taskId)
                .select()
                .single();

            if (error) throw new InternalServerErrorException(error.message);

            if (task.monday_item_id) {
                await this.mondayApi.updateItemStatus(task.monday_item_id, 'Pending Teacher Review');
            }
            this.logger.log(`[HARDWARE_EVENT] GREEN_LED on | task_id=${dto.taskId} team_id=${task.team_id}`);
            return data as Task;
        } else {
            const { data, error } = await this.supabase.db
                .from('tasks')
                .update({
                    status: 'qa_review',
                    pm_notes: dto.notes ?? null,
                })
                .eq('id', dto.taskId)
                .select()
                .single();

            if (error) throw new InternalServerErrorException(error.message);
            return data as Task;
        }
    }

    async teacherApprove(taskId: string): Promise<void> {
        const task = await this.fetchTask(taskId);

        if (task.status !== 'teacher_review') {
            this.logger.warn(
                `teacherApprove called on task ${taskId} with status "${task.status}" — ignoring`,
            );
            return;
        }

        const { error } = await this.supabase.db
            .from('tasks')
            .update({ status: 'approved' })
            .eq('id', taskId);

        if (error) throw new InternalServerErrorException(error.message);
        this.logger.log(`Task ${taskId} approved by teacher`);
        await this.teamsService.checkAndCompleteTeam(task.team_id, task.sprint_id);
    }

    async getTasksByTeam(teamId: string): Promise<Task[]> {
        const { data, error } = await this.supabase.db
            .from('tasks')
            .select('*')
            .eq('team_id', teamId)
            .order('created_at', { ascending: true });

        if (error) throw new InternalServerErrorException(error.message);
        return (data ?? []) as Task[];
    }

    private async fetchTask(taskId: string): Promise<Task> {
        const { data, error } = await this.supabase.db
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .maybeSingle();

        if (error) throw new InternalServerErrorException(error.message);
        if (!data) throw new NotFoundException(`Task "${taskId}" not found`);
        return data as Task;
    }

    private async assertUserRole(userId: string, teamId: string, allowedRoles: string[]): Promise<void> {
        const { data } = await this.supabase.db
            .from('users')
            .select('current_role, current_team_id')
            .eq('id', userId)
            .maybeSingle();

        if (!data) throw new UnauthorizedException('User not found');
        if (data.current_team_id !== teamId) throw new ForbiddenException('User does not belong to this team');
        if (!allowedRoles.includes(data.current_role)) {
            throw new ForbiddenException(
                `Role "${data.current_role}" cannot perform this action (allowed: ${allowedRoles.join(', ')})`,
            );
        }
    }
}
