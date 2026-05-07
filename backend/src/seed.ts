/**
 * Seed script — idempotent demo data.
 *
 * Inserts (or upserts) the canonical hackathon demo: 1 challenge, 3 sprints,
 * 2 teams, 8 students, 1 teacher, 1 admin, 8 tasks. All accounts use the
 * same demo password so they're easy to test with — DO NOT run this against
 * production.
 *
 * @version 1.10
 */

import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const log = (msg: string): void => console.log(`[Seed] ${msg}`);
const err = (msg: string): void => console.error(`[Seed] ✗ ${msg}`);

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'demo1234';

const ID = {
    challenge: {
        gift:   'aaaa0001-0000-0000-0000-000000000000',  // אתגר מספר 1 – מתנה
        puzzle: 'aaaa0002-0000-0000-0000-000000000000',  // אתגר אישי: פאזל — פאזלים לכבדי ראייה
        style:  'aaaa0003-0000-0000-0000-000000000000',  // אתגר מספר 3 – סטייל אישי
    },
    sprint: {
        // GIFT — אתגר 1: 5 lesson sets
        gift_medal:   'bbbb0101-0000-0000-0000-000000000000',
        gift_parents: 'bbbb0102-0000-0000-0000-000000000000',
        gift_simple:  'bbbb0103-0000-0000-0000-000000000000',
        gift_complex: 'bbbb0104-0000-0000-0000-000000000000',
        gift_more:    'bbbb0105-0000-0000-0000-000000000000',
        // PUZZLE — אתגר אישי: 3 lesson sets
        puzzle_basic:  'bbbb0201-0000-0000-0000-000000000000',
        puzzle_shapes: 'bbbb0202-0000-0000-0000-000000000000',
        puzzle_free:   'bbbb0203-0000-0000-0000-000000000000',
        // STYLE — אתגר 3: 7 lesson sets
        style_party:           'bbbb0301-0000-0000-0000-000000000000',
        style_glasses:         'bbbb0302-0000-0000-0000-000000000000',
        style_rings:           'bbbb0303-0000-0000-0000-000000000000',
        style_bracelets:       'bbbb0304-0000-0000-0000-000000000000',
        style_pendants:        'bbbb0305-0000-0000-0000-000000000000',
        style_masks:           'bbbb0306-0000-0000-0000-000000000000',
        style_print_in_place:  'bbbb0307-0000-0000-0000-000000000000',
    },
    team: {
        alpha: 'cccc0001-0000-0000-0000-000000000000',
        beta:  'cccc0002-0000-0000-0000-000000000000',
    },
    user: {
        yael:  'dddd0001-0000-0000-0000-000000000000',
        david: 'dddd0002-0000-0000-0000-000000000000',
        noa:   'dddd0003-0000-0000-0000-000000000000',
        ariel: 'dddd0004-0000-0000-0000-000000000000',
        maya:  'dddd0005-0000-0000-0000-000000000000',
        omer:  'dddd0006-0000-0000-0000-000000000000',
        lior:  'dddd0007-0000-0000-0000-000000000000',
        tal:   'dddd0008-0000-0000-0000-000000000000',
        teacher: 'dddd0009-0000-0000-0000-000000000000',
        admin:   'dddd000a-0000-0000-0000-000000000000',
    },
    task: {
        // 8 tasks for the active mission (puzzle), 1 per role per team
        a_designer: 'eeee0001-0000-0000-0000-000000000000',
        a_editor:   'eeee0002-0000-0000-0000-000000000000',
        a_qa:       'eeee0003-0000-0000-0000-000000000000',
        a_printer:  'eeee0004-0000-0000-0000-000000000000',
        b_designer: 'eeee0005-0000-0000-0000-000000000000',
        b_editor:   'eeee0006-0000-0000-0000-000000000000',
        b_qa:       'eeee0007-0000-0000-0000-000000000000',
        b_printer:  'eeee0008-0000-0000-0000-000000000000',
    },
} as const;

async function seed(): Promise<void> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) { err('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1); }

    const db = createClient(url, key);

    try {
        log(`Hashing demo password (cost ${process.env.BCRYPT_COST ?? 12})...`);
        const cost = parseInt(process.env.BCRYPT_COST ?? '12', 10);
        const hash = await bcrypt.hash(DEMO_PASSWORD, cost);

        // ── 1. Challenges (= TechSchool missions) ────────────────────────
        log('challenges...');
        const { error: e1 } = await db.from('challenges').upsert([
            {
                id: ID.challenge.gift,
                title: 'אתגר מספר 1 – מתנה',
                description:
                    'מגנים, מדליות ומתנות מודפסות. נלמד טכניקות מידול בסיסיות ומתקדמות, נעצב פריט אישי בעל משמעות, ' +
                    'ונדפיס אותו ב-3D. דגש על דיוק, גימור, וייחוד אישי.',
                is_active: false,
                order_index: 1,
                monday_board_id: null,
            },
            {
                id: ID.challenge.puzzle,
                title: 'אתגר אישי: פאזל — פאזלים לכבדי ראייה',
                description:
                    'יצירת פאזלים תלת-ממדיים נגישים לילדים עם לקויות ראייה. שפה של מגע, חיבורים חכמים עם ' +
                    'מרווח סובלנות 0.2-0.4 מ"מ, וצורות מעולם התוכן של הילדים. גודל 10-16 ס"מ, גובה 10 מ"מ. ' +
                    'יעד: 2-6 חלקים פאזל אחד.',
                is_active: true,
                order_index: 2,
                monday_board_id: null,
            },
            {
                id: ID.challenge.style,
                title: 'אתגר מספר 3 – סטייל אישי',
                description:
                    'אביזרי אופנה ועיצוב מודפסים: טבעות, צמידים, תליונים, משקפיים, מסכות וחלקים זזים. ' +
                    'דגש על קולקציה אחידה, יצירתיות, מורכבות טכנית וגימור.',
                is_active: false,
                order_index: 3,
                monday_board_id: null,
            },
        ], { onConflict: 'id' });
        if (e1) throw new Error(`challenges: ${e1.message}`);

        // ── 2. Sprints (= lesson sets within each mission) ───────────────
        log('sprints...');
        const { error: e2 } = await db.from('sprints').upsert([
            // GIFT — 5 lesson sets, verbatim from TechSchool
            { id: ID.sprint.gift_medal,   challenge_id: ID.challenge.gift, title: 'מדליה למצטיינים',                    description: '5 נושאים — מידול מדליה אישית, חריטה, וגימור.',                  order_index: 1 },
            { id: ID.sprint.gift_parents, challenge_id: ID.challenge.gift, title: 'מתנה להורים',                       description: '9 נושאים — פריט מתנה משמעותי לבני המשפחה.',                       order_index: 2 },
            { id: ID.sprint.gift_simple,  challenge_id: ID.challenge.gift, title: 'מגן הוקרה פשוט',                    description: '2 נושאים — מגן בסיסי עם טקסט ועיצוב פשוט.',                       order_index: 3 },
            { id: ID.sprint.gift_complex, challenge_id: ID.challenge.gift, title: 'מגן הוקרה מורכב',                   description: '2 נושאים — מגן עם קימורים, הבלטות ועיצוב מתקדם.',                 order_index: 4 },
            { id: ID.sprint.gift_more,    challenge_id: ID.challenge.gift, title: 'עוד מתנות (מידול מורכב יותר)',       description: '5 נושאים — מחזיק מפתחות, עציץ, קופסת חתול, כוס לעטים, תג שם.',     order_index: 5 },
            // PUZZLE — 3 lesson sets
            { id: ID.sprint.puzzle_basic,  challenge_id: ID.challenge.puzzle, title: 'פאזלים בסיסיים',  description: '4 נושאים — צורות פשוטות, חיבורים בסיסיים, וסימוני מגע.', order_index: 1 },
            { id: ID.sprint.puzzle_shapes, challenge_id: ID.challenge.puzzle, title: 'פאזלים בצורות',   description: '3 נושאים — צורות מוכרות (חיות / פירות / תחבורה).',         order_index: 2 },
            { id: ID.sprint.puzzle_free,   challenge_id: ID.challenge.puzzle, title: 'פאזלים חופשיים', description: '3 נושאים — תכנון מקורי לבחירת התלמיד.',                       order_index: 3 },
            // STYLE — 7 lesson sets
            { id: ID.sprint.style_party,          challenge_id: ID.challenge.style, title: 'אבזרים למסיבה / סלפי',    description: '3 נושאים — אבזרים יומיומיים לאירועים.', order_index: 1 },
            { id: ID.sprint.style_glasses,        challenge_id: ID.challenge.style, title: 'משקפיים',                 description: '3 נושאים — מסגרות משקפיים מודפסות.',     order_index: 2 },
            { id: ID.sprint.style_rings,          challenge_id: ID.challenge.style, title: 'טבעות',                   description: '4 נושאים — טבעות אישיות בעיצוב חופשי.',  order_index: 3 },
            { id: ID.sprint.style_bracelets,      challenge_id: ID.challenge.style, title: 'צמידים',                  description: '3 נושאים — צמידים וטכניקות שילוב.',       order_index: 4 },
            { id: ID.sprint.style_pendants,       challenge_id: ID.challenge.style, title: 'תליונים וסיכות',           description: '4 נושאים — תכשיטים ופרטי קישוט.',          order_index: 5 },
            { id: ID.sprint.style_masks,          challenge_id: ID.challenge.style, title: 'מסכות',                   description: '2 נושאים — מסכות אופנה ולתחפושת.',        order_index: 6 },
            { id: ID.sprint.style_print_in_place, challenge_id: ID.challenge.style, title: 'מבוא לחלקים זזים — print in place', description: '3 נושאים — חלקים זזים ללא הרכבה.', order_index: 7 },
        ], { onConflict: 'id' });
        if (e2) throw new Error(`sprints: ${e2.message}`);

        // ── 3. Teams (both currently on the puzzle mission) ──────────────
        log('teams...');
        const { error: e3 } = await db.from('teams').upsert([
            { id: ID.team.alpha, name: 'Team Alpha — נבחרת אלפא', accumulated_score: 150, sprint_status: 'active', is_completed: false, current_challenge_id: ID.challenge.puzzle, current_sprint_id: ID.sprint.puzzle_basic },
            { id: ID.team.beta,  name: 'Team Beta — נבחרת בטא',   accumulated_score: 120, sprint_status: 'active', is_completed: false, current_challenge_id: ID.challenge.puzzle, current_sprint_id: ID.sprint.puzzle_basic },
        ], { onConflict: 'id' });
        if (e3) throw new Error(`teams: ${e3.message}`);

        // ── 4. Users (8 students + 1 teacher + 1 admin, all with same hash) ──
        log('users...');
        const { error: e4 } = await db.from('users').upsert([
            { id: ID.user.yael,    name: 'Yael Mizrahi',   email: 'yael@techschool.demo',    password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.alpha, current_role: 'editor',   total_active_time: 3240, is_active: true },
            { id: ID.user.david,   name: 'David Cohen',    email: 'david@techschool.demo',   password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.alpha, current_role: 'qa',       total_active_time: 2880, is_active: true },
            { id: ID.user.noa,     name: 'Noa Ben-David',  email: 'noa@techschool.demo',     password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.alpha, current_role: 'designer', total_active_time: 4200, is_active: true },
            { id: ID.user.ariel,   name: 'Ariel Levy',     email: 'ariel@techschool.demo',   password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.alpha, current_role: 'printer',  total_active_time: 3600, is_active: true },
            { id: ID.user.maya,    name: 'Maya Shapiro',   email: 'maya@techschool.demo',    password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.beta,  current_role: 'editor',   total_active_time: 2700, is_active: true },
            { id: ID.user.omer,    name: 'Omer Peretz',    email: 'omer@techschool.demo',    password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.beta,  current_role: 'qa',       total_active_time: 3100, is_active: true },
            { id: ID.user.lior,    name: 'Lior Katz',      email: 'lior@techschool.demo',    password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.beta,  current_role: 'designer', total_active_time: 2400, is_active: true },
            { id: ID.user.tal,     name: 'Tal Friedman',   email: 'tal@techschool.demo',     password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.beta,  current_role: 'printer',  total_active_time: 3900, is_active: true },
            { id: ID.user.teacher, name: 'Teacher Demo',   email: 'teacher@techschool.demo', password_hash: hash, account_type: 'teacher', auth_provider: 'local', current_team_id: null,          current_role: null,       total_active_time: 0,    is_active: true },
            { id: ID.user.admin,   name: 'Admin Demo',     email: 'admin@techschool.demo',   password_hash: hash, account_type: 'admin',   auth_provider: 'local', current_team_id: null,          current_role: null,       total_active_time: 0,    is_active: true },
        ], { onConflict: 'id' });
        if (e4) throw new Error(`users: ${e4.message}`);

        // ── 5. Tasks (puzzle mission, 1 per role per team) ───────────────
        log('tasks...');
        const qaA = { isCompleted: true,  hasErrors: false, improvements: ['חזק את ה-tolerance בין החלקים'] };
        const qaB = { isCompleted: true,  hasErrors: false, improvements: ['סמן בולט ל"למעלה" של החלק'] };
        const qaC = { isCompleted: true,  hasErrors: false, improvements: [] };
        const qaD = { isCompleted: false, hasErrors: true,  improvements: ['חיבורים תפוסים — הגדל מרווח ל-0.3 מ"מ', 'בדוק כיוון הדפסה'] };

        const { error: e5 } = await db.from('tasks').upsert([
            // Team Alpha — Puzzle mission
            { id: ID.task.a_designer, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.alpha, assigned_role: 'designer',
              title: 'מידול פאזל בסיסי ב-Fusion 360',
              description: 'עצבו פאזל 3-4 חלקים, גודל 12ס"מ, גובה 10מ"מ. סימוני מגע על כל חלק.',
              status: 'approved', submission_url: 'https://drive.google.com/demo/puzzle-design-alpha',
              submitted_by: ID.user.noa, reviewed_by_qa: ID.user.david, reviewed_by_pm: ID.user.yael,
              qa_checklist: qaA, qa_notes: 'מידות תקינות, סימוני מגע ברורים.', pm_notes: 'מוכן להדפסה.' },
            { id: ID.task.a_editor, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.alpha, assigned_role: 'editor',
              title: 'הכנת קובץ Slicer + תמיכות',
              description: 'layer 0.2מ"מ, infill 20%, אופטימיזציה לזמן הדפסה.',
              status: 'teacher_review', submission_url: 'https://drive.google.com/demo/puzzle-slicer-alpha',
              submitted_by: ID.user.yael, reviewed_by_qa: ID.user.david, reviewed_by_pm: ID.user.yael,
              qa_checklist: qaB, qa_notes: 'הגדרות נכונות.', pm_notes: 'שולח למורה.' },
            { id: ID.task.a_qa, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.alpha, assigned_role: 'qa',
              title: 'בדיקת tolerance ובדיקת מגע',
              description: 'אמת מרווח 0.2-0.4מ"מ בכל חיבור. בדוק שניתן לזהות חלקים לפי מגע בלבד.',
              status: 'qa_review', submission_url: 'https://drive.google.com/demo/puzzle-qa-alpha',
              submitted_by: ID.user.david },
            { id: ID.task.a_printer, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.alpha, assigned_role: 'printer',
              title: 'הדפסת הפאזל + הרכבה בעיניים מכוסות',
              description: 'הדפיסו את הפאזל. נסו להרכיב אותו בעיניים מכוסות. תעדו תוצאות.',
              status: 'pending' },
            // Team Beta — Puzzle mission
            { id: ID.task.b_designer, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.beta, assigned_role: 'designer',
              title: 'פאזל חיה מוכרת',
              description: 'עצבו פאזל 4-5 חלקים בצורת חיה (כלב/חתול). גודל 14ס"מ, גובה 12מ"מ.',
              status: 'approved', submission_url: 'https://drive.google.com/demo/puzzle-design-beta',
              submitted_by: ID.user.lior, reviewed_by_qa: ID.user.omer, reviewed_by_pm: ID.user.maya,
              qa_checklist: qaC, pm_notes: 'יצירתי ונגיש למגע.' },
            { id: ID.task.b_editor, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.beta, assigned_role: 'editor',
              title: 'Slicer + תמיכות ל-overhangs',
              description: 'בדוק זוויות overhang, הוסף תמיכות נדרשות, חישב זמן הדפסה.',
              status: 'pm_review', submission_url: 'https://drive.google.com/demo/puzzle-slicer-beta',
              submitted_by: ID.user.maya, reviewed_by_qa: ID.user.omer,
              qa_checklist: qaD, qa_notes: 'חיבורים תפוסים — צריך להגדיל סובלנות.' },
            { id: ID.task.b_qa, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.beta, assigned_role: 'qa',
              title: 'בדיקה איכותית + בדיקת מגע',
              description: 'אמת שכל חלק מסומן לכיוון. אין שני חלקים זהים במגע.',
              status: 'pending' },
            { id: ID.task.b_printer, sprint_id: ID.sprint.puzzle_basic, team_id: ID.team.beta, assigned_role: 'printer',
              title: 'הדפסה + תיעוד',
              description: 'הדפס בשני צבעים שונים. צלם תהליך + תוצר סופי.',
              status: 'pending' },
        ], { onConflict: 'id' });
        if (e5) throw new Error(`tasks: ${e5.message}`);

        // ── 6. Quiz question bank (role-knowledge for designer/editor/qa/printer) ──
        log('quiz questions...');
        const roleQuestions: {
            scope: 'role';
            role: 'designer' | 'editor' | 'qa' | 'printer';
            prompt: string;
            options: string[];
            correct_index: number;
        }[] = [
            // designer
            { scope: 'role', role: 'designer', prompt: 'In Fusion 360, which feature lets you carve material out of a body?',
              options: ['Extrude — Join', 'Extrude — Cut', 'Sketch — Trim', 'Patch'], correct_index: 1 },
            { scope: 'role', role: 'designer', prompt: 'A "prototype" in 3D-print missions is...',
              options: ['The final, polished part', 'A first version of a model used to test the design', 'A presentation slide', 'A bill of materials'], correct_index: 1 },
            { scope: 'role', role: 'designer', prompt: 'Minimum recommended wall thickness for FDM prints is roughly...',
              options: ['0.1 mm', '1.2 mm', '5 mm', '10 mm'], correct_index: 1 },
            { scope: 'role', role: 'designer', prompt: 'Which file format is the standard 3D-print mesh export?',
              options: ['PNG', 'STL', 'CSV', 'PSD'], correct_index: 1 },
            // editor (slicer / pre-print prep)
            { scope: 'role', role: 'editor', prompt: 'In a slicer, "infill" controls...',
              options: ['Print speed', 'How dense the inside of the part is', 'The bed temperature', 'The filament colour'], correct_index: 1 },
            { scope: 'role', role: 'editor', prompt: 'A typical FDM layer height for a balanced print is...',
              options: ['0.02 mm', '0.20 mm', '2.00 mm', '20 mm'], correct_index: 1 },
            { scope: 'role', role: 'editor', prompt: 'Why generate "supports" in a slicer?',
              options: ['To make the model heavier', 'To hold up overhangs and bridges during printing', 'To save filament', 'To translate text'], correct_index: 1 },
            { scope: 'role', role: 'editor', prompt: 'What is "G-code"?',
              options: ['A grading rubric', 'Instructions the printer executes layer by layer', 'A type of plastic', 'A photo format'], correct_index: 1 },
            // qa
            { scope: 'role', role: 'qa', prompt: 'Submitting work "for QA" means you are asking someone to...',
              options: ['Build it for you', 'Throw it away', 'Check that it meets the requirements', 'Translate it'], correct_index: 2 },
            { scope: 'role', role: 'qa', prompt: 'A "bug" found during QA review is...',
              options: ['An insect on the printer', 'A defect that should be fixed before approval', 'A new feature request', 'A delivery delay'], correct_index: 1 },
            { scope: 'role', role: 'qa', prompt: 'What does "approved" usually mean in the task pipeline?',
              options: ['Pending review', 'Sent back for fixes', 'Signed off as complete', 'Cancelled'], correct_index: 2 },
            { scope: 'role', role: 'qa', prompt: 'If a part fails dimensional check, the right action is to...',
              options: ['Approve anyway', 'Mark needs-fix and explain in the notes', 'Delete the team', 'Ignore it'], correct_index: 1 },
            // printer
            { scope: 'role', role: 'printer', prompt: 'Bed adhesion failures most often happen because...',
              options: ['The filament is too cold and the bed is not level/clean', 'The wifi is slow', 'The model has too many polygons', 'Supports are disabled'], correct_index: 0 },
            { scope: 'role', role: 'printer', prompt: 'What is "stringing" on a 3D print?',
              options: ['Thin plastic threads between features caused by oozing', 'Audio cables on the printer', 'A type of infill', 'A status code'], correct_index: 0 },
            { scope: 'role', role: 'printer', prompt: 'You should level the print bed...',
              options: ['Never — it is automatic always', 'When prints start failing or the printer is moved', 'Only on day 1', 'Once a year'], correct_index: 1 },
            { scope: 'role', role: 'printer', prompt: 'Which is the safer first step when a print fails mid-way?',
              options: ['Hit the printer', 'Pause, inspect, and re-slice if needed', 'Run it again identically and hope', 'Delete the file'], correct_index: 1 },
        ];

        // Pull existing prompts to avoid inserting duplicates on re-run.
        const { data: existing } = await db.from('quiz_questions').select('prompt');
        const existingPrompts = new Set(((existing as { prompt: string }[]) ?? []).map((r) => r.prompt));
        const toInsert = roleQuestions.filter((q) => !existingPrompts.has(q.prompt));
        if (toInsert.length > 0) {
            const { error: eq } = await db.from('quiz_questions').insert(toInsert);
            if (eq) throw new Error(`quiz_questions: ${eq.message}`);
        }

        // ── 7. Hint counters ─────────────────────────────────────────────
        log('hint counters...');
        const { error: e6 } = await db.from('team_hint_counters').upsert([
            { user_id: ID.user.noa,   team_id: ID.team.alpha, hint_count: 2 },
            { user_id: ID.user.ariel, team_id: ID.team.alpha, hint_count: 4 },
            { user_id: ID.user.lior,  team_id: ID.team.beta,  hint_count: 1 },
            { user_id: ID.user.tal,   team_id: ID.team.beta,  hint_count: 3 },
        ], { onConflict: 'user_id,team_id' });
        if (e6) throw new Error(`hint counters: ${e6.message}`);

        log('');
        log('Seed complete.');
        log('');
        log(`Demo password for every account: ${DEMO_PASSWORD}`);
        log('');
        log('Accounts:');
        log('  admin@techschool.demo    — admin (user CRUD)');
        log('  teacher@techschool.demo  — teacher');
        log('  yael, david, noa, ariel  — Team Alpha (editor/qa/designer/printer)');
        log('  maya, omer, lior, tal    — Team Beta  (editor/qa/designer/printer)');
    } catch (e) {
        err(`Seed failed: ${(e as Error).message}`);
        process.exit(1);
    }
}

seed();
