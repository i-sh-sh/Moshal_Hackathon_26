/**
 * PostgreSQL connection pool wrapper (porsager/postgres).
 *
 * All SQL in the application goes through `db.sql` so that bind values are
 * parameterised by the tagged-template machinery — never string-concatenate
 * user input into a query.
 *
 * @version 1.10
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import postgres from 'postgres';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DbService.name);
    private _sql!: postgres.Sql;

    constructor(private readonly config: ConfigService) {}

    get sql(): postgres.Sql { return this._sql; }

    onModuleInit(): void {
        const { url, ssl, poolMax } = this.config.database;
        this._sql = postgres(url, {
            ssl: ssl === 'require' ? 'require' : false,
            max: poolMax,
            idle_timeout: 30,
            connect_timeout: 10,
        });
        this.logger.log(`Database pool initialised (max=${poolMax}, ssl=${ssl})`);
    }

    async onModuleDestroy(): Promise<void> {
        if (this._sql) await this._sql.end();
    }
}
