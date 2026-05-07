export interface RoleInfo {
    title: string;
    subtitle: string;
    bullets: string[];
    jargon?: { term: string; explanation: string }[];
}

export const ROLE_INFO: Record<string, RoleInfo> = {
    dev: {
        title: 'Designer',
        subtitle: 'מעצב/ת המודל התלת-ממדי',
        bullets: [
            'תפקידך לתכנן איך האובייקט ייראה.',
            'אתה אחראי לחשוב על הצורה, הגודל והחלקים של המודל.',
            'אתה יוצר את המודל בתוכנת CAD ומוודא שהעיצוב מתאים להדפסה.',
            'לפני שמגישים — בדוק שאין פתחים במודל ושהמידות הגיוניות.',
        ],
        jargon: [
            { term: 'מודל', explanation: 'הצורה התלת-ממדית שאתה מעצב במחשב' },
            { term: 'CAD / Fusion 360', explanation: 'תוכנה המאפשרת ליצור עיצובים תלת-ממדיים מדויקים' },
            { term: 'STL', explanation: 'פורמט קובץ שהמדפסת יכולה לקרוא' },
            { term: 'Overhang', explanation: 'חלק של המודל שתלוי באוויר — צריך לדאוג שהמדפסת תצליח להדפיס אותו' },
        ],
    },
    qa: {
        title: 'QA',
        subtitle: 'בודק/ת איכות',
        bullets: [
            'QA פירושו בדיקת איכות (Quality Assurance).',
            'תפקידך לבדוק אם העבודה עומדת בדרישות המשימה.',
            'אתה מחפש טעויות, בעיות או דברים שצריך לשפר.',
            'אחרי הבדיקה, אתה מחליט — לאשר את העבודה או להחזיר לתיקון.',
        ],
        jargon: [
            { term: 'באג', explanation: 'שגיאה או בעיה שנמצאה בעבודה' },
            { term: 'אישור', explanation: 'החלטה שהעבודה עומדת בסטנדרט הנדרש' },
            { term: 'Checklist', explanation: 'רשימת דרישות לבדיקה' },
        ],
    },
    pm: {
        title: 'Editor',
        subtitle: 'עורך/ת — מכין/ה את הקובץ להדפסה',
        bullets: [
            'תפקידך לעבד ולהכין את קובץ המודל להדפסה.',
            'אתה עובד עם ה-Slicer כדי להגדיר איך המדפסת תדפיס את המודל.',
            'אתה קובע הגדרות כמו מהירות, עובי שכבה ומילוי.',
            'אתה מוודא שה-G-code מוכן ושולח להדפסה.',
        ],
        jargon: [
            { term: 'Slicer', explanation: 'תוכנה שמכינה את המודל להדפסה ע"י פריסתו לשכבות' },
            { term: 'G-code', explanation: 'קובץ ההוראות שהמדפסת מבצעת שכבה-שכבה' },
            { term: 'Infill', explanation: 'כמות המילוי הפנימי של המודל, בדרך כלל באחוזים' },
            { term: 'Support', explanation: 'תמיכות זמניות שהמדפסת מוסיפה לאזורים התלויים באוויר' },
        ],
    },
    hardware: {
        title: 'Printer',
        subtitle: 'מפעיל/ת המדפסת',
        bullets: [
            'תפקידך לדאוג לשלב ההדפסה הפיזי.',
            'אתה בודק שהקובץ מוכן, שהמדפסת תקינה ושיש מספיק חומר הדפסה.',
            'אתה מפעיל את המדפסת ועוקב אחרי ההדפסה.',
            'אחרי ההדפסה — אתה בודק אם התוצאה יצאה כמצופה ומדווח לצוות.',
        ],
        jargon: [
            { term: 'פילמנט', explanation: 'חומר הגלם הפלסטי שמוזן למדפסת' },
            { term: 'כיול', explanation: 'הגדרת המדפסת כך שהיא תדפיס בדיוק במקום הנכון' },
            { term: 'Stringing', explanation: 'חוטי פלסטיק דקים שנוצרים בטעות בין חלקי המודל' },
            { term: 'Bed Adhesion', explanation: 'הדבקת שכבת ההדפסה הראשונה למשטח — חשוב מאוד להצלחת ההדפסה' },
        ],
    },
};

export function getRoleInfo(roleKey: string): RoleInfo | null {
    return ROLE_INFO[roleKey] ?? null;
}
