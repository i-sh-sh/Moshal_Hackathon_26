<script setup lang="ts">
import type { UserRole } from '~/types/types';
import { useUser } from '~/composables/useUser';
import { DEMO_USERS } from '~/services/demoData';

useHead({ title: 'TeamSprintUp — סימולציית עבודה בהייטק' });

const TS_LOGO_URL =
    'https://il-lms.techschool.org/wp-content/themes/techschool-IL/assets/img/tech_school_logo.png';

const { login } = useUser();
const router = useRouter();

interface ApiUser {
    id: string;
    name: string;
    email: string;
    current_team_id: string | null;
    current_role: string | null;
    account_type?: string;
}

const users = ref<ApiUser[]>([...DEMO_USERS]);
const selecting = ref<string | null>(null);
const loginView = ref<'closed' | 'students' | 'teachers'>('closed');

const filteredUsers = computed(() =>
    loginView.value === 'students'
        ? users.value.filter(u => u.account_type === 'student')
        : loginView.value === 'teachers'
            ? users.value.filter(u => u.account_type === 'teacher' || u.account_type === 'admin')
            : [],
);

async function selectUser(u: ApiUser) {
    selecting.value = u.id;
    login({
        id: u.id,
        name: u.name,
        email: u.email,
        currentTeamId: u.current_team_id,
        currentRole: u.current_role as UserRole | null,
    });
    if (u.account_type === 'teacher' || u.account_type === 'admin') {
        await router.push('/teacher');
    } else {
        await router.push('/student');
    }
}

function closeModal() {
    if (selecting.value) return;
    loginView.value = 'closed';
}

const studentFeatures = [
    {
        title: 'תפקיד מקצועי אמיתי',
        desc: 'כל תלמיד מקבל תפקיד — מפתח, מעצב, QA, או מנהל מדפסת — ועובד בו לאורך כל הספרינט.',
        icon: `<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>`,
        color: 'from-[#3CC2EE] to-cyan-500',
        bg: 'bg-cyan-50',
    },
    {
        title: "צ'אט AI מקצועי",
        desc: 'DUDE, הבוט שמדבר בז\'רגון אמיתי של ההייטק, מסייע לתלמיד ומשדרג בהדרגה את הלקסיקון המקצועי שלו.',
        icon: `<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>`,
        color: 'from-violet-400 to-purple-500',
        bg: 'bg-violet-50',
    },
    {
        title: 'לוח משימות',
        desc: 'משימות צוותיות מנוהלות על לוח בסגנון Monday.com — גרירה, סטטוס, ועדיפות.',
        icon: `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>`,
        color: 'from-amber-400 to-orange-500',
        bg: 'bg-amber-50',
    },
    {
        title: 'ספרינט ולידרבורד',
        desc: 'מעקב נקודות ותחרות בריאה בין הצוותים — מי מסיים קודם? מי מתקדם הכי מהר?',
        icon: `<path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/>`,
        color: 'from-emerald-400 to-teal-500',
        bg: 'bg-emerald-50',
    },
    {
        title: 'מעבדה ומדפסת',
        desc: 'ניהול ציוד פיזי, הזמנת זמן מכונה, ותפעול מדפסת 3D ולייזר קאטר.',
        icon: `<path d="M6 9v11"/><path d="M18 9v11"/><rect x="3" y="3" width="18" height="7" rx="1"/><path d="M6 14h12"/><path d="M6 17h12"/>`,
        color: 'from-rose-400 to-pink-500',
        bg: 'bg-rose-50',
    },
    {
        title: 'לוח אירועים',
        desc: 'כל הדדליינים, ההודעות מהמורה, ואירועי הספרינט במקום אחד.',
        icon: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
        color: 'from-blue-400 to-indigo-500',
        bg: 'bg-blue-50',
    },
];

const teacherFeatures = [
    {
        title: 'ניהול משימות',
        desc: 'פתיחה וסגירה של ספרינטים לכל צוות בנפרד, עם מעקב סטטוס בזמן אמת.',
        icon: `<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>`,
        color: 'from-[#3CC2EE] to-cyan-500',
        bg: 'bg-cyan-50',
    },
    {
        title: 'שיבוץ תפקידים',
        desc: 'הקצאת תפקידים ספציפיים לתלמידים בכל ספרינט מתוך ממשק ניהול פשוט.',
        icon: `<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/>`,
        color: 'from-violet-400 to-purple-500',
        bg: 'bg-violet-50',
    },
    {
        title: 'DUDE Insights',
        desc: 'אנליזה של ציוני ז\'רגון, כישורים רכים, ודפוסי עבודה — לכל תלמיד בנפרד.',
        icon: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
        color: 'from-emerald-400 to-teal-500',
        bg: 'bg-emerald-50',
    },
    {
        title: 'התראות חכמות',
        desc: 'זיהוי אוטומטי של תלמידים שנתקעו, עם קישור ישיר לפרופיל שלהם.',
        icon: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
        color: 'from-rose-400 to-red-500',
        bg: 'bg-rose-50',
    },
    {
        title: 'פרופיל תלמיד',
        desc: 'מעקב אישי עם גרף התקדמות לאורך זמן, מונחים שזוהו, ונושאי קושי.',
        icon: `<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
        color: 'from-amber-400 to-orange-500',
        bg: 'bg-amber-50',
    },
    {
        title: 'Monday Board',
        desc: 'תצוגת כל הצוותים והמשימות שלהם — מי הספיק, מי עדיין עובד, מה תקוע.',
        icon: `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>`,
        color: 'from-blue-400 to-indigo-500',
        bg: 'bg-blue-50',
    },
];

const techStack = [
    { name: 'NestJS', color: 'text-red-600', icon: `<path d="M11.5 2C6.806 2 3 5.806 3 10.5a8.496 8.496 0 005.618 7.958c.041-.017.082-.02.122-.02.144 0 .28.06.373.166a.5.5 0 01.117.415C9.105 19.395 9 19.938 9 20.5c0 .276.224.5.5.5h5c.276 0 .5-.224.5-.5 0-.562-.105-1.105-.23-1.48a.5.5 0 01.117-.415.5.5 0 01.373-.166c.04 0 .081.003.122.02A8.496 8.496 0 0020 10.5C20 5.806 16.194 2 11.5 2z"/>` },
    { name: 'Nuxt 3', color: 'text-emerald-600', icon: `<path d="M12 2L2 19h20L12 2z"/>` },
    { name: 'Supabase', color: 'text-emerald-500', icon: `<path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C.33 12.57.696 13.5 1.369 13.5h9.136l.536 9.542c.015.986 1.26 1.41 1.874.637l9.261-11.652c.434-.52.068-1.447-.604-1.447h-9.173L11.9 1.036z"/>` },
    { name: 'Gemini API', color: 'text-blue-500', icon: `<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>` },
    { name: 'Tailwind CSS', color: 'text-cyan-500', icon: `<path d="M12 6C9.33 6 7.67 7.33 7 10c1-1.33 2.17-1.83 3.5-1.5.76.19 1.31.74 1.91 1.35C13.37 10.8 14.33 12 16 12c2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.3-.74-1.91-1.35C14.63 7.2 13.67 6 12 6zm-5 6c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.3.74 1.91 1.35C8.37 16.8 9.33 18 11 18c2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.3-.74-1.91-1.35C13.63 13.2 12.67 12 11 12z"/>` },
];
</script>

<template>
    <div class="min-h-screen bg-[#F8FAFC] font-[Heebo]" dir="rtl">

        <!-- ── Sticky header ────────────────────────────────────────── -->
        <header class="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200/70 px-6 h-14 flex items-center gap-3">
            <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center shadow-sm">
                    <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                </div>
                <span class="font-extrabold text-gray-900 text-sm tracking-tight">TeamSprintUp</span>
            </div>
            <div class="flex-1" />
            <div class="flex items-center gap-2">
                <button
                    class="px-4 py-1.5 text-sm font-semibold text-gray-600 hover:text-[#3CC2EE] transition-colors cursor-pointer"
                    @click="loginView = 'students'"
                >
                    כניסה כתלמיד
                </button>
                <button
                    class="px-4 py-1.5 bg-[#3CC2EE] hover:bg-[#2ba9d4] text-white text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                    @click="loginView = 'teachers'"
                >
                    כניסה כמורה
                </button>
            </div>
        </header>

        <!-- ── Hero ───────────────────────────────────────────────────── -->
        <section class="relative overflow-hidden px-6 pt-20 pb-24 flex flex-col items-center text-center">
            <!-- Animated blobs -->
            <div class="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#3CC2EE]/15 blur-3xl animate-pulse" style="animation-duration:4s" />
            <div class="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full bg-violet-400/10 blur-3xl animate-pulse" style="animation-duration:6s" />
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-cyan-300/8 blur-3xl" />

            <!-- Logo -->
            <div class="relative z-10 bg-white rounded-2xl px-5 py-3 shadow-md mb-6 border border-gray-100">
                <img :src="TS_LOGO_URL" alt="TechSchool" class="h-10 object-contain" referrerpolicy="no-referrer" />
            </div>

            <!-- Badge -->
            <div class="relative z-10 inline-flex items-center gap-2 bg-[#3CC2EE]/10 border border-[#3CC2EE]/30 text-[#2ba9d4] px-4 py-1.5 rounded-full text-xs font-bold mb-6">
                <span class="w-2 h-2 rounded-full bg-[#3CC2EE] animate-pulse" />
                פלטפורמת סימולציה מקצועית לתלמידי TechSchool
            </div>

            <!-- Headline -->
            <h1 class="relative z-10 text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-tight tracking-tight max-w-3xl mb-4">
                ברוכים הבאים ל-<span class="text-[#3CC2EE]">TeamSprintUp</span>
            </h1>

            <!-- Subheadline -->
            <p class="relative z-10 text-lg text-gray-500 max-w-2xl leading-relaxed mb-10">
                סימולציית עבודה בהייטק — שבה כל תלמיד חווה תפקיד אמיתי, עובד בצוות, ומפתח כישורים מקצועיים בדרך הכי טבעית שיש
            </p>

            <!-- CTAs -->
            <div class="relative z-10 flex flex-col sm:flex-row gap-3 items-center justify-center">
                <button
                    class="group flex items-center gap-2.5 px-7 py-3.5 bg-[#3CC2EE] hover:bg-[#2ba9d4] text-white text-base font-bold rounded-2xl shadow-lg shadow-[#3CC2EE]/30 transition-all hover:shadow-[#3CC2EE]/40 hover:-translate-y-0.5 cursor-pointer"
                    @click="loginView = 'students'"
                >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    כניסה כתלמיד
                </button>
                <button
                    class="group flex items-center gap-2.5 px-7 py-3.5 bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-[#3CC2EE]/50 text-gray-700 text-base font-bold rounded-2xl shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer"
                    @click="loginView = 'teachers'"
                >
                    <svg class="w-4 h-4 text-[#3CC2EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                    </svg>
                    כניסה כמורה
                </button>
            </div>

            <!-- Stats row -->
            <div class="relative z-10 mt-14 flex flex-wrap justify-center gap-8">
                <div v-for="s in [{n:'6', label:'תפקידים מקצועיים'},{n:'AI', label:'צ\'אט מקצועי'},{n:'∞', label:'ספרינטים'}]"
                    :key="s.label"
                    class="flex flex-col items-center gap-1"
                >
                    <span class="text-2xl font-black text-[#3CC2EE]">{{ s.n }}</span>
                    <span class="text-xs text-gray-400 font-medium">{{ s.label }}</span>
                </div>
            </div>
        </section>

        <!-- ── Student features ────────────────────────────────────────── -->
        <section class="px-6 py-20 max-w-6xl mx-auto">
            <div class="text-center mb-12">
                <span class="inline-flex items-center gap-2 text-xs font-bold text-[#3CC2EE] uppercase tracking-widest mb-3">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    לתלמיד
                </span>
                <h2 class="text-3xl font-black text-gray-900">מה מקבל התלמיד?</h2>
                <p class="text-gray-500 mt-2 max-w-lg mx-auto">חווית עבודה מקצועית אמיתית — מהרגע הראשון עד סוף הספרינט</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div
                    v-for="f in studentFeatures"
                    :key="f.title"
                    class="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-[#3CC2EE]/30 p-6 flex flex-col gap-3 transition-all duration-200 cursor-default"
                >
                    <div :class="['w-10 h-10 rounded-xl flex items-center justify-center shrink-0', f.bg]">
                        <div :class="['w-5 h-5 bg-gradient-to-br rounded-lg flex items-center justify-center', f.color]">
                            <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" v-html="f.icon" />
                        </div>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-900 text-sm">{{ f.title }}</h3>
                        <p class="text-gray-500 text-xs leading-relaxed mt-1">{{ f.desc }}</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── Teacher features ────────────────────────────────────────── -->
        <section class="px-6 py-20 bg-gray-900 rounded-3xl mx-4 mb-8">
            <div class="max-w-6xl mx-auto">
                <div class="text-center mb-12">
                    <span class="inline-flex items-center gap-2 text-xs font-bold text-[#3CC2EE] uppercase tracking-widest mb-3">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                        </svg>
                        למורה
                    </span>
                    <h2 class="text-3xl font-black text-white">מה מקבל המורה?</h2>
                    <p class="text-gray-400 mt-2 max-w-lg mx-auto">כלי ניהול מלאים ואנליזה עמוקה — בלי לשבור את הראש</p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div
                        v-for="f in teacherFeatures"
                        :key="f.title"
                        class="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#3CC2EE]/40 rounded-2xl p-6 flex flex-col gap-3 transition-all duration-200 cursor-default backdrop-blur-sm"
                    >
                        <div :class="['w-10 h-10 rounded-xl flex items-center justify-center shrink-0', f.bg, 'opacity-90']">
                            <svg class="w-5 h-5" :class="f.color.replace('from-', 'text-').split(' ')[0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" v-html="f.icon" />
                        </div>
                        <div>
                            <h3 class="font-bold text-white text-sm">{{ f.title }}</h3>
                            <p class="text-gray-400 text-xs leading-relaxed mt-1">{{ f.desc }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── AI / Gemini section ──────────────────────────────────── -->
        <section class="px-6 py-20 max-w-6xl mx-auto">
            <div class="relative bg-gradient-to-br from-[#3CC2EE]/10 via-blue-50 to-violet-50 rounded-3xl border border-[#3CC2EE]/20 p-10 overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-full opacity-30"
                    style="background: radial-gradient(ellipse at 70% 50%, rgba(60,194,238,0.2) 0%, transparent 70%)" />

                <div class="relative z-10 flex flex-col lg:flex-row items-center gap-10">
                    <!-- Text -->
                    <div class="flex-1 text-center lg:text-right">
                        <div class="inline-flex items-center gap-2 bg-emerald-100 border border-emerald-200 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-bold mb-4">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            מאושר למשרד החינוך מכיתה ז׳ ומעלה
                        </div>
                        <h2 class="text-2xl font-black text-gray-900 mb-3">מופעל על ידי Gemini API</h2>
                        <p class="text-gray-600 leading-relaxed max-w-lg mx-auto lg:mx-0">
                            DUDE, הבוט החכם של הפלטפורמה, מבוסס על Gemini API של Google — מאושר לשימוש חינוכי לפי רשימת
                            <a href="https://ecat.education.gov.il/toolsandgames?csrt=7622849689745272831#/pageSize=20&viewMode=list&orderBy=20&pageNumber=1"
                                target="_blank" rel="noopener"
                                class="text-[#3CC2EE] underline underline-offset-2 hover:text-[#2ba9d4] font-semibold transition-colors">
                                כלי AI מאושרים של משרד החינוך
                            </a>.
                            הבוט מדבר עם התלמיד בז'רגון מקצועי אמיתי — ובכך מפתח את הלקסיקון שלו בצורה טבעית לחלוטין.
                        </p>
                    </div>

                    <!-- Visual -->
                    <div class="shrink-0 bg-white rounded-2xl border border-gray-200 shadow-lg p-5 w-72 flex flex-col gap-3">
                        <div class="flex items-center gap-2 pb-3 border-b border-gray-100">
                            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center">
                                <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                                </svg>
                            </div>
                            <span class="font-bold text-sm text-gray-900">DUDE Bot</span>
                            <span class="mr-auto text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full font-bold">מחובר</span>
                        </div>
                        <div class="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 leading-relaxed">
                            "שים לב שה-PR שלך עדיין ב-review. צריך לעשות merge אחרי שה-CI עובר ❤️"
                        </div>
                        <div class="bg-[#3CC2EE]/10 rounded-xl p-3 text-xs text-[#2ba9d4] leading-relaxed self-end text-left max-w-[85%]">
                            מה זה CI?
                        </div>
                        <div class="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 leading-relaxed">
                            "Continuous Integration — תהליך אוטומטי שמריץ טסטים על כל קוד שמועלה לריפו..."
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── Tech stack ──────────────────────────────────────────────── -->
        <section class="px-6 pb-16 max-w-6xl mx-auto">
            <p class="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">פותח עם</p>
            <div class="flex flex-wrap justify-center gap-4">
                <div
                    v-for="t in techStack"
                    :key="t.name"
                    class="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all"
                >
                    <svg class="w-4 h-4" :class="t.color" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" v-html="t.icon" />
                    <span class="text-sm font-semibold text-gray-700">{{ t.name }}</span>
                </div>
            </div>
        </section>

        <!-- ── Footer ─────────────────────────────────────────────────── -->
        <footer class="border-t border-gray-200 px-6 py-8 flex flex-col items-center gap-2">
            <div class="flex items-center gap-2">
                <div class="w-5 h-5 rounded bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center">
                    <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                </div>
                <span class="text-sm font-bold text-gray-700">TeamSprintUp</span>
            </div>
            <p class="text-xs text-gray-400">פותח במסגרת האקתון משהל 2026 · TechSchool</p>
        </footer>


        <!-- ── Login Modal ─────────────────────────────────────────────── -->
        <Teleport to="body">
            <Transition name="modal">
                <div
                    v-if="loginView !== 'closed'"
                    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
                    @click.self="closeModal"
                >
                    <!-- Backdrop -->
                    <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" @click="closeModal" />

                    <!-- Panel -->
                    <div class="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" dir="rtl">
                        <!-- Panel header -->
                        <div class="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center shrink-0">
                                <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                </svg>
                            </div>
                            <div class="flex-1">
                                <p class="font-bold text-gray-900 text-sm">
                                    {{ loginView === 'students' ? 'בחר/י תלמיד' : 'בחר/י מורה' }}
                                </p>
                                <p class="text-xs text-gray-400 mt-0.5">לחץ/י על המשתמש כדי להיכנס</p>
                            </div>
                            <button
                                class="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
                                @click="closeModal"
                            >
                                <svg class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>

                        <!-- Tab switcher -->
                        <div class="flex gap-1 px-4 pt-3">
                            <button
                                :class="['flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer', loginView === 'students' ? 'bg-[#3CC2EE]/10 text-[#3CC2EE]' : 'text-gray-400 hover:text-gray-600']"
                                @click="loginView = 'students'"
                            >תלמידים</button>
                            <button
                                :class="['flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer', loginView === 'teachers' ? 'bg-[#3CC2EE]/10 text-[#3CC2EE]' : 'text-gray-400 hover:text-gray-600']"
                                @click="loginView = 'teachers'"
                            >מורים</button>
                        </div>

                        <!-- Users grid -->
                        <div class="overflow-y-auto p-4 flex-1">
                            <div v-if="!filteredUsers.length" class="flex flex-col items-center py-12 text-gray-400">
                                <svg class="w-10 h-10 mb-3 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                </svg>
                                <p class="text-sm">אין משתמשים בקטגוריה זו</p>
                            </div>
                            <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <button
                                    v-for="u in filteredUsers"
                                    :key="u.id"
                                    :disabled="selecting !== null"
                                    class="group bg-gray-50 hover:bg-[#3CC2EE]/5 border border-gray-200 hover:border-[#3CC2EE]/40 rounded-2xl p-4 flex flex-col items-center gap-2.5 transition-all cursor-pointer disabled:opacity-60 text-center"
                                    :class="{ 'border-[#3CC2EE] bg-[#3CC2EE]/5 scale-95': selecting === u.id }"
                                    @click="selectUser(u)"
                                >
                                    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center text-white text-lg font-bold shadow-sm select-none">
                                        {{ u.name.charAt(0) }}
                                    </div>
                                    <div>
                                        <p class="font-semibold text-gray-800 text-sm leading-tight">{{ u.name }}</p>
                                        <p class="text-gray-400 text-[11px] mt-0.5 truncate max-w-[110px]">{{ u.email }}</p>
                                    </div>
                                    <div v-if="selecting === u.id" class="w-4 h-4 border-2 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.2s ease;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
    transform: translateY(24px);
    opacity: 0;
}
</style>
