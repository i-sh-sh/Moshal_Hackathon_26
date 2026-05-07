import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
    private readonly logger = new Logger(SupabaseService.name);
    private client!: SupabaseClient;

    onModuleInit(): void {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !key) {
            this.logger.warn(
                'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — DB calls will fail',
            );
        }

        // Service-role key bypasses RLS — backend is trusted
        this.client = createClient(url ?? '', key ?? '');
        this.logger.log('Supabase client initialised (service role)');
    }

    get db(): SupabaseClient {
        return this.client;
    }
}
