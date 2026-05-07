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

import postgres from 'postgres';
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
    const url = process.env.DATABASE_URL;
    if (!url) { err('DATABASE_URL not set'); process.exit(1); }
    const sql = postgres(url, {
        ssl: url.includes('sslmode=disable') ? false : 'require',
        max: 1,
    });

    try {
        log(`Hashing demo password (cost ${process.env.BCRYPT_COST ?? 12})...`);
        const cost = parseInt(process.env.BCRYPT_COST ?? '12', 10);
        const hash = await bcrypt.hash(DEMO_PASSWORD, cost);

        // ── 1. Challenge ─────────────────────────────────────────────────
        log('challenges...');
        await sql`
            insert into challenges (id, title, description, is_active, order_index, monday_board_id)
            values (${ID.challenge},
                    ${'Tech School 3D Design — שנה א׳'},
                    ${'תוכנית תלת-מימד לנבחרת Tech School, שנה א׳. CBL בהלימה למודל SEM. שלושה אתגרים קבוצתיים.'},
                    true, 1, null)
            on conflict (id) do update set title = excluded.title, is_active = excluded.is_active
        `;

        // ── 2. Sprints ───────────────────────────────────────────────────
        log('sprints...');
        await sql`
            insert into sprints (id, challenge_id, title, description, order_index) values
            (${ID.sprint.gift},     ${ID.challenge}, ${'אתגר 01 — מתנה'},       ${'יסודות התלת-מימד.'},     1),
            (${ID.sprint.games},    ${ID.challenge}, ${'אתגר 02 — משחקים'},     ${'מספר רכיבים, שילוב טכניקות.'}, 2),
            (${ID.sprint.branding}, ${ID.challenge}, ${'אתגר 03 — מיתוג אישי'}, ${'קנה מידה, חיבורים, מיתוג.'},  3)
            on conflict (id) do update set title = excluded.title
        `;

        // ── 3. Teams ─────────────────────────────────────────────────────
        log('teams...');
        await sql`
            insert into teams (id, name, accumulated_score, sprint_status, is_completed, current_challenge_id, current_sprint_id) values
            (${ID.team.alpha}, ${'Team Alpha — נבחרת אלפא'}, 150, 'active', false, ${ID.challenge}, ${ID.sprint.gift}),
            (${ID.team.beta},  ${'Team Beta — נבחרת בטא'},   120, 'active', false, ${ID.challenge}, ${ID.sprint.gift})
            on conflict (id) do update set
                accumulated_score = excluded.accumulated_score,
                sprint_status = excluded.sprint_status,
                current_challenge_id = excluded.current_challenge_id,
                current_sprint_id = excluded.current_sprint_id
        `;

        // ── 4. Users (8 students + 1 teacher + 1 admin, all with same hash) ──
        log('users...');
        await sql`
            insert into users (id, name, email, password_hash, account_type, auth_provider,
                               current_team_id, current_role, total_active_time, is_active) values
            (${ID.user.yael},    ${'Yael Mizrahi'},   ${'yael@techschool.demo'},   ${hash}, 'student','local', ${ID.team.alpha}, 'pm',       3240, true),
            (${ID.user.david},   ${'David Cohen'},    ${'david@techschool.demo'},  ${hash}, 'student','local', ${ID.team.alpha}, 'qa',       2880, true),
            (${ID.user.noa},     ${'Noa Ben-David'},  ${'noa@techschool.demo'},    ${hash}, 'student','local', ${ID.team.alpha}, 'dev',      4200, true),
            (${ID.user.ariel},   ${'Ariel Levy'},     ${'ariel@techschool.demo'},  ${hash}, 'student','local', ${ID.team.alpha}, 'hardware', 3600, true),
            (${ID.user.maya},    ${'Maya Shapiro'},   ${'maya@techschool.demo'},   ${hash}, 'student','local', ${ID.team.beta},  'pm',       2700, true),
            (${ID.user.omer},    ${'Omer Peretz'},    ${'omer@techschool.demo'},   ${hash}, 'student','local', ${ID.team.beta},  'qa',       3100, true),
            (${ID.user.lior},    ${'Lior Katz'},      ${'lior@techschool.demo'},   ${hash}, 'student','local', ${ID.team.beta},  'dev',      2400, true),
            (${ID.user.tal},     ${'Tal Friedman'},   ${'tal@techschool.demo'},    ${hash}, 'student','local', ${ID.team.beta},  'hardware', 3900, true),
            (${ID.user.teacher}, ${'Teacher Demo'},   ${'teacher@techschool.demo'},${hash}, 'teacher','local', null,             null,       0,    true),
            (${ID.user.admin},   ${'Admin Demo'},     ${'admin@techschool.demo'},  ${hash}, 'admin',  'local', null,             null,       0,    true)
            on conflict (id) do update set
                name = excluded.name,
                password_hash = excluded.password_hash,
                account_type = excluded.account_type,
                auth_provider = excluded.auth_provider,
                current_team_id = excluded.current_team_id,
                current_role = excluded.current_role,
                is_active = excluded.is_active
        `;

        // ── 5. Tasks (same fixtures as before) ───────────────────────────
        log('tasks...');
        const qaA = JSON.stringify({ isCompleted: true, hasErrors: false, improvements: ['הוסף chamfer לפינות חדות'] });
        const qaB = JSON.stringify({ isCompleted: true, hasErrors: false, improvements: ['תמיכות נראות מינימליות'] });
        const qaC = JSON.stringify({ isCompleted: true, hasErrors: false, improvements: [] });
        const qaD = JSON.stringify({ isCompleted: true, hasErrors: true,  improvements: ['הקטן צפיפות תמיכות', 'בדוק זווית overhang'] });

        await sql`
            insert into tasks (id, sprint_id, team_id, assigned_role, title, description, status,
                               submission_url, submitted_by, reviewed_by_qa, reviewed_by_pm,
                               qa_checklist, qa_notes, pm_notes) values
            (${ID.task.a1_hw}, ${ID.sprint.gift}, ${ID.team.alpha}, 'hardware',
             ${'עיצוב אובייקט מתנה ב-Fusion 360'},
             ${'צרו אובייקט תלת-מימדי בעל משמעות אישית. גובה מקס׳ 10ס״מ. ללא תמיכות.'},
             'approved', ${'https://drive.google.com/demo/gift-design-alpha'},
             ${ID.user.ariel}, ${ID.user.david}, ${ID.user.yael}, ${qaA}::jsonb,
             ${'המודל תקין.'}, ${'מאושר להדפסה.'}),
            (${ID.task.a1_dev}, ${ID.sprint.gift}, ${ID.team.alpha}, 'dev',
             ${'ייצוא קובץ STL ואופטימיזציה'},
             ${'ייצאו ל-STL, בדקו עובי דפנות מינ׳ 1.2מ״מ.'},
             'teacher_review', ${'https://drive.google.com/demo/stl-alpha'},
             ${ID.user.noa}, ${ID.user.david}, ${ID.user.yael}, ${qaB}::jsonb,
             ${'קובץ נקי.'}, ${'שולח למורה לאישור.'}),
            (${ID.task.a1_qa}, ${ID.sprint.gift}, ${ID.team.alpha}, 'qa',
             ${'בדיקת QA מלאה'},
             ${'בדקו מידות, עובי דפנות, סימולציית הדפסה ב-Slicer.'},
             'qa_review', ${'https://drive.google.com/demo/qa-checklist-alpha'},
             ${ID.user.david}, null, null, null::jsonb, null, null),
            (${ID.task.a1_pm}, ${ID.sprint.gift}, ${ID.team.alpha}, 'pm',
             ${'הגשה ל-LMS + פרזנטציה'},
             ${'רכזו תוצרים, העלו ל-LMS, בנו מצגת קצרה.'},
             'pending', null, null, null, null, null::jsonb, null, null),
            (${ID.task.b1_hw}, ${ID.sprint.gift}, ${ID.team.beta}, 'hardware',
             ${'מחזיק מפתחות מותאם'},
             ${'עצבו מחזיק עם ייחוד אישי. חור 6מ״מ, גובה מקס׳ 8ס״מ.'},
             'approved', ${'https://drive.google.com/demo/keychain-beta'},
             ${ID.user.tal}, ${ID.user.omer}, ${ID.user.maya}, ${qaC}::jsonb,
             null, ${'עיצוב מרשים.'}),
            (${ID.task.b1_dev}, ${ID.sprint.gift}, ${ID.team.beta}, 'dev',
             ${'הגדרות Slicer + תמיכות'},
             ${'layer 0.2מ״מ, infill 20%, supports אוטו׳.'},
             'pm_review', ${'https://drive.google.com/demo/slicer-beta'},
             ${ID.user.lior}, ${ID.user.omer}, null, ${qaD}::jsonb,
             ${'בעיות קלות.'}, null),
            (${ID.task.b1_qa}, ${ID.sprint.gift}, ${ID.team.beta}, 'qa',
             ${'אימות מידות'},
             ${'גובה 8ס״מ, חור 6מ״מ, אין חלקים נפרדים.'},
             'pending', null, null, null, null, null::jsonb, null, null),
            (${ID.task.b1_pm}, ${ID.sprint.gift}, ${ID.team.beta}, 'pm',
             ${'תיעוד תהליך + הגשה'},
             ${'תעדו 3 איטרציות, שגיאות, לקחים.'},
             'pending', null, null, null, null, null::jsonb, null, null)
            on conflict (id) do update set status = excluded.status
        `;

        // ── 6. Hint counters ─────────────────────────────────────────────
        log('hint counters...');
        await sql`
            insert into team_hint_counters (user_id, team_id, hint_count) values
            (${ID.user.noa},   ${ID.team.alpha}, 2),
            (${ID.user.ariel}, ${ID.team.alpha}, 4),
            (${ID.user.lior},  ${ID.team.beta},  1),
            (${ID.user.tal},   ${ID.team.beta},  3)
            on conflict (user_id, team_id) do update set hint_count = excluded.hint_count
        `;

        log('');
        log('✅  Seed complete.');
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
    } finally {
        await sql.end();
    }
}

seed();
