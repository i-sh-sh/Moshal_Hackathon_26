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
import { AzureOpenAI, toFile } from 'openai';
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
    struggleAreas: string[];
    alertLevel: 'none' | 'low' | 'medium' | 'high';
    alertMessage: string;
    rawResponse: unknown;
}

const HINT_UNAVAILABLE = 'Hint unavailable right now. Try again in a moment.';

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);
    private readonly client: AzureOpenAI | null;
    private readonly deployment: string;
    private readonly whisperDeployment: string;
    private readonly enabled: boolean;

    constructor(
        private readonly config: ConfigService,
        private readonly gatekeeper: GatekeeperService,
    ) {
        const {
            azureOpenAiEndpoint,
            azureOpenAiApiKey,
            azureOpenAiDeployment,
            azureOpenAiApiVersion,
            azureOpenAiWhisperDeployment,
        } = this.config.integrations;

        this.enabled = azureOpenAiEndpoint.length > 0 && azureOpenAiApiKey.length > 0;
        this.deployment = azureOpenAiDeployment;
        this.whisperDeployment = azureOpenAiWhisperDeployment;

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
                struggleAreas: [],
                alertLevel: 'none' as const,
                alertMessage: '',
                rawResponse: null,
            };
        }

        const systemPrompt =
            `You are an educational assistant for a hi-tech simulation platform (Tech School).\n` +
            `Analyze the provided student messages and return ONLY a valid JSON object (no markdown):\n` +
            `{\n` +
            `  "jargonScore": <0-100>,\n` +
            `  "softSkillScore": <0-100>,\n` +
            `  "detectedTerms": ["tech term 1", ...],\n` +
            `  "suggestions": ["pedagogical suggestion 1", ...],\n` +
            `  "struggleAreas": ["specific topic/task the student struggled with", ...],\n` +
            `  "alertLevel": "none|low|medium|high",\n` +
            `  "alertMessage": "Brief Hebrew sentence for the teacher about this student"\n` +
            `}\n` +
            `jargonScore: professional tech jargon usage (higher = more).\n` +
            `softSkillScore: communication clarity & collaboration (higher = better).\n` +
            `struggleAreas: specific topics, tools, or tasks where student showed confusion or repeated questions. Empty array if none.\n` +
            `alertLevel: none=all good, low=minor confusion, medium=needs check-in, high=clearly stuck or frustrated.\n` +
            `alertMessage: if alertLevel != none, write a short Hebrew sentence for the teacher (e.g. "התלמיד מתקשה עם ייצוא STL"). Otherwise empty string.\n` +
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
                struggleAreas: parsed.struggleAreas ?? [],
                alertLevel: parsed.alertLevel ?? 'none',
                alertMessage: parsed.alertMessage ?? '',
                rawResponse: parsed,
            };
        } catch (err) {
            this.logger.error('AI analysis failed', (err as Error).message);
            return {
                jargonScore: 0,
                softSkillScore: 0,
                detectedTerms: [],
                suggestions: ['AI analysis temporarily unavailable'],
                struggleAreas: [],
                alertLevel: 'none' as const,
                alertMessage: '',
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
     * Transcribes an audio buffer to text using Azure OpenAI Whisper.
     * Accepts any browser-recorded format (webm, ogg, mp4, wav).
     */
    async transcribeAudio(buffer: Buffer, mimeType = 'audio/webm'): Promise<string> {
        if (!this.client) {
            return '[Mock transcription] speech-to-text requires AZURE_OPENAI_API_KEY + AZURE_OPENAI_WHISPER_DEPLOYMENT';
        }
        try {
            const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'webm';
            const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });
            const result = await this.gatekeeper.execute('azure', () =>
                this.client!.audio.transcriptions.create({
                    file,
                    model: this.whisperDeployment,
                }),
            );
            return result.text ?? '';
        } catch (err) {
            this.logger.error('transcribeAudio failed', (err as Error).message);
            return '';
        }
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

    /**
     * Private 1-on-1 mentor chat with DUDE.
     * Answers freely but stays within Tech School challenge context.
     */
    async privateMentorChat(
        message: string,
        history: { role: 'user' | 'assistant'; content: string }[],
    ): Promise<string> {
        if (!this.client) {
            return `[DUDE Mock] שלום! אני DUDE המנטור הפרטי שלך. שאל/י אותי כל דבר שקשור לאתגרים, Fusion 360, תפקידי הצוות, תהליכי עבודה ועוד. (set AZURE_OPENAI keys for real responses)`;
        }

        const systemPrompt =
            `אתה DUDE — מנטור אישי וחכם בפלטפורמת Tech School לנוער.\n` +
            `אתה מנהל שיחה פרטית עם תלמיד/ה אחד/ת.\n` +
            `תוכל לדון בכל נושא שקשור לאתגרים הטכנולוגיים:\n` +
            `  • Fusion 360 — עיצוב תלת-מימד, STL, הדפסה, מיפוי\n` +
            `  • תפקידי הצוות — PM, QA, Dev, Hardware\n` +
            `  • תהליכי עבודה — Agile, ספרינטים, ביקורת קוד, תיעוד\n` +
            `  • מיומנויות רכות — תקשורת, ניהול זמן, עבודת צוות\n` +
            `  • שאלות טכניות כלליות בגבולות האתגרים\n` +
            `אל תדון בנושאים שאינם קשורים ל-Tech School.\n` +
            `סגנון: ידידותי, מעודד, קצר (עד 4 משפטים). שלב עברית ואנגלית טכנית.`;

        const contextMessages = history.slice(-12).map((m) => ({
            role: m.role,
            content: m.content,
        }));

        try {
            const response = await this.gatekeeper.execute('azure', () =>
                this.client!.chat.completions.create({
                    model: this.deployment,
                    max_tokens: 300,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...contextMessages,
                        { role: 'user', content: message },
                    ],
                }),
            );
            return response.choices[0]?.message?.content ?? 'לא הצלחתי לענות כרגע, נסה שוב.';
        } catch (err) {
            this.logger.error('privateMentorChat failed', (err as Error).message);
            return 'שגיאה זמנית — נסה שוב בעוד רגע.';
        }
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
