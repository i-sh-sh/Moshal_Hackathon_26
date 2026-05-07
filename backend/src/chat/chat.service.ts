/**
 * ChatService — manages group chat channels and messages for the DUDE system.
 *
 * Each team has exactly one chat channel (unique constraint on team_id).
 * Teachers are added as observers to all channels on login.
 * DUDE bot messages are stored with is_bot=true.
 *
 * Private DUDE conversations are stored in private_dude_messages (migration 007).
 *
 * @version 1.10
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ChatMessage {
    id: string;
    channelId: string;
    senderId: string | null;
    senderName: string;
    isBot: boolean;
    content: string;
    createdAt: string;
}

export interface ChatChannel {
    id: string;
    teamId: string;
    name: string;
    createdAt: string;
}

const DUDE_BOT_NAME = 'DUDE 🤖';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async createChannel(teamId: string, teamName: string): Promise<ChatChannel> {
        const { data, error } = await this.supabase.db
            .from('chat_channels')
            .upsert({ team_id: teamId, name: `${teamName} Chat` }, { onConflict: 'team_id' })
            .select('id, team_id, name, created_at')
            .single();

        if (error) {
            this.logger.error('Failed to create channel', error.message);
            throw new Error(error.message);
        }

        return this.mapChannel(data as any);
    }

    async getChannelByTeam(teamId: string): Promise<ChatChannel | null> {
        const { data } = await this.supabase.db
            .from('chat_channels')
            .select('id, team_id, name, created_at')
            .eq('team_id', teamId)
            .maybeSingle();

        return data ? this.mapChannel(data as any) : null;
    }

    async getAllChannels(): Promise<ChatChannel[]> {
        const { data } = await this.supabase.db
            .from('chat_channels')
            .select('id, team_id, name, created_at')
            .order('created_at', { ascending: true });

        return (data ?? []).map((r: any) => this.mapChannel(r));
    }

    async getMessages(channelId: string, limit = 100): Promise<ChatMessage[]> {
        const { data, error } = await this.supabase.db
            .from('chat_messages')
            .select('id, channel_id, sender_id, sender_name, is_bot, content, created_at')
            .eq('channel_id', channelId)
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) throw new NotFoundException(error.message);
        return (data ?? []).map((r: any) => this.mapMessage(r));
    }

    async sendMessage(
        channelId: string,
        senderId: string,
        senderName: string,
        content: string,
    ): Promise<ChatMessage> {
        const { data, error } = await this.supabase.db
            .from('chat_messages')
            .insert({
                channel_id: channelId,
                sender_id: senderId,
                sender_name: senderName,
                is_bot: false,
                content,
            })
            .select('id, channel_id, sender_id, sender_name, is_bot, content, created_at')
            .single();

        if (error) throw new Error(error.message);
        return this.mapMessage(data as any);
    }

    async sendBotMessage(channelId: string, content: string): Promise<ChatMessage> {
        const { data, error } = await this.supabase.db
            .from('chat_messages')
            .insert({
                channel_id: channelId,
                sender_id: null,
                sender_name: DUDE_BOT_NAME,
                is_bot: true,
                content,
            })
            .select('id, channel_id, sender_id, sender_name, is_bot, content, created_at')
            .single();

        if (error) throw new Error(error.message);
        return this.mapMessage(data as any);
    }

    async addParticipant(channelId: string, userId: string, role: 'member' | 'teacher'): Promise<void> {
        await this.supabase.db
            .from('channel_participants')
            .upsert({ channel_id: channelId, user_id: userId, role }, { onConflict: 'channel_id,user_id' });
    }

    async addTeacherToAllChannels(teacherId: string): Promise<void> {
        const channels = await this.getAllChannels();
        for (const ch of channels) {
            await this.addParticipant(ch.id, teacherId, 'teacher');
        }
        this.logger.log(`Teacher ${teacherId} added to ${channels.length} channels`);
    }

    /** Returns messages since the last analysis or all if never analyzed */
    async getUnanalyzedMessages(channelId: string): Promise<ChatMessage[]> {
        const { data: log } = await this.supabase.db
            .from('channel_analysis_log')
            .select('analyzed_at')
            .eq('channel_id', channelId)
            .order('analyzed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let query = this.supabase.db
            .from('chat_messages')
            .select('id, channel_id, sender_id, sender_name, is_bot, content, created_at')
            .eq('channel_id', channelId)
            .eq('is_bot', false)
            .order('created_at', { ascending: true });

        if (log) {
            query = query.gt('created_at', (log as any).analyzed_at);
        }

        const { data } = await query;
        return (data ?? []).map((r: any) => this.mapMessage(r));
    }

    async logAnalysis(channelId: string, messageCount: number, summary: string): Promise<void> {
        await this.supabase.db
            .from('channel_analysis_log')
            .insert({ channel_id: channelId, message_count: messageCount, summary });
    }

    // ── Private DUDE messages ──────────────────────────────────────────────────

    async savePrivateMessage(userId: string, role: 'student' | 'dude', content: string): Promise<void> {
        await this.supabase.db
            .from('private_dude_messages')
            .insert({ user_id: userId, role, content });
    }

    async getPrivateMessages(userId: string, limit = 100): Promise<{ id: string; role: 'student' | 'dude'; content: string; createdAt: string }[]> {
        const { data } = await this.supabase.db
            .from('private_dude_messages')
            .select('id, role, content, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(limit);

        return (data ?? []).map((r: any) => ({ id: r.id, role: r.role, content: r.content, createdAt: r.created_at }));
    }

    async getUnanalyzedPrivateMessages(userId: string): Promise<{ id: string; role: 'student' | 'dude'; content: string }[]> {
        const { data } = await this.supabase.db
            .from('private_dude_messages')
            .select('id, role, content')
            .eq('user_id', userId)
            .eq('analyzed', false)
            .order('created_at', { ascending: true });

        return (data ?? []).map((r: any) => ({ id: r.id, role: r.role, content: r.content }));
    }

    async markPrivateMessagesAnalyzed(userId: string): Promise<void> {
        await this.supabase.db
            .from('private_dude_messages')
            .update({ analyzed: true })
            .eq('user_id', userId)
            .eq('analyzed', false);
    }

    private mapChannel(r: any): ChatChannel {
        return { id: r.id, teamId: r.team_id, name: r.name, createdAt: r.created_at };
    }

    private mapMessage(r: any): ChatMessage {
        return {
            id: r.id,
            channelId: r.channel_id,
            senderId: r.sender_id,
            senderName: r.sender_name,
            isBot: r.is_bot,
            content: r.content,
            createdAt: r.created_at,
        };
    }
}
