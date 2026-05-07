/**
 * POC demo fixtures — used by composables when running without a backend.
 * Internal role keys: pm/qa/dev/hardware (matches DB).
 * Display labels: Editor / QA / Designer / Printer (via ROLE_LABELS).
 */

import type {
    Challenge,
    Team,
    StudentRole,
    StudentWithRoleHistory,
} from '~/types/types';

// ── Mission ids ────────────────────────────────────────────────────────
export const MISSION_IDS = {
    gift:   'aaaa0001-0000-0000-0000-000000000000',
    puzzle: 'aaaa0002-0000-0000-0000-000000000000',
    style:  'aaaa0003-0000-0000-0000-000000000000',
} as const;

// ── Missions (challenges) — 3 real TechSchool missions ─────────────────
export const DEMO_MISSIONS: Challenge[] = [
    {
        id: MISSION_IDS.gift,
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
        id: MISSION_IDS.puzzle,
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
        id: MISSION_IDS.style,
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
    [MISSION_IDS.gift]:   5,
    [MISSION_IDS.puzzle]: 3,
    [MISSION_IDS.style]:  7,
};

// ── Teams — both currently on the puzzle mission ───────────────────────
export const DEMO_TEAMS: Team[] = [
    {
        id: 'cccc0001-0000-0000-0000-000000000000',
        name: 'Team Alpha — נבחרת אלפא',
        accumulatedScore: 150,
        sprintStatus: 'active',
        isCompleted: false,
        currentChallengeId: MISSION_IDS.puzzle,
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
        currentChallengeId: MISSION_IDS.puzzle,
        currentSprintId: null,
        createdAt: '2026-04-01T08:00:00Z',
        updatedAt: '2026-05-07T12:00:00Z',
    },
];

// ── Users ──────────────────────────────────────────────────────────────
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

function emptyRoleCount() { return { pm: 0, qa: 0, dev: 0, hardware: 0 }; }

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

// ─── Quiz question pool — Hebrew ────────────────────────────────────────
export interface DemoQuizQuestion {
    id: string;
    scope: 'role' | 'mission' | 'teamwork';
    role: StudentRole | null;        // when scope='role'
    missionId: string | null;        // when scope='mission'
    prompt: string;
    options: string[];
    correctIndex: number;
}

let _qid = 0;
const qRole = (role: StudentRole, prompt: string, options: string[], correctIndex: number): DemoQuizQuestion => ({
    id: `qq-${(++_qid).toString().padStart(4, '0')}`,
    scope: 'role',
    role,
    missionId: null,
    prompt,
    options,
    correctIndex,
});
const qMission = (missionId: string, prompt: string, options: string[], correctIndex: number): DemoQuizQuestion => ({
    id: `qq-${(++_qid).toString().padStart(4, '0')}`,
    scope: 'mission',
    role: null,
    missionId,
    prompt,
    options,
    correctIndex,
});
const qTeamwork = (prompt: string, options: string[], correctIndex: number): DemoQuizQuestion => ({
    id: `qq-${(++_qid).toString().padStart(4, '0')}`,
    scope: 'teamwork',
    role: null,
    missionId: null,
    prompt,
    options,
    correctIndex,
});

export const DEMO_QUIZ_QUESTIONS: DemoQuizQuestion[] = [
    // ───────── Role-knowledge: dev = Designer ─────────
    qRole('dev', 'ב-Fusion 360, איזו פעולה מסירה חומר מתוך גוף מוצק?',
        ['Extrude — Join', 'Extrude — Cut', 'Sketch — Trim', 'Patch'], 1),
    qRole('dev', 'מהו "פרוטוטיפ" באתגרי הדפסה תלת-ממדית?',
        ['התוצר הסופי המגומר', 'גרסה ראשונית של מודל לבדיקת התכנון', 'שקף במצגת', 'רשימת חומרים'], 1),
    qRole('dev', 'מהו עובי דופן מינימלי מומלץ להדפסת FDM?',
        ['0.1 מ"מ', '1.2 מ"מ', '5 מ"מ', '10 מ"מ'], 1),
    qRole('dev', 'איזה פורמט קובץ הוא הסטנדרט לייצוא mesh להדפסה תלת-ממדית?',
        ['PNG', 'STL', 'CSV', 'PSD'], 1),

    // ───────── Role-knowledge: pm = Editor (slicer / pre-print) ─────────
    qRole('pm', 'בסליסר, מה ה-"infill" קובע?',
        ['מהירות הדפסה', 'את צפיפות הפנים של החלק', 'טמפרטורת המשטח', 'צבע הפילמנט'], 1),
    qRole('pm', 'מהו גובה שכבה אופייני להדפסת FDM מאוזנת?',
        ['0.02 מ"מ', '0.20 מ"מ', '2.00 מ"מ', '20 מ"מ'], 1),
    qRole('pm', 'למה מייצרים "תמיכות" (supports) בסליסר?',
        ['כדי להכביד על המודל', 'כדי להחזיק overhangs וגשרים בזמן ההדפסה', 'כדי לחסוך פילמנט', 'כדי לתרגם טקסט'], 1),
    qRole('pm', 'מהו "G-code"?',
        ['רובריקת ציון', 'ההוראות שהמדפסת מבצעת שכבה-שכבה', 'סוג של פלסטיק', 'פורמט של תמונה'], 1),

    // ───────── Role-knowledge: qa ─────────
    qRole('qa', 'מה המשמעות של "להגיש ל-QA"?',
        ['שמישהו יבנה עבורך', 'שמישהו יזרוק', 'שמישהו יבדוק שעמדת בדרישות', 'שמישהו יתרגם'], 2),
    qRole('qa', 'מהו "באג" שנמצא בסקירת QA?',
        ['חרק על המדפסת', 'פגם שצריך לתקן לפני אישור', 'בקשה לפיצ\'ר חדש', 'איחור באספקה'], 1),
    qRole('qa', 'מה משמעות "אושר" בפייפליין המשימות?',
        ['ממתין לבדיקה', 'הוחזר לתיקון', 'אושרר כהושלם', 'בוטל'], 2),
    qRole('qa', 'אם חלק נכשל בבדיקת מימדים, הפעולה הנכונה היא…',
        ['לאשר בכל זאת', 'לסמן needs-fix ולתעד בהערות', 'למחוק את הצוות', 'להתעלם'], 1),

    // ───────── Role-knowledge: hardware = Printer ─────────
    qRole('hardware', 'כשלי הדבקה למשטח קורים בדרך כלל בגלל…',
        ['הפילמנט קר מדי או שהמשטח לא מיושר/נקי', 'ה-WiFi איטי', 'יותר מדי פוליגונים במודל', 'תמיכות כבויות'], 0),
    qRole('hardware', 'מה זה "stringing" בהדפסה תלת-ממדית?',
        ['חוטי פלסטיק דקים בין חלקים שנגרמים מנזילה', 'כבלי שמע במדפסת', 'סוג של infill', 'קוד סטטוס'], 0),
    qRole('hardware', 'מתי כדאי לכייל את משטח ההדפסה?',
        ['אף פעם — תמיד אוטומטי', 'כשהדפסות מתחילות להיכשל או שהמדפסת זזה', 'רק ביום הראשון', 'פעם בשנה'], 1),
    qRole('hardware', 'מה הצעד הבטוח הראשון כשהדפסה נכשלת באמצע?',
        ['להכות במדפסת', 'להשהות, לבדוק, ובמידת הצורך לחתוך מחדש', 'להריץ אותו דבר ולקוות', 'למחוק את הקובץ'], 1),

    // ───────── Mission-specific: gift (אתגר מספר 1 – מתנה) ─────────
    qMission(MISSION_IDS.gift, 'מה הגודל המומלץ למחזיק מפתחות אישי?',
        ['מתחת ל-2 ס"מ', 'גובה מקסימלי של ~8 ס"מ עם חור 6 מ"מ לטבעת', 'מעל 20 ס"מ', 'אין הגבלה'], 1),
    qMission(MISSION_IDS.gift, 'איזו טכניקה מתאימה ליצירת חריטה (טקסט בולט) על מגן?',
        ['Sketch + Extrude עם גובה 0.5–1 מ"מ', 'Boolean רנדומלי', 'Patch על משטח', 'Slicer ניקוי'], 0),
    qMission(MISSION_IDS.gift, 'מה הופך מגן הוקרה ל"מורכב" יותר ממגן פשוט?',
        ['גודל גדול יותר', 'קימורים, הבלטות, ועומקים מודלים', 'יותר תמיכות', 'צבע אדום'], 1),
    qMission(MISSION_IDS.gift, 'באיזו טכניקה נשתמש ליצירת מדליה בעלת אופי אישי?',
        ['חריטה (engrave) של שם או צורה אישית', 'Boolean רנדומלי', 'הגדלת infill', 'הסרת תמיכות'], 0),

    // ───────── Mission-specific: puzzle (פאזלים לכבדי ראייה) ─────────
    qMission(MISSION_IDS.puzzle, 'מה גודל מומלץ לפאזל המכיל 2-3 חלקים?',
        ['5–7 ס"מ', '10–13 ס"מ', '15–20 ס"מ', 'מעל 25 ס"מ'], 1),
    qMission(MISSION_IDS.puzzle, 'מה מרווח הסובלנות (Tolerance) המומלץ בין חלקי פאזל מודפסים?',
        ['0.0 מ"מ — להדק חזק', '0.2–0.4 מ"מ — שייכנסו בקלות', '1–2 מ"מ — רחב מאוד', '5 מ"מ ומעלה'], 1),
    qMission(MISSION_IDS.puzzle, 'איך ילד עם לקות ראייה ידע אם הוא מחזיק חלק הפוך?',
        ['לפי הצבע', 'לפי סימן מוסכם — פינה קטומה או שקע קטן ל"למעלה"', 'לפי המשקל', 'הוא לא יכול לדעת'], 1),
    qMission(MISSION_IDS.puzzle, 'מה הגובה המינימלי המומלץ לפאזל בהדפסה?',
        ['2 מ"מ', '5 מ"מ', '10 מ"מ', '50 מ"מ'], 2),
    qMission(MISSION_IDS.puzzle, 'מה היתרון בשימוש בטקסטורות (נקודות / פסים) על חלקי הפאזל?',
        ['פחות חומר', 'מאפשר לזהות חלקים במגע ולא רק בראייה', 'מקצר זמן הדפסה', 'מוסיף משקל'], 1),

    // ───────── Teamwork / collaboration (2 sampled per quiz) ─────────
    qTeamwork(
        'כשנתקלת בקושי ואינך מצליח להתקדם לבד, מה עליך לעשות?',
        ['לשמור לעצמך ולנסות שוב מאוחר יותר', 'לעדכן את הצוות ולבקש עזרה', 'לוותר על המשימה', 'לחכות שהמורה ישים לב'],
        1,
    ),
    qTeamwork(
        'סיימת את המשימה שלך מוקדם. מה עדיף לעשות?',
        ['לשחק בטלפון', 'לבדוק אם מישהו בצוות צריך עזרה', 'לצאת מוקדם', 'לחכות בשקט שיגמר השיעור'],
        1,
    ),
    qTeamwork(
        'מה תפקידו של ה-PM (Editor) בצוות?',
        ['להדפיס את קובץ ה-STL', 'לנהל לוח זמנים ולוודא שהצוות עומד בדדליין', 'לאשר קוד', 'לצייר את העיצוב הראשוני'],
        1,
    ),
    qTeamwork(
        'כשיש חילוקי דעות בצוות, מה הדרך הטובה ביותר לפתור אותם?',
        ['להמשיך ולהתעלם', 'לדון יחד ולתת לכולם להביע דעה לפני ההחלטה', 'לבקש מהחלש להחליט', 'לבקש מהמורה להכריע מיד'],
        1,
    ),
    qTeamwork(
        'מה חשוב לעשות לפני שמגישים משימה לסקירת QA?',
        ['להגיש ישר מבלי לבדוק', 'לבדוק בעצמך שעמדת בכל דרישות המשימה', 'לשאול רק את ה-PM', 'להמתין שה-QA יבקש'],
        1,
    ),

    // ───────── Mission-specific: style (סטייל אישי) ─────────
    qMission(MISSION_IDS.style, 'מה זה "Print in Place"?',
        ['הדפסה במקום הלקוח', 'מנגנון עם חלקים זזים שנדפס בבת אחת ללא הרכבה', 'הדפסה ללא תמיכות', 'הדפסה דו-צבעונית'], 1),
    qMission(MISSION_IDS.style, 'מה חשוב לתת תשומת לב כשמדפסים טבעת לילד?',
        ['גודל פנימי מדויק (perimeter) להתאמה לאצבע', 'infill של 90%', 'גובה שכבה גדול', 'אין חשיבות לגודל'], 0),
    qMission(MISSION_IDS.style, 'איך מקבלים "קולקציה" טובה של אבזרי אופנה?',
        ['פריטים זהים', 'אלמנט עיצובי משותף שחוזר בין הפריטים', 'הרבה צבעים שונים', 'כל פריט בנפרד'], 1),
    qMission(MISSION_IDS.style, 'איזה גימור מתאים למסכה אופנתית?',
        ['השארת תמיכות', 'שיוף קל וצביעה — ולפעמים השלמה ידנית', 'השארה כמו שיצא מהמדפסת', 'הדפסה בלי infill'], 1),
];

// ─── Hardcoded Hebrew hints (used by HintPanel when offline) ────────────
export const DEMO_HINTS: string[] = [
    'נסו להתחיל מהצורה הבסיסית הגדולה ביותר. אילו צורות 3D פשוטות יכולות להוות בסיס למודל שלכם?',
    'אם החלקים לא נכנסים — בדקו את ה-Tolerance בסליסר. נסו 0.2-0.4 מ"מ.',
    'בדקו עובי דפנות לפני ייצוא ל-STL. דפנות דקות מ-1.2 מ"מ עלולות להישבר.',
    'בעיות overhang? הוסיפו תמיכות אוטומטיות בסליסר או שנו את כיוון ההדפסה.',
    'לפני שמגישים — אמתו שהמודל נסגר (closed mesh). פתחים גורמים לכשלים בהדפסה.',
    'שכבה ראשונה לא נדבקת? נקו את המשטח ובדקו את גובה הפיה.',
    'נסו להוסיף chamfer קטן (0.5 מ"מ) לפינות חדות — הדפסה תיראה הרבה יותר נקייה.',
    'אם המודל גדול מדי — שקלו לחלק אותו לחלקים שיתחברו אחרי ההדפסה.',
    'שאלה מכוונת: איפה הסטרטוס של המשימה כרגע? מה השלב הבא בפייפליין?',
    'תזכורת: סקירת QA מתחילה אחרי שהמשימה במצב qa_review. אל תפסחו על הצ\'קליסט.',
];
