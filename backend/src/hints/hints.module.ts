import { Module } from '@nestjs/common';
import { HintsService } from './hints.service';
import { HintsController } from './hints.controller';
import { AIModule } from '../ai/ai.module';
import { RagModule } from '../rag/rag.module';

@Module({
    imports: [AIModule, RagModule],
    providers: [HintsService],
    controllers: [HintsController],
})
export class HintsModule {}
