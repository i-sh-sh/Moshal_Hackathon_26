import { Type } from 'class-transformer';
import {
    IsArray,
    IsIn,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ROLE_PRIORITY, StudentRole } from '../teacher.types';

export class RoleAssignmentItemDto {
    @ApiProperty()
    @IsUUID()
    userId!: string;

    @ApiProperty({ enum: ROLE_PRIORITY })
    @IsIn(ROLE_PRIORITY as unknown as string[])
    role!: StudentRole;
}

export class AssignRolesDto {
    @ApiProperty({ type: [RoleAssignmentItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RoleAssignmentItemDto)
    assignments!: RoleAssignmentItemDto[];

    @ApiProperty({ required: false })
    @IsUUID()
    @IsOptional()
    challengeId?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    assignedBy?: string;
}
