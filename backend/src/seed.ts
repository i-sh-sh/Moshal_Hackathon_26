import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const log = (msg: string) => console.log(`[Seed] ${msg}`);
const err = (msg: string) => console.error(`[Seed] ✗ ${msg}`);

// ── Fixed UUIDs — guarantees idempotency across runs ─────────────────────────
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

async function seed() {
    const sql = postgres(process.env.DATABASE_URL ?? '', { ssl: 'require', max: 1 });

    try {
        // ── 1. Challenge ─────────────────────────────────────────────────────
        log('Seeding challenges...');
        await sql`
            INSERT INTO challenges (id, title, description, is_active, order_index, monday_board_id)
            VALUES (
                ${ID.challenge},
                ${'Tech School 3D Design — שנה א׳'},
                ${'תוכנית תלת-מימד לנבחרת Tech School, שנה א׳. למידה מבוססת אתגרים (CBL) בהלימה למודל SEM. שלושה אתגרים קבוצתיים: מתנה, משחקים ומיתוג אישי.'},
                ${true}, ${1}, ${null}
            )
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title, is_active = EXCLUDED.is_active
        `;
        log('  ✓ challenges (1 row)');

        // ── 2. Sprints ───────────────────────────────────────────────────────
        log('Seeding sprints...');
        await sql`
            INSERT INTO sprints (id, challenge_id, title, description, order_index) VALUES
            (${ID.sprint.gift},     ${ID.challenge}, ${'אתגר 01 — מתנה'},       ${'יסודות התלת-מימד, צורות וטכניקות בסיס. כל קבוצה מעצבת ומדפיסה מתנה אישית אחת.'}, ${1}),
            (${ID.sprint.games},    ${ID.challenge}, ${'אתגר 02 — משחקים'},     ${'מספר רכיבים, שילוב בין טכניקות, תכנון לאחור. יצירת משחק עם ייחוד לעיר/ישוב. גביע ראש העיר.'}, ${2}),
            (${ID.sprint.branding}, ${ID.challenge}, ${'אתגר 03 — מיתוג אישי'}, ${'קנה מידה, הרכבה וחיבורים, שילוב חומרים, חיתוכים וחריטות. מוגש בתחרות מוקדמות אזורית — Makeathon.'}, ${3})
            ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title
        `;
        log('  ✓ sprints (3 rows)');

        // ── 3. Teams ─────────────────────────────────────────────────────────
        log('Seeding teams...');
        await sql`
            INSERT INTO teams (id, name, accumulated_score, sprint_status, is_completed, current_challenge_id, current_sprint_id) VALUES
            (${ID.team.alpha}, ${'Team Alpha — נבחרת אלפא'}, ${150}, ${'active'}, ${false}, ${ID.challenge}, ${ID.sprint.gift}),
            (${ID.team.beta},  ${'Team Beta — נבחרת בטא'},   ${120}, ${'active'}, ${false}, ${ID.challenge}, ${ID.sprint.gift})
            ON CONFLICT (id) DO UPDATE SET
                accumulated_score = EXCLUDED.accumulated_score, sprint_status = EXCLUDED.sprint_status,
                current_challenge_id = EXCLUDED.current_challenge_id, current_sprint_id = EXCLUDED.current_sprint_id
        `;
        log('  ✓ teams (2 rows)');

        // ── 4. Users ─────────────────────────────────────────────────────────
        log('Seeding users...');
        await sql`
            INSERT INTO users (id, name, email, current_team_id, current_role, total_active_time) VALUES
            (${ID.user.yael},  ${'Yael Mizrahi'},  ${'yael@techschool.demo'},  ${ID.team.alpha}, ${'pm'},       ${3240}),
            (${ID.user.david}, ${'David Cohen'},   ${'david@techschool.demo'}, ${ID.team.alpha}, ${'qa'},       ${2880}),
            (${ID.user.noa},   ${'Noa Ben-David'}, ${'noa@techschool.demo'},   ${ID.team.alpha}, ${'dev'},      ${4200}),
            (${ID.user.ariel}, ${'Ariel Levy'},    ${'ariel@techschool.demo'}, ${ID.team.alpha}, ${'hardware'}, ${3600}),
            (${ID.user.maya},  ${'Maya Shapiro'},  ${'maya@techschool.demo'},  ${ID.team.beta},  ${'pm'},       ${2700}),
            (${ID.user.omer},  ${'Omer Peretz'},   ${'omer@techschool.demo'},  ${ID.team.beta},  ${'qa'},       ${3100}),
            (${ID.user.lior},  ${'Lior Katz'},     ${'lior@techschool.demo'},  ${ID.team.beta},  ${'dev'},      ${2400}),
            (${ID.user.tal},   ${'Tal Friedman'},  ${'tal@techschool.demo'},   ${ID.team.beta},  ${'hardware'}, ${3900})
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, current_team_id = EXCLUDED.current_team_id,
                current_role = EXCLUDED.current_role
        `;
        log('  ✓ users (8 rows)');

        // ── 5. Tasks ─────────────────────────────────────────────────────────
        log('Seeding tasks...');
        const qaChecklistA = JSON.stringify({ isCompleted: true, hasErrors: false, improvements: ['הוסף chamfer לפינות חדות'] });
        const qaChecklistB = JSON.stringify({ isCompleted: true, hasErrors: false, improvements: ['תמיכות נראות מינימליות — בדוק שוב'] });
        const qaChecklistC = JSON.stringify({ isCompleted: true, hasErrors: false, improvements: [] });
        const qaChecklistD = JSON.stringify({ isCompleted: true, hasErrors: true,  improvements: ['הקטן צפיפות תמיכות', 'בדוק זווית overhang'] });

        await sql`
            INSERT INTO tasks (id, sprint_id, team_id, assigned_role, title, description, status,
                               submission_url, submitted_by, reviewed_by_qa, reviewed_by_pm,
                               qa_checklist, qa_notes, pm_notes) VALUES
            (
                ${ID.task.a1_hw}, ${ID.sprint.gift}, ${ID.team.alpha}, ${'hardware'},
                ${'עיצוב אובייקט מתנה ב-Fusion 360'},
                ${'צרו אובייקט תלת-מימדי בעל משמעות אישית תוך שימוש בצורות בסיס. גובה מקסימלי 10ס"מ. על האובייקט להיות ניתן להדפסה ללא תמיכות.'},
                ${'approved'}, ${'https://drive.google.com/demo/gift-design-alpha'},
                ${ID.user.ariel}, ${ID.user.david}, ${ID.user.yael},
                ${qaChecklistA}::jsonb, ${'המודל תקין, מידות בתוך הספק.'}, ${'מאושר להדפסה. עבודה מצוינת!'}
            ),
            (
                ${ID.task.a1_dev}, ${ID.sprint.gift}, ${ID.team.alpha}, ${'dev'},
                ${'ייצוא קובץ STL ואופטימיזציה להדפסה'},
                ${'ייצאו את המודל לפורמט STL, בדקו עובי דפנות מינימלי (1.2מ"מ) והוסיפו תמיכות במידת הצורך בתוכנת Slicer.'},
                ${'teacher_review'}, ${'https://drive.google.com/demo/stl-alpha'},
                ${ID.user.noa}, ${ID.user.david}, ${ID.user.yael},
                ${qaChecklistB}::jsonb, ${'קובץ נקי ומוכן.'}, ${'שולח למורה לאישור סופי.'}
            ),
            (
                ${ID.task.a1_qa}, ${ID.sprint.gift}, ${ID.team.alpha}, ${'qa'},
                ${'בדיקת QA: מידות, עובי דפנות, הדפסה'},
                ${'בצעו בדיקת QA מלאה: ודאו שהמידות תואמות לדרישות, בדקו עובי דפנות (מינ׳ 1.2מ"מ), ובצעו סימולציית הדפסה ב-Slicer.'},
                ${'qa_review'}, ${'https://drive.google.com/demo/qa-checklist-alpha'},
                ${ID.user.david}, ${null}, ${null}, ${null}::jsonb, ${null}, ${null}
            ),
            (
                ${ID.task.a1_pm}, ${ID.sprint.gift}, ${ID.team.alpha}, ${'pm'},
                ${'הגשת תוצר קבוצתי ל-LMS + הכנת פרזנטציה'},
                ${'רכזו את כל תוצרי הצוות, העלו ל-LMS ובנו מצגת קצרה (5 שקפים) שמסבירה את תהליך העיצוב.'},
                ${'pending'}, ${null}, ${null}, ${null}, ${null}, ${null}::jsonb, ${null}, ${null}
            ),
            (
                ${ID.task.b1_hw}, ${ID.sprint.gift}, ${ID.team.beta}, ${'hardware'},
                ${'עיצוב מחזיק מפתחות מותאם אישית'},
                ${'עצבו מחזיק מפתחות עם ייחוד אישי (שם, צורה, סמל) ב-Fusion 360. חור לטבעת קוטר 6מ"מ, גובה מקסימלי 8ס"מ.'},
                ${'approved'}, ${'https://drive.google.com/demo/keychain-beta'},
                ${ID.user.tal}, ${ID.user.omer}, ${ID.user.maya},
                ${qaChecklistC}::jsonb, ${null}, ${'עיצוב מרשים עם נגיעה אישית.'}
            ),
            (
                ${ID.task.b1_dev}, ${ID.sprint.gift}, ${ID.team.beta}, ${'dev'},
                ${'הגדרות Slicer + מבני תמיכה'},
                ${'הגדירו הגדרות Slicer (layer: 0.2מ"מ, infill: 20%), הוסיפו supports אוטומטיים ושמרו פרופיל מותאם לצוות.'},
                ${'pm_review'}, ${'https://drive.google.com/demo/slicer-beta'},
                ${ID.user.lior}, ${ID.user.omer}, ${null},
                ${qaChecklistD}::jsonb, ${'בעיות קלות — עדיין ניתן להדפסה. שולח ל-PM.'}, ${null}
            ),
            (
                ${ID.task.b1_qa}, ${ID.sprint.gift}, ${ID.team.beta}, ${'qa'},
                ${'אימות מידות מול דרישות האתגר'},
                ${'ודאו שהמחזיק עומד בדרישות: גובה מקסימלי 8ס"מ, חור לטבעת בקוטר 6מ"מ, ואין חלקים עצמאיים שיתפרקו בהדפסה.'},
                ${'pending'}, ${null}, ${null}, ${null}, ${null}, ${null}::jsonb, ${null}, ${null}
            ),
            (
                ${ID.task.b1_pm}, ${ID.sprint.gift}, ${ID.team.beta}, ${'pm'},
                ${'תיעוד תהליך העיצוב ותיאום הגשה'},
                ${'תעדו את תהליך העיצוב ב-Google Doc: 3 איטרציות, שגיאות, מה למדתם ומה הייתם עושים אחרת. הגישו יחד עם קובץ STL.'},
                ${'pending'}, ${null}, ${null}, ${null}, ${null}, ${null}::jsonb, ${null}, ${null}
            )
            ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
        `;
        log('  ✓ tasks (8 rows)');

        // ── 6. Hint counters ─────────────────────────────────────────────────
        log('Seeding hint counters...');
        await sql`
            INSERT INTO team_hint_counters (user_id, team_id, hint_count) VALUES
            (${ID.user.noa},   ${ID.team.alpha}, ${2}),
            (${ID.user.ariel}, ${ID.team.alpha}, ${4}),
            (${ID.user.lior},  ${ID.team.beta},  ${1}),
            (${ID.user.tal},   ${ID.team.beta},  ${3})
            ON CONFLICT (user_id, team_id) DO UPDATE SET hint_count = EXCLUDED.hint_count
        `;
        log('  ✓ team_hint_counters (4 rows)');

        log('');
        log('✅  Seed complete!');
        log('');
        log('Demo users:');
        log(`  Alpha PM  → ${ID.user.yael}  (Yael Mizrahi)`);
        log(`  Alpha QA  → ${ID.user.david} (David Cohen)`);
        log(`  Alpha Dev → ${ID.user.noa}   (Noa Ben-David)`);
        log(`  Alpha HW  → ${ID.user.ariel} (Ariel Levy)`);
        log(`  Beta  PM  → ${ID.user.maya}  (Maya Shapiro)`);
        log(`  Beta  QA  → ${ID.user.omer}  (Omer Peretz)`);
        log(`  Beta  Dev → ${ID.user.lior}  (Lior Katz)`);
        log(`  Beta  HW  → ${ID.user.tal}   (Tal Friedman)`);
    } catch (e) {
        err(`Seed failed: ${(e as Error).message}`);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

seed();
