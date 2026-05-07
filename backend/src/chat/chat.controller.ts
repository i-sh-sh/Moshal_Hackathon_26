import {
    Body, Controller, Get, HttpCode, Param,
    Post, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { AIService } from '../integrations/ai/ai.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat')
export class ChatController {
    constructor(
        private readonly chat: ChatService,
        private readonly ai: AIService,
    ) {}

    /** GET /chat/channels — all channels (teacher view) */
    @Get('channels')
    getAllChannels() {
        return this.chat.getAllChannels();
    }

    /** GET /chat/teams/:teamId/channel — get channel for a team */
    @Get('teams/:teamId/channel')
    getTeamChannel(@Param('teamId') teamId: string) {
        return this.chat.getChannelByTeam(teamId);
    }

    /** POST /chat/teams/:teamId/channel — create or get channel for a team */
    @Post('teams/:teamId/channel')
    createTeamChannel(
        @Param('teamId') teamId: string,
        @Query('teamName') teamName: string,
    ) {
        return this.chat.createChannel(teamId, teamName || 'Team');
    }

    /** GET /chat/channels/:channelId/messages */
    @Get('channels/:channelId/messages')
    getMessages(
        @Param('channelId') channelId: string,
        @Query('limit') limit?: string,
    ) {
        return this.chat.getMessages(channelId, limit ? parseInt(limit, 10) : 100);
    }

    /** POST /chat/channels/:channelId/messages */
    @Post('channels/:channelId/messages')
    sendMessage(
        @Param('channelId') channelId: string,
        @Body() dto: SendMessageDto,
    ) {
        return this.chat.sendMessage(channelId, dto.senderId, dto.senderName, dto.content);
    }

    /**
     * POST /chat/transcribe
     * Accepts a multipart audio file and returns { text: string }.
     * Frontend records via MediaRecorder, sends as FormData field "audio".
     */
    @Post('transcribe')
    @HttpCode(200)
    @UseInterceptors(FileInterceptor('audio'))
    async transcribe(@UploadedFile() file: Express.Multer.File) {
        if (!file) return { text: '' };
        const text = await this.ai.transcribeAudio(file.buffer, file.mimetype);
        return { text };
    }
}
