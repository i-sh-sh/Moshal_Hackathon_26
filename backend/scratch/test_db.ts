import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testConnections() {
    console.log('--- Testing Database Connections ---');

    // 1. Test Supabase REST Client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log(`\n1. Testing Supabase REST API...`);
    console.log(`URL: ${supabaseUrl}`);
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    } else {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
        if (error) {
            console.error(`❌ REST API failed: ${error.message}`);
        } else {
            console.log(`✅ REST API connected! User count: ${data === null ? '0 (or empty table)' : 'connected'}`);
        }
    }

    // 2. Test Direct Postgres Connection
    const dbUrl = process.env.DATABASE_URL;
    console.log(`\n2. Testing Direct Postgres Connection...`);
    console.log(`URL: ${dbUrl ? dbUrl.replace(/:[^:@]+@/, ':****@') : 'undefined'}`);

    if (!dbUrl) {
        console.error('❌ Missing DATABASE_URL');
    } else {
        const sql = postgres(dbUrl, {
            ssl: dbUrl.includes('sslmode=disable') ? false : 'require',
            connect_timeout: 10
        });

        try {
            const result = await sql`SELECT 1 as connected`;
            if (result && result[0] && result[0].connected === 1) {
                console.log('✅ Direct Postgres connected!');
            } else {
                console.error('❌ Direct Postgres failed: Unexpected result');
            }
        } catch (err: any) {
            console.error(`❌ Direct Postgres failed: ${err.message}`);
            if (err.message.includes('ENOTFOUND')) {
                console.log('💡 Hint: The hostname cannot be resolved. Check for typos or DNS issues.');
            }
        } finally {
            await sql.end();
        }
    }
}

testConnections().catch(err => {
    console.error('Unexpected error during test:', err);
});
