import { Controller, Get, Param, Query } from '@nestjs/common';
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

    @Get('analytics/teacher-dashboard')
    getTeacherDashboard() {
        return this.teams.getTeacherDashboard();
    }

    @Get(':id')
    getTeam(@Param('id') id: string) {
        return this.teams.getTeamById(id);
    }

    @Get(':id/sprint-progress')
    getSprintProgress(
        @Param('id') teamId: string,
        @Query('sprintId') sprintId: string,
    ) {
        return this.teams.getSprintProgress(teamId, sprintId);
    }
}
