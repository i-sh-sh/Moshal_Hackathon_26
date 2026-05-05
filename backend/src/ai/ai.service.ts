import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { HintContext } from '../rag/rag.service';

export interface AIAnalysisRequest {
    text: string;
    context?: Record<string, unknown>;
}

export interface AIAnalysisResult {
    jargonScore: number;
    softSkillScore: number;
    detectedTerms: string[];
    suggestions: string[];
    rawResponse: unknown;
}

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);
    private readonly client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    });
    private readonly model = 'claude-sonnet-4-6';

    async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
        this.logger.debug(`Analyzing text (${request.text.length} chars)`);

        const systemPrompt = `You are an educational assistant for a hi-tech simulation platform.
Analyze the provided text and return ONLY a valid JSON object (no markdown) with this exact shape:
{
  "jargonScore": <0-100>,
  "softSkillScore": <0-100>,
  "detectedTerms": ["term1", "term2"],
  "suggestions": ["suggestion1"]
}
jargonScore: how much professional tech jargon is used (higher = more jargon).
softSkillScore: quality of communication clarity and soft skills (higher = better).
Context: ${JSON.stringify(request.context ?? {})}`;

        try {
            const message = await this.client.messages.create({
                model: this.model,
                max_tokens: 512,
                system: systemPrompt,
                messages: [{ role: 'user', content: request.text }],
            });

            const raw = message.content[0].type === 'text' ? message.content[0].text : '{}';
            const parsed = JSON.parse(raw) as Partial<AIAnalysisResult>;

            return {
                jargonScore: parsed.jargonScore ?? 0,
                softSkillScore: parsed.softSkillScore ?? 0,
                detectedTerms: parsed.detectedTerms ?? [],
                suggestions: parsed.suggestions ?? [],
                rawResponse: parsed,
            };
        } catch (err) {
            this.logger.error('AI analysis failed', (err as Error).message);
            return {
                jargonScore: 0,
                softSkillScore: 0,
                detectedTerms: [],
                suggestions: ['AI analysis unavailable — check ANTHROPIC_API_KEY'],
                rawResponse: null,
            };
        }
    }

    async generateHint(ctx: HintContext): Promise<string> {
        const { syllabus, teamProgress, hintNumber, isLastFreeHint, isOverFreeLimit } = ctx;

        // ── Build the techniques reference block ──────────────────────────────
        const techniquesBlock = syllabus.fusion360Techniques
            .map((t) => `  • ${t.name} — ${t.hebrewDescription} (${t.sprintRelevance})`)
            .join('\n');

        // ── Hint-depth instruction based on number ────────────────────────────
        const depthInstruction =
            hintNumber === 1
                ? 'Hint #1: כוון לכיוון הכללי — שם הכלי או העקרון הרלוונטי, בלי לפרט.'
                : hintNumber === 2
                ? 'Hint #2: תן כיוון ספציפי יותר — איזה כלי להשתמש ואיך לגשת אליו.'
                : 'Hint #3+: תלמיד/ה מתקשה — תן צעד מעשי וישיר עם הנחיה ממוקדת.';

        // ── Point cost notice (shown on last free / over limit) ───────────────
        const costNotice = isLastFreeHint
            ? '\n⚠️ זהו ה-Hint החינמי האחרון. רמז נוסף יעלה 10 נקודות לצוות.'
            : isOverFreeLimit
            ? `\n💸 Hint #${hintNumber} — נוכו 10 נקודות מהצוות.`
            : '';

        const systemPrompt = `
אתה מנטור תומך ב-Tech School — תוכנית תלת-מימד לנוער.
תפקידך: לעזור לתלמיד/ה להתקדם מבלי לתת את התשובה ישירות.

═══════════════════════════════════
📚 SYLLABUS CONTEXT — ${syllabus.hebrewTitle}
═══════════════════════════════════
תקופה: ${syllabus.period} | מספר מפגשים: ${syllabus.sessionsCount}
מטרת האתגר: ${syllabus.cblGoal}
נושאי ליבה: ${syllabus.coreTopics.join(' | ')}
אירוע שיא: ${syllabus.peakEvent}
הגשה: ${syllabus.submissionNote}

כלי Fusion 360 רלוונטיים לאתגר זה:
${techniquesBlock}

מיומנויות שמפתחים: ${syllabus.skillsToLearn.join(' | ')}

═══════════════════════════════════
📋 CURRENT TASK
═══════════════════════════════════
כותרת: ${ctx.taskTitle}
תיאור: ${ctx.taskDescription}
תפקיד: ${ctx.assignedRole.toUpperCase()}

═══════════════════════════════════
👥 TEAM PROGRESS
═══════════════════════════════════
ספרינט נוכחי: ${teamProgress.sprintTitle}
משימות שאושרו: ${teamProgress.approvedCount}/${teamProgress.totalCount}
${costNotice}

═══════════════════════════════════
📏 HINT RULES
═══════════════════════════════════
${depthInstruction}
- שלב עברית ואנגלית באופן טבעי (כמו שמדברים בשיעור)
- אם רלוונטי — ציין כלי Fusion 360 ספציפי בשמו המדויק
- אל תתן את הפתרון המלא
- עד 3 משפטים
- התייחס למיומנויות ה-CBL של האתגר כשמתאים
`.trim();

        const userMessage =
            `תן Hint #${hintNumber} לתלמיד/ה שעובד/ת על המשימה: "${ctx.taskTitle}"`;

        try {
            const message = await this.client.messages.create({
                model: this.model,
                max_tokens: 300,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
            });

            return message.content[0].type === 'text'
                ? message.content[0].text
                : 'Hint unavailable right now.';
        } catch (err) {
            this.logger.error('generateHint failed', (err as Error).message);
            return 'Hint unavailable right now — check ANTHROPIC_API_KEY.';
        }
    }
}
