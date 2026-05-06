import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { MondayApiModule } from '../integrations/monday/monday-api.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
    imports: [MondayApiModule, TeamsModule],
    providers: [TasksService],
    controllers: [TasksController],
    exports: [TasksService],
})
export class TasksModule {}
