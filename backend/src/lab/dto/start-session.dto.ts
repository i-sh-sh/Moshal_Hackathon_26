import { IsOptional, IsString, IsUUID } from 'class-validator';

export class StartSessionDto {
    @IsUUID()
    teamId: string;

    @IsOptional()
    @IsUUID()
    toolId?: string;

    @IsString()
    purpose: string;
}
