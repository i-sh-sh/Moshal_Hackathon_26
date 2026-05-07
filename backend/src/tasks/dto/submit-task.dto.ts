import { IsString, IsOptional, IsUrl } from 'class-validator';

export class SubmitTaskDto {
    @IsString()
    taskId!: string;

    @IsString()
    userId!: string;

    @IsString()
    @IsOptional()
    submissionUrl?: string;

    @IsString()
    @IsOptional()
    submissionImageUrl?: string;
}
