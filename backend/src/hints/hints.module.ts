import { Module } from '@nestjs/common';
import { HintsService } from './hints.service';
import { HintsController } from './hints.controller';
import { AIModule } from '../ai/ai.module';

@Module({
    imports: [AIModule],
    providers: [HintsService],
    controllers: [HintsController],
})
export class HintsModule {}
