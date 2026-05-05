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
10. [פריסה לאוויר (Supabase + Railway + Vercel)](#פריסה-לאוויר)
11. [עבודה עם Git](#עבודה-עם-git)
12. [מי אחראי על מה](#מי-אחראי-על-מה)

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
│       ├── rag/                 # בניית הקשר ל-hints: syllabus + התקדמות צוות
│       ├── supabase/            # חיבור ל-DB (service role — עוקף RLS)
│       ├── tasks/               # כל לוגיקת זרימת המשימות
│       ├── teams/               # leaderboards, ניקוד, בדיקת סיום צוות
│       ├── users/               # GET /users, GET /users/:id
│       ├── webhooks/            # קבלת events נכנסים מ-Monday
│       └── seed.ts              # הזרעת נתוני פתיחה (אידמפוטנטי)
│
├── frontend/                    # אפליקציית Nuxt 3
│   ├── components/
│   │   ├── AnalyticsDashboard.vue # כרטיסי סיכום + טבלת analytics לכל תלמיד
│   │   ├── EnglishTerm.vue        # מילון אנגלי-עברי בhover
│   │   ├── HintPanel.vue          # היסטוריית hints ניתנת לכיווץ + בקשת hint חדש
│   │   ├── Leaderboard.vue        # טבלת דירוג צוותים עם score bars
│   │   ├── MockMondayBoard.vue    # ממשק המורה בסגנון Monday
│   │   └── SprintProgress.vue     # פס התקדמות sprint + ניקוד
│   ├── composables/
│   │   ├── useLeaderboard.ts    # fetch לטבלת הניקוד
│   │   ├── useTasks.ts          # כל קריאות ה-API למשימות ו-hints
│   │   └── useUser.ts           # session state — שמירה ב-localStorage
│   ├── middleware/
│   │   └── auth.ts              # הגנה על נתיבים: מפנה ל-/ אם אין session
│   ├── pages/
│   │   ├── index.vue            # מסך כניסה — בחירת משתמש
│   │   ├── student.vue          # /student — דשבורד תלמיד מלא
│   │   └── teacher.vue          # /teacher — דשבורד המורה (סימולטור Monday)
│   └── types/
│       └── types.ts             # טיפוסי TypeScript משותפים
│
└── supabase/
    └── schema.sql               # כל ה-SQL: טבלאות, views, RLS, פונקציות
```

---

## ארכיטקטורה

### תרשים כללי

```
┌──────────────────────┐      ┌──────────────────────┐
│       תלמיד          │      │       מורה            │
│  / (בחירת משתמש)     │      │  /teacher             │
│  /student (דשבורד)   │      │  (MockMondayBoard.vue) │
└──────────┬───────────┘      └──────────┬────────────┘
           │ HTTP                         │ HTTP
           ▼                             ▼
┌─────────────────────────────────────────────────────┐
│              NestJS Backend (:3001)                  │
│                                                      │
│  /api/users/*        ← רשימת משתמשים                 │
│  /api/tasks/*        ← זרימת משימות                  │
│  /api/hints/*        ← מערכת hints + RAG             │
│  /api/teams/*        ← leaderboards + analytics      │
│  /api/mock-monday/*  ← סימולטור Monday               │
│  /api/webhooks/monday← webhook אמיתי מ-Monday        │
│                                                      │
│  AIService (Claude)  ← יצירת hints + ניתוח טקסט     │
│  RagService          ← בניית הקשר מסילבוס + DB       │
└────────────┬────────────────────────────────────────┘
             │ supabase-js (service role)
             ▼
┌─────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL)                   │
│  challenges / teams / users / sprints / tasks        │
│  hint_logs / team_hint_counters                      │
│  + views: group_leaderboard, teacher_analytics       │
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
- Azure OpenAI resource עם deployment פעיל

### צעד 1 — הקמת Supabase
1. צור פרויקט ב-[supabase.com](https://supabase.com)
2. לך ל-**SQL Editor** → העתק-הדבק את `supabase/schema.sql` → הרץ
3. שמור את ה-URL, `anon key`, ו-`service_role key` מ-Project Settings → API

### צעד 2 — Seed — נתוני פתיחה
```bash
cd backend
cp .env.example .env   # מלא את הערכים
npm install
npm run seed           # יוצר challenge, sprint, 4 צוותים, משימות לדוגמה
```
הסיד אידמפוטנטי — בטוח להריץ כמה פעמים.

### צעד 3 — הרצת Backend
```bash
cd backend
npm run start:dev
# השרת רץ על http://localhost:3001
```

### צעד 4 — הרצת Frontend
```bash
cd frontend
npm install
npm run dev
# האפליקציה רצה על http://localhost:3000
```

### צעד 5 — בדיקה שהכל עובד
- פתח `http://localhost:3000` — מסך בחירת משתמש
- בחר תלמיד → תועבר ל-`/student` — הדשבורד המלא (מתרענן אוטומטית כל 20 שניות)
- פתח `http://localhost:3000/teacher` — ממשק המורה (סימולטור Monday + Analytics)

---

## Backend — NestJS

### מודולים ומה שהם עושים

#### `SupabaseModule` — חיבור ה-DB (Global)
קובץ: `src/supabase/supabase.service.ts`

מאתחל `SupabaseClient` עם service role key (עוקף RLS — backend נחשב trusted).
מסומן `@Global()` — כל המודולים מקבלים `SupabaseService` דרך DI ללא import ידני.

#### `TasksModule` — הלב של המוצר
קובץ: `src/tasks/tasks.service.ts`

אחראי על כל מעבר הסטטוס של משימה. כל מתודה מאמתת שהמשתמש נמצא בצוות הנכון ויש לו את התפקיד המתאים לפני שמבצעת את השינוי.

```
submitTask()     → מעביר pending → qa_review   (Dev/Hardware בלבד)
qaReview()       → מעביר qa_review → pm_review או חזרה ל-pending (QA בלבד)
pmReview()       → מעביר pm_review → teacher_review + שולח עדכון ל-Monday (PM בלבד)
teacherApprove() → מעביר teacher_review → approved + בודק סיום צוות
```

#### `HintsModule` + `RagModule` — מערכת הרמזים עם הקשר
קובץ: `src/hints/hints.service.ts`, `src/rag/rag.service.ts`

```
requestHint() → RagService בונה הקשר מלא:
                  - סילבוס לפי sprint UUID (src/rag/syllabus.ts)
                  - כלי Fusion 360 רלוונטיים לאתגר
                  - התקדמות הצוות (כמה משימות אושרו)
                  - מספר הרמז הנוכחי
              → AIService מייצר hint מותאם לפי עומק (1/2/3+)
              → אם hint 4+: ניכוי 10 נקודות מהצוות
              → כל hint מתועד ב-hint_logs
```

#### `TeamsModule` — ניקוד וסיום
קובץ: `src/teams/teams.service.ts`

```
checkAndCompleteTeam()    → כל המשימות approved? → is_completed=true
getGroupLeaderboard()     → כל הצוותים ממוינים לפי ניקוד
getIndividualLeaderboard() → top 3 בלבד
getTeacherAnalytics()     → זמן פעיל vs מהירות ביצוע לכל תלמיד
getTeamById()             → פרטי צוות כולל sprint נוכחי (join)
getSprintProgress()       → כמה משימות אושרו מתוך הסה"כ
```

#### `UsersModule` — ניהול משתמשים
קובץ: `src/users/users.service.ts`

```
findAll()   → כל המשתמשים (לבחירת זהות במסך כניסה)
findOne(id) → משתמש בודד עם team + role
```

#### `MockMondayModule` — סימולטור
קובץ: `src/mock-monday/mock-monday.service.ts`

מחליף את Monday.com האמיתי לצורך הדמו. מתממשק לאותם שירותים פנימיים בדיוק כמו ה-webhook האמיתי.

#### `AIModule` — Azure OpenAI
קובץ: `src/ai/ai.service.ts`

שתי מתודות:
- `analyze(text)` — מחזיר jargonScore, softSkillScore, detectedTerms
- `generateHint(ctx)` — hint מותאם לפי מספר, סילבוס, והתקדמות (1=כללי, 2=ספציפי, 3+=מעשי)

המודל נקבע דרך `AZURE_OPENAI_DEPLOYMENT` ב-`.env` — ניתן להחליף deployment בלי לשנות קוד.

### כל ה-API Endpoints

| Method | נתיב | מי קורא | מה עושה |
|---|---|---|---|
| `GET` | `/api/users` | Frontend (login) | רשימת כל המשתמשים |
| `GET` | `/api/users/:id` | Frontend | פרטי משתמש בודד |
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
| `GET` | `/api/teams/:id` | Frontend | פרטי צוות + sprint נוכחי |
| `GET` | `/api/teams/:id/sprint-progress` | Frontend | X/Y משימות אושרו |
| `POST` | `/api/webhooks/monday` | Monday.com | webhook אמיתי |
| `GET` | `/api/mock-monday/challenges` | Frontend | רשימת challenges |
| `GET` | `/api/mock-monday/board/:id` | Frontend | לוח בסגנון Monday |
| `POST` | `/api/mock-monday/kickoff/:id` | מורה | הפעלת challenge |
| `POST` | `/api/mock-monday/approve/:taskId` | מורה | אישור teacher |
| `POST` | `/api/mock-monday/reject/:taskId` | מורה | דחיית teacher |

---

## Frontend — Nuxt 3

### דפים (Pages)

#### `pages/index.vue` — מסך כניסה
גריד של כרטיסי משתמשים עם אווטאר, שם, ותפקיד. לחיצה שומרת session ב-localStorage ומעבירה ל-`/student`.

#### `pages/student.vue` — דשבורד התלמיד
הדף המרכזי של האפליקציה. מתרענן אוטומטית כל 20 שניות עם אינדיקטור LIVE.

| אזור | תיאור |
|---|---|
| Sticky navbar | שם, תגית תפקיד, שם צוות, ניקוד, כפתור יציאה |
| SprintProgress | שם ה-sprint, פס התקדמות X/Y, status pill |
| גריד משימות | כרטיס לכל משימה עם כפתורים לפי תפקיד |
| מודלים | Submit / QA Review / PM Review — עם ספינר ו-toast |
| HintPanel | קיפול/פריסה של היסטוריית hints + בקשה חדשה |
| Tab "Leaderboard" | טבלת הצוותים עם highlight לצוות שלך |

#### `pages/teacher.vue` — דשבורד המורה
שני טאבים: **Monday Board** (MockMondayBoard.vue) + **Analytics** (AnalyticsDashboard.vue).

### קומפוננטות

#### `SprintProgress.vue`
מציג שם sprint, פס התקדמות צבעוני (אינדיגו → ירוק כשמסתיים), ניקוד צוות, ו-status badge.

#### `HintPanel.vue`
ניתן לפתיחה/סגירה. מציג את ה-hint האחרון שהוחזר מ-Claude עם פרטי עלות, ורשימה גלולה של כל הרמזים הקודמים.

#### `Leaderboard.vue`
טבלת צוותים ממוינת לפי ניקוד. score bars יחסיים, medals 🥇🥈🥉, highlight לצוות המחובר.

#### `AnalyticsDashboard.vue`
כרטיסי סיכום (מספר תלמידים, סה"כ משימות שאושרו, זמן פעיל ממוצע, תלמידים מתקדמים) + טבלה מפורטת לכל תלמיד עם progress bar לאישורים ומהירות tasks/שעה.

#### `EnglishTerm.vue` — תרגום מונחים
```vue
<EnglishTerm term="Sprint" />
<!-- מציג "Sprint" + tooltip עברי "ספרינט (מחזור פיתוח קצר)" בhover -->
```
יש מילון מובנה של 30 מונחים. ניתן להעביר `translation` ידני.

#### `MockMondayBoard.vue` — ממשק המורה
ממשק בעיצוב כהה בסגנון Monday.com עם 5 עמודות שמשקפות את סטטוסי המשימות.

### Composables

#### `useUser.ts`
```typescript
const { user, isLoggedIn, login, logout } = useUser();
// session נשמר ב-localStorage, מסונכרן דרך useState
```

#### `useTasks.ts`
```typescript
const { tasks, fetchTasks, submitTask, qaReview, pmReview, requestHint } =
    useTasks(teamId, userId);
// כל פעולה קוראת ל-API ומרעננת את רשימת המשימות אוטומטית
```

#### `useLeaderboard.ts`
```typescript
const { rows, fetchLeaderboard } = useLeaderboard();
// rows: GroupLeaderboardRow[] ממוינים לפי ניקוד
```

### Middleware

#### `middleware/auth.ts`
מגן על כל הנתיבים. אם אין session ב-localStorage מפנה ל-`/` (מסך כניסה). רץ בצד הלקוח בלבד.

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
| `tasks` | sprint_id, team_id, **status**, qa_checklist (JSONB), monday_item_id | לב המערכת |
| `hint_logs` | user_id, team_id, hint_number, points_deducted | כל hint מתועד |
| `team_hint_counters` | user_id, team_id, hint_count | unique על (user, team) |

### Views מובנים

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

### RAG — הקשר עשיר לכל hint

ה-`RagService` בונה הקשר מלא לפני כל קריאה ל-Claude:
- **סילבוס** — לפי sprint UUID: שם, מטרת CBL, כלי Fusion 360 רלוונטיים
- **התקדמות הצוות** — כמה משימות אושרו בספרינט
- **מספר הרמז** — קובע את עומק ה-hint

Claude מותאם לפי מספר הרמז:
- **Hint #1** — כיוון כללי, מושג רלוונטי
- **Hint #2** — כיוון ספציפי יותר, שם הכלי
- **Hint #3+** — צעד מעשי וישיר, התלמיד מתקשה

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
SUPABASE_SERVICE_ROLE_KEY=eyJ...           # שמור סודי! עוקף את כל ה-RLS
AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com/
AZURE_OPENAI_API_KEY=xxxxxxxxxxxxxxxx      # מ-Azure Portal → OpenAI → Keys
AZURE_OPENAI_API_VERSION=2024-02-01
AZURE_OPENAI_DEPLOYMENT=your-deployment   # שם ה-deployment שיצרת ב-Azure OpenAI Studio
MONDAY_API_TOKEN=eyJ...                    # רלוונטי רק ל-Monday אמיתי
MONDAY_WEBHOOK_SECRET=any-string           # מחרוזת אקראית שאתה בוחר
CORS_ORIGINS=http://localhost:3000         # מופרד בפסיקים לריבוי דומיינים
```

### `frontend/.env`
```env
NUXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...     # בטוח לחשוף — RLS מגן
NUXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
NUXT_SUPABASE_SERVICE_KEY=eyJ...         # לserver routes בלבד
```

> **הסבר שמות:** `NUXT_PUBLIC_*` זמין גם בדפדפן וגם בשרת. `NUXT_*` (ללא PUBLIC) — שרת בלבד.

---

## פריסה לאוויר

הסטאק מומלץ לפריסה חינמית: **Supabase** (DB) + **Railway** (backend) + **Vercel** (frontend).

ראה [DEPLOY.md](./DEPLOY.md) למדריך שלב-אחר-שלב מלא.

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
- **הוספת endpoint חדש?** — תוסיף אותו לcomposable המתאים בפרונטאנד

---

## מי אחראי על מה

| תחום | קבצים רלוונטיים |
|---|---|
| **חיבור DB** | `backend/src/supabase/` |
| **זרימת משימות** | `backend/src/tasks/` |
| **מערכת hints + AI + RAG** | `backend/src/hints/`, `backend/src/ai/`, `backend/src/rag/` |
| **ניקוד וסיום צוות** | `backend/src/teams/` |
| **ניהול משתמשים** | `backend/src/users/` |
| **סימולטור Monday** | `backend/src/mock-monday/`, `frontend/components/MockMondayBoard.vue` |
| **מסך כניסה** | `frontend/pages/index.vue`, `frontend/composables/useUser.ts` |
| **דשבורד תלמיד** | `frontend/pages/student.vue`, `frontend/components/SprintProgress.vue`, `frontend/components/HintPanel.vue` |
| **Analytics מורה** | `frontend/components/AnalyticsDashboard.vue` |
| **Leaderboard** | `frontend/components/Leaderboard.vue`, `frontend/composables/useLeaderboard.ts` |
| **DB, RLS, Views** | `supabase/schema.sql` |
| **טיפוסים משותפים** | `frontend/types/types.ts` |
