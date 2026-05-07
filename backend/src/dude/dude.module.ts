import { Module } from '@nestjs/common';
import { DudeService } from './dude.service';
import { DudeController } from './dude.controller';
import { ChatModule } from '../chat/chat.module';
import { AIModule } from '../integrations/ai/ai.module';
import { StudentProfileModule } from '../student-profile/student-profile.module';

@Module({
    imports: [ChatModule, AIModule, StudentProfileModule],
    providers: [DudeService],
    controllers: [DudeController],
    exports: [DudeService],
})
export class DudeModule {}
