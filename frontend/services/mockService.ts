import type {
    User,
    Activity,
    AIAnalysisResult,
    AIActivity,
    MondayActivity,
} from '~/types/types';

// ============================================================
// Mock data — replace each function with a real API call
// once the backend / Supabase is ready.
// ============================================================

export const mockUsers: User[] = [
    {
        id: 'usr-001',
        name: 'Alice Cohen',
        email: 'alice@example.com',
        currentTeamId: null,
        currentRole: 'designer',
        totalActiveTime: 0,
        lastLoginAt: '2026-04-28T10:30:00Z',
        createdAt: '2026-04-01T08:00:00Z',
        updatedAt: '2026-04-28T10:30:00Z',
    },
    {
        id: 'usr-002',
        name: 'Bob Levi',
        email: 'bob@example.com',
        currentTeamId: null,
        currentRole: 'editor',
        totalActiveTime: 0,
        lastLoginAt: '2026-04-29T11:00:00Z',
        createdAt: '2026-04-03T09:15:00Z',
        updatedAt: '2026-04-29T11:00:00Z',
    },
];

const mockAIActivities: AIActivity[] = [
    {
        id: 'act-ai-001',
        userId: 'usr-001',
        actionType: 'ai.jargon_scored',
        createdAt: '2026-04-29T14:00:00Z',
        payload: {
            jargonScore: 72,
            softSkillScore: 55,
            detectedTerms: ['MVP', 'sprint', 'stakeholder alignment'],
            suggestions: [
                'Try replacing "leverage synergies" with "work together".',
                'Clarify what "MVP" means for non-technical listeners.',
            ],
        },
    },
];

const mockMondayActivities: MondayActivity[] = [
    {
        id: 'act-monday-001',
        userId: 'usr-001',
        actionType: 'monday.item_created',
        createdAt: '2026-04-30T09:00:00Z',
        payload: {
            eventType: 'create_pulse',
            boardId: 987654321,
            itemId: 111222333,
            itemName: 'Onboarding Task #1',
        },
    },
];

// ============================================================
// Service API — mirrors what real API calls will look like
// ============================================================

export const mockService = {
    /** GET /users/:id */
    async getUser(id: string): Promise<User | undefined> {
        return mockUsers.find((u) => u.id === id);
    },

    /** GET /users */
    async listUsers(): Promise<User[]> {
        return mockUsers;
    },

    /** GET /activities?userId=:id */
    async listActivities(userId: string): Promise<Activity[]> {
        const all: Activity[] = [...mockAIActivities, ...mockMondayActivities];
        return all.filter((a) => a.userId === userId);
    },

    /** POST /ai/analyze  (mocked — returns canned result) */
    async analyzeText(_text: string): Promise<AIAnalysisResult> {
        return {
            jargonScore: 68,
            softSkillScore: 61,
            detectedTerms: ['agile', 'bandwidth', 'circle back'],
            suggestions: [
                '"Circle back" → "follow up later"',
                'Good use of active voice — keep it up.',
            ],
        };
    },
};