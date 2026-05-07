/**
 * POC demo fixtures — used by composables when running without a backend.
 * Mirrors what backend/src/seed.ts inserts into the DB, so the demo UI looks
 * the same whether or not Supabase is reachable.
 *
 * Internal role keys: pm/qa/dev/hardware (matches DB).
 * Display labels: Editor / QA / Designer / Printer (via ROLE_LABELS).
 */

import type {
    Challenge,
    Team,
    StudentRole,
    StudentWithRoleHistory,
} from '~/types/types';

// ── Missions (challenges) — 3 real TechSchool missions ─────────────────
export const DEMO_MISSIONS: Challenge[] = [
    {
        id: 'aaaa0001-0000-0000-0000-000000000000',
        title: 'אתגר מספר 1 – מתנה',
        description:
            'מגנים, מדליות ומתנות מודפסות. נלמד טכניקות מידול בסיסיות ומתקדמות, נעצב פריט אישי בעל ' +
            'משמעות, ונדפיס אותו ב-3D. דגש על דיוק, גימור, וייחוד אישי.',
        mondayBoardId: null,
        isActive: false,
        orderIndex: 1,
        createdAt: '2026-04-01T08:00:00Z',
    },
    {
        id: 'aaaa0002-0000-0000-0000-000000000000',
        title: 'אתגר אישי: פאזל — פאזלים לכבדי ראייה',
        description:
            'יצירת פאזלים תלת-ממדיים נגישים לילדים עם לקויות ראייה. שפה של מגע, חיבורים חכמים עם ' +
            'מרווח סובלנות 0.2-0.4 מ"מ, וצורות מעולם התוכן של הילדים. גודל 10-16 ס"מ, גובה 10 מ"מ. ' +
            'יעד: 2-6 חלקי פאזל אחד.',
        mondayBoardId: null,
        isActive: true,
        orderIndex: 2,
        createdAt: '2026-05-05T08:00:00Z',
    },
    {
        id: 'aaaa0003-0000-0000-0000-000000000000',
        title: 'אתגר מספר 3 – סטייל אישי',
        description:
            'אביזרי אופנה ועיצוב מודפסים: טבעות, צמידים, תליונים, משקפיים, מסכות וחלקים זזים. ' +
            'דגש על קולקציה אחידה, יצירתיות, מורכבות טכנית וגימור.',
        mondayBoardId: null,
        isActive: false,
        orderIndex: 3,
        createdAt: '2026-04-19T08:00:00Z',
    },
];

export const LESSONS_PER_MISSION: Record<string, number> = {
    'aaaa0001-0000-0000-0000-000000000000': 5,
    'aaaa0002-0000-0000-0000-000000000000': 3,
    'aaaa0003-0000-0000-0000-000000000000': 7,
};

// ── Teams — both currently on the puzzle mission ───────────────────────
export const DEMO_TEAMS: Team[] = [
    {
        id: 'cccc0001-0000-0000-0000-000000000000',
        name: 'Team Alpha — נבחרת אלפא',
        accumulatedScore: 150,
        sprintStatus: 'active',
        isCompleted: false,
        currentChallengeId: 'aaaa0002-0000-0000-0000-000000000000',
        currentSprintId: null,
        createdAt: '2026-04-01T08:00:00Z',
        updatedAt: '2026-05-07T12:00:00Z',
    },
    {
        id: 'cccc0002-0000-0000-0000-000000000000',
        name: 'Team Beta — נבחרת בטא',
        accumulatedScore: 120,
        sprintStatus: 'active',
        isCompleted: false,
        currentChallengeId: 'aaaa0002-0000-0000-0000-000000000000',
        currentSprintId: null,
        createdAt: '2026-04-01T08:00:00Z',
        updatedAt: '2026-05-07T12:00:00Z',
    },
];

// ── Users — 8 students + teacher + admin ───────────────────────────────
// Shape matches what /api/users returns (snake_case fields + account_type).
export interface DemoApiUser {
    id: string;
    name: string;
    email: string;
    current_team_id: string | null;
    current_role: StudentRole | null;
    account_type: 'student' | 'teacher' | 'admin';
}

export const DEMO_USERS: DemoApiUser[] = [
    { id: 'dddd0001-0000-0000-0000-000000000000', name: 'Yael Mizrahi',  email: 'yael@techschool.demo',    current_team_id: 'cccc0001-0000-0000-0000-000000000000', current_role: 'pm',       account_type: 'student' },
    { id: 'dddd0002-0000-0000-0000-000000000000', name: 'David Cohen',   email: 'david@techschool.demo',   current_team_id: 'cccc0001-0000-0000-0000-000000000000', current_role: 'qa',       account_type: 'student' },
    { id: 'dddd0003-0000-0000-0000-000000000000', name: 'Noa Ben-David', email: 'noa@techschool.demo',     current_team_id: 'cccc0001-0000-0000-0000-000000000000', current_role: 'dev',      account_type: 'student' },
    { id: 'dddd0004-0000-0000-0000-000000000000', name: 'Ariel Levy',    email: 'ariel@techschool.demo',   current_team_id: 'cccc0001-0000-0000-0000-000000000000', current_role: 'hardware', account_type: 'student' },
    { id: 'dddd0005-0000-0000-0000-000000000000', name: 'Maya Shapiro',  email: 'maya@techschool.demo',    current_team_id: 'cccc0002-0000-0000-0000-000000000000', current_role: 'pm',       account_type: 'student' },
    { id: 'dddd0006-0000-0000-0000-000000000000', name: 'Omer Peretz',   email: 'omer@techschool.demo',    current_team_id: 'cccc0002-0000-0000-0000-000000000000', current_role: 'qa',       account_type: 'student' },
    { id: 'dddd0007-0000-0000-0000-000000000000', name: 'Lior Katz',     email: 'lior@techschool.demo',    current_team_id: 'cccc0002-0000-0000-0000-000000000000', current_role: 'dev',      account_type: 'student' },
    { id: 'dddd0008-0000-0000-0000-000000000000', name: 'Tal Friedman',  email: 'tal@techschool.demo',     current_team_id: 'cccc0002-0000-0000-0000-000000000000', current_role: 'hardware', account_type: 'student' },
    { id: 'dddd0009-0000-0000-0000-000000000000', name: 'Teacher Demo',  email: 'teacher@techschool.demo', current_team_id: null,                                    current_role: null,       account_type: 'teacher' },
    { id: 'dddd000a-0000-0000-0000-000000000000', name: 'Admin Demo',    email: 'admin@techschool.demo',   current_team_id: null,                                    current_role: null,       account_type: 'admin'   },
];

function emptyRoleCount() {
    return { pm: 0, qa: 0, dev: 0, hardware: 0 };
}

// ── Students with role history (used by RoleAssignmentPanel) ───────────
export const DEMO_STUDENTS_BY_TEAM: Record<string, StudentWithRoleHistory[]> = {
    'cccc0001-0000-0000-0000-000000000000': [
        { id: 'dddd0001-0000-0000-0000-000000000000', name: 'Yael Mizrahi',  email: 'yael@techschool.demo',  currentRole: 'pm',       lastRoles: ['qa', 'dev'], roleCount: { ...emptyRoleCount(), pm: 1, qa: 1, dev: 1 }, suggestedRole: null },
        { id: 'dddd0002-0000-0000-0000-000000000000', name: 'David Cohen',   email: 'david@techschool.demo', currentRole: 'qa',       lastRoles: ['hardware'],  roleCount: { ...emptyRoleCount(), qa: 1, hardware: 1 },     suggestedRole: null },
        { id: 'dddd0003-0000-0000-0000-000000000000', name: 'Noa Ben-David', email: 'noa@techschool.demo',   currentRole: 'dev',      lastRoles: ['pm'],         roleCount: { ...emptyRoleCount(), dev: 1, pm: 1 },           suggestedRole: null },
        { id: 'dddd0004-0000-0000-0000-000000000000', name: 'Ariel Levy',    email: 'ariel@techschool.demo', currentRole: 'hardware', lastRoles: ['dev'],        roleCount: { ...emptyRoleCount(), hardware: 1, dev: 1 },     suggestedRole: null },
    ],
    'cccc0002-0000-0000-0000-000000000000': [
        { id: 'dddd0005-0000-0000-0000-000000000000', name: 'Maya Shapiro',  email: 'maya@techschool.demo', currentRole: 'pm',       lastRoles: ['hardware'],  roleCount: { ...emptyRoleCount(), pm: 1, hardware: 1 },     suggestedRole: null },
        { id: 'dddd0006-0000-0000-0000-000000000000', name: 'Omer Peretz',   email: 'omer@techschool.demo', currentRole: 'qa',       lastRoles: ['pm'],         roleCount: { ...emptyRoleCount(), qa: 1, pm: 1 },           suggestedRole: null },
        { id: 'dddd0007-0000-0000-0000-000000000000', name: 'Lior Katz',     email: 'lior@techschool.demo', currentRole: 'dev',      lastRoles: ['qa'],         roleCount: { ...emptyRoleCount(), dev: 1, qa: 1 },           suggestedRole: null },
        { id: 'dddd0008-0000-0000-0000-000000000000', name: 'Tal Friedman',  email: 'tal@techschool.demo', currentRole: 'hardware', lastRoles: ['dev'],        roleCount: { ...emptyRoleCount(), hardware: 1, dev: 1 },     suggestedRole: null },
    ],
};

// ── Quiz question pool ─────────────────────────────────────────────────
export interface DemoQuizQuestion {
    id: string;
    role: StudentRole;
    prompt: string;
    options: string[];
    correctIndex: number;
}

let _qid = 0;
const q = (role: StudentRole, prompt: string, options: string[], correctIndex: number): DemoQuizQuestion => ({
    id: `qq-${(++_qid).toString().padStart(4, '0')}`,
    role,
    prompt,
    options,
    correctIndex,
});

export const DEMO_QUIZ_QUESTIONS: DemoQuizQuestion[] = [
    // dev = Designer
    q('dev', 'In Fusion 360, which feature lets you carve material out of a body?',
        ['Extrude — Join', 'Extrude — Cut', 'Sketch — Trim', 'Patch'], 1),
    q('dev', 'A "prototype" in 3D-print missions is...',
        ['The final, polished part', 'A first version of a model used to test the design', 'A presentation slide', 'A bill of materials'], 1),
    q('dev', 'Minimum recommended wall thickness for FDM prints is roughly...',
        ['0.1 mm', '1.2 mm', '5 mm', '10 mm'], 1),
    q('dev', 'Which file format is the standard 3D-print mesh export?',
        ['PNG', 'STL', 'CSV', 'PSD'], 1),
    // pm = Editor
    q('pm', 'In a slicer, "infill" controls...',
        ['Print speed', 'How dense the inside of the part is', 'The bed temperature', 'The filament colour'], 1),
    q('pm', 'A typical FDM layer height for a balanced print is...',
        ['0.02 mm', '0.20 mm', '2.00 mm', '20 mm'], 1),
    q('pm', 'Why generate "supports" in a slicer?',
        ['To make the model heavier', 'To hold up overhangs and bridges during printing', 'To save filament', 'To translate text'], 1),
    q('pm', 'What is "G-code"?',
        ['A grading rubric', 'Instructions the printer executes layer by layer', 'A type of plastic', 'A photo format'], 1),
    // qa
    q('qa', 'Submitting work "for QA" means you are asking someone to...',
        ['Build it for you', 'Throw it away', 'Check that it meets the requirements', 'Translate it'], 2),
    q('qa', 'A "bug" found during QA review is...',
        ['An insect on the printer', 'A defect that should be fixed before approval', 'A new feature request', 'A delivery delay'], 1),
    q('qa', 'What does "approved" usually mean in the task pipeline?',
        ['Pending review', 'Sent back for fixes', 'Signed off as complete', 'Cancelled'], 2),
    q('qa', 'If a part fails dimensional check, the right action is to...',
        ['Approve anyway', 'Mark needs-fix and explain in the notes', 'Delete the team', 'Ignore it'], 1),
    // hardware = Printer
    q('hardware', 'Bed adhesion failures most often happen because...',
        ['The filament is too cold and the bed is not level/clean', 'The wifi is slow', 'The model has too many polygons', 'Supports are disabled'], 0),
    q('hardware', 'What is "stringing" on a 3D print?',
        ['Thin plastic threads between features caused by oozing', 'Audio cables on the printer', 'A type of infill', 'A status code'], 0),
    q('hardware', 'You should level the print bed...',
        ['Never — it is automatic always', 'When prints start failing or the printer is moved', 'Only on day 1', 'Once a year'], 1),
    q('hardware', 'Which is the safer first step when a print fails mid-way?',
        ['Hit the printer', 'Pause, inspect, and re-slice if needed', 'Run it again identically and hope', 'Delete the file'], 1),
];
