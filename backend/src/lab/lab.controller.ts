import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { EndSessionDto } from './dto/end-session.dto';
import { StartSessionDto } from './dto/start-session.dto';
import { LabService } from './lab.service';

@ApiTags('lab')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab')
export class LabController {
    constructor(private readonly lab: LabService) {}

    /** Available lab tools catalog. */
    @Get('tools')
    getTools() {
        return this.lab.getTools();
    }

    /** All sessions for a team. */
    @Get('sessions')
    getSessions(@Query('teamId') teamId: string) {
        return this.lab.getSessions(teamId);
    }

    /** Student starts a new lab session. */
    @Post('sessions')
    startSession(
        @Body() dto: StartSessionDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.lab.startSession(dto, user.userId);
    }

    /** Student ends an active session. */
    @Patch('sessions/:id/end')
    endSession(
        @Param('id') id: string,
        @Body() dto: EndSessionDto,
    ) {
        return this.lab.endSession(id, dto);
    }
}
