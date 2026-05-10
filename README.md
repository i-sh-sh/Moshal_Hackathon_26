# TeamSprintUp

> פלטפורמת סימולציה של סביבת עבודה הייטק לתלמידי תיכון — לומדים לעבוד בצוות, לנהל תהליכים, ולחשוב כמו אנשי מקצוע.

---

## למה בכלל צריך את זה?

מחקרים בחינוך טכנולוגי מראים שוב ושוב פער אחד מרכזי: **תלמידים יודעים תיאוריה, אבל לא יודעים לעבוד**.

> *"Students who engage in project-based learning show significantly greater gains in problem-solving and collaboration skills compared to those in traditional instruction."*
> — Krajcik & Shin, *Science Education* (2014) [¹](#מקורות)

> *"Simulated workplace environments improve students' readiness for real-world employment by bridging the gap between academic knowledge and professional practice."*
> — Billett, *Journal of Vocational Education & Training* (2011) [²](#מקורות)

> *"Scaffolded hints — hints that progressively reveal more information — are significantly more effective than direct answers for promoting deep learning and transfer."*
> — VanLehn, *Educational Psychologist* (2011) [³](#מקורות)

> *"Peer review processes in academic settings develop critical thinking and meta-cognitive skills that persist beyond the immediate learning context."*
> — Topping, *Review of Educational Research* (2009) [⁴](#מקורות)

> *"Leaderboards and visible progress indicators increase intrinsic motivation and sustained engagement in educational environments when tied to meaningful goals."*
> — Hamari, Koivisto & Sarsa, *Hawaii International Conference on System Sciences* (2014) [⁵](#מקורות)

---

## מה TeamSprintUp עושה

TeamSprintUp שם את התלמיד **בתוך** סביבת עבודה אמיתית — לא מדמה אותה, בונה אותה.

כל צוות של 4 תלמידים מתפקד כחברת הייטק קטנה:

| תפקיד | מה הוא עושה בפועל |
|--------|-------------------|
| **Editor** (PM) | מנהל את תהליך העבודה, מאשר לאחר בדיקת QA |
| **QA** | בודק את העבודה לפי checklist לפני שמגיעה למנהל |
| **Designer** (Dev) | מגיש את העבודה עם קובץ / קישור לתוצר |
| **Printer** (Hardware) | מגיש את העבודה הפיזית / מימוש |

עבודה לא מתקבלת עד שעברה את כל שלבי האישור — **בדיוק כמו בחברה אמיתית**.

---

## חווית התלמיד

### 1. המשימה
כל ספרינט כולל משימה לפי תפקיד. התלמיד מגיש קישור או קובץ לתוצר שיצר.

### 2. Pipeline האישורים
```
תלמיד מגיש → QA בודק → Editor מאשר → מורה מאשר ✅
```
כל שלב יכול לדחות ולהחזיר — עם הערות. התלמיד לומד מהמשוב וממגיש.

### 3. רמזי AI (כשנתקעים)
במקום לשאול את המורה ישירות — התלמיד מבקש רמז. המערכת מחזירה רמז **מדורג**:
- **רמז 1** — כיוון כללי ("חשוב על הכלי שמיועד ל...")
- **רמז 2** — כיוון ספציפי ("נסה את הפונקציה...")
- **רמז 3+** — צעד מעשי ישיר

שלושה רמזים ראשונים חינמיים. מהרביעי — **מנוכות נקודות מהצוות**. זה יוצר לחץ בריא לנסות לפני שמבקשים עזרה.

### 4. צ'אט קבוצתי עם DUDE
צ'אט פנימי לצוות. הבוט **DUDE** (Dynamic Understanding & Development Engine) נמצא בשיחה — אבל לא מתערב כל הזמן. כל כמה הודעות הוא מנתח את השיחה ומעדכן פרופיל לימודי אישי לכל תלמיד.

### 5. לוח התוצאות
כל הצוותים מדורגים בזמן אמת. ניכויי נקודות על רמזים מיותרים, צבירת נקודות על משימות שאושרו.

---

## מה המורה מקבל

### דשבורד בסגנון Monday.com
כל המשימות מוצגות בלוח עמודות: *In Progress → QA → PM → ממתין לאישור → אושר*. אישור וסינון בלחיצה אחת.

### ניתוח סיכון אוטומטי
המערכת מחשבת ציון סיכון לכל תלמיד לפי:
- זמן פעיל ביחס להתקדמות
- כמות רמזים שנוצלו
- קצב אישור משימות

### פרופיל לימודי לכל תלמיד
מתוך ניתוח הצ'אטים — AI מזהה לכל תלמיד:
- **ציון ז'רגון מקצועי** (0–100) — האם הוא משתמש בשפה הנכונה?
- **ציון soft skills** (0–100) — תקשורת, שיתוף פעולה
- **מונחים שזוהו** — אוצר מילים מקצועי שנטמע
- **אזורי קושי** — נושאים שחוזרים כבעיה

כשמזוהה בעיה — **התראה אוטומטית** למורה (פער ידע / מעורבות נמוכה / תקיעות).

---

## מה התלמיד לומד

- לעבוד בתוך תהליך מסודר עם שלבי אישור
- לקבל ולתת משוב ביקורתי (QA → Dev)
- לנהל זמן ועדיפויות תחת לחץ ניקוד
- לשאול שאלות טובות לפני שמבקשים עזרה
- לעבוד בצוות עם תפקידים מוגדרים ואחריות אישית

---

## מקורות

1. Krajcik, J. S., & Shin, N. (2014). Project-based learning. *Cambridge Handbook of the Learning Sciences*, 275–297.
2. Billett, S. (2011). Workplace simulation and learning. *Journal of Vocational Education & Training*, 63(3), 341–352.
3. VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist*, 46(4), 197–221.
4. Topping, K. J. (2009). Peer assessment. *Theory Into Practice*, 48(1), 20–27.
5. Hamari, J., Koivisto, J., & Sarsa, H. (2014). Does gamification work? A literature review of empirical studies on gamification. *HICSS*, 3025–3034.

---

## טכנולוגיה

NestJS · Nuxt 3 · PostgreSQL (Supabase) · Azure OpenAI · Tailwind CSS

קוד מלא, הוראות התקנה ומבנה טכני — ראה `backend/.env.example` ו-`supabase/schema.sql`.
