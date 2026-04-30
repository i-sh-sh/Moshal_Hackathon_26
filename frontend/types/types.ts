// ============================================================
// Core domain types
// Kept intentionally loose where the product is still undefined.
// ============================================================

/**
 * Mirrors the `users` table.
 * `metadata` is a free-form bucket — extend as the product solidifies.
 */
export interface User {
    id: string;           // UUID
    email: string;
    createdAt: string;    // ISO-8601
    updatedAt: string;
    metadata: UserMetadata;
}

/**
 * Known metadata fields — all optional because nothing is guaranteed yet.
 * Add new fields here as product requirements crystallise.
 */
export interface UserMetadata {
    displayName?: string;
    role?: 'learner' | 'mentor' | 'admin' | string;
    mondayUserId?: number;
    preferredLanguage?: 'en' | 'he' | string;
    skillLevel?: 'beginner' | 'intermediate' | 'advanced' | string;
    [key: string]: unknown; // escape hatch
}

// ------------------------------------------------------------

/**
 * Mirrors the `activities` table.
 * `payload` schema varies by `actionType` — see comments per type below.
 */
export interface Activity<TPayload = Record<string, unknown>> {
    id: string;
    userId: string;
    actionType: ActivityActionType | string;
    createdAt: string;
    payload: TPayload;
}

/**
 * Known action types — add as Monday/AI/lesson flows are defined.
 */
export type ActivityActionType =
    | 'monday.item_created'
    | 'monday.item_updated'
    | 'monday.status_changed'
    | 'ai.jargon_scored'
    | 'ai.soft_skill_scored'
    | 'lesson.started'
    | 'lesson.completed';

// ------------------------------------------------------------

/**
 * Result returned by the backend AIService and stored in activities.payload
 * when actionType is 'ai.jargon_scored' or 'ai.soft_skill_scored'.
 */
export interface AIAnalysisResult {
    jargonScore: number;       // 0–100
    softSkillScore: number;    // 0–100
    detectedTerms: string[];
    suggestions: string[];
    /** Raw model output kept for debugging */
    rawResponse?: unknown;
}

// ------------------------------------------------------------

/** Typed alias for AI-related activities */
export type AIActivity = Activity<AIAnalysisResult>;

/** Typed alias for Monday webhook activities */
export type MondayActivity = Activity<{
    eventType: string;
    boardId?: number;
    itemId?: number;
    [key: string]: unknown;
}>;