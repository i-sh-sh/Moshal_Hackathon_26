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
    challenge: 'aaaa0001-0000-0000-0000-000000000000',
    sprint: {
        gift:     'bbbb0001-0000-0000-0000-000000000000',
        games:    'bbbb0002-0000-0000-0000-000000000000',
        branding: 'bbbb0003-0000-0000-0000-000000000000',
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
        a1_hw:  'eeee0001-0000-0000-0000-000000000000',
        a1_dev: 'eeee0002-0000-0000-0000-000000000000',
        a1_qa:  'eeee0003-0000-0000-0000-000000000000',
        a1_pm:  'eeee0004-0000-0000-0000-000000000000',
        b1_hw:  'eeee0005-0000-0000-0000-000000000000',
        b1_dev: 'eeee0006-0000-0000-0000-000000000000',
        b1_qa:  'eeee0007-0000-0000-0000-000000000000',
        b1_pm:  'eeee0008-0000-0000-0000-000000000000',
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

        // ── 1. Challenge ─────────────────────────────────────────────────
        log('challenges...');
        const { error: e1 } = await db.from('challenges').upsert({
            id: ID.challenge,
            title: 'Tech School 3D Design — שנה א׳',
            description: 'תוכנית תלת-מימד לנבחרת Tech School, שנה א׳. CBL בהלימה למודל SEM. שלושה אתגרים קבוצתיים.',
            is_active: true,
            order_index: 1,
            monday_board_id: null,
        }, { onConflict: 'id' });
        if (e1) throw new Error(`challenges: ${e1.message}`);

        // ── 2. Sprints ───────────────────────────────────────────────────
        log('sprints...');
        const { error: e2 } = await db.from('sprints').upsert([
            { id: ID.sprint.gift,     challenge_id: ID.challenge, title: 'אתגר 01 — מתנה',       description: 'יסודות התלת-מימד.',     order_index: 1 },
            { id: ID.sprint.games,    challenge_id: ID.challenge, title: 'אתגר 02 — משחקים',     description: 'מספר רכיבים, שילוב טכניקות.', order_index: 2 },
            { id: ID.sprint.branding, challenge_id: ID.challenge, title: 'אתגר 03 — מיתוג אישי', description: 'קנה מידה, חיבורים, מיתוג.',  order_index: 3 },
        ], { onConflict: 'id' });
        if (e2) throw new Error(`sprints: ${e2.message}`);

        // ── 3. Teams ─────────────────────────────────────────────────────
        log('teams...');
        const { error: e3 } = await db.from('teams').upsert([
            { id: ID.team.alpha, name: 'Team Alpha — נבחרת אלפא', accumulated_score: 150, sprint_status: 'active', is_completed: false, current_challenge_id: ID.challenge, current_sprint_id: ID.sprint.gift },
            { id: ID.team.beta,  name: 'Team Beta — נבחרת בטא',   accumulated_score: 120, sprint_status: 'active', is_completed: false, current_challenge_id: ID.challenge, current_sprint_id: ID.sprint.gift },
        ], { onConflict: 'id' });
        if (e3) throw new Error(`teams: ${e3.message}`);

        // ── 4. Users (8 students + 1 teacher + 1 admin, all with same hash) ──
        log('users...');
        const { error: e4 } = await db.from('users').upsert([
            { id: ID.user.yael,    name: 'Yael Mizrahi',   email: 'yael@techschool.demo',    password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.alpha, current_role: 'pm',       total_active_time: 3240, is_active: true },
            { id: ID.user.david,   name: 'David Cohen',    email: 'david@techschool.demo',   password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.alpha, current_role: 'qa',       total_active_time: 2880, is_active: true },
            { id: ID.user.noa,     name: 'Noa Ben-David',  email: 'noa@techschool.demo',     password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.alpha, current_role: 'dev',      total_active_time: 4200, is_active: true },
            { id: ID.user.ariel,   name: 'Ariel Levy',     email: 'ariel@techschool.demo',   password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.alpha, current_role: 'hardware', total_active_time: 3600, is_active: true },
            { id: ID.user.maya,    name: 'Maya Shapiro',   email: 'maya@techschool.demo',    password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.beta,  current_role: 'pm',       total_active_time: 2700, is_active: true },
            { id: ID.user.omer,    name: 'Omer Peretz',    email: 'omer@techschool.demo',    password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.beta,  current_role: 'qa',       total_active_time: 3100, is_active: true },
            { id: ID.user.lior,    name: 'Lior Katz',      email: 'lior@techschool.demo',    password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.beta,  current_role: 'dev',      total_active_time: 2400, is_active: true },
            { id: ID.user.tal,     name: 'Tal Friedman',   email: 'tal@techschool.demo',     password_hash: hash, account_type: 'student', auth_provider: 'local', current_team_id: ID.team.beta,  current_role: 'hardware', total_active_time: 3900, is_active: true },
            { id: ID.user.teacher, name: 'Teacher Demo',   email: 'teacher@techschool.demo', password_hash: hash, account_type: 'teacher', auth_provider: 'local', current_team_id: null,          current_role: null,       total_active_time: 0,    is_active: true },
            { id: ID.user.admin,   name: 'Admin Demo',     email: 'admin@techschool.demo',   password_hash: hash, account_type: 'admin',   auth_provider: 'local', current_team_id: null,          current_role: null,       total_active_time: 0,    is_active: true },
        ], { onConflict: 'id' });
        if (e4) throw new Error(`users: ${e4.message}`);

        // ── 5. Tasks (same fixtures as before) ───────────────────────────
        log('tasks...');
        const qaA = { isCompleted: true, hasErrors: false, improvements: ['הוסף chamfer לפינות חדות'] };
        const qaB = { isCompleted: true, hasErrors: false, improvements: ['תמיכות נראות מינימליות'] };
        const qaC = { isCompleted: true, hasErrors: false, improvements: [] };
        const qaD = { isCompleted: true, hasErrors: true,  improvements: ['הקטן צפיפות תמיכות', 'בדוק זווית overhang'] };

        const { error: e5 } = await db.from('tasks').upsert([
            { id: ID.task.a1_hw, sprint_id: ID.sprint.gift, team_id: ID.team.alpha, assigned_role: 'hardware',
              title: 'עיצוב אובייקט מתנה ב-Fusion 360',
              description: 'צרו אובייקט תלת-מימדי בעל משמעות אישית. גובה מקס׳ 10ס״מ. ללא תמיכות.',
              status: 'approved', submission_url: 'https://drive.google.com/demo/gift-design-alpha',
              submitted_by: ID.user.ariel, reviewed_by_qa: ID.user.david, reviewed_by_pm: ID.user.yael,
              qa_checklist: qaA, qa_notes: 'המודל תקין.', pm_notes: 'מאושר להדפסה.' },
            { id: ID.task.a1_dev, sprint_id: ID.sprint.gift, team_id: ID.team.alpha, assigned_role: 'dev',
              title: 'ייצוא קובץ STL ואופטימיזציה',
              description: 'ייצאו ל-STL, בדקו עובי דפנות מינ׳ 1.2מ״מ.',
              status: 'teacher_review', submission_url: 'https://drive.google.com/demo/stl-alpha',
              submitted_by: ID.user.noa, reviewed_by_qa: ID.user.david, reviewed_by_pm: ID.user.yael,
              qa_checklist: qaB, qa_notes: 'קובץ נקי.', pm_notes: 'שולח למורה לאישור.' },
            { id: ID.task.a1_qa, sprint_id: ID.sprint.gift, team_id: ID.team.alpha, assigned_role: 'qa',
              title: 'בדיקת QA מלאה',
              description: 'בדקו מידות, עובי דפנות, סימולציית הדפסה ב-Slicer.',
              status: 'qa_review', submission_url: 'https://drive.google.com/demo/qa-checklist-alpha',
              submitted_by: ID.user.david },
            { id: ID.task.a1_pm, sprint_id: ID.sprint.gift, team_id: ID.team.alpha, assigned_role: 'pm',
              title: 'הגשה ל-LMS + פרזנטציה',
              description: 'רכזו תוצרים, העלו ל-LMS, בנו מצגת קצרה.',
              status: 'pending' },
            { id: ID.task.b1_hw, sprint_id: ID.sprint.gift, team_id: ID.team.beta, assigned_role: 'hardware',
              title: 'מחזיק מפתחות מותאם',
              description: 'עצבו מחזיק עם ייחוד אישי. חור 6מ״מ, גובה מקס׳ 8ס״מ.',
              status: 'approved', submission_url: 'https://drive.google.com/demo/keychain-beta',
              submitted_by: ID.user.tal, reviewed_by_qa: ID.user.omer, reviewed_by_pm: ID.user.maya,
              qa_checklist: qaC, pm_notes: 'עיצוב מרשים.' },
            { id: ID.task.b1_dev, sprint_id: ID.sprint.gift, team_id: ID.team.beta, assigned_role: 'dev',
              title: 'הגדרות Slicer + תמיכות',
              description: 'layer 0.2מ״מ, infill 20%, supports אוטו׳.',
              status: 'pm_review', submission_url: 'https://drive.google.com/demo/slicer-beta',
              submitted_by: ID.user.lior, reviewed_by_qa: ID.user.omer,
              qa_checklist: qaD, qa_notes: 'בעיות קלות.' },
            { id: ID.task.b1_qa, sprint_id: ID.sprint.gift, team_id: ID.team.beta, assigned_role: 'qa',
              title: 'אימות מידות',
              description: 'גובה 8ס״מ, חור 6מ״מ, אין חלקים נפרדים.',
              status: 'pending' },
            { id: ID.task.b1_pm, sprint_id: ID.sprint.gift, team_id: ID.team.beta, assigned_role: 'pm',
              title: 'תיעוד תהליך + הגשה',
              description: 'תעדו 3 איטרציות, שגיאות, לקחים.',
              status: 'pending' },
        ], { onConflict: 'id' });
        if (e5) throw new Error(`tasks: ${e5.message}`);

        // ── 6. Hint counters ─────────────────────────────────────────────
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
        log('  yael, david, noa, ariel  — Team Alpha (pm/qa/dev/hw)');
        log('  maya, omer, lior, tal    — Team Beta  (pm/qa/dev/hw)');
    } catch (e) {
        err(`Seed failed: ${(e as Error).message}`);
        process.exit(1);
    }
}

seed();
