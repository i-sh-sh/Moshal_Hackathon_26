import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

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

    async generateHint(
        taskDescription: string,
        context: string,
        hintNumber: number,
    ): Promise<string> {
        const systemPrompt = `You are a supportive educational mentor in a hi-tech simulation for students.
Give hint #${hintNumber} for the task below. Rules:
- Be encouraging, never give the answer directly
- Hint #1: point to the general concept
- Hint #2: give a more specific direction
- Hint #3+: give a concrete actionable nudge (student is struggling)
- Keep hints under 3 sentences
- Write in English`;

        const userMessage = `Task: ${taskDescription}\nExtra context: ${context || 'none'}`;

        try {
            const message = await this.client.messages.create({
                model: this.model,
                max_tokens: 256,
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
