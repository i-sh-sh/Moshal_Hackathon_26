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
│   ├── migrations/              # קבצי SQL ממוספרים (002_auth_audit.sql...)
│   └── src/
│       ├── config/              # משתני סביבה מוטפסים — מקור אמת יחיד
│       ├── common/              # טיפוסים, decorators, שגיאות משותפים
│       ├── gatekeeper/          # chokepoint לכל קריאה יוצאת (rate-limit, retry)
│       ├── audit/               # תיעוד אירועי אבטחה (append-only)
│       ├── auth/                # JWT + refresh tokens + LocalAuthProvider
│       ├── admin/               # CRUD משתמשים (admin בלבד)
│       ├── activity/            # heartbeat + מעקב זמן פעיל
│       ├── integrations/
│       │   ├── ai/              # Azure OpenAI — hints + ניתוח טקסט
│       │   ├── monday/          # Monday GraphQL client
│       │   ├── firebase/        # stub (mock ברירת מחדל)
│       │   ├── storage/         # stub (mock ברירת מחדל)
│       │   └── techschool/      # stub (mock ברירת מחדל)
│       ├── hints/               # לוגיקת מערכת ה-hints (3 חינם → ניכוי נקודות)
│       ├── mock-monday/         # סימולטור Monday.com לדמו
│       ├── rag/                 # בניית הקשר ל-hints: syllabus + התקדמות צוות
│       ├── supabase/            # חיבור ל-DB (service role)
│       ├── tasks/               # כל לוגיקת זרימת המשימות
│       ├── teams/               # leaderboards, ניקוד, בדיקת סיום צוות
│       ├── users/               # GET /users, GET /users/:id
│       └── webhooks/            # קבלת events נכנסים מ-Monday
│
├── frontend/                    # אפליקציית Nuxt 3
│   ├── components/
│   │   ├── EnglishTerm.vue      # מילון אנגלי-עברי בhover
│   │   ├── HintPanel.vue        # היסטוריית hints ניתנת לכיווץ + בקשת hint חדש
│   │   ├── Leaderboard.vue      # טבלת דירוג צוותים עם score bars
│   │   ├── MockMondayBoard.vue  # ממשק המורה בסגנון Monday
│   │   └── SprintProgress.vue   # פס התקדמות sprint + ניקוד
│   ├── composables/
│   │   ├── useLeaderboard.ts    # fetch לטבלת הניקוד
│   │   ├── useTasks.ts          # כל קריאות ה-API למשימות ו-hints
│   │   └── useUser.ts           # session state — שמירה ב-localStorage
│   ├── pages/
│   │   ├── index.vue            # מסך כניסה — בחירת משתמש
│   │   ├── student.vue          # /student — דשבורד תלמיד מלא
│   │   └── teacher.vue          # /teacher — דשבורד המורה (סימולטור Monday)
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
│  /api/auth/*         ← login, register, refresh      │
│  /api/users/*        ← רשימת משתמשים                 │
│  /api/tasks/*        ← זרימת משימות                  │
│  /api/hints/*        ← מערכת hints + RAG             │
│  /api/teams/*        ← leaderboards + analytics      │
│  /api/mock-monday/*  ← סימולטור Monday               │
│  /api/webhooks/monday← webhook אמיתי מ-Monday        │
│                                                      │
│  GatekeeperService   ← כל קריאה יוצאת עוברת כאן     │
│  AIService (Azure)   ← יצירת hints + ניתוח טקסט     │
│  RagService          ← בניית הקשר מסילבוס + DB       │
└────────────┬────────────────────────────────────────┘
             │ supabase-js (service role)
             ▼
┌─────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL)                   │
│  challenges / teams / users / sprints / tasks        │
│  hint_logs / team_hint_counters                      │
│  refresh_tokens / audit_logs                         │
│  + views: group_leaderboard, teacher_analytics       │
└─────────────────────────────────────────────────────┘
```

### עקרונות ארכיטקטורה

1. **שכבות** — Controllers מטפלים ב-HTTP בלבד. Services מכילים את הלוגיקה העסקית.
2. **Gatekeeper** — כל קריאה ליוצאת (Azure OpenAI, Monday) עוברת דרך `GatekeeperService` שמטפל ב-rate-limit, retry, ותיעוד.
3. **Integrations mock-first** — Azure, Monday, Firebase, S3 ניתנים להחלפה בין mock ל-real דרך env var. הפרויקט עולה ללא שום credentials חיצוניים.

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
  מורה מאשר (דרך סימולטור / Monday)
      │
      ▼
  [approved]
      │
      └─► מערכת בודקת: כל משימות הצוות אושרו?
              │
              ▼
         is_completed = true
```

---

## הרצה מקומית — התחלה מהירה

### דרישות מקדימות
- Node.js 18+
- חשבון Supabase (חינמי)

### צעד 1 — הקמת Supabase
1. צור פרויקט ב-[supabase.com](https://supabase.com)
2. לך ל-**SQL Editor** → העתק-הדבק את `supabase/schema.sql` → הרץ
3. שמור את ה-URL ו-`service_role key` מ-Project Settings → API

### צעד 2 — Backend
```bash
cd backend
cp .env.example .env   # מלא את הערכים (ראה סעיף "משתני סביבה")
npm install
npm run seed           # יוצר 2 צוותים, 8 משתמשים, 3 ספרינטים, 8 משימות
npm run start:dev      # http://localhost:3001
```

### צעד 3 — Frontend
```bash
cd frontend
cp .env.example .env   # מלא NUXT_PUBLIC_API_BASE_URL
npm install
npm run dev            # http://localhost:3000
```

### צעד 4 — בדיקה
- `http://localhost:3000` — מסך בחירת משתמש
- `http://localhost:3000/teacher` — ממשק המורה

---

## Backend — NestJS

### מודולים ומה שהם עושים

#### `TasksModule` — הלב של המוצר
קובץ: `src/tasks/tasks.service.ts`

```
submitTask()     → pending → qa_review         (Dev/Hardware בלבד)
qaReview()       → qa_review → pm_review / pending  (QA בלבד)
pmReview()       → pm_review → teacher_review       (PM בלבד)
teacherApprove() → teacher_review → approved + בדיקת סיום צוות
```

#### `HintsModule` + `RagModule` — מערכת הרמזים
קבצים: `src/hints/hints.service.ts`, `src/rag/rag.service.ts`

```
requestHint() → RagService בונה הקשר:
                  - סילבוס לפי sprint UUID
                  - כלי Fusion 360 רלוונטיים
                  - התקדמות הצוות
                  - מספר הרמז הנוכחי
              → AIService מייצר hint דרך Azure OpenAI
              → hint 4+: ניכוי 10 נקודות מהצוות
              → כל hint מתועד ב-hint_logs
```

#### `TeamsModule`
קובץ: `src/teams/teams.service.ts`

```
checkAndCompleteTeam()    → כל המשימות approved? → is_completed=true
getGroupLeaderboard()     → כל הצוותים ממוינים לפי ניקוד
getIndividualLeaderboard()→ top 3 בלבד
getTeacherAnalytics()     → זמן פעיל vs מהירות ביצוע
getTeamById()             → פרטי צוות + sprint נוכחי
getSprintProgress()       → X/Y משימות אושרו
```

#### `AuthModule`
קובץ: `src/auth/`

```
POST /auth/login    → JWT access token + refresh token (HttpOnly cookie)
POST /auth/refresh  → מחליף refresh token
POST /auth/logout   → מבטל refresh token
GET  /auth/me       → פרטי המשתמש המחובר
```

#### `AIModule` — Azure OpenAI
קובץ: `src/integrations/ai/ai.service.ts`

- `analyze(text)` — jargonScore, softSkillScore, detectedTerms
- `generateHint(ctx)` — hint מותאם לפי עומק (1=כללי, 2=ספציפי, 3+=מעשי)
- עובד ב-mock אוטומטי אם `AZURE_OPENAI_API_KEY` לא מוגדר

#### `GatekeeperModule`
קובץ: `src/gatekeeper/gatekeeper.service.ts`

כל קריאה יוצאת (Azure OpenAI, Monday) עוברת כאן:
- Token bucket rate limiting
- Retry עם exponential backoff
- תיעוד מובנה לכל קריאה

### כל ה-API Endpoints

| Method | נתיב | מה עושה |
|---|---|---|
| `POST` | `/api/auth/login` | התחברות |
| `POST` | `/api/auth/refresh` | חידוש token |
| `POST` | `/api/auth/logout` | התנתקות |
| `GET` | `/api/users` | רשימת כל המשתמשים |
| `GET` | `/api/users/:id` | משתמש בודד |
| `GET` | `/api/tasks/team/:teamId` | משימות הצוות |
| `POST` | `/api/tasks/submit` | הגשת עבודה |
| `POST` | `/api/tasks/qa-review` | אישור/דחיית QA |
| `POST` | `/api/tasks/pm-review` | אישור/דחיית PM |
| `POST` | `/api/hints` | בקשת hint |
| `GET` | `/api/hints/count` | כמה hints נוצלו |
| `GET` | `/api/hints/history` | היסטוריית hints |
| `GET` | `/api/teams/leaderboard/group` | דירוג צוותים |
| `GET` | `/api/teams/leaderboard/individual` | top 3 אישי |
| `GET` | `/api/teams/analytics` | analytics לכל תלמיד |
| `GET` | `/api/teams/:id` | פרטי צוות + sprint |
| `GET` | `/api/teams/:id/sprint-progress` | X/Y משימות |
| `POST` | `/api/webhooks/monday` | webhook מ-Monday |
| `GET` | `/api/mock-monday/challenges` | רשימת challenges |
| `GET` | `/api/mock-monday/board/:id` | לוח בסגנון Monday |
| `POST` | `/api/mock-monday/kickoff/:id` | הפעלת challenge |
| `POST` | `/api/mock-monday/approve/:taskId` | אישור teacher |
| `POST` | `/api/mock-monday/reject/:taskId` | דחיית teacher |

---

## Frontend — Nuxt 3

### דפים (Pages)

#### `pages/index.vue` — מסך כניסה
גריד של כרטיסי משתמשים. לחיצה שומרת session ב-localStorage ומעבירה ל-`/student`.

#### `pages/student.vue` — דשבורד התלמיד

| אזור | תיאור |
|---|---|
| Sticky navbar | שם, תגית תפקיד, שם צוות, ניקוד |
| SprintProgress | שם ה-sprint, פס התקדמות X/Y |
| גריד משימות | כרטיס לכל משימה עם כפתורים לפי תפקיד |
| HintPanel | היסטוריית hints + בקשה חדשה |
| Tab "Leaderboard" | טבלת הצוותים |

#### `pages/teacher.vue` — דשבורד המורה
עוטף את `MockMondayBoard.vue`.

### קומפוננטות

#### `SprintProgress.vue`
פס התקדמות צבעוני, ניקוד צוות, status badge.

#### `HintPanel.vue`
ניתן לפתיחה/סגירה. מציג hints מ-Azure OpenAI עם פרטי עלות והיסטוריה.

#### `Leaderboard.vue`
טבלת צוותים ממוינת לפי ניקוד. medals 🥇🥈🥉, highlight לצוות המחובר.

#### `MockMondayBoard.vue` — ממשק המורה
עיצוב כהה בסגנון Monday.com עם 5 עמודות:
`In Progress → QA Review → PM Review → Pending Teacher Review → Approved`

#### `EnglishTerm.vue`
```vue
<EnglishTerm term="Sprint" />
<!-- מציג tooltip עברי בhover -->
```

### Composables

```typescript
const { user, isLoggedIn, login, logout } = useUser();

const { tasks, fetchTasks, submitTask, qaReview, pmReview, requestHint } =
    useTasks(teamId, userId);

const { rows, fetchLeaderboard } = useLeaderboard();
```

---

## Database — Supabase

### טבלאות

| טבלה | עמודות מרכזיות | הערות |
|---|---|---|
| `challenges` | title, monday_board_id, is_active | מופעל ע"י המורה |
| `teams` | accumulated_score, sprint_status, is_completed | |
| `users` | current_team_id, current_role, password_hash, account_type | |
| `sprints` | challenge_id, order_index | שלבי-משנה בתוך challenge |
| `tasks` | sprint_id, team_id, status, qa_checklist | לב המערכת |
| `hint_logs` | user_id, team_id, hint_number, points_deducted | append-only |
| `team_hint_counters` | user_id, team_id, hint_count | unique (user, team) |
| `refresh_tokens` | user_id, token_hash, expires_at, revoked_at | JWT refresh |
| `audit_logs` | user_id, action, metadata | תיעוד אבטחה |
| `failed_login_attempts` | email, attempts, locked_until | brute-force protection |

### Views מובנים

| View | שימוש |
|---|---|
| `group_leaderboard` | דירוג צוותים לפי ניקוד |
| `individual_leaderboard` | דירוג אישי (backend מחזיר top 3 בלבד) |
| `teacher_analytics` | זמן פעיל + tasks/שעה לכל תלמיד |

### RLS
- **Backend** — service role key → עוקף RLS, גישה מלאה
- **Frontend** — anon key → RLS חל, כל משתמש רואה רק את הנתונים שלו

---

## מערכת ה-Hints

```
hints 1-3  →  חינמי מ-Azure OpenAI
hint 4+    →  ניכוי 10 נקודות מהצוות
החלפת צוות →  הסופר מתאפס
```

### RAG — הקשר לכל hint

`RagService` בונה הקשר לפני כל קריאה ל-Azure OpenAI:
- **סילבוס** — לפי sprint UUID: שם, מטרת CBL, כלי Fusion 360 רלוונטיים
- **התקדמות הצוות** — כמה משימות אושרו בספרינט
- **מספר הרמז** — קובע את עומק ה-hint

עומק לפי מספר רמז:
- **Hint #1** — כיוון כללי, מושג רלוונטי
- **Hint #2** — כיוון ספציפי, שם הכלי
- **Hint #3+** — צעד מעשי וישיר

---

## סימולטור Monday.com

כשמורה לוחץ Approve בסימולטור → הקוד קורא לאותה פונקציה (`teacherApprove`) שהיה מופעל על ידי webhook אמיתי מ-Monday. **אין שום שינוי בלוגיקה הפנימית.**

כפתור **Kickoff Challenge** — מפעיל challenge חדש לכל הצוותים.

---

## משתני סביבה

### `backend/.env`
```env
# שרת
PORT=3001
CORS_ORIGINS=http://localhost:3000

# Supabase (חובה)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # שמור סודי! עוקף את כל ה-RLS

# JWT (חובה)
JWT_ACCESS_SECRET=כל-סטרינג-ארוך-אקראי

# Azure OpenAI (אופציונלי — mock פועל בלעדיו)
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Monday.com (אופציונלי — הסימולטור מחליף)
MONDAY_API_TOKEN=
MONDAY_WEBHOOK_SECRET=
```

### `frontend/.env`
```env
NUXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
```

---

## עבודה עם Git

```bash
git pull origin claude/learn-project-OVYbH

git add .
git commit -m "feat: תיאור קצר"
git push origin claude/learn-project-OVYbH
```

### כללי אצבע
- **שינית `frontend/types/types.ts`?** — תעדכן גם את backend DTOs
- **שינית `supabase/schema.sql`?** — תעדכן את הצוות לפני שמריצים ב-Supabase
- **הוספת endpoint חדש?** — תוסיף אותו ל-composable המתאים בפרונטאנד

---

## מי אחראי על מה

| תחום | קבצים רלוונטיים |
|---|---|
| **זרימת משימות** | `backend/src/tasks/` |
| **מערכת hints + AI + RAG** | `backend/src/hints/`, `backend/src/integrations/ai/`, `backend/src/rag/` |
| **ניקוד וסיום צוות** | `backend/src/teams/` |
| **ניהול משתמשים** | `backend/src/users/` |
| **אימות והרשאות** | `backend/src/auth/`, `backend/src/admin/` |
| **סימולטור Monday** | `backend/src/mock-monday/`, `frontend/components/MockMondayBoard.vue` |
| **מסך כניסה** | `frontend/pages/index.vue`, `frontend/composables/useUser.ts` |
| **דשבורד תלמיד** | `frontend/pages/student.vue`, `frontend/components/SprintProgress.vue`, `frontend/components/HintPanel.vue` |
| **Leaderboard** | `frontend/components/Leaderboard.vue`, `frontend/composables/useLeaderboard.ts` |
| **DB ו-RLS** | `supabase/schema.sql`, `backend/migrations/` |
| **טיפוסים משותפים** | `frontend/types/types.ts` |
