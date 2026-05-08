import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface UserRow {
    id: string;
    name: string;
    email: string;
    account_type: string;
    current_team_id: string | null;
    current_role: string | null;
    total_active_time: number;
    last_login_at: string | null;
    created_at: string;
}

@Injectable()
export class UsersService {
    constructor(private readonly supabase: SupabaseService) {}

    async findAll(): Promise<UserRow[]> {
        const { data, error } = await this.supabase.db
            .from('users')
            .select('id, name, email, account_type, current_team_id, current_role, total_active_time, last_login_at, created_at')
            .order('name');

        if (error) throw new Error(error.message);
        return (data as UserRow[]) ?? [];
    }

    async findOne(id: string): Promise<UserRow> {
        const { data, error } = await this.supabase.db
            .from('users')
            .select('id, name, email, account_type, current_team_id, current_role, total_active_time, last_login_at, created_at')
            .eq('id', id)
            .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new NotFoundException(`User ${id} not found`);
        return data as UserRow;
    }
}
