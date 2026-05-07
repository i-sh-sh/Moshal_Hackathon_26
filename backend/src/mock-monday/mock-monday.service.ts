import {
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
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
    columns: {
        label: string;
        color: string;
        items: MockBoardItem[];
    }[];
}

@Injectable()
export class MockMondayService {
    private readonly logger = new Logger(MockMondayService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly tasksService: TasksService,
    ) {}

    async getBoard(challengeId: string): Promise<MockBoard> {
        const { data: challenge } = await this.supabase.db
            .from('challenges')
            .select('id, title')
            .eq('id', challengeId)
            .single();

        if (!challenge) throw new NotFoundException(`Challenge ${challengeId} not found`);

        const { data: tasks, error } = await this.supabase.db
            .from('tasks')
            .select(`
                id, title, status, assigned_role,
                submission_url, monday_item_id, updated_at,
                teams(name),
                sprints!inner(challenge_id)
            `)
            .eq('sprints.challenge_id', challengeId)
            .order('updated_at', { ascending: false });

        if (error) throw new InternalServerErrorException(error.message);

        const all = (tasks ?? []) as any[];

        const bucket = (statuses: string[]) =>
            all
                .filter((t) => statuses.includes(t.status))
                .map((t): MockBoardItem => ({
                    id: t.id,
                    mondayItemId: t.monday_item_id,
                    title: t.title,
                    teamName: t.teams?.name ?? '—',
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
        const { error } = await this.supabase.db
            .from('tasks')
            .update({ status: 'pm_review' })
            .eq('id', taskId)
            .eq('status', 'teacher_review');

        if (error) throw new InternalServerErrorException(error.message);
        return { message: 'Task rejected — returned to PM review (mock Monday event)' };
    }

    async kickoffChallenge(challengeId: string): Promise<{ message: string }> {
        this.logger.log(`[MOCK MONDAY] Teacher kicked off challenge ${challengeId}`);

        await this.supabase.db
            .from('challenges')
            .update({ is_active: true })
            .eq('id', challengeId);

        await this.supabase.db
            .from('teams')
            .update({ current_challenge_id: challengeId, sprint_status: 'active', is_completed: false })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        return { message: `Challenge ${challengeId} kicked off for all teams (mock Monday event)` };
    }

    async listChallenges(): Promise<{ id: string; title: string; isActive: boolean }[]> {
        const { data, error } = await this.supabase.db
            .from('challenges')
            .select('id, title, is_active')
            .order('order_index' as any);

        if (error) throw new InternalServerErrorException(error.message);
        return (data ?? []).map((c) => ({ id: c.id, title: c.title, isActive: c.is_active }));
    }
}
