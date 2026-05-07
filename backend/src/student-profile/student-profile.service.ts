/**
 * StudentProfileService — maintains per-student learning profiles.
 *
 * A profile aggregates jargon/soft-skill scores from conversation analyses.
 * After each update a snapshot is saved so teachers can track progress over time.
 * Profiles are created lazily on first update.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AIAnalysisResult } from '../integrations/ai/ai.service';

export interface StudentProfile {
    id: string;
    userId: string;
    jargonScore: number;
    softSkillScore: number;
    detectedTerms: string[];
    messagesAnalyzed: number;
    lastAnalyzedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ProfileSnapshot {
    id: string;
    userId: string;
    jargonScore: number;
    softSkillScore: number;
    detectedTerms: string[];
    snapshotAt: string;
}

@Injectable()
export class StudentProfileService {
    private readonly logger = new Logger(StudentProfileService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async getProfile(userId: string): Promise<StudentProfile | null> {
        const { data } = await this.supabase.db
            .from('student_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        return data ? this.mapProfile(data as any) : null;
    }

    async getAllProfiles(): Promise<StudentProfile[]> {
        const { data } = await this.supabase.db
            .from('student_profiles')
            .select('*')
            .order('updated_at', { ascending: false });

        return (data ?? []).map((r: any) => this.mapProfile(r));
    }

    async getSnapshots(userId: string): Promise<ProfileSnapshot[]> {
        const { data } = await this.supabase.db
            .from('profile_snapshots')
            .select('*')
            .eq('user_id', userId)
            .order('snapshot_at', { ascending: true });

        return (data ?? []).map((r: any) => this.mapSnapshot(r));
    }

    /**
     * Upserts profile from an AI analysis result and saves a snapshot.
     * Scores are averaged with the running weighted mean.
     */
    async updateFromAnalysis(userId: string, analysis: AIAnalysisResult): Promise<void> {
        const existing = await this.getProfile(userId);
        const analyzed = (existing?.messagesAnalyzed ?? 0) + 1;

        const jargonScore = existing
            ? (existing.jargonScore * existing.messagesAnalyzed + analysis.jargonScore) / analyzed
            : analysis.jargonScore;

        const softSkillScore = existing
            ? (existing.softSkillScore * existing.messagesAnalyzed + analysis.softSkillScore) / analyzed
            : analysis.softSkillScore;

        // Merge detected terms (unique)
        const terms = Array.from(
            new Set([...(existing?.detectedTerms ?? []), ...analysis.detectedTerms]),
        );

        const now = new Date().toISOString();

        const { error } = await this.supabase.db
            .from('student_profiles')
            .upsert(
                {
                    user_id: userId,
                    jargon_score: parseFloat(jargonScore.toFixed(2)),
                    soft_skill_score: parseFloat(softSkillScore.toFixed(2)),
                    detected_terms: terms,
                    messages_analyzed: analyzed,
                    last_analyzed_at: now,
                    updated_at: now,
                },
                { onConflict: 'user_id' },
            );

        if (error) {
            this.logger.error('Failed to upsert student profile', error.message);
            return;
        }

        // Save snapshot
        await this.supabase.db.from('profile_snapshots').insert({
            user_id: userId,
            jargon_score: parseFloat(jargonScore.toFixed(2)),
            soft_skill_score: parseFloat(softSkillScore.toFixed(2)),
            detected_terms: terms,
        });

        this.logger.log(
            `Profile updated for ${userId}: jargon=${jargonScore.toFixed(1)}, soft=${softSkillScore.toFixed(1)}`,
        );
    }

    /** Snapshot current profile without running a new analysis */
    async snapshot(userId: string): Promise<void> {
        const profile = await this.getProfile(userId);
        if (!profile) return;

        await this.supabase.db.from('profile_snapshots').insert({
            user_id: userId,
            jargon_score: profile.jargonScore,
            soft_skill_score: profile.softSkillScore,
            detected_terms: profile.detectedTerms,
        });
    }

    private mapProfile(r: any): StudentProfile {
        return {
            id: r.id,
            userId: r.user_id,
            jargonScore: parseFloat(r.jargon_score),
            softSkillScore: parseFloat(r.soft_skill_score),
            detectedTerms: r.detected_terms ?? [],
            messagesAnalyzed: r.messages_analyzed,
            lastAnalyzedAt: r.last_analyzed_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }

    private mapSnapshot(r: any): ProfileSnapshot {
        return {
            id: r.id,
            userId: r.user_id,
            jargonScore: parseFloat(r.jargon_score),
            softSkillScore: parseFloat(r.soft_skill_score),
            detectedTerms: r.detected_terms ?? [],
            snapshotAt: r.snapshot_at,
        };
    }
}
