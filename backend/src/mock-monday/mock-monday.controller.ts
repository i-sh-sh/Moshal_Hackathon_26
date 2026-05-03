import {
    Controller,
    Get,
    Param,
    Post,
    HttpCode,
} from '@nestjs/common';
import { MockMondayService } from './mock-monday.service';

@Controller('mock-monday')
export class MockMondayController {
    constructor(private readonly mockMonday: MockMondayService) {}

    @Get('challenges')
    listChallenges() {
        return this.mockMonday.listChallenges();
    }

    @Get('board/:challengeId')
    getBoard(@Param('challengeId') challengeId: string) {
        return this.mockMonday.getBoard(challengeId);
    }

    @Post('kickoff/:challengeId')
    @HttpCode(200)
    kickoff(@Param('challengeId') challengeId: string) {
        return this.mockMonday.kickoffChallenge(challengeId);
    }

    @Post('approve/:taskId')
    @HttpCode(200)
    approve(@Param('taskId') taskId: string) {
        return this.mockMonday.approveTask(taskId);
    }

    @Post('reject/:taskId')
    @HttpCode(200)
    reject(@Param('taskId') taskId: string) {
        return this.mockMonday.rejectTask(taskId);
    }
}
