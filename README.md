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
8. [מערכת DUDE — צ'אט + בוט AI + פרופיל לימודי](#מערכת-dude--צאט--בוט-ai--פרופיל-לימודי)
9. [סימולטור Monday.com](#סימולטור-mondaycom)
10. [משתני סביבה](#משתני-סביבה)
11. [עבודה עם Git](#עבודה-עם-git)
12. [מי אחראי על מה](#מי-אחראי-על-מה)

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
│       ├── webhooks/            # קבלת events נכנסים מ-Monday
│       ├── chat/                # ערוצי צ'אט קבוצתי — CRUD הודעות וערוצים
│       ├── dude/                # בוט DUDE — תגובות AI + הפעלת ניתוח שיחה
│       └── student-profile/     # פרופיל לימודי — ז'רגון, soft skills, snapshots
│
├── frontend/                    # אפליקציית Nuxt 3
│   ├── components/
│   │   ├── AnalyticsDashboard.vue   # טבלת analytics לכל תלמיד (זמן פעיל, tasks/hr)
│   │   ├── ChatChannel.vue          # ממשק צ'אט קבוצתי — בועות הודעה + input
│   │   ├── EnglishTerm.vue          # מילון אנגלי-עברי בhover
│   │   ├── HintPanel.vue            # היסטוריית hints ניתנת לכיווץ + בקשת hint חדש
│   │   ├── Leaderboard.vue          # טבלת דירוג צוותים עם score bars
│   │   ├── MockMondayBoard.vue      # ממשק המורה בסגנון Monday
│   │   ├── SprintProgress.vue       # פס התקדמות sprint + ניקוד
│   │   ├── StudentProfileCard.vue   # כרטיס פרופיל לימודי + sparkline התקדמות
│   │   └── TeacherChatPanel.vue     # כל הערוצים למורה + כפתור ניתוח DUDE
│   ├── composables/
│   │   ├── useChat.ts           # init ערוץ, fetch/send הודעות, polling 5 שניות
│   │   ├── useLeaderboard.ts    # fetch לטבלת הניקוד
│   │   ├── useStudentProfile.ts # fetch פרופיל + snapshots + triggerAnalysis
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
│  /api/auth/*              ← login, register, refresh      │
│  /api/users/*             ← רשימת משתמשים                │
│  /api/tasks/*             ← זרימת משימות                 │
│  /api/hints/*             ← מערכת hints + RAG            │
│  /api/teams/*             ← leaderboards + analytics     │
│  /api/mock-monday/*       ← סימולטור Monday              │
│  /api/webhooks/monday     ← webhook אמיתי מ-Monday       │
│  /api/chat/*              ← ערוצי צ'אט + הודעות          │
│  /api/dude/*              ← DUDE bot + ניתוח שיחה        │
│  /api/student-profiles/*  ← פרופילים + snapshots         │
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
│  chat_channels / chat_messages / channel_participants│
│  student_profiles / profile_snapshots                │
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
- `generateDudeResponse(history, trigger)` — תגובת בוט בצ'אט קבוצתי
- `analyzeConversation(messages, userId)` — ניתוח שיחה לעדכון פרופיל לימודי
- עובד ב-mock אוטומטי אם `AZURE_OPENAI_API_KEY` לא מוגדר

#### `ChatModule` — ערוצי צ'אט
קובץ: `src/chat/chat.service.ts`

```
createChannel(teamId)    → יוצר ערוץ לצוות (unique per team)
getMessages(channelId)   → הודעות ממוינות לפי זמן
sendMessage(...)         → שמירת הודעת תלמיד
sendBotMessage(...)      → שמירת תגובת DUDE (is_bot=true)
addTeacherToAllChannels()→ מוסיף מורה כ-observer לכל הערוצים
getUnanalyzedMessages()  → הודעות מאז הניתוח האחרון
```

#### `DudeModule` — בוט AI
קובץ: `src/dude/dude.service.ts`

```
onStudentMessage(channelId, msg) → מחליט אם DUDE מגיב:
    • כל DUDE_RESPONSE_INTERVAL=3 הודעות תלמיד
    • תמיד כאשר ההודעה מסתיימת ב-"?"
analyzeChannel(channelId) → מריץ ניתוח מלא, מעדכן פרופילים, מתעד ב-channel_analysis_log
```

#### `StudentProfileModule` — פרופיל לימודי
קובץ: `src/student-profile/student-profile.service.ts`

```
getProfile(userId)         → פרופיל נוכחי (null אם לא נוצר עדיין)
updateFromAnalysis(userId) → weighted mean של ז'רגון + soft skills + שמירת snapshot
getAllProfiles()            → כל הפרופילים (תצוגת מורה)
getSnapshots(userId)       → היסטוריה כרונולוגית לגרף התקדמות
```

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
| `GET` | `/api/chat/channels` | כל הערוצים (מורה) |
| `GET` | `/api/chat/teams/:teamId/channel` | ערוץ הצוות |
| `POST` | `/api/chat/teams/:teamId/channel` | יצירת ערוץ לצוות |
| `GET` | `/api/chat/channels/:channelId/messages` | הודעות בערוץ |
| `POST` | `/api/chat/channels/:channelId/messages` | שליחת הודעה (ישירה, ללא DUDE) |
| `POST` | `/api/dude/channels/:channelId/messages` | שליחת הודעה + הפעלת DUDE |
| `POST` | `/api/dude/channels/:channelId/analyze` | ניתוח שיחה ועדכון פרופילים |
| `GET` | `/api/student-profiles` | כל הפרופילים (מורה) |
| `GET` | `/api/student-profiles/:userId` | פרופיל תלמיד |
| `GET` | `/api/student-profiles/:userId/snapshots` | היסטוריית ניקוד |

---

## Frontend — Nuxt 3

### דפים (Pages)

#### `pages/index.vue` — מסך כניסה
גריד של כרטיסי משתמשים. לחיצה שומרת session ב-localStorage ומעבירה ל-`/student`.

#### `pages/student.vue` — דשבורד התלמיד

| Tab | תיאור |
|---|---|
| 📋 My Tasks | גריד משימות עם כפתורים לפי תפקיד + HintPanel |
| 🏆 Leaderboard | טבלת הצוותים + top 3 אישי |
| 💬 צ'אט DUDE | צ'אט קבוצתי — DUDE עונה כל 3 הודעות / על שאלות |
| 📈 ההתקדמות שלי | כרטיס פרופיל לימודי אישי + גרף snapshots |

#### `pages/teacher.vue` — דשבורד המורה

| Tab | תיאור |
|---|---|
| 📋 Monday Board | סימולטור Monday עם אישור/דחיית משימות |
| 📊 Analytics | זמן פעיל + tasks/שעה לכל תלמיד |
| 💬 צ'אטים DUDE | כל הערוצים הקבוצתיים + כפתור "נתח שיחה" |
| 🧠 פרופילים | כרטיסי פרופיל לכל תלמיד שנותח |

### קומפוננטות

#### `SprintProgress.vue`
פס התקדמות צבעוני, ניקוד צוות, status badge.

#### `HintPanel.vue`
ניתן לפתיחה/סגירה. מציג hints מ-Azure OpenAI עם פרטי עלות והיסטוריה.

#### `Leaderboard.vue`
טבלת צוותים ממוינת לפי ניקוד. medals 🥇🥈🥉, highlight לצוות המחובר.

#### `ChatChannel.vue`
ממשק צ'אט קבוצתי. בועות הודעה צבעוניות לפי שולח (תלמיד / DUDE / עצמי). input עם Enter לשליחה. auto-scroll לתחתית.

#### `TeacherChatPanel.vue`
sidebar עם רשימת ערוצים לפי צוות. תצוגת כל ההודעות בפורמט Discord. כפתור "נתח שיחה" → POST `/dude/.../analyze`.

#### `StudentProfileCard.vue`
כרטיס פרופיל: ניקוד ז'רגון + soft skills עם progress bars, רשימת מונחים שזוהו, sparkline לתרשים ההתקדמות לאורך זמן.

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

// DUDE
const { channel, messages, sending, initChannel, sendMessage, startPolling } =
    useChat(teamId, userId, userName);

const { profile, snapshots, allProfiles, fetchMyProfile, fetchAllProfiles, triggerAnalysis } =
    useStudentProfile();
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
| `chat_channels` | team_id, name | unique per team |
| `chat_messages` | channel_id, sender_id, is_bot, content | הודעות תלמידים + DUDE |
| `channel_participants` | channel_id, user_id, role | member / teacher |
| `channel_analysis_log` | channel_id, message_count, summary | תיעוד ריצות ניתוח |
| `student_profiles` | user_id, jargon_score, soft_skill_score, detected_terms | unique per user |
| `profile_snapshots` | user_id, jargon_score, soft_skill_score, snapshot_at | לגרף התקדמות |
| `teacher_alerts` | user_id, alert_type, message, is_read | knowledge_gap / stuck |
| `jargon_events` | user_id, message_id, term | זיהוי מונחים ברמת הודעה |

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

## מערכת DUDE — צ'אט + בוט AI + פרופיל לימודי

DUDE (Dynamic Understanding & Development Engine) היא שכבת למידה חכמה שמוסיפה לפלטפורמה:

### זרימה מלאה

```
תלמיד כותב הודעה בצ'אט
    │
    ▼
POST /dude/channels/:id/messages
    │
    ├─► ChatService.sendMessage()  — שמירת הודעה ב-DB
    │
    └─► DudeService.onStudentMessage()  — בדיקת trigger:
            │
            ├── כל 3 הודעות תלמיד → DUDE מגיב
            ├── הודעה מסתיימת ב-"?" → DUDE מגיב תמיד
            │
            └─► AIService.generateDudeResponse(history)
                    │
                    ▼
            ChatService.sendBotMessage()  → is_bot=true בDB
```

### ניתוח שיחה (מופעל ידנית ע"י מורה)

```
מורה לוחץ "נתח שיחה" ב-TeacherChatPanel
    │
    ▼
POST /dude/channels/:id/analyze
    │
    └─► DudeService.analyzeChannel()
            │
            ├─► מקבץ הודעות לפי שולח
            ├─► AIService.analyzeConversation(messages[]) לכל תלמיד
            ├─► StudentProfileService.updateFromAnalysis() — weighted mean
            ├─► profile_snapshots ← snapshot חדש לגרף ההתקדמות
            └─► channel_analysis_log ← תיעוד הניתוח
```

### מה המורה רואה

- **Tab "צ'אטים DUDE"** — כל הערוצים הקבוצתיים + כפתור ניתוח לכל ערוץ
- **Tab "פרופילים"** — כרטיס לכל תלמיד: ניקוד ז'רגון (0-100), soft skills (0-100), מונחים שזוהו

### מה התלמיד רואה

- **Tab "צ'אט DUDE"** — צ'אט קבוצתי עם תגובות DUDE בכחול (גלוי לכולם)
- **Tab "ההתקדמות שלי"** — כרטיס פרופיל עם ניקודים אישיים + sparkline התפתחות לאורך זמן

### הגדרות בוט (ניתן לשנות ב-`dude.service.ts`)

```typescript
const DUDE_RESPONSE_INTERVAL = 3;  // כל כמה הודעות DUDE מגיב
```

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
| **DUDE — צ'אט קבוצתי** | `backend/src/chat/`, `frontend/components/ChatChannel.vue`, `frontend/composables/useChat.ts` |
| **DUDE — בוט AI** | `backend/src/dude/`, `backend/src/integrations/ai/ai.service.ts` |
| **DUDE — פרופיל לימודי** | `backend/src/student-profile/`, `frontend/components/StudentProfileCard.vue`, `frontend/composables/useStudentProfile.ts` |
| **DUDE — ממשק מורה** | `frontend/components/TeacherChatPanel.vue`, `frontend/pages/teacher.vue` |
| **DB ו-RLS** | `supabase/schema.sql`, `backend/migrations/` |
| **טיפוסים משותפים** | `frontend/types/types.ts` |
