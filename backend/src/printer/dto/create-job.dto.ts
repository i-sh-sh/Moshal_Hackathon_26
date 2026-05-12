import { IsInt, IsOptional, IsString, IsUrl, IsUUID, Max, Min } from 'class-validator';

export class CreateJobDto {
    @IsUUID()
    teamId: string;

    @IsOptional()
    @IsUUID()
    taskId?: string;

    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsUrl()
    fileUrl?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(20)
    copies?: number = 1;
}
