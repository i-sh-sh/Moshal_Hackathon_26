import { IsString, IsOptional } from 'class-validator';

export class RequestHintDto {
    @IsString()
    userId!: string;

    @IsString()
    teamId!: string;

    @IsString()
    @IsOptional()
    taskId?: string;

    @IsString()
    @IsOptional()
    taskDescription?: string;

    @IsString()
    @IsOptional()
    context?: string;
}
