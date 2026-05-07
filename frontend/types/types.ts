// ============================================================
// TeamSprintUp — Shared Domain Types
// ============================================================

// Internal role keys stay as the original DB taxonomy. Display labels
// ("Designer", "Editor", "QA", "Printer") are mapped via ROLE_LABELS below.
export type StudentRole = 'pm' | 'qa' | 'dev' | 'hardware';

// Kept as alias so existing code (Task.assignedRole, etc.) still type-checks.
export type UserRole = StudentRole;

export const ROLE_PRIORITY: StudentRole[] = ['pm', 'qa', 'dev', 'hardware'];

// Mapping: pm → Editor, qa → QA, dev → Designer, hardware → Printer
export const ROLE_LABELS: Record<StudentRole, string> = {
    pm:       'Editor',
    qa:       'QA',
    dev:      'Designer',
    hardware: 'Printer',
};

export const ROLE_EMOJI: Record<StudentRole, string> = {
    pm:       '✂️',
    qa:       '🔍',
    dev:      '📐',
    hardware: '🖨️',
};

export interface RoleCount {
    pm: number;
    qa: number;
    dev: number;
    hardware: number;
}

export interface StudentWithRoleHistory {
    id: string;
    name: string;
    email: string;
    currentRole: StudentRole | null;
    lastRoles: StudentRole[];
    roleCount: RoleCount;
    suggestedRole: StudentRole | null;
}

export interface TeacherPublishPayload {
    teamId: string;
}

export interface TeacherAssignRolesPayload {
    assignments: { userId: string; role: StudentRole }[];
    challengeId?: string;
    assignedBy?: string;
}

// ── Pre/post-mission quizzes ───────────────────────────────────────────────
export type QuizPhase = 'pre' | 'post';

export interface QuizAttempt {
    id: string;
    userId: string;
    teamId: string | null;
    challengeId: string;
    phase: QuizPhase;
    startedAt: string;
    submittedAt: string | null;
    score: number | null;
    total: number;
    pairedAttemptId: string | null;
    learningGain: number | null;
}

export interface AttemptQuestion {
    id: string;
    questionId: string;
    orderIndex: number;
    prompt: string;
    options: string[];
    selectedIndex: number | null;
    isCorrect: boolean | null;
}

export interface AttemptWithQuestions {
    attempt: QuizAttempt;
    questions: AttemptQuestion[];
}

export interface QuizSubmitResult {
    score: number;
    total: number;
    learningGain: number | null;
}

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

// ── Teacher Analytics Dashboard ──────────────────────────────────────

export interface TeacherDashboardSummary {
    totalStudents: number;
    totalTeams: number;
    activeTeams: number;
    approvedTasks: number;
    totalTasks: number;
    averageProgressPercent: number;
}

export interface StudentInsight {
    userId: string;
    name: string;
    email: string;
    teamId: string | null;
    teamName: string | null;
    role: UserRole | null;
    totalActiveTimeSeconds: number;
    totalTasks: number;
    approvedTasks: number;
    hintCount: number;
    tasksPerHour: number | null;
    riskLevel: 'ok' | 'watch' | 'needs_attention';
    insightReason: string;
}

export interface TeamProgress {
    teamId: string;
    teamName: string;
    score: number;
    sprintStatus: string;
    isCompleted: boolean;
    totalTasks: number;
    approvedTasks: number;
    progressPercent: number;
    totalHints: number;
}

export interface DifficultTask {
    taskId: string;
    title: string;
    teamName: string;
    hintCount: number;
    status: string;
}

export interface TeacherDashboardResponse {
    summary: TeacherDashboardSummary;
    students: StudentInsight[];
    teams: TeamProgress[];
    difficultTasks: DifficultTask[];
}
