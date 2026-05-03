import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { SupabaseService } from './supabase/supabase.service';

const log = new Logger('Seed');

// ── Fixed UUIDs — guarantees idempotency across runs ─────────────────────────

const ID = {
    challenge: 'aaaa0001-0000-0000-0000-000000000000',

    sprint: {
        gift:     'bbbb0001-0000-0000-0000-000000000000', // אתגר 01 מתנה
        games:    'bbbb0002-0000-0000-0000-000000000000', // אתגר 02 משחקים
        branding: 'bbbb0003-0000-0000-0000-000000000000', // אתגר 03 מיתוג אישי
    },

    team: {
        alpha: 'cccc0001-0000-0000-0000-000000000000',
        beta:  'cccc0002-0000-0000-0000-000000000000',
    },

    user: {
        // Team Alpha
        yael:  'dddd0001-0000-0000-0000-000000000000', // PM
        david: 'dddd0002-0000-0000-0000-000000000000', // QA
        noa:   'dddd0003-0000-0000-0000-000000000000', // Dev
        ariel: 'dddd0004-0000-0000-0000-000000000000', // Hardware
        // Team Beta
        maya:  'dddd0005-0000-0000-0000-000000000000', // PM
        omer:  'dddd0006-0000-0000-0000-000000000000', // QA
        lior:  'dddd0007-0000-0000-0000-000000000000', // Dev
        tal:   'dddd0008-0000-0000-0000-000000000000', // Hardware
    },

    task: {
        // Alpha — Sprint 1 (מתנה)
        a1_hw:  'eeee0001-0000-0000-0000-000000000000',
        a1_dev: 'eeee0002-0000-0000-0000-000000000000',
        a1_qa:  'eeee0003-0000-0000-0000-000000000000',
        a1_pm:  'eeee0004-0000-0000-0000-000000000000',
        // Beta — Sprint 1 (מתנה)
        b1_hw:  'eeee0005-0000-0000-0000-000000000000',
        b1_dev: 'eeee0006-0000-0000-0000-000000000000',
        b1_qa:  'eeee0007-0000-0000-0000-000000000000',
        b1_pm:  'eeee0008-0000-0000-0000-000000000000',
    },
} as const;

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
    });
    const db = app.get(SupabaseService).db;

    // ── 1. Challenge ─────────────────────────────────────────────────────────
    log.log('Seeding challenges...');
    await upsert(db, 'challenges', [
        {
            id: ID.challenge,
            title: 'Tech School 3D Design — שנה א׳',
            description:
                'תוכנית תלת-מימד לנבחרת Tech School, שנה א׳. ' +
                'למידה מבוססת אתגרים (CBL) בהלימה למודל SEM. ' +
                'שלושה אתגרים קבוצתיים: מתנה, משחקים ומיתוג אישי.',
            is_active: true,
            order_index: 1,
            monday_board_id: null,
        },
    ]);

    // ── 2. Sprints ───────────────────────────────────────────────────────────
    log.log('Seeding sprints...');
    await upsert(db, 'sprints', [
        {
            id: ID.sprint.gift,
            challenge_id: ID.challenge,
            title: 'אתגר 01 — מתנה',
            description:
                'יסודות התלת-מימד, צורות וטכניקות בסיס. ' +
                'כל קבוצה מעצבת ומדפיסה מתנה אישית אחת.',
            order_index: 1,
        },
        {
            id: ID.sprint.games,
            challenge_id: ID.challenge,
            title: 'אתגר 02 — משחקים',
            description:
                'מספר רכיבים, שילוב בין טכניקות, תכנון לאחור. ' +
                'יצירת משחק עם ייחוד לעיר/ישוב. גביע ראש העיר.',
            order_index: 2,
        },
        {
            id: ID.sprint.branding,
            challenge_id: ID.challenge,
            title: 'אתגר 03 — מיתוג אישי',
            description:
                'קנה מידה, הרכבה וחיבורים, שילוב חומרים, חיתוכים וחריטות. ' +
                'מוגש בתחרות מוקדמות אזורית — Makeathon.',
            order_index: 3,
        },
    ]);

    // ── 3. Teams (current_sprint_id can be set now that sprints exist) ────────
    log.log('Seeding teams...');
    await upsert(db, 'teams', [
        {
            id: ID.team.alpha,
            name: 'Team Alpha — נבחרת אלפא',
            accumulated_score: 150,
            sprint_status: 'active',
            is_completed: false,
            current_challenge_id: ID.challenge,
            current_sprint_id: ID.sprint.gift,
        },
        {
            id: ID.team.beta,
            name: 'Team Beta — נבחרת בטא',
            accumulated_score: 120,
            sprint_status: 'active',
            is_completed: false,
            current_challenge_id: ID.challenge,
            current_sprint_id: ID.sprint.gift,
        },
    ]);

    // ── 4. Users ─────────────────────────────────────────────────────────────
    log.log('Seeding users...');
    await upsert(db, 'users', [
        // Team Alpha
        {
            id: ID.user.yael,
            name: 'Yael Mizrahi',
            email: 'yael@techschool.demo',
            current_team_id: ID.team.alpha,
            current_role: 'pm',
            total_active_time: 3240,
        },
        {
            id: ID.user.david,
            name: 'David Cohen',
            email: 'david@techschool.demo',
            current_team_id: ID.team.alpha,
            current_role: 'qa',
            total_active_time: 2880,
        },
        {
            id: ID.user.noa,
            name: 'Noa Ben-David',
            email: 'noa@techschool.demo',
            current_team_id: ID.team.alpha,
            current_role: 'dev',
            total_active_time: 4200,
        },
        {
            id: ID.user.ariel,
            name: 'Ariel Levy',
            email: 'ariel@techschool.demo',
            current_team_id: ID.team.alpha,
            current_role: 'hardware',
            total_active_time: 3600,
        },
        // Team Beta
        {
            id: ID.user.maya,
            name: 'Maya Shapiro',
            email: 'maya@techschool.demo',
            current_team_id: ID.team.beta,
            current_role: 'pm',
            total_active_time: 2700,
        },
        {
            id: ID.user.omer,
            name: 'Omer Peretz',
            email: 'omer@techschool.demo',
            current_team_id: ID.team.beta,
            current_role: 'qa',
            total_active_time: 3100,
        },
        {
            id: ID.user.lior,
            name: 'Lior Katz',
            email: 'lior@techschool.demo',
            current_team_id: ID.team.beta,
            current_role: 'dev',
            total_active_time: 2400,
        },
        {
            id: ID.user.tal,
            name: 'Tal Friedman',
            email: 'tal@techschool.demo',
            current_team_id: ID.team.beta,
            current_role: 'hardware',
            total_active_time: 3900,
        },
    ]);

    // ── 5. Tasks — Sprint 1 (מתנה), both teams ───────────────────────────────
    // Statuses are mixed intentionally to make the demo board look alive:
    //   Alpha: approved / teacher_review / qa_review / pending
    //   Beta:  approved / pm_review     / pending   / pending
    log.log('Seeding tasks...');
    await upsert(db, 'tasks', [

        // ── Team Alpha ────────────────────────────────────────────────────────
        {
            id: ID.task.a1_hw,
            sprint_id: ID.sprint.gift,
            team_id: ID.team.alpha,
            assigned_role: 'hardware',
            title: 'עיצוב אובייקט מתנה ב-Fusion 360',
            description:
                'צרו אובייקט תלת-מימדי בעל משמעות אישית תוך שימוש בצורות בסיס. ' +
                'גובה מקסימלי 10ס"מ. על האובייקט להיות ניתן להדפסה ללא תמיכות.',
            status: 'approved',
            submission_url: 'https://drive.google.com/demo/gift-design-alpha',
            submitted_by: ID.user.ariel,
            reviewed_by_qa: ID.user.david,
            reviewed_by_pm: ID.user.yael,
            qa_checklist: {
                isCompleted: true,
                hasErrors: false,
                improvements: ['הוסף chamfer לפינות חדות'],
            },
            qa_notes: 'המודל תקין, מידות בתוך הספק.',
            pm_notes: 'מאושר להדפסה. עבודה מצוינת!',
        },
        {
            id: ID.task.a1_dev,
            sprint_id: ID.sprint.gift,
            team_id: ID.team.alpha,
            assigned_role: 'dev',
            title: 'ייצוא קובץ STL ואופטימיזציה להדפסה',
            description:
                'ייצאו את המודל לפורמט STL, בדקו עובי דפנות מינימלי (1.2מ"מ) ' +
                'והוסיפו תמיכות במידת הצורך בתוכנת Slicer.',
            status: 'teacher_review',
            submission_url: 'https://drive.google.com/demo/stl-alpha',
            submitted_by: ID.user.noa,
            reviewed_by_qa: ID.user.david,
            reviewed_by_pm: ID.user.yael,
            qa_checklist: {
                isCompleted: true,
                hasErrors: false,
                improvements: ['תמיכות נראות מינימליות — בדוק שוב'],
            },
            qa_notes: 'קובץ נקי ומוכן.',
            pm_notes: 'שולח למורה לאישור סופי.',
        },
        {
            id: ID.task.a1_qa,
            sprint_id: ID.sprint.gift,
            team_id: ID.team.alpha,
            assigned_role: 'qa',
            title: 'בדיקת QA: מידות, עובי דפנות, הדפסה',
            description:
                'בצעו בדיקת QA מלאה: ודאו שהמידות תואמות לדרישות, ' +
                'בדקו עובי דפנות (מינ׳ 1.2מ"מ), ובצעו סימולציית הדפסה ב-Slicer.',
            status: 'qa_review',
            submission_url: 'https://drive.google.com/demo/qa-checklist-alpha',
            submitted_by: ID.user.david,
        },
        {
            id: ID.task.a1_pm,
            sprint_id: ID.sprint.gift,
            team_id: ID.team.alpha,
            assigned_role: 'pm',
            title: 'הגשת תוצר קבוצתי ל-LMS + הכנת פרזנטציה',
            description:
                'רכזו את כל תוצרי הצוות, העלו ל-LMS ובנו מצגת קצרה (5 שקפים) ' +
                'שמסבירה את תהליך העיצוב: בעיה → פתרון → איטרציות → תוצר סופי.',
            status: 'pending',
        },

        // ── Team Beta ─────────────────────────────────────────────────────────
        {
            id: ID.task.b1_hw,
            sprint_id: ID.sprint.gift,
            team_id: ID.team.beta,
            assigned_role: 'hardware',
            title: 'עיצוב מחזיק מפתחות מותאם אישית',
            description:
                'עצבו מחזיק מפתחות עם ייחוד אישי (שם, צורה, סמל) ב-Fusion 360. ' +
                'חור לטבעת קוטר 6מ"מ, גובה מקסימלי 8ס"מ.',
            status: 'approved',
            submission_url: 'https://drive.google.com/demo/keychain-beta',
            submitted_by: ID.user.tal,
            reviewed_by_qa: ID.user.omer,
            reviewed_by_pm: ID.user.maya,
            qa_checklist: {
                isCompleted: true,
                hasErrors: false,
                improvements: [],
            },
            pm_notes: 'עיצוב מרשים עם נגיעה אישית.',
        },
        {
            id: ID.task.b1_dev,
            sprint_id: ID.sprint.gift,
            team_id: ID.team.beta,
            assigned_role: 'dev',
            title: 'הגדרות Slicer + מבני תמיכה',
            description:
                'הגדירו הגדרות Slicer (layer: 0.2מ"מ, infill: 20%), ' +
                'הוסיפו supports אוטומטיים ושמרו פרופיל מותאם לצוות.',
            status: 'pm_review',
            submission_url: 'https://drive.google.com/demo/slicer-beta',
            submitted_by: ID.user.lior,
            reviewed_by_qa: ID.user.omer,
            qa_checklist: {
                isCompleted: true,
                hasErrors: true,
                improvements: ['הקטן צפיפות תמיכות', 'בדוק זווית overhang'],
            },
            qa_notes: 'בעיות קלות — עדיין ניתן להדפסה. שולח ל-PM.',
        },
        {
            id: ID.task.b1_qa,
            sprint_id: ID.sprint.gift,
            team_id: ID.team.beta,
            assigned_role: 'qa',
            title: 'אימות מידות מול דרישות האתגר',
            description:
                'ודאו שהמחזיק עומד בדרישות: גובה מקסימלי 8ס"מ, ' +
                'חור לטבעת בקוטר 6מ"מ, ואין חלקים עצמאיים שיתפרקו בהדפסה.',
            status: 'pending',
        },
        {
            id: ID.task.b1_pm,
            sprint_id: ID.sprint.gift,
            team_id: ID.team.beta,
            assigned_role: 'pm',
            title: 'תיעוד תהליך העיצוב ותיאום הגשה',
            description:
                'תעדו את תהליך העיצוב ב-Google Doc: 3 איטרציות, שגיאות, ' +
                'מה למדתם ומה הייתם עושים אחרת. הגישו יחד עם קובץ STL.',
            status: 'pending',
        },
    ]);

    // ── 6. Hint counters — shows the system has been used ────────────────────
    log.log('Seeding hint counters...');
    await upsert(db, 'team_hint_counters', [
        { user_id: ID.user.noa,   team_id: ID.team.alpha, hint_count: 2 },
        { user_id: ID.user.ariel, team_id: ID.team.alpha, hint_count: 4 }, // over limit → points deducted
        { user_id: ID.user.lior,  team_id: ID.team.beta,  hint_count: 1 },
        { user_id: ID.user.tal,   team_id: ID.team.beta,  hint_count: 3 },
    ]);

    await app.close();
    log.log('✅  Seed complete!');
    log.log('');
    log.log('Demo credentials (no auth — use IDs directly):');
    log.log(`  Team Alpha PM  → userId: ${ID.user.yael}  (Yael Mizrahi)`);
    log.log(`  Team Alpha QA  → userId: ${ID.user.david} (David Cohen)`);
    log.log(`  Team Alpha Dev → userId: ${ID.user.noa}   (Noa Ben-David)`);
    log.log(`  Team Alpha HW  → userId: ${ID.user.ariel} (Ariel Levy)`);
    log.log(`  Team Beta  PM  → userId: ${ID.user.maya}  (Maya Shapiro)`);
    log.log(`  Team Beta  QA  → userId: ${ID.user.omer}  (Omer Peretz)`);
    log.log(`  Team Beta  Dev → userId: ${ID.user.lior}  (Lior Katz)`);
    log.log(`  Team Beta  HW  → userId: ${ID.user.tal}   (Tal Friedman)`);
    log.log(`  Challenge      → ${ID.challenge}`);
    log.log(`  Active Sprint  → ${ID.sprint.gift} (אתגר 01 — מתנה)`);
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function upsert(db: any, table: string, rows: object[]) {
    const { error } = await db
        .from(table)
        .upsert(rows, { onConflict: 'id' });

    if (error) {
        log.error(`Failed to upsert into "${table}": ${error.message}`);
        throw error;
    }
    log.log(`  ✓ ${table} (${rows.length} rows)`);
}

// ── Run ───────────────────────────────────────────────────────────────────────

seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
