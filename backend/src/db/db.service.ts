import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import postgres from 'postgres';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DbService.name);
    private _sql!: postgres.Sql;

    get sql() { return this._sql; }

    onModuleInit() {
        this._sql = postgres(process.env.DATABASE_URL ?? '', {
            ssl: 'require',
            max: 5,
            idle_timeout: 30,
            connect_timeout: 10,
        });
        this.logger.log('Database connection pool initialised');
    }

    async onModuleDestroy() {
        await this._sql.end();
    }
}
