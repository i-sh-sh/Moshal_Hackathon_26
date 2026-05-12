import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
    constructor(private readonly supabase: SupabaseService) {}

    async findAll(teamId?: string) {
        let query = this.supabase.db
            .from('events')
            .select('*, creator:users!created_by(name)')
            .eq('is_active', true)
            .order('event_date', { ascending: true });

        if (teamId) {
            query = query.or(`team_id.is.null,team_id.eq.${teamId}`);
        } else {
            query = query.is('team_id', null);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data ?? [];
    }

    async create(dto: CreateEventDto, createdBy: string) {
        const { data, error } = await this.supabase.db
            .from('events')
            .insert({
                title:       dto.title,
                description: dto.description,
                event_date:  dto.eventDate,
                event_type:  dto.eventType ?? 'event',
                team_id:     dto.teamId ?? null,
                created_by:  createdBy,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async remove(id: string) {
        const { error } = await this.supabase.db
            .from('events')
            .update({ is_active: false })
            .eq('id', id);
        if (error) throw error;
    }
}
