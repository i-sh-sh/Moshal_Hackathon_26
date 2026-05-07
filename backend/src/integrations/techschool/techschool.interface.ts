/**
 * Tech School LMS integration contract.
 *
 * Tomorrow this pulls live mission/lesson metadata to feed the RAG syllabus.
 * Today the mock returns fixture missions covering the three spec'd
 * sprint themes (gift / games / branding).
 *
 * @version 1.00
 */

export const TECHSCHOOL_PROVIDER_TOKEN = Symbol('TECHSCHOOL_PROVIDER');

export interface TechSchoolMission {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly englishTerms: readonly string[];
    readonly difficulty: 1 | 2 | 3;
    readonly estimatedMinutes: number;
    readonly topic: 'gift' | 'games' | 'branding';
}

export interface ListMissionsFilters {
    readonly topic?: 'gift' | 'games' | 'branding';
    readonly maxDifficulty?: 1 | 2 | 3;
}

export interface TechSchoolProvider {
    listMissions(filters?: ListMissionsFilters): Promise<TechSchoolMission[]>;
    getMission(id: string): Promise<TechSchoolMission | null>;
}
