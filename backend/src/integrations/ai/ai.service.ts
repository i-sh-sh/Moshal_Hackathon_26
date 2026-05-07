/**
 * AIService — domain-level methods backed by Azure OpenAI.
 *
 * All requests are routed through GatekeeperService — never call
 * `this.client` directly outside `gatekeeper.execute(...)`.
 *
 * Falls back to a deterministic mock string when no API key is configured,
 * so local dev and offline demos still work end-to-end.
 *
 * @version 1.20
 */

import { Injectable, Logger } from '@nestjs/common';
import { AzureOpenAI } from 'openai';
import type { HintContext } from '../../rag/rag.service';
import { ConfigService } from '../../config/config.service';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';

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

const HINT_UNAVAILABLE = 'Hint unavailable right now. Try again in a moment.';

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);
    private readonly client: AzureOpenAI | null;
    private readonly deployment: string;
    private readonly enabled: boolean;

    constructor(
        private readonly config: ConfigService,
        private readonly gatekeeper: GatekeeperService,
    ) {
        const { azureOpenAiEndpoint, azureOpenAiApiKey, azureOpenAiDeployment, azureOpenAiApiVersion } =
            this.config.integrations;

        this.enabled = azureOpenAiEndpoint.length > 0 && azureOpenAiApiKey.length > 0;
        this.deployment = azureOpenAiDeployment;

        this.client = this.enabled
            ? new AzureOpenAI({
                  endpoint: azureOpenAiEndpoint,
                  apiKey: azureOpenAiApiKey,
                  apiVersion: azureOpenAiApiVersion,
                  deployment: azureOpenAiDeployment,
              })
            : null;

        if (!this.enabled) {
            this.logger.warn('AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY not set — AI calls will return mock responses');
        }
    }

    async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
        if (!this.client) {
            return {
                jargonScore: 0,
                softSkillScore: 0,
                detectedTerms: [],
                suggestions: ['AI analysis disabled — Azure OpenAI not configured'],
                rawResponse: null,
            };
        }

        const systemPrompt =
            `You are an educational assistant for a hi-tech simulation platform.\n` +
            `Analyze the provided text and return ONLY a valid JSON object (no markdown):\n` +
            `{ "jargonScore": <0-100>, "softSkillScore": <0-100>, ` +
            `"detectedTerms": ["t1"], "suggestions": ["s1"] }\n` +
            `jargonScore: how much professional tech jargon is used (higher = more jargon).\n` +
            `softSkillScore: communication clarity & soft skills (higher = better).\n` +
            `Context: ${JSON.stringify(request.context ?? {})}`;

        try {
            const response = await this.gatekeeper.execute('azure', () =>
                this.client!.chat.completions.create({
                    model: this.deployment,
                    max_tokens: 512,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: request.text },
                    ],
                }),
            );
            const raw = response.choices[0]?.message?.content ?? '{}';
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
                suggestions: ['AI analysis temporarily unavailable'],
                rawResponse: null,
            };
        }
    }

    async generateHint(ctx: HintContext): Promise<string> {
        if (!this.client) return this.mockHint(ctx);

        const systemPrompt = this.buildHintSystemPrompt(ctx);
        const userMessage = `תן Hint #${ctx.hintNumber} למשימה: "${ctx.taskTitle}"`;

        try {
            const response = await this.gatekeeper.execute('azure', () =>
                this.client!.chat.completions.create({
                    model: this.deployment,
                    max_tokens: 300,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage },
                    ],
                }),
            );
            return response.choices[0]?.message?.content ?? HINT_UNAVAILABLE;
        } catch (err) {
            this.logger.error('generateHint failed', (err as Error).message);
            return HINT_UNAVAILABLE;
        }
    }

    private buildHintSystemPrompt(ctx: HintContext): string {
        const { syllabus, teamProgress, hintNumber, isLastFreeHint, isOverFreeLimit } = ctx;
        const techniquesBlock = syllabus.fusion360Techniques
            .map((t) => `  • ${t.name} — ${t.hebrewDescription} (${t.sprintRelevance})`)
            .join('\n');
        const depthInstruction =
            hintNumber === 1
                ? 'Hint #1: כוון לכיוון הכללי — שם הכלי או העקרון הרלוונטי, בלי לפרט.'
                : hintNumber === 2
                ? 'Hint #2: תן כיוון ספציפי יותר — איזה כלי להשתמש ואיך לגשת אליו.'
                : 'Hint #3+: תלמיד/ה מתקשה — תן צעד מעשי וישיר עם הנחיה ממוקדת.';
        const costNotice = isLastFreeHint
            ? '\n⚠️ זהו ה-Hint החינמי האחרון. רמז נוסף יעלה 10 נקודות לצוות.'
            : isOverFreeLimit
            ? `\n💸 Hint #${hintNumber} — נוכו 10 נקודות מהצוות.`
            : '';

        return `
אתה מנטור תומך ב-Tech School — תוכנית תלת-מימד לנוער.
תפקידך: לעזור לתלמיד/ה להתקדם מבלי לתת את התשובה ישירות.

═══════════════════════════════════
📚 SYLLABUS — ${syllabus.hebrewTitle}
═══════════════════════════════════
תקופה: ${syllabus.period} | מפגשים: ${syllabus.sessionsCount}
מטרת האתגר: ${syllabus.cblGoal}
נושאי ליבה: ${syllabus.coreTopics.join(' | ')}
אירוע שיא: ${syllabus.peakEvent}
הגשה: ${syllabus.submissionNote}

כלי Fusion 360 רלוונטיים:
${techniquesBlock}

מיומנויות: ${syllabus.skillsToLearn.join(' | ')}

═══════════════════════════════════
📋 CURRENT TASK
═══════════════════════════════════
כותרת: ${ctx.taskTitle}
תיאור: ${ctx.taskDescription}
תפקיד: ${ctx.assignedRole.toUpperCase()}

═══════════════════════════════════
👥 TEAM PROGRESS
═══════════════════════════════════
ספרינט: ${teamProgress.sprintTitle}
אושרו: ${teamProgress.approvedCount}/${teamProgress.totalCount}
${costNotice}

═══════════════════════════════════
📏 HINT RULES
═══════════════════════════════════
${depthInstruction}
- שלב עברית ואנגלית באופן טבעי
- אם רלוונטי — ציין כלי Fusion 360 ספציפי בשמו
- אל תתן את הפתרון המלא
- עד 3 משפטים
`.trim();
    }

    /**
     * Generates a DUDE bot reply given a recent message history and the
     * triggering student message.
     */
    async generateDudeResponse(history: { senderName: string; content: string; isBot: boolean }[], trigger: string): Promise<string> {
        if (!this.client) return this.mockDudeResponse(trigger);

        const systemPrompt =
            `אתה DUDE — בוט לימודי ידידותי בפלטפורמת Tech School.\n` +
            `אתה משתתף בצ'אט קבוצתי של צוות תלמידים שעובדים על אתגר תלת-מימד ב-Fusion 360.\n` +
            `תפקידך: לעודד, להכווין, לעזור להבין מושגים מבלי לתת תשובות ישירות.\n` +
            `כאשר תלמיד שואל שאלה — ענה בצורה מכוונת ולא ישירה.\n` +
            `כאשר הצוות שותק — שאל שאלה מעוררת מחשבה.\n` +
            `שמור על תשובות קצרות (עד 3 משפטים). שלב עברית ואנגלית טכנית.`;

        const contextMessages = history.slice(-10).map((m) => ({
            role: m.isBot ? 'assistant' as const : 'user' as const,
            content: `[${m.senderName}]: ${m.content}`,
        }));

        try {
            const response = await this.gatekeeper.execute('azure', () =>
                this.client!.chat.completions.create({
                    model: this.deployment,
                    max_tokens: 200,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...contextMessages,
                        { role: 'user', content: trigger },
                    ],
                }),
            );
            return response.choices[0]?.message?.content ?? 'המשיכו כך! 💪';
        } catch (err) {
            this.logger.error('generateDudeResponse failed', (err as Error).message);
            return this.mockDudeResponse(trigger);
        }
    }

    /**
     * Analyzes a list of student messages and returns jargon / soft-skill scores.
     * Used by DudeService to update student profiles after channel analysis.
     */
    async analyzeConversation(messages: string[], userId: string): Promise<AIAnalysisResult> {
        const combined = messages.join('\n');
        return this.analyze({ text: combined, context: { userId, source: 'group_chat' } });
    }

    private mockDudeResponse(trigger: string): string {
        if (trigger.endsWith('?')) {
            return '[DUDE Mock] שאלה מעולה! נסו לחשוב על הכלים שלמדתם בספרינט הנוכחי. (set AZURE_OPENAI keys for real responses)';
        }
        return '[DUDE Mock] ממשיכים לעבוד יפה! 💡 זכרו לתעד את ההחלטות שלכם. (set AZURE_OPENAI keys for real responses)';
    }

    private mockHint(ctx: HintContext): string {
        return (
            `[Mock hint #${ctx.hintNumber}] חשוב על איזה כלי ב-Fusion 360 ` +
            `יכול לעזור עם המשימה "${ctx.taskTitle}". (set AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY to enable real hints)`
        );
    }
}
