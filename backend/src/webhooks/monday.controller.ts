import {
    Body,
    Controller,
    Headers,
    HttpCode,
    Logger,
    Post,
    UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TasksService } from '../tasks/tasks.service';

interface MondayChallenge {
    challenge: string;
}

interface MondayEvent {
    type: string;
    boardId?: number;
    pulseId?: number;
    userId?: number;
    columnId?: string;
    columnType?: string;
    value?: unknown;
    previousValue?: unknown;
    [key: string]: unknown;
}

interface MondayWebhookEvent {
    event: MondayEvent;
}

type MondayPayload = MondayChallenge | MondayWebhookEvent;

@Controller('webhooks')
export class MondayController {
    private readonly logger = new Logger(MondayController.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly tasksService: TasksService,
    ) {}

    @Post('monday')
    @HttpCode(200)
    async handleMonday(
        @Body() payload: MondayPayload,
        @Headers('authorization') auth: string | undefined,
    ): Promise<unknown> {
        this.validateSecret(auth);

        // Monday subscription handshake
        if ('challenge' in payload) {
            this.logger.log('Monday webhook handshake');
            return { challenge: payload.challenge };
        }

        const { event } = payload;
        this.logger.log(`Monday event: type=${event?.type} board=${event?.boardId}`);

        switch (event?.type) {
            case 'create_pulse':
                await this.handleChallengeKickoff(event);
                break;

            case 'change_column_value':
            case 'change_status_column_value':
                await this.handleColumnChange(event);
                break;

            default:
                this.logger.debug(`Unhandled Monday event type: ${event?.type}`);
        }

        return { received: true };
    }

    // ------------------------------------------------------------------
    // Teacher creates an item on a board → activate that challenge for all teams
    // ------------------------------------------------------------------
    private async handleChallengeKickoff(event: MondayEvent): Promise<void> {
        const { data: challenge } = await this.supabase.db
            .from('challenges')
            .select('id')
            .eq('monday_board_id', event.boardId)
            .single();

        if (!challenge) {
            this.logger.warn(`No challenge mapped to Monday board ${event.boardId}`);
            return;
        }

        await this.supabase.db
            .from('challenges')
            .update({ is_active: true })
            .eq('id', challenge.id);

        await this.supabase.db
            .from('teams')
            .update({
                current_challenge_id: challenge.id,
                sprint_status: 'active',
                is_completed: false,
            })
            .neq('id', '00000000-0000-0000-0000-000000000000'); // all teams

        this.logger.log(`Challenge ${challenge.id} kicked off via Monday board ${event.boardId}`);
    }

    // ------------------------------------------------------------------
    // Teacher changes status column to "Approved" / "Done" → approve the task
    // ------------------------------------------------------------------
    private async handleColumnChange(event: MondayEvent): Promise<void> {
        const value = event.value as { label?: { text?: string } } | undefined;
        const label = value?.label?.text?.toLowerCase() ?? '';

        if (!['approved', 'done'].includes(label)) return;

        const { data: task } = await this.supabase.db
            .from('tasks')
            .select('id, status')
            .eq('monday_item_id', event.pulseId)
            .maybeSingle();

        if (!task) {
            this.logger.debug(`No task found for Monday item ${event.pulseId}`);
            return;
        }

        if (task.status !== 'teacher_review') {
            this.logger.debug(
                `Task ${task.id} is in status "${task.status}", skipping teacher approval`,
            );
            return;
        }

        this.logger.log(`Teacher approved task ${task.id} via Monday`);
        await this.tasksService.teacherApprove(task.id);
    }

    // ------------------------------------------------------------------
    private validateSecret(authHeader: string | undefined): void {
        const secret = process.env.MONDAY_WEBHOOK_SECRET;
        if (!secret) return; // not configured — skip validation in dev
        if (authHeader !== secret) {
            throw new UnauthorizedException('Invalid Monday webhook secret');
        }
    }
}
