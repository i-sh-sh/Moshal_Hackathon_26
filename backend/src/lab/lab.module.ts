import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LabController } from './lab.controller';
import { LabService } from './lab.service';

@Module({
    imports: [AuthModule],
    controllers: [LabController],
    providers: [LabService],
    exports: [LabService],
})
export class LabModule {}
