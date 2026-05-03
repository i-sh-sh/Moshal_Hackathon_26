import { Controller, Get } from '@nestjs/common';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
    constructor(private readonly teams: TeamsService) {}

    @Get('leaderboard/group')
    getGroupLeaderboard() {
        return this.teams.getGroupLeaderboard();
    }

    @Get('leaderboard/individual')
    getIndividualLeaderboard() {
        return this.teams.getIndividualLeaderboard();
    }

    @Get('analytics')
    getAnalytics() {
        return this.teams.getTeacherAnalytics();
    }
}
