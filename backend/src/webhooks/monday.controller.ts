import {
    Controller,
    Post,
    Body,
    Headers,
    HttpCode,
    Logger,
} from '@nestjs/common';

// Monday.com sends a challenge on webhook subscription — we must echo it back.
interface MondayChallenge {
    challenge: string;
}

// Generic Monday webhook event envelope.
// Full schema: https://developer.monday.com/apps/docs/webhooks
interface MondayWebhookEvent {
    event: {
        type: string;
        boardId?: number;
        pulseId?: number;      // item id in Monday speak
        userId?: number;
        columnId?: string;
        columnType?: string;
        value?: unknown;
        previousValue?: unknown;
        [key: string]: unknown; // future-proof
    };
}

type MondayPayload = MondayChallenge | MondayWebhookEvent;

@Controller('webhooks')
export class MondayController {
    private readonly logger = new Logger(MondayController.name);

    @Post('monday')
    @HttpCode(200)
    handleMonday(
        @Body() payload: MondayPayload,
        @Headers('authorization') auth: string | undefined,
    ): unknown {
        // TODO: validate the authorization token against process.env.MONDAY_WEBHOOK_SECRET

        // Monday subscription handshake
        if ('challenge' in payload) {
            this.logger.log('Monday webhook challenge received — responding');
            return { challenge: payload.challenge };
        }

        // Real event
        this.logger.log(
            `Monday webhook event: ${JSON.stringify(payload.event?.type)} — boardId=${payload.event?.boardId}`,
        );
        this.logger.debug('Full Monday payload', JSON.stringify(payload, null, 2));

        // TODO: persist to activities table via SupabaseService
        // TODO: trigger AIService.analyze() if relevant event type

        return { received: true };
    }
}