import { Module } from '@nestjs/common';
import { StudentProfileService } from './student-profile.service';
import { StudentProfileController } from './student-profile.controller';

@Module({
    providers: [StudentProfileService],
    controllers: [StudentProfileController],
    exports: [StudentProfileService],
})
export class StudentProfileModule {}
