import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    HttpCode,
} from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { TasksService } from './tasks.service';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { QaReviewDto } from './dto/qa-review.dto';
import { PmReviewDto } from './dto/pm-review.dto';

class TeacherApproveDto {
    @IsUUID()
    taskId!: string;
}

@Controller('tasks')
export class TasksController {
    constructor(private readonly tasks: TasksService) {}

    @Get('team/:teamId')
    getByTeam(@Param('teamId') teamId: string) {
        return this.tasks.getTasksByTeam(teamId);
    }

    @Post('submit')
    @HttpCode(200)
    submit(@Body() dto: SubmitTaskDto) {
        return this.tasks.submitTask(dto);
    }

    @Post('qa-review')
    @HttpCode(200)
    qaReview(@Body() dto: QaReviewDto) {
        return this.tasks.qaReview(dto);
    }

    @Post('pm-review')
    @HttpCode(200)
    pmReview(@Body() dto: PmReviewDto) {
        return this.tasks.pmReview(dto);
    }

    @Post('teacher-approve')
    @HttpCode(200)
    teacherApprove(@Body() dto: TeacherApproveDto) {
        return this.tasks.teacherApprove(dto.taskId);
    }
}
