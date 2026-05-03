import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AIService } from '../ai/ai.service';
import { RequestHintDto } from './dto/request-hint.dto';

const FREE_HINTS = 3;
const POINTS_PER_EXTRA_HINT = 10;

export interface HintResponse {
    hint: string;
    hintNumber: number;
    hintsRemaining: number;
    pointsDeducted: number;
    isFree: boolean;
}

@Injectable()
export class HintsService {
    private readonly logger = new Logger(HintsService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly aiService: AIService,
    ) {}

    async requestHint(dto: RequestHintDto): Promise<HintResponse> {
        const currentCount = await this.getHintCount(dto.userId, dto.teamId);
        const hintNumber = currentCount + 1;

        // Generate hint text via AI
        const hint = await this.aiService.generateHint(
            dto.taskDescription ?? 'No description provided',
            dto.context ?? '',
            hintNumber,
        );

        const pointsDeducted = hintNumber > FREE_HINTS ? POINTS_PER_EXTRA_HINT : 0;

        // Log this hint interaction
        const { error: logError } = await this.supabase.db
            .from('hint_logs')
            .insert({
                user_id: dto.userId,
                team_id: dto.teamId,
                task_id: dto.taskId ?? null,
                hint_number: hintNumber,
                hint_text: hint,
                points_deducted: pointsDeducted,
            });

        if (logError) {
            this.logger.error('Failed to log hint', logError.message);
        }

        // Upsert the counter
        const { error: counterError } = await this.supabase.db
            .from('team_hint_counters')
            .upsert(
                { user_id: dto.userId, team_id: dto.teamId, hint_count: hintNumber },
                { onConflict: 'user_id,team_id' },
            );

        if (counterError) {
            this.logger.error('Failed to update hint counter', counterError.message);
        }

        // Deduct team points if over free limit
        if (pointsDeducted > 0) {
            const { error: rpcError } = await this.supabase.db.rpc(
                'deduct_team_score',
                { p_team_id: dto.teamId, p_amount: pointsDeducted },
            );

            if (rpcError) {
                this.logger.error('Failed to deduct team score', rpcError.message);
            } else {
                this.logger.log(
                    `Deducted ${pointsDeducted} pts from team ${dto.teamId} (hint #${hintNumber})`,
                );
            }
        }

        return {
            hint,
            hintNumber,
            hintsRemaining: Math.max(0, FREE_HINTS - hintNumber),
            pointsDeducted,
            isFree: hintNumber <= FREE_HINTS,
        };
    }

    async getHintCount(userId: string, teamId: string): Promise<number> {
        const { data } = await this.supabase.db
            .from('team_hint_counters')
            .select('hint_count')
            .eq('user_id', userId)
            .eq('team_id', teamId)
            .maybeSingle();

        return data?.hint_count ?? 0;
    }

    async getHintHistory(userId: string, teamId: string): Promise<unknown[]> {
        const { data, error } = await this.supabase.db
            .from('hint_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('team_id', teamId)
            .order('created_at', { ascending: true });

        if (error) throw new InternalServerErrorException(error.message);
        return data ?? [];
    }
}
