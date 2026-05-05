import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { AIModule } from './ai/ai.module';
import { TasksModule } from './tasks/tasks.module';
import { HintsModule } from './hints/hints.module';
import { TeamsModule } from './teams/teams.module';
import { MondayApiModule } from './monday/monday-api.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
    imports: [
        DbModule,          // @Global — injected everywhere
        AIModule,
        MondayApiModule,
        TeamsModule,
        TasksModule,
        HintsModule,
        WebhooksModule,
    ],
})
export class AppModule {}
