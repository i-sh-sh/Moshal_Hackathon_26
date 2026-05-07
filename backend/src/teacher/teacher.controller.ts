/**
 * Teacher REST endpoints — challenge publishing + role assignments.
 *
 * @version 1.00
 */

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TeacherService } from './teacher.service';
import { PublishChallengeDto } from './dto/publish-challenge.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

@ApiTags('teacher')
@Controller('teacher')
export class TeacherController {
    constructor(private readonly teacher: TeacherService) {}

    @Get('challenges')
    getChallenges() {
        return this.teacher.getChallenges();
    }

    @Get('teams')
    getTeams() {
        return this.teacher.getTeams();
    }

    @Get('teams/:teamId/students-with-role-history')
    getStudentsWithRoleHistory(@Param('teamId') teamId: string) {
        return this.teacher.getStudentsWithRoleHistory(teamId);
    }

    @Post('challenges/:challengeId/publish')
    publishChallenge(
        @Param('challengeId') challengeId: string,
        @Body() dto: PublishChallengeDto,
    ) {
        return this.teacher.publishChallenge(challengeId, dto);
    }

    @Post('teams/:teamId/assign-roles')
    assignRoles(@Param('teamId') teamId: string, @Body() dto: AssignRolesDto) {
        return this.teacher.assignRoles(teamId, dto);
    }

    @Post('teams/:teamId/auto-assign-roles')
    autoAssignRoles(
        @Param('teamId') teamId: string,
        @Body() body: { challengeId?: string },
    ) {
        return this.teacher.autoAssignRoles(teamId, body?.challengeId);
    }
}
