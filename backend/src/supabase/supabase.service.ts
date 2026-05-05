import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
    private readonly logger = new Logger(SupabaseService.name);
    private _client: SupabaseClient | null = null;

    get db(): SupabaseClient {
        if (!this._client) {
            const url = process.env.SUPABASE_URL;
            const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

            if (!url || !key) {
                this.logger.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — DB calls will fail');
            }

            this._client = createClient(url ?? 'https://placeholder.supabase.co', key ?? 'placeholder');
            this.logger.log('Supabase client initialised (service role)');
        }
        return this._client;
    }
}
