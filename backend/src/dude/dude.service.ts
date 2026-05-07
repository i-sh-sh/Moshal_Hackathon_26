/**
 * DudeService — orchestrates the DUDE AI bot.
 *
 * Group chat policy (v2):
 *   • DUDE no longer posts messages in group channels.
 *   • Analysis still runs silently every AUTO_ANALYZE_INTERVAL student messages.
 *   • Teacher can trigger analysis manually via POST /dude/channels/:id/analyze.
 *   • Private 1-on-1 mentor chat is unchanged.
 *
 * @version 2.00
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChatService, ChatMessage } from '../chat/chat.service';
import { AIService } from '../integrations/ai/ai.service';
import { StudentProfileService } from '../student-profile/student-profile.service';

const AUTO_ANALYZE_INTERVAL = 10;

@Injectable()
export class DudeService {
    private readonly logger = new Logger(DudeService.name);

    /** In-memory counter for auto-analysis trigger */
    private readonly analyzeCounters = new Map<string, number>();

    constructor(
        private readonly chat: ChatService,
        private readonly ai: AIService,
        private readonly profiles: StudentProfileService,
    ) {}

    /**
     * Called after each student message is saved.
     * Silently triggers background analysis every AUTO_ANALYZE_INTERVAL messages.
     * Does NOT post any bot reply to the group channel.
     */
    async onStudentMessage(channelId: string, message: ChatMessage): Promise<void> {
        if (message.isBot) return;

        const analyzeCount = (this.analyzeCounters.get(channelId) ?? 0) + 1;
        this.analyzeCounters.set(channelId, analyzeCount);
        if (analyzeCount >= AUTO_ANALYZE_INTERVAL) {
            this.analyzeCounters.set(channelId, 0);
            this.analyzeChannel(channelId).catch(() => undefined);
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
                await this.profiles.updateFromAnalysis(senderId, result, channelId);
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
