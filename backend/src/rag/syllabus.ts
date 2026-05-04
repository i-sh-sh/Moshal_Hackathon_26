// Fixed sprint IDs from seed.ts — syllabus content keyed by sprint UUID
export const SPRINT_IDS = {
    gift:     'bbbb0001-0000-0000-0000-000000000000',
    games:    'bbbb0002-0000-0000-0000-000000000000',
    branding: 'bbbb0003-0000-0000-0000-000000000000',
} as const;

export interface SprintSyllabus {
    hebrewTitle: string;
    englishTitle: string;
    period: string;
    sessionsCount: number;
    coreTopics: string[];
    fusion360Techniques: Fusion360Technique[];
    skillsToLearn: string[];
    cblGoal: string;
    peakEvent: string;
    submissionNote: string;
}

export interface Fusion360Technique {
    name: string;            // tool name — used verbatim in hints
    hebrewDescription: string;
    sprintRelevance: string; // why it matters this sprint
}

// ── Sprint 1: מתנה ────────────────────────────────────────────────────────────

const SPRINT_GIFT: SprintSyllabus = {
    hebrewTitle: 'אתגר 01 — מתנה',
    englishTitle: 'Challenge 01 — Gift',
    period: 'אוקטובר–נובמבר',
    sessionsCount: 7,
    coreTopics: [
        'יסודות התלת-מימד',
        'צורות בסיסיות (box, cylinder, sphere)',
        'טכניקות עיצוב ראשוניות',
        'הגדרת מידות ואילוצים ב-Sketch',
    ],
    fusion360Techniques: [
        {
            name: 'Sketch',
            hebrewDescription: 'רישום 2D — בסיס לכל מודל',
            sprintRelevance: 'כל אובייקט מתחיל בסקצ׳ על מישור',
        },
        {
            name: 'Extrude',
            hebrewDescription: 'המרת סקצ׳ 2D לגוף 3D',
            sprintRelevance: 'הכלי המרכזי ליצירת גובה ועומק',
        },
        {
            name: 'Fillet',
            hebrewDescription: 'עיגול פינות חדות',
            sprintRelevance: 'חשוב להדפסה — פינות חדות נוטות להיתלש',
        },
        {
            name: 'Chamfer',
            hebrewDescription: 'גזירת פינות בזווית 45°',
            sprintRelevance: 'אלטרנטיבה לFillet, נותן מראה טכני',
        },
        {
            name: 'Appearance',
            hebrewDescription: 'הוספת צבע וחומר למודל',
            sprintRelevance: 'לרינדור ולהצגה ויזואלית',
        },
    ],
    skillsToLearn: [
        'יצירתיות — עיצוב עם משמעות אישית',
        'ירידה לפרטים — דיוק מידות',
        'אמפתיה — מתנה מותאמת למקבל',
        'התמודדות עם אתגר — למידה מאיטרציות',
    ],
    cblGoal:
        'עיצוב והדפסת מתנה תלת-מימדית בעלת משמעות אישית תוך שימוש בצורות בסיס. ' +
        'המוצר חייב להיות ניתן להדפסה ללא תמיכות מורכבות.',
    peakEvent: 'Kick-off — אירוע פתיחת שנה',
    submissionNote: 'תוצר קבוצתי אחד — קובץ STL + מצגת 5 שקפים ב-LMS',
};

// ── Sprint 2: משחקים ──────────────────────────────────────────────────────────

const SPRINT_GAMES: SprintSyllabus = {
    hebrewTitle: 'אתגר 02 — משחקים',
    englishTitle: 'Challenge 02 — Games',
    period: 'נובמבר–ינואר',
    sessionsCount: 7,
    coreTopics: [
        'מספר רכיבים ומכלולים (Assembly)',
        'שילוב בין טכניקות עיצוב',
        'תכנון לאחור — מהמוצר הסופי להחלטות העיצוב',
        'ייחוד מקומי — אלמנט מהעיר/ישוב',
    ],
    fusion360Techniques: [
        {
            name: 'Bodies & Components',
            hebrewDescription: 'ניהול מספר גופים במסמך אחד',
            sprintRelevance: 'משחק = מספר חלקים — כל חלק = Component',
        },
        {
            name: 'Joint / As-Built Joint',
            hebrewDescription: 'חיבור בין רכיבים עם אילוצי תנועה',
            sprintRelevance: 'מאפשר סימולציה של תנועת חלקי המשחק',
        },
        {
            name: 'Pattern (Rectangular / Circular)',
            hebrewDescription: 'שכפול אלמנטים במרווחים שווים',
            sprintRelevance: 'יעיל לאריחי לוח משחק, כלים זהים',
        },
        {
            name: 'Mirror',
            hebrewDescription: 'שיקוף סימטרי של גוף או Feature',
            sprintRelevance: 'חוסך זמן בעיצוב חלקים סימטריים',
        },
        {
            name: 'Combine (Join / Cut / Intersect)',
            hebrewDescription: 'מיזוג או חיתוך בין גופים',
            sprintRelevance: 'יצירת חריצים ומחזיקים בין חלקים',
        },
    ],
    skillsToLearn: [
        'חשיבה לוגית — כללי המשחק → דרישות העיצוב',
        'פתרון בעיות — מה לא עובד ולמה',
        'תקשורת — תיאום בין חברי הצוות',
        'עבודת צוות — חלוקת עבודה נכונה',
        'גמישות מחשבתית — שינוי גישה כשנדרש',
    ],
    cblGoal:
        'עיצוב משחק תלת-מימדי מרובה רכיבים עם ייחוד לעיר/ישוב. ' +
        'המשחק חייב להכיל לפחות 3 רכיבים נפרדים שמתחברים.',
    peakEvent: 'גביע ראש העיר — תחרות עירונית',
    submissionNote: 'תוצר קבוצתי — Assembly מלא + הוראות משחק',
};

// ── Sprint 3: מיתוג אישי ──────────────────────────────────────────────────────

const SPRINT_BRANDING: SprintSyllabus = {
    hebrewTitle: 'אתגר 03 — מיתוג אישי',
    englishTitle: 'Challenge 03 — Personal Branding',
    period: 'ינואר–מרץ',
    sessionsCount: 7,
    coreTopics: [
        'קנה מידה ויחסים בין רכיבים',
        'הרכבה וחיבורים מדויקים',
        'שילוב חומרים שונים',
        'חיתוכים וחריטות (Engrave / Emboss)',
    ],
    fusion360Techniques: [
        {
            name: 'Scale',
            hebrewDescription: 'שינוי גודל אחיד או על ציר מסוים',
            sprintRelevance: 'התאמת אלמנטי מיתוג לגדלים שונים',
        },
        {
            name: 'Emboss / Engrave',
            hebrewDescription: 'הבלטה או חריטה של טקסט ואיורים',
            sprintRelevance: 'הוספת שם, לוגו, טקסטורה אישית',
        },
        {
            name: 'Shell',
            hebrewDescription: 'חלילת גוף מוצק להדפסה חסכונית',
            sprintRelevance: 'חוסך חומר הדפסה ב-30-50%',
        },
        {
            name: 'Loft',
            hebrewDescription: 'יצירת מעבר חלק בין שני פרופילים',
            sprintRelevance: 'צורות אורגניות ועיצוביות',
        },
        {
            name: 'Decal / Texture',
            hebrewDescription: 'הוספת תמונה/לוגו לפני המודל',
            sprintRelevance: 'מיתוג ויזואלי למצגת',
        },
    ],
    skillsToLearn: [
        'ביטוי אישי — זהות עיצובית',
        'חשיבה עיצובית (Design Thinking)',
        'עמידה ביעדים — הגשה לתחרות אזורית',
    ],
    cblGoal:
        'עיצוב אובייקט מיתוגי אישי לתחרות אזורית (Makeathon). ' +
        'חייב לשלב לפחות 2 טכניקות מתקדמות ולהציג זהות ייחודית.',
    peakEvent: 'Makeathon — תחרות מוקדמות אזורית',
    submissionNote: 'מוגש לתחרות אזורית — קובץ STL + קובץ Fusion 360 + poster',
};

// ── Fallback for tasks not linked to a known sprint ──────────────────────────

export const GENERIC_SYLLABUS: SprintSyllabus = {
    hebrewTitle: 'Tech School 3D Design',
    englishTitle: 'Tech School 3D Design',
    period: 'שנה א׳',
    sessionsCount: 0,
    coreTopics: ['מידול תלת-מימד', 'הדפסת תלת-מימד', 'Fusion 360'],
    fusion360Techniques: [
        { name: 'Sketch',   hebrewDescription: 'רישום 2D',    sprintRelevance: 'בסיס לכל מודל' },
        { name: 'Extrude',  hebrewDescription: 'גוף 3D מסקצ׳', sprintRelevance: 'יצירת גובה' },
        { name: 'Fillet',   hebrewDescription: 'עיגול פינות',  sprintRelevance: 'עיצוב ועמידות' },
    ],
    skillsToLearn: ['יצירתיות', 'דיוק', 'עבודת צוות'],
    cblGoal: 'עיצוב והדפסת מודל תלת-מימדי איכותי.',
    peakEvent: '',
    submissionNote: 'הגשה ל-LMS',
};

// ── Lookup map ────────────────────────────────────────────────────────────────

export const SYLLABUS_BY_SPRINT: Record<string, SprintSyllabus> = {
    [SPRINT_IDS.gift]:     SPRINT_GIFT,
    [SPRINT_IDS.games]:    SPRINT_GAMES,
    [SPRINT_IDS.branding]: SPRINT_BRANDING,
};
