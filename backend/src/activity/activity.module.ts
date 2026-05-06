/**
 * Activity module.
 *
 * @version 1.00
 */

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Module({
    imports: [AuthModule],
    controllers: [ActivityController],
    providers: [ActivityService],
    exports: [ActivityService],
})
export class ActivityModule {}
