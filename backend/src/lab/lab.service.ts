import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EndSessionDto } from './dto/end-session.dto';
import { StartSessionDto } from './dto/start-session.dto';

@Injectable()
export class LabService {
    constructor(private readonly supabase: SupabaseService) {}

    async getTools() {
        const { data, error } = await this.supabase.db
            .from('lab_tools')
            .select('*')
            .order('name');
        if (error) throw error;
        return data ?? [];
    }

    async getSessions(teamId: string) {
        const { data, error } = await this.supabase.db
            .from('lab_sessions')
            .select('*, user:users!user_id(name), tool:lab_tools(name, category)')
            .eq('team_id', teamId)
            .order('started_at', { ascending: false });
        if (error) throw error;
        return data ?? [];
    }

    async startSession(dto: StartSessionDto, userId: string) {
        const { data, error } = await this.supabase.db
            .from('lab_sessions')
            .insert({
                team_id: dto.teamId,
                user_id: userId,
                tool_id: dto.toolId ?? null,
                purpose: dto.purpose,
                status:  'active',
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async endSession(id: string, dto: EndSessionDto) {
        const { data, error } = await this.supabase.db
            .from('lab_sessions')
            .update({
                status:     dto.status,
                output_url: dto.outputUrl ?? null,
                notes:      dto.notes ?? null,
                ended_at:   new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
}
