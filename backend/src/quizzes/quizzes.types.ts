/**
 * Pre/post-mission quiz domain types.
 *
 * Each mission (== challenge) has a pre-quiz and a post-quiz per student.
 * The post-quiz reuses the exact same questions sampled for the pre-quiz,
 * so we can compute learning_gain = post_score − pre_score.
 *
 * @version 1.00
 */

import { StudentRole } from '../teacher/teacher.types';

export type QuizPhase = 'pre' | 'post';
export type QuestionScope = 'role' | 'mission';

export const DEFAULT_QUIZ_LENGTH = 5;
export const MIN_QUIZ_LENGTH = 3;
export const MAX_QUIZ_LENGTH = 7;

export interface QuizQuestion {
    id: string;
    scope: QuestionScope;
    role: StudentRole | null;
    challenge_id: string | null;
    prompt: string;
    options: string[];
    correct_index: number;
}

export interface QuizAttempt {
    id: string;
    userId: string;
    teamId: string | null;
    challengeId: string;
    phase: QuizPhase;
    startedAt: string;
    submittedAt: string | null;
    score: number | null;
    total: number;
    pairedAttemptId: string | null;
    learningGain: number | null;
}

export interface AttemptQuestion {
    id: string;
    questionId: string;
    orderIndex: number;
    prompt: string;
    options: string[];
    selectedIndex: number | null;
    isCorrect: boolean | null;
}

export interface AttemptWithQuestions {
    attempt: QuizAttempt;
    questions: AttemptQuestion[];
}
