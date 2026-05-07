import type {
    AttemptWithQuestions,
    QuizPhase,
    QuizSubmitResult,
} from '~/types/types';

export function useQuizzes() {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    async function start(
        challengeId: string,
        userId: string,
        phase: QuizPhase,
        length?: number,
    ): Promise<AttemptWithQuestions> {
        return $fetch<AttemptWithQuestions>(
            `${base}/quizzes/missions/${challengeId}/start`,
            { method: 'POST', body: { userId, phase, length } },
        );
    }

    async function submit(
        attemptId: string,
        answers: { questionId: string; selectedIndex: number }[],
    ): Promise<QuizSubmitResult> {
        return $fetch<QuizSubmitResult>(
            `${base}/quizzes/attempts/${attemptId}/submit`,
            { method: 'POST', body: { answers } },
        );
    }

    async function getMine(
        challengeId: string,
        userId: string,
        phase: QuizPhase,
    ): Promise<AttemptWithQuestions | null> {
        return $fetch<AttemptWithQuestions | null>(
            `${base}/quizzes/missions/${challengeId}/me`,
            { params: { userId, phase } },
        );
    }

    async function results(challengeId: string): Promise<unknown[]> {
        return $fetch<unknown[]>(
            `${base}/quizzes/missions/${challengeId}/results`,
        );
    }

    return { start, submit, getMine, results };
}
