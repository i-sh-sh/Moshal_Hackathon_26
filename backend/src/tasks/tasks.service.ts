import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
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
        private readonly db: DbService,
        private readonly mondayApi: MondayApiService,
        private readonly teamsService: TeamsService,
    ) {}

    async submitTask(dto: SubmitTaskDto): Promise<Task> {
        const task = await this.fetchTask(dto.taskId);

        if (!['pending', 'rejected'].includes(task.status)) {
            throw new BadRequestException(`Task cannot be submitted from status "${task.status}"`);
        }
        await this.assertUserRole(dto.userId, task.team_id, ['dev', 'hardware']);

        const [updated] = await this.db.sql<Task[]>`
            UPDATE tasks
            SET status = 'qa_review',
                submission_url = ${dto.submissionUrl ?? null},
                submission_image_url = ${dto.submissionImageUrl ?? null},
                submitted_by = ${dto.userId},
                updated_at = now()
            WHERE id = ${dto.taskId}
            RETURNING *
        `;
        if (!updated) throw new InternalServerErrorException('Update failed');
        return updated;
    }

    async qaReview(dto: QaReviewDto): Promise<Task> {
        const task = await this.fetchTask(dto.taskId);

        if (task.status !== 'qa_review') {
            throw new BadRequestException(`Task is not awaiting QA review (current: "${task.status}")`);
        }
        await this.assertUserRole(dto.userId, task.team_id, ['qa']);

        const newStatus: TaskStatus = dto.decision === 'approve' ? 'pm_review' : 'pending';
        const checklistJson = JSON.stringify(dto.checklist);

        const [updated] = await this.db.sql<Task[]>`
            UPDATE tasks
            SET status = ${newStatus},
                qa_checklist = ${checklistJson}::jsonb,
                qa_notes = ${dto.notes ?? null},
                reviewed_by_qa = ${dto.userId},
                updated_at = now()
            WHERE id = ${dto.taskId}
            RETURNING *
        `;
        if (!updated) throw new InternalServerErrorException('Update failed');
        return updated;
    }

    async pmReview(dto: PmReviewDto): Promise<Task> {
        const task = await this.fetchTask(dto.taskId);

        if (task.status !== 'pm_review') {
            throw new BadRequestException(`Task is not awaiting PM review (current: "${task.status}")`);
        }
        await this.assertUserRole(dto.userId, task.team_id, ['pm']);

        if (dto.decision === 'approve') {
            const [updated] = await this.db.sql<Task[]>`
                UPDATE tasks
                SET status = 'teacher_review',
                    pm_notes = ${dto.notes ?? null},
                    reviewed_by_pm = ${dto.userId},
                    updated_at = now()
                WHERE id = ${dto.taskId}
                RETURNING *
            `;
            if (!updated) throw new InternalServerErrorException('Update failed');

            if (task.monday_item_id) {
                await this.mondayApi.updateItemStatus(task.monday_item_id, 'Pending Teacher Review');
            }
            this.logger.log(`[HARDWARE_EVENT] GREEN_LED on | task_id=${dto.taskId} team_id=${task.team_id}`);
            return updated;
        } else {
            const [updated] = await this.db.sql<Task[]>`
                UPDATE tasks
                SET status = 'qa_review',
                    pm_notes = ${dto.notes ?? null},
                    updated_at = now()
                WHERE id = ${dto.taskId}
                RETURNING *
            `;
            if (!updated) throw new InternalServerErrorException('Update failed');
            return updated;
        }
    }

    async teacherApprove(taskId: string): Promise<void> {
        const task = await this.fetchTask(taskId);

        if (task.status !== 'teacher_review') {
            this.logger.warn(`teacherApprove called on task ${taskId} with status "${task.status}" — ignoring`);
            return;
        }

        await this.db.sql`
            UPDATE tasks SET status = 'approved', updated_at = now() WHERE id = ${taskId}
        `;
        this.logger.log(`Task ${taskId} approved by teacher`);
        await this.teamsService.checkAndCompleteTeam(task.team_id, task.sprint_id);
    }

    async getTasksByTeam(teamId: string): Promise<Task[]> {
        return this.db.sql<Task[]>`
            SELECT * FROM tasks WHERE team_id = ${teamId} ORDER BY created_at ASC
        `;
    }

    private async fetchTask(taskId: string): Promise<Task> {
        const [row] = await this.db.sql<Task[]>`SELECT * FROM tasks WHERE id = ${taskId}`;
        if (!row) throw new NotFoundException(`Task "${taskId}" not found`);
        return row;
    }

    private async assertUserRole(userId: string, teamId: string, allowedRoles: string[]): Promise<void> {
        const [user] = await this.db.sql<{ current_role: string; current_team_id: string }[]>`
            SELECT current_role, current_team_id FROM users WHERE id = ${userId}
        `;
        if (!user) throw new UnauthorizedException('User not found');
        if (user.current_team_id !== teamId) throw new ForbiddenException('User does not belong to this team');
        if (!allowedRoles.includes(user.current_role)) {
            throw new ForbiddenException(`Role "${user.current_role}" cannot perform this action (allowed: ${allowedRoles.join(', ')})`);
        }
    }
}
