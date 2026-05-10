/**
 * Migration runner.
 *
 * Applies any unapplied numbered SQL files in `backend/migrations/` to the
 * database referenced by DATABASE_URL. Tracks applied migrations in a
 * `_migrations` table.
 *
 * Usage: `npm run migrate` (uses ts-node)
 *
 * Exit codes:
 *   0 — all migrations applied (or already up to date)
 *   1 — failure (DB unreachable, SQL error, etc.)
 *
 * @version 1.00
 */

import postgres from 'postgres';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', '..', 'supabase', 'migrations');

const log = (msg: string): void => console.log(`[migrate] ${msg}`);
const err = (msg: string): void => console.error(`[migrate] ✗ ${msg}`);

interface MigrationFile {
    readonly name: string;
    readonly path: string;
    readonly content: string;
}

async function discoverMigrations(): Promise<MigrationFile[]> {
    const entries = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = entries
        .filter((f) => f.endsWith('.sql'))
        .sort();
    const out: MigrationFile[] = [];
    for (const name of sqlFiles) {
        const fullPath = path.join(MIGRATIONS_DIR, name);
        const content = await fs.readFile(fullPath, 'utf-8');
        out.push({ name, path: fullPath, content });
    }
    return out;
}

async function ensureTable(sql: postgres.Sql): Promise<void> {
    await sql`
        create table if not exists public._migrations (
            name        text primary key,
            applied_at  timestamptz not null default now(),
            checksum    text not null
        )
    `;
}

function checksum(content: string): string {
    // Simple FNV-1a so we don't need a crypto import — collision-resistant
    // enough to detect accidental edits to applied migrations.
    let h = 0x811c9dc5;
    for (let i = 0; i < content.length; i += 1) {
        h ^= content.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return ('0000000' + (h >>> 0).toString(16)).slice(-8);
}

async function run(): Promise<void> {
    const url = process.env.DATABASE_URL;
    if (!url) {
        err('DATABASE_URL not set — see backend/.env.example');
        process.exit(1);
    }

    const sql = postgres(url, {
        ssl: url.includes('sslmode=disable') ? false : 'require',
        max: 1,
    });

    try {
        await ensureTable(sql);
        const applied = await sql<{ name: string; checksum: string }[]>`
            select name, checksum from public._migrations
        `;
        const appliedMap = new Map(applied.map((r) => [r.name, r.checksum]));

        const migrations = await discoverMigrations();
        if (migrations.length === 0) {
            log('No migration files found. Nothing to do.');
            return;
        }

        let appliedCount = 0;
        for (const m of migrations) {
            const sum = checksum(m.content);
            const prior = appliedMap.get(m.name);
            if (prior) {
                if (prior !== sum) {
                    err(
                        `${m.name} has been edited since it was applied ` +
                        `(checksum ${prior} → ${sum}). Migrations are immutable. ` +
                        `Create a new migration to apply changes.`,
                    );
                    process.exit(1);
                }
                continue;
            }
            log(`Applying ${m.name}...`);
            await sql.unsafe(m.content);
            await sql`
                insert into public._migrations (name, checksum)
                values (${m.name}, ${sum})
            `;
            log(`  ✓ ${m.name}`);
            appliedCount += 1;
        }

        if (appliedCount === 0) log('Database is up to date.');
        else log(`Applied ${appliedCount} migration(s).`);
    } catch (e) {
        err(`Migration failed: ${(e as Error).message}`);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

run();
