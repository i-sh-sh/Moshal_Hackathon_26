# מדריך Deploy — TeamSprintUp

**זמן משוער: 20-30 דקות**

```
Frontend (Nuxt 3 SSR)  →  Vercel       → your-app.vercel.app
Backend  (NestJS)      →  Railway      → your-backend.railway.app
Database (PostgreSQL)  →  Supabase     → כבר פעיל
```

> **סדר חשוב:** Railway קודם → מקבלים URL → מגדירים ב-Vercel.

---

## שלב 1 — Railway (Backend)

### 1.1 יצירת חשבון
1. לך ל-[railway.app](https://railway.app)
2. לחץ **Start a New Project** → **Login with GitHub**
3. אשר את הרשאות GitHub

### 1.2 יצירת פרויקט
1. לחץ **New Project** → **Deploy from GitHub repo**
2. בחר את הריפו `Moshal_Hackathon_26`
3. Railway יזהה אוטומטית שזה Node.js

### 1.3 הגדרת Root Directory
1. לחץ על השירות שנוצר → **Settings**
2. תחת **Source** → **Root Directory** → הכנס: `backend`
3. Railway יריץ אוטומטית: `npm install` → `npm run build` → `npm run start:prod`

### 1.4 הגדרת משתני סביבה
לחץ על השירות → **Variables** → **+ New Variable** — הוסף את כולם:

| Key | Value | איפה מוצאים |
|---|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase → Settings → API (service_role) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | console.anthropic.com → API Keys |
| `MONDAY_WEBHOOK_SECRET` | כל מחרוזת אקראית | בחר בעצמך |
| `CORS_ORIGINS` | *(ריק לעכשיו — נחזור)* | — |

> Railway מוסיף `PORT` אוטומטית — אל תוסיף אותו ידנית.

### 1.5 קבלת ה-URL
1. לחץ **Settings** → **Networking** → **Generate Domain**
2. תקבל משהו כמו: `teamsprintup-backend.up.railway.app`
3. **שמור את ה-URL הזה** — נצטרך אותו בשלב הבא

---

## שלב 2 — Vercel (Frontend)

### 2.1 יצירת חשבון
1. לך ל-[vercel.com](https://vercel.com)
2. לחץ **Sign Up** → **Continue with GitHub**
3. אשר גישה לריפו

### 2.2 ייבוא הפרויקט
1. לחץ **Add New Project**
2. בחר את הריפו `Moshal_Hackathon_26`
3. **חשוב:** תחת **Root Directory** לחץ **Edit** → הכנס: `frontend`
4. Framework Preset: Vercel יזהה **Nuxt.js** אוטומטית ✅

### 2.3 הגדרת משתני סביבה
לפני לחיצת Deploy, פרוס את **Environment Variables**:

| Key | Value |
|---|---|
| `NUXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NUXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon key מ-Supabase) |
| `NUXT_SUPABASE_SERVICE_KEY` | `eyJ...` (service_role key) |
| `NUXT_PUBLIC_API_BASE_URL` | `https://YOUR-BACKEND.up.railway.app/api` |

> החלף `YOUR-BACKEND` ב-URL שקיבלת מ-Railway בשלב 1.5

### 2.4 Deploy
לחץ **Deploy** — Vercel יריץ `npm install` → `npm run build` (כ-2 דקות).

תקבל URL כמו: `teamsprintup.vercel.app`

---

## שלב 3 — חזרה ל-Railway: עדכון CORS

1. חזור ל-Railway → **Variables**
2. עדכן את `CORS_ORIGINS`:
   ```
   https://teamsprintup.vercel.app
   ```
   (אם רוצים גם local dev: `https://teamsprintup.vercel.app,http://localhost:3000`)
3. Railway יעשה redeploy אוטומטי

---

## שלב 4 — הרצת ה-Seed על Production

עם ה-`.env` המקומי שמכיל את ה-`SUPABASE_SERVICE_ROLE_KEY` האמיתי:

```bash
cd backend
npm run seed
```

הסקריפט מתחבר ישירות ל-Supabase — לא משנה מאיפה מריצים אותו.

---

## שלב 5 — בדיקה

```
https://YOUR-APP.vercel.app          → ממשק תלמידים
https://YOUR-APP.vercel.app/teacher  → סימולטור Monday (ממשק מורה)
https://YOUR-BACKEND.railway.app/api/teams/leaderboard/group → בדיקת API ישירה
```

---

## Deploys אוטומטיים

כל `git push origin master` מפעיל deploy אוטומטי בשתי הפלטפורמות.

```bash
git add .
git commit -m "fix: something"
git push origin master
# ↳ Railway מתחיל build (~1 דק׳)
# ↳ Vercel מתחיל build (~2 דק׳)
```

---

## פתרון בעיות נפוצות

**`CORS error` בקונסול הדפדפן:**
- ודא ש-`CORS_ORIGINS` ב-Railway מכיל את ה-URL המדויק של Vercel (ללא slash בסוף)

**`500 Internal Server Error` מ-Railway:**
- לחץ על השירות → **Deployments** → בחר deploy אחרון → **View Logs**
- בדרך כלל: משתנה סביבה חסר

**Frontend נטען אך API calls נכשלות:**
- בדוק ש-`NUXT_PUBLIC_API_BASE_URL` מסתיים ב-`/api`
- בדוק שה-Railway service פעיל (לא ב-sleep)

**Railway service ב-sleep אחרי חוסר פעילות:**
- ב-Free tier, Railway עוצר services שלא קיבלו בקשה ב-30 דקות
- לפרזנטציה: שלח בקשה ל-API דקה לפני כדי "להעיר" אותו
- או שדרג ל-Hobby plan ($5/חודש) שמונע sleep
