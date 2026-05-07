/**
 * Create-user DTO for the admin API.
 *
 * @version 1.00
 */

import {
    IsEmail,
    IsIn,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
} from 'class-validator';
import { AccountType, WorkRole } from '../../common/types/authenticated-user';

export class CreateUserDto {
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name!: string;

    @IsEmail()
    @MaxLength(254)
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(256)
    password!: string;

    @IsIn(['student', 'teacher', 'admin'])
    accountType!: AccountType;

    @IsOptional()
    @IsUUID()
    teamId?: string;

    @IsOptional()
    @IsIn(['designer', 'editor', 'qa', 'printer'])
    workRole?: WorkRole;
}
