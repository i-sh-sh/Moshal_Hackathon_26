/**
 * Admin controller — `/api/admin/*`. All endpoints require an `admin`
 * account.
 *
 * @version 1.00
 */

import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService, AdminUserView } from './admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
    AssignTeamDto,
    ResetPasswordDto,
    UpdateUserDto,
} from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuditLogService } from '../audit/audit-log.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
    constructor(
        private readonly admin: AdminService,
        private readonly audit: AuditLogService,
    ) {}

    @Get('users')
    listUsers(): Promise<AdminUserView[]> {
        return this.admin.listUsers();
    }

    @Post('users')
    @HttpCode(201)
    createUser(
        @Body() dto: CreateUserDto,
        @CurrentUser() actor: AuthenticatedUser,
    ): Promise<AdminUserView> {
        return this.admin.createUser(dto, actor);
    }

    @Get('users/:id')
    getUser(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminUserView> {
        return this.admin.getUser(id);
    }

    @Patch('users/:id')
    updateUser(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateUserDto,
        @CurrentUser() actor: AuthenticatedUser,
    ): Promise<AdminUserView> {
        return this.admin.updateUser(id, dto, actor);
    }

    @Delete('users/:id')
    @HttpCode(200)
    disableUser(
        @Param('id', new ParseUUIDPipe()) id: string,
        @CurrentUser() actor: AuthenticatedUser,
    ): Promise<AdminUserView> {
        return this.admin.disableUser(id, actor);
    }

    @Post('users/:id/reset-password')
    @HttpCode(204)
    async resetPassword(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: ResetPasswordDto,
        @CurrentUser() actor: AuthenticatedUser,
    ): Promise<void> {
        await this.admin.resetPassword(id, dto, actor);
    }

    @Post('users/:id/assign-team')
    assignTeam(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: AssignTeamDto,
        @CurrentUser() actor: AuthenticatedUser,
    ): Promise<AdminUserView> {
        return this.admin.assignTeam(id, dto, actor);
    }

    @Get('audit-log')
    auditLog(@Query('limit') limit?: string): Promise<unknown[]> {
        const n = limit ? parseInt(limit, 10) : 100;
        return this.audit.recent(Number.isFinite(n) ? n : 100);
    }
}
