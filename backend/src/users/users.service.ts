import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';

export interface UserRow {
    id: string;
    name: string;
    email: string;
    current_team_id: string | null;
    current_role: string | null;
    total_active_time: number;
    last_login_at: string | null;
    created_at: string;
}

@Injectable()
export class UsersService {
    constructor(private readonly db: DbService) {}

    async findAll(): Promise<UserRow[]> {
        return this.db.sql<UserRow[]>`
            SELECT id, name, email, current_team_id, current_role,
                   total_active_time, last_login_at, created_at
            FROM users ORDER BY name
        `;
    }

    async findOne(id: string): Promise<UserRow> {
        const [row] = await this.db.sql<UserRow[]>`
            SELECT id, name, email, current_team_id, current_role,
                   total_active_time, last_login_at, created_at
            FROM users WHERE id = ${id}
        `;
        if (!row) throw new NotFoundException(`User ${id} not found`);
        return row;
    }
}
