export type PmDecision = 'approve' | 'reject';

export class PmReviewDto {
    taskId!: string;
    userId!: string;
    decision!: PmDecision;
    notes?: string;
}
