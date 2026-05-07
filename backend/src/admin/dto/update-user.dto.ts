/**
 * Update-user DTO. All fields optional — admin can update any subset.
 *
 * @version 1.00
 */

import {
    IsBoolean,
    IsEmail,
    IsIn,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
} from 'class-validator';
import { AccountType, WorkRole } from '../../common/types/authenticated-user';

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name?: string;

    @IsOptional()
    @IsEmail()
    @MaxLength(254)
    email?: string;

    @IsOptional()
    @IsIn(['student', 'teacher', 'admin'])
    accountType?: AccountType;

    @IsOptional()
    @IsUUID()
    teamId?: string | null;

    @IsOptional()
    @IsIn(['pm', 'qa', 'dev', 'hardware'])
    workRole?: WorkRole;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class ResetPasswordDto {
    @IsString()
    @MinLength(8)
    @MaxLength(256)
    newPassword!: string;
}

export class AssignTeamDto {
    @IsUUID()
    teamId!: string;

    @IsIn(['pm', 'qa', 'dev', 'hardware'])
    workRole!: WorkRole;
}
