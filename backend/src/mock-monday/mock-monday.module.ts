import { Module } from '@nestjs/common';
import { MockMondayService } from './mock-monday.service';
import { MockMondayController } from './mock-monday.controller';
import { TasksModule } from '../tasks/tasks.module';

@Module({
    imports: [TasksModule],
    providers: [MockMondayService],
    controllers: [MockMondayController],
})
export class MockMondayModule {}
