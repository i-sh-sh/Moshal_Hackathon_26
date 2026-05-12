import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';

@Injectable()
export class PrinterService {
    constructor(private readonly supabase: SupabaseService) {}

    async getJobs(teamId: string) {
        const { data, error } = await this.supabase.db
            .from('printer_jobs')
            .select('*, submitter:users!submitted_by(name), task:tasks(title)')
            .eq('team_id', teamId)
            .order('submitted_at', { ascending: false });
        if (error) throw error;
        return data ?? [];
    }

    async submit(dto: CreateJobDto, userId: string) {
        const { data, error } = await this.supabase.db
            .from('printer_jobs')
            .insert({
                team_id:      dto.teamId,
                submitted_by: userId,
                task_id:      dto.taskId ?? null,
                title:        dto.title,
                description:  dto.description,
                file_url:     dto.fileUrl ?? null,
                copies:       dto.copies ?? 1,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async updateStatus(id: string, dto: UpdateJobStatusDto) {
        const update: Record<string, unknown> = {
            status:         dto.status,
            operator_notes: dto.operatorNotes ?? null,
        };
        if (dto.status === 'done' || dto.status === 'cancelled') {
            update.completed_at = new Date().toISOString();
        }
        const { data, error } = await this.supabase.db
            .from('printer_jobs')
            .update(update)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
}
