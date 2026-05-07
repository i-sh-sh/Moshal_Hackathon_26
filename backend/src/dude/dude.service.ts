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

const AUTO_ANALYZE_GROUP_INTERVAL = 10;
const AUTO_ANALYZE_PRIVATE_INTERVAL = 5;

@Injectable()
export class DudeService {
    private readonly logger = new Logger(DudeService.name);

    /** In-memory counters for auto-analysis triggers */
    private readonly groupAnalyzeCounters   = new Map<string, number>();
    private readonly privateAnalyzeCounters = new Map<string, number>();

    constructor(
        private readonly chat: ChatService,
        private readonly ai: AIService,
        private readonly profiles: StudentProfileService,
    ) {}

    /**
     * Called after each student message is saved.
     * Silently triggers background analysis every AUTO_ANALYZE_GROUP_INTERVAL messages.
     * Does NOT post any bot reply to the group channel.
     */
    async onStudentMessage(channelId: string, message: ChatMessage): Promise<void> {
        if (message.isBot) return;

        const count = (this.groupAnalyzeCounters.get(channelId) ?? 0) + 1;
        this.groupAnalyzeCounters.set(channelId, count);
        if (count >= AUTO_ANALYZE_GROUP_INTERVAL) {
            this.groupAnalyzeCounters.set(channelId, 0);
            this.analyzeChannel(channelId).catch(() => undefined);
        }
    }

    /**
     * Private 1-on-1 chat with DUDE.
     * Persists both sides to private_dude_messages and auto-analyzes every N exchanges.
     */
    async privateMentorChat(
        userId: string,
        message: string,
        history: { role: 'user' | 'assistant'; content: string }[],
    ): Promise<string> {
        // Save student message
        this.chat.savePrivateMessage(userId, 'student', message).catch(() => undefined);

        const reply = await this.ai.privateMentorChat(message, history);

        // Save DUDE reply
        this.chat.savePrivateMessage(userId, 'dude', reply).catch(() => undefined);

        // Auto-analyze private chat every AUTO_ANALYZE_PRIVATE_INTERVAL student messages
        const count = (this.privateAnalyzeCounters.get(userId) ?? 0) + 1;
        this.privateAnalyzeCounters.set(userId, count);
        if (count >= AUTO_ANALYZE_PRIVATE_INTERVAL) {
            this.privateAnalyzeCounters.set(userId, 0);
            this.analyzePrivate(userId).catch(() => undefined);
        }

        return reply;
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

    /**
     * Analyzes unanalyzed private DUDE messages for a single student.
     * Called by teacher or auto-triggered every AUTO_ANALYZE_PRIVATE_INTERVAL messages.
     */
    async analyzePrivate(userId: string): Promise<{ analyzed: number; summary: string }> {
        const messages = await this.chat.getUnanalyzedPrivateMessages(userId);
        const studentMessages = messages.filter((m) => m.role === 'student');

        if (studentMessages.length === 0) {
            return { analyzed: 0, summary: 'No new private messages to analyze.' };
        }

        try {
            const texts = studentMessages.map((m) => m.content);
            const result = await this.ai.analyzeConversation(texts, userId);
            await this.profiles.updateFromAnalysis(userId, result, undefined);
            await this.chat.markPrivateMessagesAnalyzed(userId);
            const summary = `private: jargon=${result.jargonScore}, soft=${result.softSkillScore}`;
            this.logger.log(`Private analysis done for ${userId}: ${summary}`);
            return { analyzed: studentMessages.length, summary };
        } catch (err) {
            this.logger.error(`Private analysis failed for ${userId}`, (err as Error).message);
            return { analyzed: 0, summary: 'Analysis failed.' };
        }
    }
}
