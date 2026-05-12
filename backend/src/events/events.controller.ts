import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
    constructor(private readonly events: EventsService) {}

    /** All active events visible to a team (team-specific + global). */
    @Get()
    findAll(@Query('teamId') teamId?: string) {
        return this.events.findAll(teamId);
    }

    /** Teacher creates a new event. */
    @Post()
    create(
        @Body() dto: CreateEventDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.events.create(dto, user.userId);
    }

    /** Soft-delete (set is_active = false). */
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.events.remove(id);
    }
}
