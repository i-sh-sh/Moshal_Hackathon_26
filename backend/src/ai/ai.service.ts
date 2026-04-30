import { Injectable, Logger } from '@nestjs/common';

// ------------------------------------------------------------------
// Shared contract — keep in sync with frontend/types/types.ts
// ------------------------------------------------------------------
export interface AIAnalysisRequest {
    text: string;
    /** Free-form extra context: lesson id, monday item id, user level, etc. */
    context?: Record<string, unknown>;
}

export interface AIAnalysisResult {
    jargonScore: number;       // 0–100
    softSkillScore: number;    // 0–100
    detectedTerms: string[];
    suggestions: string[];
    /** Raw model response preserved for debugging / future parsing */
    rawResponse: unknown;
}

// ------------------------------------------------------------------

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);

    async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
        this.logger.debug(`Analyzing text (${request.text.length} chars)`);

        // TODO: pick your provider — OpenAI / Anthropic / Gemini / local Ollama
        // const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // TODO: inject your system prompt
        // const systemPrompt = `
        //   You are an educational assistant. Given a piece of text, return a JSON object:
        //   {
        //     "jargonScore": <0-100>,
        //     "softSkillScore": <0-100>,
        //     "detectedTerms": ["term1", "term2"],
        //     "suggestions": ["suggestion1"]
        //   }
        //   Context provided: ${JSON.stringify(request.context)}
        // `;

        // TODO: call the model
        // const response = await client.chat.completions.create({
        //   model: 'gpt-4o',
        //   messages: [
        //     { role: 'system', content: systemPrompt },
        //     { role: 'user',   content: request.text },
        //   ],
        //   response_format: { type: 'json_object' },
        // });
        // const parsed = JSON.parse(response.choices[0].message.content ?? '{}');

        // Stub response until real model is wired
        const parsed = {
            jargonScore: 0,
            softSkillScore: 0,
            detectedTerms: [],
            suggestions: ['AI provider not yet configured — see TODOs in AIService'],
        };

        return {
            jargonScore: parsed.jargonScore ?? 0,
            softSkillScore: parsed.softSkillScore ?? 0,
            detectedTerms: parsed.detectedTerms ?? [],
            suggestions: parsed.suggestions ?? [],
            rawResponse: parsed,
        };
    }
}