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
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { PrinterService } from './printer.service';

@ApiTags('printer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('printer')
export class PrinterController {
    constructor(private readonly printer: PrinterService) {}

    /** All jobs for a team, newest first. */
    @Get('jobs')
    getJobs(@Query('teamId') teamId: string) {
        return this.printer.getJobs(teamId);
    }

    /** Student submits a new print job. */
    @Post('jobs')
    submit(
        @Body() dto: CreateJobDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.printer.submit(dto, user.userId);
    }

    /** Hardware-role student updates job status. */
    @Patch('jobs/:id/status')
    updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateJobStatusDto,
    ) {
        return this.printer.updateStatus(id, dto);
    }
}
