/**
 * QuizzesService — pre/post-mission knowledge quizzes.
 *
 * Pre quiz   : random sample of 5–7 questions from the pool
 *              (role-knowledge for the student's role + mission-specific).
 * Post quiz  : reuses the exact pre questions for the same student.
 * On post-submit, learning_gain = post.score − pre.score is stored.
 *
 * @version 1.00
 */

import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
    AttemptQuestion,
    AttemptWithQuestions,
    DEFAULT_QUIZ_LENGTH,
    MAX_QUIZ_LENGTH,
    MIN_QUIZ_LENGTH,
    QuizAttempt,
    QuizPhase,
    QuizQuestion,
} from './quizzes.types';
import { StartQuizDto } from './dto/start-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { StudentRole } from '../teacher/teacher.types';

@Injectable()
export class QuizzesService {
    private readonly logger = new Logger(QuizzesService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async startQuiz(
        challengeId: string,
        dto: StartQuizDto,
    ): Promise<AttemptWithQuestions> {
        const length = clampLength(dto.length ?? DEFAULT_QUIZ_LENGTH);

        // existing attempt for (user, challenge, phase) → return it
        const existing = await this.findAttempt(dto.userId, challengeId, dto.phase);
        if (existing) {
            const questions = await this.loadAttemptQuestions(existing.id);
            return { attempt: this.toApi(existing), questions };
        }

        const { data: user } = await this.supabase.db
            .from('users')
            .select('id, current_team_id, current_role')
            .eq('id', dto.userId)
            .maybeSingle();
        if (!user) throw new NotFoundException('User not found');

        if (dto.phase === 'pre') {
            return this.createPreAttempt(
                challengeId,
                dto.userId,
                user.current_team_id ?? null,
                user.current_role as StudentRole | null,
                length,
            );
        }

        // post: must have a completed pre attempt to copy from
        const pre = await this.findAttempt(dto.userId, challengeId, 'pre');
        if (!pre || !pre.submitted_at) {
            throw new BadRequestException(
                'Pre-quiz must be completed before starting the post-quiz',
            );
        }
        return this.createPostAttempt(
            pre as AttemptRow,
            user.current_team_id ?? null,
        );
    }

    async submitQuiz(
        attemptId: string,
        dto: SubmitQuizDto,
    ): Promise<{ score: number; total: number; learningGain: number | null }> {
        const { data: attempt } = await this.supabase.db
            .from('quiz_attempts')
            .select('*')
            .eq('id', attemptId)
            .maybeSingle();
        if (!attempt) throw new NotFoundException('Attempt not found');
        if (attempt.submitted_at) {
            throw new BadRequestException('Attempt already submitted');
        }

        const questions = await this.loadAttemptQuestions(attemptId);
        const correctMap = new Map(
            await this.loadCorrectIndexes(questions.map((q) => q.questionId)),
        );

        const now = new Date().toISOString();
        let score = 0;
        for (const a of dto.answers) {
            const aq = questions.find((q) => q.questionId === a.questionId);
            if (!aq) continue;
            const correctIndex = correctMap.get(a.questionId);
            const isCorrect = correctIndex === a.selectedIndex;
            if (isCorrect) score++;
            await this.supabase.db
                .from('quiz_attempt_questions')
                .update({
                    selected_index: a.selectedIndex,
                    is_correct: isCorrect,
                    answered_at: now,
                })
                .eq('id', aq.id);
        }

        let learningGain: number | null = null;
        if (attempt.phase === 'post' && attempt.paired_attempt_id) {
            const { data: pre } = await this.supabase.db
                .from('quiz_attempts')
                .select('score')
                .eq('id', attempt.paired_attempt_id)
                .maybeSingle();
            if (pre && typeof pre.score === 'number') {
                learningGain = score - pre.score;
            }
        }

        await this.supabase.db
            .from('quiz_attempts')
            .update({
                submitted_at: now,
                score,
                learning_gain: learningGain,
            })
            .eq('id', attemptId);

        return { score, total: attempt.total, learningGain };
    }

    async getMyAttempt(
        challengeId: string,
        userId: string,
        phase: QuizPhase,
    ): Promise<AttemptWithQuestions | null> {
        const attempt = await this.findAttempt(userId, challengeId, phase);
        if (!attempt) return null;
        const questions = await this.loadAttemptQuestions(attempt.id);
        return { attempt: this.toApi(attempt), questions };
    }

    async getResultsForChallenge(challengeId: string): Promise<unknown[]> {
        const { data } = await this.supabase.db
            .from('quiz_attempts')
            .select(
                'id, user_id, phase, score, total, submitted_at, learning_gain, paired_attempt_id',
            )
            .eq('challenge_id', challengeId)
            .order('user_id', { ascending: true });
        return data ?? [];
    }

    // ─── internal helpers ──────────────────────────────────────────────

    private async findAttempt(
        userId: string,
        challengeId: string,
        phase: QuizPhase,
    ): Promise<AttemptRow | null> {
        const { data } = await this.supabase.db
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', userId)
            .eq('challenge_id', challengeId)
            .eq('phase', phase)
            .maybeSingle();
        return (data as AttemptRow) ?? null;
    }

    private async createPreAttempt(
        challengeId: string,
        userId: string,
        teamId: string | null,
        role: StudentRole | null,
        length: number,
    ): Promise<AttemptWithQuestions> {
        const pool = await this.fetchPool(role, challengeId);
        if (pool.length < MIN_QUIZ_LENGTH) {
            throw new BadRequestException(
                `Question pool too small (have ${pool.length}, need at least ${MIN_QUIZ_LENGTH})`,
            );
        }
        const sampleSize = Math.min(length, pool.length);
        const sampled = shuffle(pool).slice(0, sampleSize);

        const { data: inserted, error } = await this.supabase.db
            .from('quiz_attempts')
            .insert({
                user_id: userId,
                team_id: teamId,
                challenge_id: challengeId,
                phase: 'pre',
                total: sampleSize,
            })
            .select('*')
            .single();
        if (error || !inserted) {
            throw new BadRequestException(error?.message ?? 'Failed to start quiz');
        }

        const rows = sampled.map((q, idx) => ({
            attempt_id: inserted.id,
            question_id: q.id,
            order_index: idx,
        }));
        await this.supabase.db.from('quiz_attempt_questions').insert(rows);

        const questions = await this.loadAttemptQuestions(inserted.id);
        return { attempt: this.toApi(inserted as AttemptRow), questions };
    }

    private async createPostAttempt(
        pre: AttemptRow,
        teamId: string | null,
    ): Promise<AttemptWithQuestions> {
        const preQuestions = await this.loadAttemptQuestions(pre.id);

        const { data: inserted, error } = await this.supabase.db
            .from('quiz_attempts')
            .insert({
                user_id: pre.user_id,
                team_id: teamId,
                challenge_id: pre.challenge_id,
                phase: 'post',
                total: pre.total,
                paired_attempt_id: pre.id,
            })
            .select('*')
            .single();
        if (error || !inserted) {
            throw new BadRequestException(error?.message ?? 'Failed to start post quiz');
        }

        const rows = preQuestions.map((q) => ({
            attempt_id: inserted.id,
            question_id: q.questionId,
            order_index: q.orderIndex,
        }));
        await this.supabase.db.from('quiz_attempt_questions').insert(rows);

        const questions = await this.loadAttemptQuestions(inserted.id);
        return { attempt: this.toApi(inserted as AttemptRow), questions };
    }

    private async fetchPool(
        role: StudentRole | null,
        challengeId: string,
    ): Promise<QuizQuestion[]> {
        const out: QuizQuestion[] = [];

        if (role) {
            const { data } = await this.supabase.db
                .from('quiz_questions')
                .select('*')
                .eq('scope', 'role')
                .eq('role', role);
            out.push(...((data as QuizQuestion[]) ?? []));
        }

        const { data: missionRows } = await this.supabase.db
            .from('quiz_questions')
            .select('*')
            .eq('scope', 'mission')
            .eq('challenge_id', challengeId);
        out.push(...((missionRows as QuizQuestion[]) ?? []));

        return out;
    }

    private async loadAttemptQuestions(
        attemptId: string,
    ): Promise<AttemptQuestion[]> {
        const { data: rows } = await this.supabase.db
            .from('quiz_attempt_questions')
            .select('id, question_id, order_index, selected_index, is_correct')
            .eq('attempt_id', attemptId)
            .order('order_index', { ascending: true });

        const ids = (rows ?? []).map((r: { question_id: string }) => r.question_id);
        if (ids.length === 0) return [];

        const { data: qs } = await this.supabase.db
            .from('quiz_questions')
            .select('id, prompt, options')
            .in('id', ids);
        const qMap = new Map(
            ((qs as { id: string; prompt: string; options: string[] }[]) ?? [])
                .map((q) => [q.id, q]),
        );

        return (rows ?? []).map((r: AttemptQuestionRow) => {
            const q = qMap.get(r.question_id);
            return {
                id: r.id,
                questionId: r.question_id,
                orderIndex: r.order_index,
                prompt: q?.prompt ?? '',
                options: q?.options ?? [],
                selectedIndex: r.selected_index,
                isCorrect: r.is_correct,
            };
        });
    }

    private async loadCorrectIndexes(
        questionIds: string[],
    ): Promise<[string, number][]> {
        if (questionIds.length === 0) return [];
        const { data } = await this.supabase.db
            .from('quiz_questions')
            .select('id, correct_index')
            .in('id', questionIds);
        return (data ?? []).map((q: { id: string; correct_index: number }) => [
            q.id,
            q.correct_index,
        ]);
    }

    private toApi(row: AttemptRow): QuizAttempt {
        return {
            id: row.id,
            userId: row.user_id,
            teamId: row.team_id,
            challengeId: row.challenge_id,
            phase: row.phase,
            startedAt: row.started_at,
            submittedAt: row.submitted_at,
            score: row.score,
            total: row.total,
            pairedAttemptId: row.paired_attempt_id,
            learningGain: row.learning_gain,
        };
    }
}

interface AttemptRow {
    id: string;
    user_id: string;
    team_id: string | null;
    challenge_id: string;
    phase: QuizPhase;
    started_at: string;
    submitted_at: string | null;
    score: number | null;
    total: number;
    paired_attempt_id: string | null;
    learning_gain: number | null;
}

interface AttemptQuestionRow {
    id: string;
    question_id: string;
    order_index: number;
    selected_index: number | null;
    is_correct: boolean | null;
}

function clampLength(n: number): number {
    return Math.max(MIN_QUIZ_LENGTH, Math.min(MAX_QUIZ_LENGTH, n));
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
