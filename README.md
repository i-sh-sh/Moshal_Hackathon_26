# TeamSprintUp — מדריך מפתח מלא

פלטפורמת סימולציה של סביבת עבודה הייטק לתלמידים.
צוותים עובדים בתפקידים אמיתיים (PM, QA, Dev, Hardware), מגישים משימות דרך pipeline של אישורים, ומקבלים hints מ-AI — הכל בניהול המורה דרך ממשק בסגנון Monday.com.

---

## תוכן עניינים

1. [מבנה הפרויקט](#מבנה-הפרויקט)
2. [ארכיטקטורה](#ארכיטקטורה)
3. [הרצה מקומית — התחלה מהירה](#הרצה-מקומית--התחלה-מהירה)
4. [Backend — NestJS](#backend--nestjs)
5. [Frontend — Nuxt 3](#frontend--nuxt-3)
6. [Database — Supabase](#database--supabase)
7. [מערכת ה-Hints](#מערכת-ה-hints)
8. [סימולטור Monday.com](#סימולטור-mondaycom)
9. [משתני סביבה](#משתני-סביבה)
10. [עבודה עם Git](#עבודה-עם-git)
11. [מי אחראי על מה](#מי-אחראי-על-מה)

---

## מבנה הפרויקט

```
Moshal_Hackathon_26/
│
├── backend/                     # שרת NestJS
│   └── src/
│       ├── ai/                  # ניתוח טקסט + יצירת hints דרך Claude AI
│       ├── hints/               # לוגיקת מערכת ה-hints (3 חינם → ניכוי נקודות)
│       ├── mock-monday/         # סימולטור Monday.com לדמו
│       ├── monday/              # GraphQL client לשליחת עדכונים ל-Monday האמיתי
│       ├── supabase/            # חיבור ל-DB (service role)
│       ├── tasks/               # כל לוגיקת זרימת המשימות
│       ├── teams/               # leaderboards, ניקוד, בדיקת סיום צוות
│       └── webhooks/            # קבלת events נכנסים מ-Monday
│
├── frontend/                    # אפליקציית Nuxt 3
│   ├── components/
│   │   ├── TaskBoard.vue        # לוח המשימות — מציג כפתורים שונים לפי תפקיד
│   │   ├── EnglishTerm.vue      # מילון אנגלי-עברי בhover
│   │   └── MockMondayBoard.vue  # ממשק המורה בסגנון Monday
│   ├── composables/
│   │   └── useTasks.ts          # כל קריאות ה-API למשימות ו-hints
│   ├── pages/
│   │   └── teacher.vue          # נתיב /teacher — דשבורד המורה
│   ├── services/
│   │   └── mockService.ts       # נתוני דמה לפיתוח ללא backend חי
│   └── types/
│       └── types.ts             # טיפוסי TypeScript משותפים (חשוב לסנכרן עם backend)
│
└── supabase/
    └── schema.sql               # כל ה-SQL: טבלאות, views, RLS, פונקציות
```

---

## ארכיטקטורה

### תרשים כללי

```
┌─────────────────────────────────────────────────────┐
│                    מורה                              │
│         /teacher  (MockMondayBoard.vue)              │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (approve / kickoff)
                       ▼
┌─────────────────────────────────────────────────────┐
│              NestJS Backend (:3001)                  │
│                                                      │
│  /api/tasks/*        ← זרימת משימות                  │
│  /api/hints/*        ← מערכת hints                   │
│  /api/teams/*        ← leaderboards + analytics      │
│  /api/mock-monday/*  ← סימולטור Monday               │
│  /api/webhooks/monday← webhook אמיתי מ-Monday        │
│                                                      │
│  AIService (Claude)  ← יצירת hints + ניתוח טקסט     │
└────────────┬────────────────────────────────────────┘
             │ supabase-js (service role)
             ▼
┌─────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL)                   │
│  challenges / teams / users / sprints / tasks        │
│  hint_logs / team_hint_counters                      │
│  + views: group_leaderboard, teacher_analytics       │
└─────────────────────────────────────────────────────┘
             ▲
             │ supabase-js (anon key + RLS)
┌─────────────────────────────────────────────────────┐
│             Nuxt 3 Frontend (:3000)                  │
│                                                      │
│  TaskBoard.vue      ← תלמידים — הגשה + ביקורת        │
│  EnglishTerm.vue    ← תרגום מונחים בhover            │
│  useTasks.ts        ← composable לכל קריאות API      │
└─────────────────────────────────────────────────────┘
```

### זרימת משימה מלאה (Task Flow)

```
Dev מגיש עבודה
      │
      ▼
  [qa_review]  ←──────────────────── QA דוחה
      │                                  ▲
  QA מאשר                                │
      │                                  │
      ▼                                  │
  [pm_review]  ←──────── PM דוחה → חוזר ל-QA
      │
  PM מאשר
      │
      ├─► Monday מתעדכן ל-"Pending Teacher Review"
      ├─► LED ירוק מופעל (mock hardware event)
      │
      ▼
[teacher_review]
      │
  מורה מאשר (דרך Monday / סימולטור)
      │
      ▼
  [approved]
      │
      └─► מערכת בודקת: כל משימות הצוות אושרו?
              │
              ▼
         is_completed = true → ספרינט הבא נפתח
```

---

## הרצה מקומית — התחלה מהירה

### דרישות מקדימות
- Node.js 18+
- חשבון Supabase (חינמי)
- מפתח API של Anthropic (Claude)

### צעד 1 — הקמת Supabase
1. צור פרויקט ב-[supabase.com](https://supabase.com)
2. לך ל-**SQL Editor** → העתק-הדבק את `supabase/schema.sql` → הרץ
3. שמור את ה-URL, `anon key`, ו-`service_role key` מ-Project Settings → API

### צעד 2 — הרצת Backend
```bash
cd backend
npm install

# צור קובץ .env והכנס את הערכים (ראה סעיף משתני סביבה למטה)
npm run start:dev
# השרת רץ על http://localhost:3001
```

### צעד 3 — הרצת Frontend
```bash
cd frontend
npm install

# צור קובץ .env והכנס את הערכים
npm run dev
# האפליקציה רצה על http://localhost:3000
```

### צעד 4 — בדיקה שהכל עובד
- פתח `http://localhost:3000` — ממשק התלמידים
- פתח `http://localhost:3000/teacher` — ממשק המורה (סימולטור Monday)

---

## Backend — NestJS

### מודולים ומה שהם עושים

#### `TasksModule` — הלב של המוצר
קובץ: `src/tasks/tasks.service.ts`

אחראי על כל מעבר הסטטוס של משימה. כל מתודה מאמתת שהמשתמש נמצא בצוות הנכון ויש לו את התפקיד המתאים לפני שמבצעת את השינוי.

```
submitTask()   → מעביר pending → qa_review   (Dev/Hardware בלבד)
qaReview()     → מעביר qa_review → pm_review או חזרה ל-pending (QA בלבד)
pmReview()     → מעביר pm_review → teacher_review + שולח עדכון ל-Monday (PM בלבד)
teacherApprove() → מעביר teacher_review → approved + בודק סיום צוות
```

#### `HintsModule` — מערכת הרמזים
קובץ: `src/hints/hints.service.ts`

```
requestHint() → בודק כמה hints כבר ביקש המשתמש בצוות זה
              → אם < 3: hint חינמי מ-Claude
              → אם >= 3: hint + ניכוי 10 נקודות מהצוות
              → כל hint מתועד ב-hint_logs
```
הסופר (team_hint_counters) נשמר לפי זוג (user_id, team_id) — מתאפס אוטומטית כשמשתמש מחליף צוות.

#### `TeamsModule` — ניקוד וסיום
קובץ: `src/teams/teams.service.ts`

```
checkAndCompleteTeam() → קורא לכל המשימות בספרינט
                       → אם כולן approved → מעדכן is_completed=true
getGroupLeaderboard()  → כל הצוותים ממוינים לפי ניקוד
getIndividualLeaderboard() → top 3 בלבד (לשמירת ביטחון)
getTeacherAnalytics()  → זמן פעיל vs מהירות ביצוע לכל תלמיד
```

#### `MockMondayModule` — סימולטור
קובץ: `src/mock-monday/mock-monday.service.ts`

מחליף את Monday.com האמיתי לצורך הדמו. מתממשק לאותם שירותים פנימיים בדיוק כמו ה-webhook האמיתי.

#### `AIModule` — Claude
קובץ: `src/ai/ai.service.ts`

שתי מתודות:
- `analyze(text)` — מחזיר jargonScore, softSkillScore, detectedTerms
- `generateHint(taskDesc, context, hintNumber)` — מחזיר hint מותאם לפי מספר הרמז (1=כללי, 2=ספציפי, 3+=מעשי)

### כל ה-API Endpoints

| Method | נתיב | מי קורא | מה עושה |
|---|---|---|---|
| `GET` | `/api/tasks/team/:teamId` | Frontend | כל המשימות של הצוות |
| `POST` | `/api/tasks/submit` | Dev/Hardware | הגשת עבודה |
| `POST` | `/api/tasks/qa-review` | QA | אישור/דחייה של QA |
| `POST` | `/api/tasks/pm-review` | PM | אישור/דחייה של PM |
| `POST` | `/api/hints` | כולם | בקשת hint |
| `GET` | `/api/hints/count` | Frontend | כמה hints נוצלו |
| `GET` | `/api/hints/history` | Frontend | היסטוריית hints |
| `GET` | `/api/teams/leaderboard/group` | Frontend | דירוג צוותים |
| `GET` | `/api/teams/leaderboard/individual` | Frontend | top 3 אישי |
| `GET` | `/api/teams/analytics` | דשבורד מורה | analytics לכל תלמיד |
| `POST` | `/api/webhooks/monday` | Monday.com | webhook אמיתי |
| `GET` | `/api/mock-monday/challenges` | Frontend | רשימת challenges |
| `GET` | `/api/mock-monday/board/:id` | Frontend | לוח בסגנון Monday |
| `POST` | `/api/mock-monday/kickoff/:id` | מורה | הפעלת challenge |
| `POST` | `/api/mock-monday/approve/:taskId` | מורה | אישור teacher |
| `POST` | `/api/mock-monday/reject/:taskId` | מורה | דחיית teacher |

---

## Frontend — Nuxt 3

### קומפוננטות מרכזיות

#### `TaskBoard.vue` — לוח המשימות של התלמידים
מציג את המשימות של הצוות וכפתורים **שונים לפי תפקיד**:

| תפקיד | מה הוא רואה |
|---|---|
| Dev / Hardware | כפתור "Submit Work" על משימות pending/rejected |
| QA | כפתור "QA Review" עם checklist על משימות qa_review |
| PM | כפתור "PM Review" עם סיכום QA על משימות pm_review |
| כולם | כפתור "Hint 💡" על כל משימה פתוחה |

#### `EnglishTerm.vue` — תרגום מונחים
```vue
<EnglishTerm term="Sprint" />
<!-- מציג "Sprint" + tooltip עברי "ספרינט (מחזור פיתוח קצר)" בhover -->
```
יש מילון מובנה של 30 מונחים. ניתן להעביר `translation` ידני.

#### `MockMondayBoard.vue` — ממשק המורה
ממשק בעיצוב כהה בסגנון Monday.com עם 5 עמודות שמשקפות את סטטוסי המשימות. המורה יכול לאשר/לדחות ולהפעיל challenges.

#### `useTasks.ts` — Composable
```typescript
const { tasks, fetchTasks, submitTask, qaReview, pmReview, requestHint } =
    useTasks(teamId, userId);
```
כל פעולה קוראת ל-API ומרעננת את רשימת המשימות אוטומטית.

---

## Database — Supabase

### טבלאות ויחסים

```
challenges (1)
    └── sprints (many)
            └── tasks (many) ←→ teams (1)
                                    └── users (many)

users ←→ hint_logs
users ←→ team_hint_counters ←→ teams
```

### טבלאות

| טבלה | עמודות מרכזיות | הערות |
|---|---|---|
| `challenges` | title, monday_board_id, is_active | מופעל ע"י המורה |
| `teams` | accumulated_score, sprint_status, **is_completed** | `is_completed` חוסם challenge הבא |
| `users` | current_team_id, **current_role**, total_active_time | role דינמי לפי challenge |
| `sprints` | challenge_id, order_index | שלבי-משנה בתוך challenge |
| `tasks` | sprint_id, team_id, **status**, qa_checklist, monday_item_id | לב המערכת |
| `hint_logs` | user_id, team_id, hint_number, points_deducted | כל hint מתועד |
| `team_hint_counters` | user_id, team_id, hint_count | unique על (user, team) |

### Views מובנים (נוצרים מה-schema)

| View | שימוש |
|---|---|
| `group_leaderboard` | דירוג צוותים לפי ניקוד |
| `individual_leaderboard` | דירוג אישי (backend מחזיר top 3 בלבד) |
| `teacher_analytics` | זמן פעיל + tasks/שעה לכל תלמיד |

### RLS — אבטחת נתונים
- **Backend** משתמש ב-service role key → עוקף RLS, יכול לקרוא/לכתוב הכל
- **Frontend** משתמש ב-anon key → RLS חל, כל משתמש רואה רק את הנתונים שלו ושל הצוות שלו

---

## מערכת ה-Hints

```
בקשת hint ראשונה (1, 2, 3)  →  hint חינמי מ-Claude
בקשת hint 4+                →  hint + ניכוי 10 נקודות מהצוות
החלפת צוות                  →  הסופר מתאפס (counter חדש לצוות חדש)
```

Claude מותאם לפי מספר הרמז:
- **Hint #1** — כיוון כללי, מושג רלוונטי
- **Hint #2** — כיוון ספציפי יותר
- **Hint #3+** — צעד מעשי, התלמיד מתקשה

כל hint מתועד ב-`hint_logs` עם טקסט ה-hint, הצוות, המשימה, וכמה נקודות נוכו.

---

## סימולטור Monday.com

מכיוון שאין גישה ל-Monday.com, בנינו סימולטור מלא:

### ממשק המורה — `/teacher`
- עיצוב כהה זהה ל-Monday.com
- **5 עמודות** המשקפות את סטטוסי המשימות:
  `In Progress → QA Review → PM Review → Pending Teacher Review → Approved`
- כפתורי **Approve / Reject** על משימות ב-"Pending Teacher Review"
- כפתור **Kickoff Challenge** — מפעיל challenge חדש לכל הצוותים
- רענון אוטומטי אחרי כל פעולה

### מה קורה מאחורי הקלעים
כשמורה לוחץ Approve בסימולטור → הקוד קורא לאותה פונקציה (`teacherApprove`) שהיה מופעל על ידי webhook אמיתי מ-Monday. **אין שום שינוי בלוגיקה הפנימית** — רק ה-trigger שונה.

---

## משתני סביבה

### `backend/.env`
```env
PORT=3001
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # שמור סודי! עוקף את כל ה-RLS
ANTHROPIC_API_KEY=sk-ant-...        # מ-console.anthropic.com
MONDAY_API_TOKEN=eyJ...             # רלוונטי רק ל-Monday אמיתי
MONDAY_WEBHOOK_SECRET=any-string    # מחרוזת אקראית שאתה בוחר
```

### `frontend/.env`
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...            # בטוח לחשוף — RLS מגן
SUPABASE_SERVICE_KEY=eyJ...         # לserver routes בלבד
API_BASE_URL=http://localhost:3001/api
```

---

## עבודה עם Git

```bash
# לפני כל עבודה
git pull origin master

# אחרי שסיימת
git add .
git commit -m "feat: תיאור קצר"
git push origin master
```

### כללי אצבע
- **שינית `frontend/types/types.ts`?** — תעדכן גם את הצד השני (backend DTOs)
- **שינית `supabase/schema.sql`?** — תעדכן את הצוות לפני שמריצים בSupabase
- **הוספת endpoint חדש?** — תוסיף אותו ל-`useTasks.ts` בפרונטאנד

---

## מי אחראי על מה

| תחום | קבצים רלוונטיים |
|---|---|
| **זרימת משימות** | `backend/src/tasks/` |
| **מערכת hints + AI** | `backend/src/hints/`, `backend/src/ai/` |
| **ניקוד וסיום צוות** | `backend/src/teams/` |
| **סימולטור Monday** | `backend/src/mock-monday/`, `frontend/components/MockMondayBoard.vue` |
| **ממשק תלמידים** | `frontend/components/TaskBoard.vue`, `frontend/composables/useTasks.ts` |
| **DB ו-RLS** | `supabase/schema.sql` |
| **טיפוסים משותפים** | `frontend/types/types.ts` |
