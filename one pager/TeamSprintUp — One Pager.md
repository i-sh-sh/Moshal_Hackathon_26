# TeamSprintUp
### סביבת עבודה מדומה לתלמידים | A Simulated Hi-Tech Workplace for Students

---

## הבעיה / The Problem

**עברית:**
תלמידי תיכון בתוכניות טכנולוגיות רוכשים ידע תיאורטי אך אינם חווים את מציאות עולם ה-Hi-Tech.
הם לא מכירים עבודת צוות אמיתית, תהליכי אישור, חלוקת תפקידים, ולחץ של דדליינים.
הפער בין הכיתה לתעשייה נותר גדול מאוד.

**English:**
High school students in tech programs gain theoretical knowledge but never experience real hi-tech workplace dynamics.
They lack exposure to real teamwork, approval pipelines, role ownership, and deadline pressure.
The gap between the classroom and the industry remains wide.

---

## הפתרון / The Solution

**עברית:**
TeamSprintUp מדמה סביבת עבודה אמיתית בתוך הכיתה.
תלמידים מחולקים לצוותים, מקבלים תפקידים מקצועיים, ומבצעים אתגרי הדפסה תלת-ממדית כמשימות אמיתיות.
כל צוות עובד עם לוח ניהול בסגנון Monday.com, עוקב אחרי התקדמות, מגיש עבודות, ומקבל משוב — בדיוק כמו בחברת סטארטאפ אמיתית.

**English:**
TeamSprintUp simulates a real workplace environment inside the classroom.
Students are divided into teams, assigned professional roles, and complete 3D-printing challenges as real work tasks.
Each team works with a Monday.com-style management board, tracks progress, submits deliverables, and receives feedback — just like a real startup team.

---

## קהל יעד / Target Audience

| קהל | Audience |
|-----|----------|
| תלמידי תיכון בתוכניות טכנולוגיות | High school students in tech/STEM programs |
| מורים ומנטורים בבתי ספר טכנולוגיים | Teachers and mentors in technology schools |
| ארגונים כמו TechSchool ו-MOSHAL | Organizations like TechSchool and MOSHAL |

---

## איך זה עובד / How It Works

```
מורה פותח אתגר  →  תלמידים מקבלים תפקידים  →  כל תלמיד משלים משימה
Teacher opens challenge  →  Students receive roles  →  Each student completes their task

        ↓                           ↓                           ↓

   לוח Monday-style          בוחן לפני/אחרי           שרשרת אישורים
   Monday-style board       Pre/Post quiz            Approval pipeline
                                                     QA → PM → Teacher
```

**תפקידים בצוות / Team Roles:**
- **Designer** — מעצב המודל התלת-ממדי | 3D model designer
- **QA** — בודק איכות | Quality assurance reviewer
- **Editor (Slicer)** — מכין את הקובץ להדפסה | Prepares the file for printing
- **Printer** — מפעיל את המדפסת | Operates the 3D printer

---

## תכונות מפתח / Key Features

| תכונה / Feature | תיאור / Description |
|-----------------|---------------------|
| 🎮 משחוק | חוויית לימוד עם שאלות בועות, חוויית משחק 8-bit |
| 🎮 Gamification | Bubble quiz game, 8-bit sound effects |
| 📋 שרשרת אישורים | Dev → QA → PM → Teacher approval pipeline |
| 📋 Approval Pipeline | Structured task flow mirroring real development |
| 🤖 רמזי AI | רמזים בהקשר מלא מ-Claude AI בעברית |
| 🤖 AI Hints | Context-aware Hebrew hints powered by Claude AI |
| 📊 לוח מורה | ניהול אתגרים, צוותים ותפקידים |
| 📊 Teacher Dashboard | Challenge management, role assignment, analytics |
| 📈 אנליטיקה | מעקב זמן פעילות, משימות שאושרו, שיפור בבוחנים |
| 📈 Analytics | Active time, approved tasks, quiz learning gain |
| 👤 פרופיל תלמיד | היסטוריית תפקידים, ניקוד, התקדמות |
| 👤 Student Profile | Role history, score, progress tracking |

---

## הטכנולוגיה / Technology Stack

```
Frontend:  Nuxt 3 + Vue 3 + Tailwind CSS
Backend:   NestJS 10 (TypeScript)
Database:  PostgreSQL (Neon Cloud)
AI:        Anthropic Claude — hint generation + RAG context
Auth:      JWT + bcrypt (Firebase-ready)
Infra:     Mock-first architecture — runs fully offline for demos
```

---

## מצב נוכחי / Current Status

**✅ מוכן לדמו / Demo-Ready**

- מערכת משימות מלאה עם שרשרת אישורים פעילה
- לוח מורה עם ניהול אתגרים ותפקידים
- בוחני ידע לפני ואחרי המשימה עם חישוב שיפור
- סביבת POC רצה ללא backend עם נתוני demo מובנים
- 8 תלמידי demo, 2 צוותים, 3 אתגרי הדפסה אמיתיים מ-TechSchool

**Full task pipeline with live approval chain**
**Teacher dashboard with challenge + role management**
**Pre/post knowledge quizzes with learning gain calculation**
**POC mode runs fully without backend on built-in demo data**
**8 demo students, 2 teams, 3 real TechSchool 3D-printing challenges**

---

## הערך הייחודי / Unique Value

> **עברית:** TeamSprintUp היא לא סימולציה — היא **חוויית עבודה אמיתית**.
> תלמידים לא לומדים *על* עבודה בצוות, הם *עובדים* בצוות.
> כל תפקיד, כל אישור, וכל דדליין הם אמיתיים בתוך הכיתה.

> **English:** TeamSprintUp is not a simulation — it's a **real work experience**.
> Students don't learn *about* teamwork, they *do* teamwork.
> Every role, every approval, and every deadline is real — inside the classroom.

---

## החזון / Vision

**עברית:**
להפוך כל שיעור טכנולוגי לחוויית עבודה אמיתית, כך שכל תלמיד יסיים את התיכון עם ניסיון מעשי בעבודת צוות בסביבת Hi-Tech.

**English:**
To turn every technology lesson into a real work experience, so every student graduates high school with hands-on hi-tech teamwork experience.

---

## הצוות / Team

**MOSHAL Hackathon 2026 — SprintUP**
*Built at Ariel University | נבנה באוניברסיטת אריאל*

---

*TeamSprintUp — Learn by doing. Work by learning.*
*TeamSprintUp — לומדים תוך כדי עשייה. עובדים תוך כדי למידה.*
