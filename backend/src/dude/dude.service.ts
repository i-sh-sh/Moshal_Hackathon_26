/**
 * DudeService — orchestrates the DUDE AI bot.
 *
 * Decides when to respond in a channel, generates replies via AIService,
 * and triggers conversation analysis after idle periods.
 *
 * Response policy:
 *   • Every DUDE_RESPONSE_INTERVAL student messages in the channel.
 *   • Always when a message ends with "?" (question detected).
 *   • Never replies to its own messages (is_bot=true).
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChatService, ChatMessage } from '../chat/chat.service';
import { AIService } from '../integrations/ai/ai.service';
import { StudentProfileService } from '../student-profile/student-profile.service';

const DUDE_RESPONSE_INTERVAL = 3;

@Injectable()
export class DudeService {
    private readonly logger = new Logger(DudeService.name);

    /** In-memory counter of student messages per channel since last DUDE response */
    private readonly msgCounters = new Map<string, number>();

    constructor(
        private readonly chat: ChatService,
        private readonly ai: AIService,
        private readonly profiles: StudentProfileService,
    ) {}

    /**
     * Called after each student message is saved.
     * May post a DUDE reply to the channel.
     */
    async onStudentMessage(channelId: string, message: ChatMessage): Promise<void> {
        const count = (this.msgCounters.get(channelId) ?? 0) + 1;
        this.msgCounters.set(channelId, count);

        const isQuestion = message.content.trim().endsWith('?');
        const intervalHit = count >= DUDE_RESPONSE_INTERVAL;

        if (!isQuestion && !intervalHit) return;

        this.msgCounters.set(channelId, 0);

        try {
            const history = await this.chat.getMessages(channelId, 20);
            const reply = await this.ai.generateDudeResponse(history, message.content);
            await this.chat.sendBotMessage(channelId, reply);
        } catch (err) {
            this.logger.error('DUDE response failed', (err as Error).message);
        }
    }

    /**
     * Private 1-on-1 chat with DUDE for a single student.
     */
    async privateMentorChat(
        userId: string,
        message: string,
        history: { role: 'user' | 'assistant'; content: string }[],
    ): Promise<string> {
        return this.ai.privateMentorChat(message, history);
    }

    /**
     * Full channel analysis — called by teacher or on idle trigger.
     * Updates every participant's student profile and logs the analysis.
     */
    async analyzeChannel(channelId: string): Promise<{ analyzed: number; summary: string }> {
        const messages = await this.chat.getUnanalyzedMessages(channelId);

        if (messages.length === 0) {
            return { analyzed: 0, summary: 'No new messages to analyze.' };
        }

        // Group messages by sender
        const bySender = new Map<string, { senderId: string; senderName: string; messages: string[] }>();
        for (const m of messages) {
            if (!m.senderId) continue;
            const entry = bySender.get(m.senderId) ?? { senderId: m.senderId, senderName: m.senderName, messages: [] };
            entry.messages.push(m.content);
            bySender.set(m.senderId, entry);
        }

        const summaryParts: string[] = [];

        for (const { senderId, senderName, messages: texts } of bySender.values()) {
            try {
                const result = await this.ai.analyzeConversation(texts, senderId);
                await this.profiles.updateFromAnalysis(senderId, result);
                summaryParts.push(`${senderName}: jargon=${result.jargonScore}, soft=${result.softSkillScore}`);
                this.logger.log(`Profile updated for ${senderName} (${senderId})`);
            } catch (err) {
                this.logger.error(`Profile update failed for ${senderId}`, (err as Error).message);
            }
        }

        const summary = summaryParts.join(' | ') || 'Analysis complete.';
        await this.chat.logAnalysis(channelId, messages.length, summary);
        return { analyzed: messages.length, summary };
    }
}
