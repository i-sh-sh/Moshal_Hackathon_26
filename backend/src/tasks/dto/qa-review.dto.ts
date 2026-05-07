import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';

export type QaDecision = 'approve' | 'reject';

export interface QaChecklist {
    isCompleted: boolean;
    hasErrors: boolean;
    improvements: string[];
}

export class QaReviewDto {
    @IsString()
    taskId!: string;

    @IsString()
    userId!: string;

    @IsEnum(['approve', 'reject'])
    decision!: QaDecision;

    @IsObject()
    checklist!: QaChecklist;

    @IsString()
    @IsOptional()
    notes?: string;
}
