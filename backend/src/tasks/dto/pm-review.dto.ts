import { IsString, IsEnum, IsOptional } from 'class-validator';

export type PmDecision = 'approve' | 'reject';

export class PmReviewDto {
    @IsString()
    taskId!: string;

    @IsString()
    userId!: string;

    @IsEnum(['approve', 'reject'])
    decision!: PmDecision;

    @IsString()
    @IsOptional()
    notes?: string;
}
