import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { AIService } from '../ai/ai.service';
import { RagService } from '../rag/rag.service';
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
        private readonly db: DbService,
        private readonly aiService: AIService,
        private readonly rag: RagService,
    ) {}

    async requestHint(dto: RequestHintDto): Promise<HintResponse> {
        const context = await this.rag.buildContext(dto.taskId ?? '', dto.userId, dto.teamId);
        const hintNumber = context.hintNumber;
        const hint = await this.aiService.generateHint(context);
        const pointsDeducted = hintNumber > FREE_HINTS ? POINTS_PER_EXTRA_HINT : 0;

        await this.db.sql`
            INSERT INTO hint_logs (user_id, team_id, task_id, hint_number, hint_text, points_deducted)
            VALUES (${dto.userId}, ${dto.teamId}, ${dto.taskId ?? null}, ${hintNumber}, ${hint}, ${pointsDeducted})
        `.catch((e: Error) => this.logger.error('Failed to log hint', e.message));

        await this.db.sql`
            INSERT INTO team_hint_counters (user_id, team_id, hint_count)
            VALUES (${dto.userId}, ${dto.teamId}, ${hintNumber})
            ON CONFLICT (user_id, team_id) DO UPDATE SET hint_count = EXCLUDED.hint_count
        `.catch((e: Error) => this.logger.error('Failed to update hint counter', e.message));

        if (pointsDeducted > 0) {
            await this.db.sql`SELECT deduct_team_score(${dto.teamId}, ${pointsDeducted})`
                .then(() => this.logger.log(`Deducted ${pointsDeducted} pts from team ${dto.teamId} (hint #${hintNumber})`))
                .catch((e: Error) => this.logger.error('Failed to deduct team score', e.message));
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
        const [row] = await this.db.sql<{ hint_count: number }[]>`
            SELECT hint_count FROM team_hint_counters
            WHERE user_id = ${userId} AND team_id = ${teamId}
        `;
        return row?.hint_count ?? 0;
    }

    async getHintHistory(userId: string, teamId: string): Promise<unknown[]> {
        return this.db.sql`
            SELECT * FROM hint_logs
            WHERE user_id = ${userId} AND team_id = ${teamId}
            ORDER BY created_at ASC
        `.catch(() => { throw new InternalServerErrorException('Failed to fetch hint history'); });
    }
}
