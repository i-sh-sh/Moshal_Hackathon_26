# TeamSprintUp 🚀

סימולציית סביבת עבודה הייטק לסטודנטים — הצוות מתנהל כחברה אמיתית, מגיש עבודות דרך pipeline של אישורים, ומקבל רמזים מ-AI. המורה שולט מדשבורד בסגנון Monday.com.

---

## מה זה בעצם?

תלמידים מחולקים לצוותים של 4. לכל תלמיד תפקיד:

| תפקיד | שם בתצוגה | אחריות |
|--------|-----------|---------|
| PM | Editor | מנהל פרויקט — מאשר לאחר QA |
| QA | QA | בודק איכות — מאשר לאחר הגשה |
| Dev | Designer | מגיש את העבודה |
| Hardware | Printer | מגיש את העבודה |

כל משימה עוברת pipeline לפני שמתקבלת:

```
הגשה → QA → PM → מורה → ✅ אושר
```

בדרך — הצוות יכול לבקש רמזים מ-AI. שלושה ראשונים חינם, מהרביעי מנוכות נקודות.

---

## תכונות מרכזיות

- **Pipeline משימות** עם 4 שלבי אישור
- **רמזי AI** מותאמי-הקשר (סילבוס + התקדמות הצוות + עומק הרמז)
- **בוט DUDE** — צ'אט קבוצתי עם בוט AI שמנתח שיחות ובונה פרופיל לימודי לכל תלמיד
- **לוח תוצאות** — דירוג צוותים ואישי בזמן אמת
- **דשבורד מורה** — ממשק בסגנון Monday.com, ניתוח סיכון לכל תלמיד, ניהול אתגרים
- **פרופיל לימודי** — מעקב ז'רגון מקצועי ו-soft skills לכל תלמיד לאורך זמן

---

## הרצה מקומית

### דרישות
- Node.js 18+
- חשבון [Supabase](https://supabase.com) (חינמי)

### צעד 1 — הקמת DB
1. צור פרויקט ב-Supabase
2. לך ל-**SQL Editor** ← הרץ את `supabase/schema.sql`
3. הרץ בסדר את קבצי `supabase/migrations/` (002, 003, 005, 006, 007, 008)
4. שמור את ה-**Project URL** ו-**service_role key** מ-Project Settings → API

### צעד 2 — Backend
```bash
cd backend
cp .env.example .env
# ערוך .env — מלא SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_ACCESS_SECRET
npm install
npm run seed        # יוצר 2 צוותים + 9 משתמשי דמו
npm run start:dev   # http://localhost:3001/api
```

### צעד 3 — Frontend
```bash
cd frontend
cp .env.example .env
# ערוך .env — NUXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
npm install
npm run dev         # http://localhost:3000
```

### צעד 4 — כניסה
פתח `http://localhost:3000`, בחר משתמש מהגריד ולחץ.

---

## חשבונות דמו

אחרי `npm run seed` — כל החשבונות עם הסיסמה `demo1234`:

| משתמש | תפקיד | צוות |
|--------|--------|------|
| `teacher@techschool.demo` | מורה | — |
| `admin@techschool.demo` | מנהל | — |
| `yael@techschool.demo` | PM (Editor) | Team Alpha |
| `david@techschool.demo` | QA | Team Alpha |
| `noa@techschool.demo` | Dev (Designer) | Team Alpha |
| `ariel@techschool.demo` | Hardware (Printer) | Team Alpha |
| `maya@techschool.demo` | PM (Editor) | Team Beta |
| `omer@techschool.demo` | QA | Team Beta |
| `lior@techschool.demo` | Dev (Designer) | Team Beta |
| `tal@techschool.demo` | Hardware (Printer) | Team Beta |

---

## Stack

| שכבה | טכנולוגיה |
|------|-----------|
| Backend | NestJS 10 (TypeScript) — port 3001 |
| Frontend | Nuxt 3 + Vue 3 + Tailwind CSS — port 3000 |
| Database | PostgreSQL דרך Supabase (או Neon) |
| AI | Azure OpenAI gpt-4o — רמזים + ניתוח שיחות |
| Auth | JWT (15 דקות) + Refresh tokens (7 ימים) |

> **הפרויקט עולה ללא שום credentials חיצוניים.** AI, Monday ו-Firebase עובדים במצב mock אוטומטי.

---

## מבנה הפרויקט

```
├── backend/src/
│   ├── tasks/              # pipeline המשימות
│   ├── hints/ + rag/       # מערכת רמזים + בניית הקשר מסילבוס
│   ├── chat/ + dude/       # צ'אט קבוצתי + בוט AI
│   ├── student-profile/    # פרופיל לימודי — ז'רגון, soft skills
│   ├── teams/              # לוח תוצאות, ניקוד, ניתוח
│   ├── mock-monday/        # סימולטור דשבורד המורה
│   ├── auth/ + admin/      # אימות, JWT, ניהול משתמשים
│   ├── gatekeeper/         # chokepoint לכל קריאה יוצאת (rate-limit, retry)
│   └── integrations/       # Azure AI, Monday, Firebase, S3 — mock↔real דרך env
│
├── frontend/
│   ├── pages/index.vue     # מסך כניסה
│   ├── pages/student.vue   # דשבורד תלמיד (משימות / לוח תוצאות / צ'אט / פרופיל)
│   └── pages/teacher.vue   # דשבורד מורה (Monday board / analytics / פרופילים)
│
└── supabase/
    ├── schema.sql           # schema בסיסי
    └── migrations/          # שינויים מצטברים (002–008)
```

---

## זרימת משימה — מלאה

```
Dev מגיש
    ↓
[qa_review] ──── QA דוחה ──→ חזרה ל-Dev
    ↓ QA מאשר
[pm_review] ──── PM דוחה ──→ חזרה ל-QA
    ↓ PM מאשר
    ├─→ Monday מתעדכן ל-"Pending Teacher Review"
    ↓
[teacher_review]
    ↓ מורה מאשר (דרך סימולטור)
[approved] ──→ בדיקה: כל משימות הצוות אושרו? → is_completed = true
```

---

## מערכת DUDE — ניתוח לימודי

DUDE (Dynamic Understanding & Development Engine) מנטר את הצ'אט הקבוצתי:

- כל 10 הודעות — AI מנתח את השיחה בשקט (ללא תגובה גלויה)
- מורה יכול להפעיל ניתוח ידני בכל עת
- לכל תלמיד נבנה פרופיל: **ציון ז'רגון** + **ציון soft skills** + **מונחים שזוהו** + **אזורי קושי**
- כשנזוהה בעיה — נוצרת **התראה למורה** (knowledge_gap / low_engagement / stuck)

---

## API Docs

השרת חושף Swagger בכתובת:
```
http://localhost:3001/api/docs
```
