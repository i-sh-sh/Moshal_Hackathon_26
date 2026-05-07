import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DudeService } from './dude.service';
import { ChatService } from '../chat/chat.service';
import { SendMessageDto } from '../chat/dto/send-message.dto';

class PrivateChatHistoryItem {
    @IsIn(['user', 'assistant'])
    role!: 'user' | 'assistant';

    @IsString()
    content!: string;
}

class PrivateChatDto {
    @IsString()
    message!: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PrivateChatHistoryItem)
    history!: PrivateChatHistoryItem[];
}

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

    /**
     * POST /dude/private/:userId/chat
     * Private 1-on-1 mentor chat with DUDE.
     * History is managed client-side; no DB persistence.
     */
    @Post('private/:userId/chat')
    @HttpCode(200)
    async privateChat(
        @Param('userId') userId: string,
        @Body() dto: PrivateChatDto,
    ) {
        const reply = await this.dude.privateMentorChat(userId, dto.message, dto.history);
        return { reply };
    }
}
