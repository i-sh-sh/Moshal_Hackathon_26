import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TasksService } from '../tasks/tasks.service';

export interface MockBoardItem {
    id: string;
    mondayItemId: number | null;
    title: string;
    teamName: string;
    assignedRole: string;
    status: string;
    submissionUrl: string | null;
    submittedAt: string;
}

export interface MockBoard {
    challengeId: string;
    challengeTitle: string;
    columns: { label: string; color: string; items: MockBoardItem[] }[];
}

@Injectable()
export class MockMondayService {
    private readonly logger = new Logger(MockMondayService.name);

    constructor(
        private readonly db: DbService,
        private readonly tasksService: TasksService,
    ) {}

    async getBoard(challengeId: string): Promise<MockBoard> {
        const [challenge] = await this.db.sql<{ id: string; title: string }[]>`
            SELECT id, title FROM challenges WHERE id = ${challengeId}
        `;
        if (!challenge) throw new NotFoundException(`Challenge ${challengeId} not found`);

        const tasks = await this.db.sql<{
            id: string; title: string; status: string; assigned_role: string;
            submission_url: string | null; monday_item_id: number | null;
            updated_at: string; team_name: string;
        }[]>`
            SELECT t.id, t.title, t.status, t.assigned_role,
                   t.submission_url, t.monday_item_id, t.updated_at,
                   tm.name AS team_name
            FROM tasks t
            JOIN sprints s ON s.id = t.sprint_id
            JOIN teams tm ON tm.id = t.team_id
            WHERE s.challenge_id = ${challengeId}
            ORDER BY t.updated_at DESC
        `.catch((e: Error) => { throw new InternalServerErrorException(e.message); });

        const bucket = (statuses: string[]): MockBoardItem[] =>
            tasks
                .filter((t) => statuses.includes(t.status))
                .map((t) => ({
                    id: t.id,
                    mondayItemId: t.monday_item_id,
                    title: t.title,
                    teamName: t.team_name ?? '—',
                    assignedRole: t.assigned_role,
                    status: t.status,
                    submissionUrl: t.submission_url,
                    submittedAt: t.updated_at,
                }));

        return {
            challengeId: challenge.id,
            challengeTitle: challenge.title,
            columns: [
                { label: 'In Progress',            color: '#579bfc', items: bucket(['pending', 'rejected']) },
                { label: 'QA Review',              color: '#ffcb00', items: bucket(['qa_review']) },
                { label: 'PM Review',              color: '#ff7575', items: bucket(['pm_review']) },
                { label: 'Pending Teacher Review', color: '#a25ddc', items: bucket(['teacher_review']) },
                { label: 'Approved',               color: '#00c875', items: bucket(['approved']) },
            ],
        };
    }

    async approveTask(taskId: string): Promise<{ message: string }> {
        this.logger.log(`[MOCK MONDAY] Teacher approved task ${taskId}`);
        await this.tasksService.teacherApprove(taskId);
        return { message: 'Task approved by teacher (mock Monday event)' };
    }

    async rejectTask(taskId: string): Promise<{ message: string }> {
        this.logger.log(`[MOCK MONDAY] Teacher rejected task ${taskId}`);
        await this.db.sql`
            UPDATE tasks SET status = 'pm_review', updated_at = now()
            WHERE id = ${taskId} AND status = 'teacher_review'
        `.catch((e: Error) => { throw new InternalServerErrorException(e.message); });
        return { message: 'Task rejected — returned to PM review (mock Monday event)' };
    }

    async kickoffChallenge(challengeId: string): Promise<{ message: string }> {
        this.logger.log(`[MOCK MONDAY] Teacher kicked off challenge ${challengeId}`);
        await this.db.sql`UPDATE challenges SET is_active = true WHERE id = ${challengeId}`;
        await this.db.sql`
            UPDATE teams
            SET current_challenge_id = ${challengeId}, sprint_status = 'active', is_completed = false, updated_at = now()
            WHERE id != '00000000-0000-0000-0000-000000000000'
        `;
        return { message: `Challenge ${challengeId} kicked off for all teams (mock Monday event)` };
    }

    async listChallenges(): Promise<{ id: string; title: string; isActive: boolean }[]> {
        const rows = await this.db.sql<{ id: string; title: string; is_active: boolean }[]>`
            SELECT id, title, is_active FROM challenges ORDER BY order_index
        `.catch((e: Error) => { throw new InternalServerErrorException(e.message); });
        return rows.map((c) => ({ id: c.id, title: c.title, isActive: c.is_active }));
    }
}
