/**
 * POC composable — quiz state lives in-memory using DEMO_QUIZ_QUESTIONS.
 * No backend round-trip; learning_gain is computed locally from the paired
 * pre-attempt's score.
 */

import type {
    AttemptQuestion,
    AttemptWithQuestions,
    QuizAttempt,
    QuizPhase,
    QuizSubmitResult,
    StudentRole,
} from '~/types/types';
import { DEMO_QUIZ_QUESTIONS, DEMO_USERS } from '~/services/demoData';

interface InternalAttempt extends QuizAttempt {
    questions: AttemptQuestion[];
}

const attemptsStore = new Map<string, InternalAttempt>();

function attemptKey(userId: string, challengeId: string, phase: QuizPhase) {
    return `${userId}|${challengeId}|${phase}`;
}

function userRole(userId: string): StudentRole {
    const u = DEMO_USERS.find((u) => u.id === userId);
    return (u?.current_role ?? 'dev') as StudentRole;
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function nextId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useQuizzes() {
    async function start(
        challengeId: string,
        userId: string,
        phase: QuizPhase,
        length = 5,
    ): Promise<AttemptWithQuestions> {
        const k = attemptKey(userId, challengeId, phase);
        const existing = attemptsStore.get(k);
        if (existing) return { attempt: existing, questions: existing.questions };

        let questions: AttemptQuestion[];
        if (phase === 'pre') {
            // Mix: ~3 role-knowledge + ~2 mission-specific (clamped to length).
            const role = userRole(userId);
            const rolePool = DEMO_QUIZ_QUESTIONS.filter(
                (q) => q.scope === 'role' && q.role === role,
            );
            const missionPool = DEMO_QUIZ_QUESTIONS.filter(
                (q) => q.scope === 'mission' && q.missionId === challengeId,
            );

            const target = Math.min(length, rolePool.length + missionPool.length);
            const targetMission = Math.min(2, missionPool.length, target);
            const targetRole = Math.min(rolePool.length, target - targetMission);

            const picked = [
                ...shuffle(rolePool).slice(0, targetRole),
                ...shuffle(missionPool).slice(0, targetMission),
            ];
            const sampled = shuffle(picked);

            questions = sampled.map((q, idx) => ({
                id: nextId('aq'),
                questionId: q.id,
                orderIndex: idx,
                prompt: q.prompt,
                options: q.options,
                selectedIndex: null,
                isCorrect: null,
            }));
        } else {
            const pre = attemptsStore.get(attemptKey(userId, challengeId, 'pre'));
            if (!pre) {
                throw new Error('יש להשלים בוחן לפני המשימה לפני הבוחן השני');
            }
            questions = pre.questions.map((q) => ({
                id: nextId('aq'),
                questionId: q.questionId,
                orderIndex: q.orderIndex,
                prompt: q.prompt,
                options: q.options,
                selectedIndex: null,
                isCorrect: null,
            }));
        }

        const attempt: InternalAttempt = {
            id: nextId('att'),
            userId,
            teamId: null,
            challengeId,
            phase,
            startedAt: new Date().toISOString(),
            submittedAt: null,
            score: null,
            total: questions.length,
            pairedAttemptId: phase === 'post'
                ? attemptsStore.get(attemptKey(userId, challengeId, 'pre'))?.id ?? null
                : null,
            learningGain: null,
            questions,
        };
        attemptsStore.set(k, attempt);
        return { attempt, questions };
    }

    async function submit(
        attemptId: string,
        answers: { questionId: string; selectedIndex: number }[],
    ): Promise<QuizSubmitResult> {
        let target: InternalAttempt | undefined;
        for (const a of attemptsStore.values()) {
            if (a.id === attemptId) { target = a; break; }
        }
        if (!target) throw new Error('Attempt not found');

        let score = 0;
        for (const ans of answers) {
            const aq = target.questions.find((q) => q.questionId === ans.questionId);
            if (!aq) continue;
            const orig = DEMO_QUIZ_QUESTIONS.find((q) => q.id === ans.questionId);
            const isCorrect = !!orig && orig.correctIndex === ans.selectedIndex;
            aq.selectedIndex = ans.selectedIndex;
            aq.isCorrect = isCorrect;
            if (isCorrect) score++;
        }

        let learningGain: number | null = null;
        if (target.phase === 'post' && target.pairedAttemptId) {
            const pre = [...attemptsStore.values()].find((a) => a.id === target!.pairedAttemptId);
            if (pre && pre.score !== null) learningGain = score - pre.score;
        }

        target.submittedAt = new Date().toISOString();
        target.score = score;
        target.learningGain = learningGain;

        return { score, total: target.total, learningGain };
    }

    async function getMine(
        challengeId: string,
        userId: string,
        phase: QuizPhase,
    ): Promise<AttemptWithQuestions | null> {
        const a = attemptsStore.get(attemptKey(userId, challengeId, phase));
        return a ? { attempt: a, questions: a.questions } : null;
    }

    async function results(_challengeId: string): Promise<unknown[]> {
        return [...attemptsStore.values()];
    }

    return { start, submit, getMine, results };
}
