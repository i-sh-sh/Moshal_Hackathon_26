/**
 * Activity controller — `/api/activity/heartbeat`, `/api/activity/me`.
 *
 * During the additive-auth phase, the heartbeat endpoint accepts a `userId`
 * in the body as a fallback for clients that haven't integrated JWT yet.
 * Once the frontend sends Authorization headers, the body field can be
 * dropped and the JWT becomes the only source of identity.
 *
 * @version 1.00
 */

import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityService, ActivitySnapshot } from './activity.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('activity')
@Controller('activity')
export class ActivityController {
    constructor(private readonly activity: ActivityService) {}

    @Public()
    @Post('heartbeat')
    @HttpCode(200)
    async heartbeat(
        @Body() dto: HeartbeatDto,
        @CurrentUser() user?: AuthenticatedUser,
    ): Promise<ActivitySnapshot> {
        const userId = user?.userId ?? dto.userId;
        if (!userId) {
            throw new BadRequestException(
                'Heartbeat requires either an Authorization header or a userId in the body',
            );
        }
        return this.activity.heartbeat(userId, dto.deltaSeconds);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@CurrentUser() user: AuthenticatedUser): Promise<ActivitySnapshot> {
        return this.activity.getActivity(user.userId);
    }
}
