import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { DudeService } from './dude.service';
import { ChatService } from '../chat/chat.service';
import { SendMessageDto } from '../chat/dto/send-message.dto';

@Controller('dude')
export class DudeController {
    constructor(
        private readonly dude: DudeService,
        private readonly chat: ChatService,
    ) {}

    /**
     * POST /dude/channels/:channelId/messages
     * Sends a student message and optionally triggers a DUDE response.
     */
    @Post('channels/:channelId/messages')
    async sendAndRespond(
        @Param('channelId') channelId: string,
        @Body() dto: SendMessageDto,
    ) {
        const saved = await this.chat.sendMessage(channelId, dto.senderId, dto.senderName, dto.content);
        // Fire-and-forget: DUDE response is async, client polls for new messages
        this.dude.onStudentMessage(channelId, saved).catch(() => undefined);
        return saved;
    }

    /**
     * POST /dude/channels/:channelId/analyze
     * Triggers a full conversation analysis for the channel.
     * Called by the teacher or an idle-detection hook.
     */
    @Post('channels/:channelId/analyze')
    @HttpCode(200)
    analyzeChannel(@Param('channelId') channelId: string) {
        return this.dude.analyzeChannel(channelId);
    }
}
