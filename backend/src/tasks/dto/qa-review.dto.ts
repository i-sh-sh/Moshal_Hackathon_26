export type QaDecision = 'approve' | 'reject';

export interface QaChecklist {
    isCompleted: boolean;
    hasErrors: boolean;
    improvements: string[];
}

export class QaReviewDto {
    taskId!: string;
    userId!: string;
    decision!: QaDecision;
    checklist!: QaChecklist;
    notes?: string;
}
