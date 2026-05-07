// ============================================================
// TeamSprintUp — Shared Domain Types
// ============================================================

export type UserRole = 'pm' | 'qa' | 'dev' | 'hardware';

export interface User {
    id: string;
    name: string;
    email: string;
    currentTeamId: string | null;
    currentRole: UserRole | null;
    totalActiveTime: number;  // seconds
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
}

// ------------------------------------------------------------

export interface Team {
    id: string;
    name: string;
    accumulatedScore: number;
    sprintStatus: 'idle' | 'active' | 'completed';
    isCompleted: boolean;
    currentChallengeId: string | null;
    currentSprintId: string | null;
    createdAt: string;
    updatedAt: string;
}

// ------------------------------------------------------------

export interface Challenge {
    id: string;
    title: string;
    description: string | null;
    mondayBoardId: number | null;
    isActive: boolean;
    orderIndex: number;
    createdAt: string;
}

// ------------------------------------------------------------

export interface Sprint {
    id: string;
    challengeId: string;
    title: string;
    description: string | null;
    orderIndex: number;
    createdAt: string;
}

// ------------------------------------------------------------

export type TaskStatus =
    | 'pending'
    | 'qa_review'
    | 'pm_review'
    | 'teacher_review'
    | 'approved'
    | 'rejected';

export interface QaChecklist {
    isCompleted: boolean;
    hasErrors: boolean;
    improvements: string[];
}

export interface Task {
    id: string;
    sprintId: string;
    teamId: string;
    assignedRole: UserRole;
    title: string;
    description: string | null;
    status: TaskStatus;
    submissionUrl: string | null;
    submissionImageUrl: string | null;
    mondayItemId: number | null;
    qaChecklist: QaChecklist | null;
    qaNotes: string | null;
    pmNotes: string | null;
    submittedBy: string | null;
    reviewedByQa: string | null;
    reviewedByPm: string | null;
    createdAt: string;
    updatedAt: string;
}

// ------------------------------------------------------------

export interface HintResponse {
    hint: string;
    hintNumber: number;
    hintsRemaining: number;
    pointsDeducted: number;
    isFree: boolean;
}

// ------------------------------------------------------------

export interface GroupLeaderboardRow {
    id: string;
    name: string;
    accumulatedScore: number;
    sprintStatus: string;
    isCompleted: boolean;
    approvedTaskCount: number;
}

export interface IndividualLeaderboardRow {
    id: string;
    name: string;
    currentTeamId: string | null;
    currentRole: UserRole | null;
    approvedTasks: number;
    totalActiveTime: number;
    rank: number;
}

// ------------------------------------------------------------

export interface AIAnalysisResult {
    jargonScore: number;
    softSkillScore: number;
    detectedTerms: string[];
    suggestions: string[];
    rawResponse?: unknown;
}

// ------------------------------------------------------------

export interface BaseActivity {
    id: string;
    userId: string;
    actionType: string;
    createdAt: string;
}

export interface AIActivity extends BaseActivity {
    actionType: 'ai.jargon_scored' | string;
    payload: {
        jargonScore: number;
        softSkillScore: number;
        detectedTerms: string[];
        suggestions: string[];
    };
}

export interface MondayActivity extends BaseActivity {
    actionType: 'monday.item_created' | string;
    payload: {
        eventType: string;
        boardId: number;
        itemId: number;
        itemName: string;
    };
}

export type Activity = AIActivity | MondayActivity;

// ── DUDE — Chat & Student Profiles ─────────────────────────────────────────

export interface ChatChannel {
    id: string;
    teamId: string;
    name: string;
    createdAt: string;
}

export interface ChatMessage {
    id: string;
    channelId: string;
    senderId: string | null;
    senderName: string;
    isBot: boolean;
    content: string;
    createdAt: string;
}

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

export interface TeacherAlert {
    id: string;
    userId: string | null;
    channelId: string | null;
    alertType: 'knowledge_gap' | 'low_engagement' | 'stuck';
    message: string;
    isRead: boolean;
    createdAt: string;
}
