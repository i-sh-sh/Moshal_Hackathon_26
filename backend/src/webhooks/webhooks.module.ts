import { Module } from '@nestjs/common';
import { MondayController } from './monday.controller';
import { TasksModule } from '../tasks/tasks.module';

@Module({
    imports: [TasksModule],
    controllers: [MondayController],
})
export class WebhooksModule {}
