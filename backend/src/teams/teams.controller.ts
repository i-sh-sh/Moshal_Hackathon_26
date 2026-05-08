import { Controller, Get, Param, Query, Post, Body, HttpCode } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamNoteDto } from './dto/create-team-note.dto';
import { CreateStudentNoteDto } from './dto/create-student-note.dto';

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

    @Get(':id/notes')
    listNotes(@Param('id') teamId: string) {
        return this.teams.listGroupNotes(teamId);
    }

    @Post(':id/notes')
    @HttpCode(201)
    createNote(@Param('id') teamId: string, @Body() dto: CreateTeamNoteDto) {
        return this.teams.createGroupNote(teamId, dto.note, dto.teacherId);
    }

    @Get('students/:studentId/notes')
    listStudentNotes(@Param('studentId') studentId: string) {
        return this.teams.listStudentNotes(studentId);
    }

    @Post('students/:studentId/notes')
    @HttpCode(201)
    createStudentNote(@Param('studentId') studentId: string, @Body() dto: CreateStudentNoteDto) {
        return this.teams.createStudentNote(studentId, dto.note, dto.teacherId);
    }
}
