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
    id: string; name: string; email: string;
    current_team_id: string | null; current_role: string | null; account_type?: string;
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
    login({ id: u.id, name: u.name, email: u.email, currentTeamId: u.current_team_id, currentRole: u.current_role as UserRole | null });
    await router.push(u.account_type === 'teacher' || u.account_type === 'admin' ? '/teacher' : '/student');
}

function closeModal() { if (!selecting.value) loginView.value = 'closed'; }

// ── Typed text animation ────────────────────────────────────────────────
const roles = ['מפתח/ת', 'מעצב/ת', 'QA', 'מנהל מדפסת'];
const typedRole = ref(roles[0]);
const typedIdx = ref(0);
const typedVisible = ref(true);

onMounted(() => {
    // Typed role cycling
    setInterval(() => {
        typedVisible.value = false;
        setTimeout(() => {
            typedIdx.value = (typedIdx.value + 1) % roles.length;
            typedRole.value = roles[typedIdx.value];
            typedVisible.value = true;
        }, 300);
    }, 2200);

    // Scroll-reveal
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal-in');
                    const kids = entry.target.querySelectorAll('[data-stagger]');
                    kids.forEach((el, i) => {
                        (el as HTMLElement).style.transitionDelay = `${i * 100}ms`;
                        el.classList.add('reveal-in');
                    });
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.12 }
    );
    document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));

    // Chat demo
    startChatLoop();

    // Mission cycle
    setInterval(() => {
        const idx = missionTeams.value.findIndex(t => t.status === 'idle');
        if (idx !== -1) {
            missionTeams.value[idx].status = 'active';
        } else {
            missionTeams.value = [
                { name: 'צוות אלפא', status: 'active' },
                { name: 'צוות ביתא', status: 'idle' },
                { name: 'צוות גמא',  status: 'completed' },
            ];
        }
    }, 2600);

    // Alert demo
    startAlertLoop();
});

// ── Animated chat demo ──────────────────────────────────────────────────
const chatMessages = [
    { from: 'bot', text: 'שים לב — ה-PR שלך עדיין ב-review. אחרי שה-CI יעבור תוכל לעשות merge לענף הראשי.' },
    { from: 'user', text: 'מה זה CI בכלל?' },
    { from: 'bot', text: 'Continuous Integration — תהליך שמריץ טסטים אוטומטיים על כל קוד שמועלה ל-repo כדי לוודא שהכל תקין.' },
];
const visibleChat = ref<number[]>([]);

function startChatLoop() {
    visibleChat.value = [];
    chatMessages.forEach((_, i) => {
        setTimeout(() => visibleChat.value.push(i), i * 1200 + 400);
    });
    setTimeout(() => startChatLoop(), chatMessages.length * 1200 + 3000);
}

// ── Board columns data ──────────────────────────────────────────────────
const boardCols = [
    {
        label: 'לביצוע', color: 'bg-gray-100 text-gray-600',
        tasks: [
            { title: 'עיצוב מסך הגדרות', tag: 'Design', tagColor: 'bg-blue-100 text-blue-700' },
            { title: 'כתיבת טסטים ל-API', tag: 'QA', tagColor: 'bg-amber-100 text-amber-700' },
        ],
    },
    {
        label: 'בעבודה', color: 'bg-amber-100 text-amber-700',
        tasks: [
            { title: 'בניית קומפוננטת Login', tag: 'Dev', tagColor: 'bg-violet-100 text-violet-700' },
        ],
    },
    {
        label: 'הושלם', color: 'bg-emerald-100 text-emerald-700',
        tasks: [
            { title: 'הגדרת DB Schema', tag: 'Dev', tagColor: 'bg-violet-100 text-violet-700' },
            { title: 'מיפוי דרישות', tag: 'PM', tagColor: 'bg-rose-100 text-rose-700' },
        ],
    },
];

// ── Mock student profiles for analytics demo ────────────────────────────
const demoStudents = [
    { name: 'נועה כהן', jargon: 78, soft: 65, alert: 'none' as const },
    { name: 'יובל לוי', jargon: 34, soft: 42, alert: 'high' as const },
    { name: 'מאיה ברק', jargon: 61, soft: 80, alert: 'medium' as const },
    { name: 'עמית דוד', jargon: 88, soft: 72, alert: 'none' as const },
];

function scoreColor(s: number) { return s >= 70 ? 'text-emerald-600' : s >= 40 ? 'text-amber-500' : 'text-red-500'; }
function scoreBar(s: number) { return s >= 70 ? 'bg-emerald-400' : s >= 40 ? 'bg-amber-400' : 'bg-red-400'; }
function alertCls(a: string) {
    if (a === 'high')   return { cls: 'bg-red-50 border-red-200 text-red-700', dot: 'bg-red-500', label: 'דורש תשומת לב' };
    if (a === 'medium') return { cls: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-400', label: 'בדוק/י' };
    return null;
}

// ── Teacher mission demo — cycling status ───────────────────────────────
const missionTeams = ref([
    { name: 'צוות אלפא', status: 'active'    as 'idle'|'active'|'completed' },
    { name: 'צוות ביתא', status: 'idle'      as 'idle'|'active'|'completed' },
    { name: 'צוות גמא',  status: 'completed' as 'idle'|'active'|'completed' },
]);

const missionStatusConfig = {
    idle:      { label: 'לא התחיל', cls: 'bg-gray-100 text-gray-500',    btn: 'bg-[#3CC2EE] text-white',  btnLabel: 'פתח לצוות' },
    active:    { label: 'פעיל',      cls: 'bg-emerald-100 text-emerald-700', btn: 'bg-rose-500 text-white',   btnLabel: 'סגור' },
    completed: { label: 'הושלם',    cls: 'bg-cyan-100 text-cyan-700',     btn: 'bg-amber-500 text-white',  btnLabel: 'פתח מחדש' },
};

// ── Teacher alerts demo ─────────────────────────────────────────────────
const alertDemo = ref<Array<{id:number; name:string; type:string; msg:string; read:boolean}>>([]);
const alertPool = [
    { id:1, name:'יובל לוי',   type:'תקוע',  msg:'לא השלים אף משימה ב-48 שעות האחרונות' },
    { id:2, name:'רוני שרון',  type:'פערים', msg:'ציון הז\'רגון ירד מ-61 ל-34 — נושא: Git' },
    { id:3, name:'ליאל גבאי',  type:'תקוע',  msg:'שואל את DUDE על אותו נושא בפעם ה-5' },
];

function startAlertLoop() {
    alertDemo.value = [];
    alertPool.forEach((a, i) => {
        setTimeout(() => alertDemo.value.push({ ...a, read: false }), i * 1100 + 300);
    });
    setTimeout(() => {
        alertDemo.value = alertDemo.value.map(a => ({ ...a, read: true }));
        setTimeout(startAlertLoop, 1800);
    }, alertPool.length * 1100 + 2200);
}

const techStack = [
    { name: 'NestJS',      color: 'text-red-600',     icon: `<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>` },
    { name: 'Nuxt 3',      color: 'text-emerald-600',  icon: `<path d="M12 2L2 19h20L12 2z"/>` },
    { name: 'Supabase',    color: 'text-emerald-500',  icon: `<path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C.33 12.57.696 13.5 1.369 13.5h9.136l.536 9.542c.015.986 1.26 1.41 1.874.637l9.261-11.652c.434-.52.068-1.447-.604-1.447h-9.173L11.9 1.036z"/>` },
    { name: 'Gemini API',  color: 'text-blue-500',     icon: `<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>` },
    { name: 'Tailwind CSS', color: 'text-cyan-500',    icon: `<path d="M12 6C9.33 6 7.67 7.33 7 10c1-1.33 2.17-1.83 3.5-1.5.76.19 1.31.74 1.91 1.35C13.37 10.8 14.33 12 16 12c2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.3-.74-1.91-1.35C14.63 7.2 13.67 6 12 6zm-5 6c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.3.74 1.91 1.35C8.37 16.8 9.33 18 11 18c2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.3-.74-1.91-1.35C13.63 13.2 12.67 12 11 12z"/>` },
];
</script>

<template>
    <div class="min-h-screen bg-[#F8FAFC] font-[Heebo]" dir="rtl">

        <!-- ══════════════════════════════════════════════════════════════
             HEADER
        ══════════════════════════════════════════════════════════════ -->
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
                <button class="px-4 py-1.5 text-sm font-semibold text-gray-600 hover:text-[#3CC2EE] transition-colors cursor-pointer" @click="loginView = 'students'">
                    כניסה כתלמיד
                </button>
                <button class="px-4 py-1.5 bg-[#3CC2EE] hover:bg-[#2ba9d4] text-white text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer" @click="loginView = 'teachers'">
                    כניסה כמורה
                </button>
            </div>
        </header>

        <!-- ══════════════════════════════════════════════════════════════
             HERO
        ══════════════════════════════════════════════════════════════ -->
        <section class="relative overflow-hidden px-6 pt-16 pb-20 flex flex-col lg:flex-row items-center justify-center gap-12 max-w-6xl mx-auto">
            <!-- Blobs -->
            <div class="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#3CC2EE]/10 blur-3xl animate-pulse pointer-events-none" style="animation-duration:5s" />
            <div class="absolute -bottom-32 -left-32 w-[450px] h-[450px] rounded-full bg-violet-400/8 blur-3xl animate-pulse pointer-events-none" style="animation-duration:7s" />

            <!-- Text side -->
            <div class="relative z-10 flex-1 text-right max-w-xl">
                <!-- Logo -->
                <div class="inline-flex bg-white rounded-2xl px-4 py-2.5 shadow-md border border-gray-100 mb-6">
                    <img :src="TS_LOGO_URL" alt="TechSchool" class="h-9 object-contain" referrerpolicy="no-referrer" />
                </div>

                <!-- Live badge -->
                <div class="flex justify-end mb-4">
                    <span class="inline-flex items-center gap-1.5 bg-[#3CC2EE]/10 border border-[#3CC2EE]/30 text-[#2ba9d4] px-3.5 py-1 rounded-full text-xs font-bold">
                        <span class="w-1.5 h-1.5 rounded-full bg-[#3CC2EE] animate-pulse" />
                        פלטפורמת סימולציה מקצועית
                    </span>
                </div>

                <!-- Headline with typed role -->
                <h1 class="text-4xl sm:text-5xl font-black text-gray-900 leading-tight tracking-tight mb-2">
                    כל תלמיד הוא
                </h1>
                <h1 class="text-4xl sm:text-5xl font-black leading-tight tracking-tight mb-5">
                    <span
                        class="text-[#3CC2EE] inline-block transition-all duration-300"
                        :class="typedVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'"
                    >{{ typedRole }}</span>
                    <span class="text-[#3CC2EE] animate-blink">|</span>
                    <span class="text-gray-900"> אמיתי</span>
                </h1>

                <p class="text-base text-gray-500 leading-relaxed mb-8 max-w-lg">
                    סימולציית עבודה בהייטק — שבה כל תלמיד חווה תפקיד אמיתי, עובד בצוות, ומפתח כישורים מקצועיים בדרך הכי טבעית שיש.
                </p>

                <!-- CTAs -->
                <div class="flex flex-col sm:flex-row gap-3 justify-end">
                    <button
                        class="flex items-center justify-center gap-2.5 px-6 py-3 bg-[#3CC2EE] hover:bg-[#2ba9d4] text-white font-bold rounded-2xl shadow-lg shadow-[#3CC2EE]/25 transition-all hover:-translate-y-0.5 cursor-pointer text-sm"
                        @click="loginView = 'students'"
                    >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        כניסה כתלמיד
                    </button>
                    <button
                        class="flex items-center justify-center gap-2.5 px-6 py-3 bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-[#3CC2EE]/40 text-gray-700 font-bold rounded-2xl shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer text-sm"
                        @click="loginView = 'teachers'"
                    >
                        <svg class="w-4 h-4 text-[#3CC2EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                        כניסה כמורה
                    </button>
                </div>
            </div>

            <!-- Floating dashboard mockup -->
            <div class="relative z-10 shrink-0 w-72 animate-float select-none">
                <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
                    <!-- Mini header -->
                    <div class="bg-[#3CC2EE] px-4 py-3 flex items-center gap-2">
                        <div class="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                            <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                        </div>
                        <span class="text-white text-xs font-bold">SprintUp Dashboard</span>
                        <div class="mr-auto flex gap-1">
                            <span class="w-2 h-2 rounded-full bg-white/40" />
                            <span class="w-2 h-2 rounded-full bg-white/40" />
                            <span class="w-2 h-2 rounded-full bg-white/60" />
                        </div>
                    </div>
                    <!-- Content -->
                    <div class="p-4 flex flex-col gap-3">
                        <!-- Role badge -->
                        <div class="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
                            <div class="w-7 h-7 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
                                <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                            <div>
                                <p class="text-[10px] text-violet-500 font-bold">התפקיד שלי</p>
                                <p class="text-xs font-bold text-violet-900">מעצב/ת UI</p>
                            </div>
                        </div>
                        <!-- Sprint progress -->
                        <div class="bg-gray-50 rounded-xl p-3">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[10px] text-gray-500 font-semibold">ספרינט 2 — שבוע 3</span>
                                <span class="text-[10px] font-bold text-emerald-600">72%</span>
                            </div>
                            <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div class="h-full w-[72%] bg-gradient-to-r from-[#3CC2EE] to-emerald-400 rounded-full" />
                            </div>
                        </div>
                        <!-- Task cards -->
                        <div class="flex flex-col gap-1.5">
                            <div class="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                                <span class="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                <span class="text-[10px] text-amber-800 font-medium truncate">עיצוב מסך הגדרות</span>
                                <span class="mr-auto text-[9px] text-amber-500 font-bold shrink-0">In Progress</span>
                            </div>
                            <div class="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                                <svg class="w-3 h-3 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                <span class="text-[10px] text-emerald-800 font-medium truncate">מיפוי דרישות</span>
                                <span class="mr-auto text-[9px] text-emerald-500 font-bold shrink-0">Done</span>
                            </div>
                        </div>
                        <!-- Score -->
                        <div class="flex gap-2">
                            <div class="flex-1 bg-cyan-50 rounded-xl p-2 text-center">
                                <p class="text-lg font-black text-[#3CC2EE]">74</p>
                                <p class="text-[9px] text-gray-400 font-medium">ז'רגון</p>
                            </div>
                            <div class="flex-1 bg-violet-50 rounded-xl p-2 text-center">
                                <p class="text-lg font-black text-violet-600">81</p>
                                <p class="text-[9px] text-gray-400 font-medium">כישורים</p>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Shadow -->
                <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 w-48 h-6 bg-[#3CC2EE]/20 rounded-full blur-xl" />
            </div>
        </section>

        <!-- ══════════════════════════════════════════════════════════════
             HOW IT WORKS — 3 steps
        ══════════════════════════════════════════════════════════════ -->
        <section class="px-6 py-20 max-w-5xl mx-auto" data-reveal>
            <div class="text-center mb-12" data-stagger>
                <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">תהליך</span>
                <h2 class="text-3xl font-black text-gray-900 mt-1">כך זה עובד</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                <!-- connector lines (desktop only) -->
                <div class="hidden md:block absolute top-9 right-[calc(33%-12px)] w-[calc(34%+24px)] h-px bg-gradient-to-l from-[#3CC2EE]/40 to-transparent" />
                <div class="hidden md:block absolute top-9 right-[calc(66%-12px)] w-[calc(34%+24px)] h-px bg-gradient-to-l from-violet-400/40 to-transparent" />

                <div v-for="(step, i) in [
                    { n:'01', title:'המורה פותח ספרינט', desc:'בחירת אתגר ושיבוץ תפקידים לכל חבר צוות', color:'bg-[#3CC2EE]', icon:'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
                    { n:'02', title:'התלמיד מקבל תפקיד', desc:'כל תלמיד רואה את תפקידו, המשימות שלו, ולוח הספרינט', color:'bg-violet-500', icon:'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 7 a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
                    { n:'03', title:'DUDE מנחה בזמן אמת', desc:'הבוט מדבר בז\'רגון מקצועי, עונה לשאלות, ומדווח למורה', color:'bg-emerald-500', icon:'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
                ]" :key="i"
                    class="flex flex-col items-center text-center gap-4 reveal-child"
                    data-stagger
                >
                    <div :class="['w-18 h-18 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg', step.color]">
                        <svg class="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" v-html="`<path d='${step.icon}'/>`" />
                    </div>
                    <div>
                        <span class="text-[10px] font-black text-[#3CC2EE] tracking-widest">{{ step.n }}</span>
                        <h3 class="font-bold text-gray-900 text-base mt-0.5">{{ step.title }}</h3>
                        <p class="text-sm text-gray-500 mt-1 leading-relaxed">{{ step.desc }}</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ══════════════════════════════════════════════════════════════
             DUDE CHAT DEMO — "הצ'אט שמלמד בלי ללמד"
        ══════════════════════════════════════════════════════════════ -->
        <section class="px-6 py-20 max-w-6xl mx-auto" data-reveal>
            <div class="flex flex-col lg:flex-row items-center gap-12">

                <!-- LEFT: animated chat -->
                <div class="w-full lg:w-96 shrink-0" data-stagger>
                    <div class="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                        <!-- Chat header -->
                        <div class="flex items-center gap-2.5 px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center">
                                <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                            </div>
                            <div>
                                <p class="text-xs font-bold text-gray-800">DUDE Bot</p>
                                <p class="text-[10px] text-emerald-500 font-semibold">מחובר · Gemini AI</p>
                            </div>
                            <div class="mr-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        </div>

                        <!-- Messages -->
                        <div class="p-4 flex flex-col gap-2.5 min-h-[200px]">
                            <TransitionGroup name="chat">
                                <div
                                    v-for="(msg, i) in chatMessages.filter((_, idx) => visibleChat.includes(idx))"
                                    :key="i"
                                    :class="[
                                        'max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed transition-all duration-400',
                                        msg.from === 'bot'
                                            ? 'bg-gray-100 text-gray-800 self-start rounded-tr-sm'
                                            : 'bg-[#3CC2EE]/15 text-[#1a8aaa] self-end rounded-tl-sm text-left'
                                    ]"
                                >
                                    {{ msg.text }}
                                </div>
                            </TransitionGroup>
                            <!-- Typing indicator -->
                            <div
                                v-if="visibleChat.length > 0 && visibleChat.length < chatMessages.length"
                                class="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-2xl rounded-tr-sm self-start"
                            >
                                <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style="animation-delay:0ms" />
                                <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style="animation-delay:150ms" />
                                <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style="animation-delay:300ms" />
                            </div>
                        </div>

                        <!-- Input mockup -->
                        <div class="px-4 pb-4">
                            <div class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                                <span class="text-xs text-gray-300 flex-1">שאל/י את DUDE...</span>
                                <div class="w-6 h-6 rounded-lg bg-[#3CC2EE] flex items-center justify-center">
                                    <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- RIGHT: explanation -->
                <div class="flex-1 text-right" data-stagger>
                    <span class="inline-flex items-center gap-2 text-xs font-bold text-[#3CC2EE] uppercase tracking-widest mb-3">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        AI צ'אט
                    </span>
                    <h2 class="text-3xl font-black text-gray-900 mb-4">הצ'אט שמלמד<br>בלי ללמד</h2>
                    <ul class="flex flex-col gap-3">
                        <li v-for="b in [
                            'DUDE מדבר בז\'רגון מקצועי אמיתי — Git, PR, CI/CD, Sprint',
                            'כל שאלה של התלמיד היא הזדמנות ללמד מושג חדש',
                            'הלקסיקון המקצועי של התלמיד גדל אוטומטית עם הזמן',
                            'הצ\'אט מנחה, מעודד, ומדווח למורה בזמן אמת',
                        ]" :key="b"
                            class="flex items-start gap-2.5 text-sm text-gray-600"
                        >
                            <span class="mt-0.5 w-5 h-5 rounded-full bg-[#3CC2EE]/15 flex items-center justify-center shrink-0">
                                <svg class="w-3 h-3 text-[#3CC2EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            </span>
                            {{ b }}
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <!-- ══════════════════════════════════════════════════════════════
             MONDAY BOARD DEMO
        ══════════════════════════════════════════════════════════════ -->
        <section class="px-4 py-20 bg-gray-900 rounded-3xl mx-4 mb-4" data-reveal>
            <div class="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12">

                <!-- LEFT: explanation -->
                <div class="flex-1 text-right" data-stagger>
                    <span class="inline-flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                        לוח משימות
                    </span>
                    <h2 class="text-3xl font-black text-white mb-4">לוח משימות<br>כמו בהייטק האמיתי</h2>
                    <ul class="flex flex-col gap-3">
                        <li v-for="b in [
                            'ממשק בסגנון Monday.com — Todo, In Progress, Done',
                            'כל תלמיד רואה את המשימות של הצוות כולו',
                            'מעקב סטטוס, תגיות תפקיד, ועדיפות',
                            'המורה יכול לפתוח ולסגור ספרינטים בכל רגע',
                        ]" :key="b"
                            class="flex items-start gap-2.5 text-sm text-gray-400"
                        >
                            <span class="mt-0.5 w-5 h-5 rounded-full bg-amber-400/15 flex items-center justify-center shrink-0">
                                <svg class="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            </span>
                            {{ b }}
                        </li>
                    </ul>
                </div>

                <!-- RIGHT: mini board -->
                <div class="shrink-0 w-full lg:w-auto" data-stagger>
                    <div class="bg-[#1a1f2e] rounded-2xl border border-white/10 p-4 flex gap-3 overflow-x-auto">
                        <div v-for="col in boardCols" :key="col.label" class="flex flex-col gap-2 min-w-[140px]">
                            <!-- Column header -->
                            <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg mb-1">
                                <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full', col.color]">{{ col.label }}</span>
                                <span class="text-[10px] font-bold text-gray-300">{{ col.tasks.length }}</span>
                            </div>
                            <!-- Task cards -->
                            <div v-for="task in col.tasks" :key="task.title"
                                class="bg-white/5 border border-white/10 rounded-xl p-2.5 flex flex-col gap-1.5 hover:bg-white/10 transition-colors">
                                <p class="text-[11px] text-white font-medium leading-snug">{{ task.title }}</p>
                                <span :class="['text-[9px] font-bold px-1.5 py-0.5 rounded-full self-start', task.tagColor]">{{ task.tag }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ══════════════════════════════════════════════════════════════
             TEACHER ANALYTICS DEMO
        ══════════════════════════════════════════════════════════════ -->
        <section class="px-6 py-20 max-w-6xl mx-auto" data-reveal>
            <div class="text-center mb-12" data-stagger>
                <span class="inline-flex items-center gap-2 text-xs font-bold text-[#3CC2EE] uppercase tracking-widest mb-3">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    למורה
                </span>
                <h2 class="text-3xl font-black text-gray-900">אנליזה מעמיקה על כל תלמיד</h2>
                <p class="text-gray-500 mt-2 max-w-lg mx-auto">DUDE Insights — פרופיל למידה אישי עם ציונים, נושאי קושי, והתראות</p>
            </div>

            <!-- Analytics mockup -->
            <div class="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden" data-stagger>
                <!-- Mock header bar -->
                <div class="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
                    <span class="font-bold text-sm text-gray-900">DUDE Insights</span>
                    <span class="text-xs text-gray-400 bg-white border border-gray-200 px-3 py-1 rounded-full">{{ demoStudents.length }} פרופילים</span>
                    <div class="mr-auto flex items-center gap-1.5 text-xs text-gray-400">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                        רענון אחרון: עכשיו
                    </div>
                </div>

                <!-- Student rows -->
                <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                        v-for="s in demoStudents"
                        :key="s.name"
                        class="bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4 transition-all hover:shadow-md"
                        :class="s.alert === 'high' ? 'border-red-200' : s.alert === 'medium' ? 'border-amber-200' : 'border-gray-200'"
                    >
                        <!-- Avatar -->
                        <div
                            class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm"
                            :class="s.alert === 'high' ? 'bg-gradient-to-br from-red-400 to-rose-500' : s.alert === 'medium' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-[#3CC2EE] to-cyan-600'"
                        >
                            {{ s.name.charAt(0) }}
                        </div>

                        <!-- Info -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <p class="font-semibold text-gray-800 text-sm">{{ s.name }}</p>
                                <span
                                    v-if="alertCls(s.alert)"
                                    :class="['inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', alertCls(s.alert)!.cls]"
                                >
                                    <span :class="['w-1.5 h-1.5 rounded-full shrink-0', alertCls(s.alert)!.dot]" />
                                    {{ alertCls(s.alert)!.label }}
                                </span>
                            </div>
                            <!-- Scores -->
                            <div class="flex items-center gap-3 mt-2">
                                <div class="flex items-center gap-1.5">
                                    <span class="text-[10px] text-gray-400 font-medium">ז'רגון</span>
                                    <span :class="['text-sm font-bold', scoreColor(s.jargon)]">{{ s.jargon }}</span>
                                    <div class="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                                        <div :class="['h-full rounded-full', scoreBar(s.jargon)]" :style="`width:${s.jargon}%`" />
                                    </div>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span class="text-[10px] text-gray-400 font-medium">כישורים</span>
                                    <span :class="['text-sm font-bold', scoreColor(s.soft)]">{{ s.soft }}</span>
                                    <div class="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                                        <div :class="['h-full rounded-full', scoreBar(s.soft)]" :style="`width:${s.soft}%`" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Arrow -->
                        <svg class="w-4 h-4 text-gray-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                    </div>
                </div>
            </div>
        </section>

        <!-- ══════════════════════════════════════════════════════════════
             TEACHER: MISSION CONTROL DEMO
        ══════════════════════════════════════════════════════════════ -->
        <section class="px-6 py-20 max-w-6xl mx-auto" data-reveal>
            <div class="flex flex-col lg:flex-row items-center gap-12">

                <!-- LEFT: explanation -->
                <div class="flex-1 text-right" data-stagger>
                    <span class="inline-flex items-center gap-2 text-xs font-bold text-[#3CC2EE] uppercase tracking-widest mb-3">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                        ניהול ספרינטים
                    </span>
                    <h2 class="text-3xl font-black text-gray-900 mb-4">שליטה מלאה<br>על כל ספרינט</h2>
                    <ul class="flex flex-col gap-3">
                        <li v-for="b in [
                            'פתיחה וסגירה של ספרינטים לכל צוות בנפרד',
                            'מעקב סטטוס בזמן אמת — פעיל, הושלם, לא התחיל',
                            'שיבוץ תפקידים: מפתח, מעצב, QA, מנהל מדפסת',
                            'פתיחה מחדש של ספרינט אם הצוות צריך עוד זמן',
                        ]" :key="b" class="flex items-start gap-2.5 text-sm text-gray-600">
                            <span class="mt-0.5 w-5 h-5 rounded-full bg-[#3CC2EE]/15 flex items-center justify-center shrink-0">
                                <svg class="w-3 h-3 text-[#3CC2EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            </span>
                            {{ b }}
                        </li>
                    </ul>
                </div>

                <!-- RIGHT: mission card mockup -->
                <div class="w-full lg:w-[420px] shrink-0" data-stagger>
                    <div class="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                        <!-- Card header -->
                        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/50">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <svg class="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/>
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-sm font-bold text-gray-900">ספרינט 2 — שבוע 3</p>
                                    <p class="text-[10px] text-gray-400">בניית ממשק משתמש</p>
                                </div>
                            </div>
                            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">פעיל</span>
                        </div>

                        <!-- Teams list -->
                        <div class="p-4 flex flex-col gap-2.5">
                            <TransitionGroup name="mission">
                                <div
                                    v-for="team in missionTeams"
                                    :key="team.name"
                                    class="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 transition-all duration-500"
                                >
                                    <!-- Team icon -->
                                    <div class="w-7 h-7 rounded-full bg-[#3CC2EE]/10 flex items-center justify-center shrink-0">
                                        <svg class="w-3.5 h-3.5 text-[#3CC2EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                            <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                                        </svg>
                                    </div>

                                    <!-- Name + status -->
                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm font-semibold text-gray-800">{{ team.name }}</p>
                                        <span :class="['text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide', missionStatusConfig[team.status].cls]">
                                            {{ missionStatusConfig[team.status].label }}
                                        </span>
                                    </div>

                                    <!-- Action button -->
                                    <button :class="['text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0', missionStatusConfig[team.status].btn]">
                                        {{ missionStatusConfig[team.status].btnLabel }}
                                    </button>
                                </div>
                            </TransitionGroup>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ══════════════════════════════════════════════════════════════
             TEACHER: SMART ALERTS DEMO
        ══════════════════════════════════════════════════════════════ -->
        <section class="px-4 py-20 bg-gray-900 rounded-3xl mx-4 mb-4" data-reveal>
            <div class="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12">

                <!-- LEFT: alert panel mockup -->
                <div class="w-full lg:w-[420px] shrink-0 order-2 lg:order-1" data-stagger>
                    <div class="bg-[#1a1f2e] rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                        <!-- Panel header -->
                        <div class="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/10 bg-white/5">
                            <div class="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
                                <svg class="w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                                </svg>
                            </div>
                            <span class="text-sm font-bold text-white">התראות פעילות</span>
                            <span class="mr-auto text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full">
                                {{ alertDemo.filter(a => !a.read).length }} חדשות
                            </span>
                        </div>

                        <!-- Alerts list -->
                        <div class="p-3 flex flex-col gap-2 min-h-[200px]">
                            <TransitionGroup name="alert-item">
                                <div
                                    v-for="alert in alertDemo"
                                    :key="alert.id"
                                    class="flex items-start gap-2.5 rounded-xl px-3 py-2.5 border transition-all duration-500"
                                    :class="alert.read
                                        ? 'bg-white/3 border-white/5 opacity-40'
                                        : 'bg-red-500/10 border-red-500/25'"
                                >
                                    <!-- Type badge -->
                                    <span class="mt-0.5 text-[9px] font-black px-2 py-1 rounded-lg shrink-0"
                                        :class="alert.read ? 'bg-white/10 text-gray-400' : 'bg-red-500/20 text-red-300'">
                                        {{ alert.type }}
                                    </span>

                                    <!-- Content -->
                                    <div class="flex-1 min-w-0">
                                        <p class="text-xs font-bold leading-tight"
                                            :class="alert.read ? 'text-gray-500' : 'text-white'">
                                            {{ alert.name }}
                                        </p>
                                        <p class="text-[10px] leading-relaxed mt-0.5"
                                            :class="alert.read ? 'text-gray-600' : 'text-gray-300'">
                                            {{ alert.msg }}
                                        </p>
                                    </div>

                                    <!-- Read indicator -->
                                    <div class="shrink-0 mt-0.5">
                                        <svg v-if="alert.read" class="w-3.5 h-3.5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                        <span v-else class="block w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                    </div>
                                </div>
                            </TransitionGroup>

                            <!-- Empty state -->
                            <div v-if="alertDemo.length === 0" class="flex items-center justify-center py-8 text-gray-600 text-xs">
                                אין התראות חדשות
                            </div>
                        </div>
                    </div>
                </div>

                <!-- RIGHT: explanation -->
                <div class="flex-1 text-right order-1 lg:order-2" data-stagger>
                    <span class="inline-flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-widest mb-3">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        התראות חכמות
                    </span>
                    <h2 class="text-3xl font-black text-white mb-4">לדעת מי נתקע<br>לפני שהוא מוותר</h2>
                    <ul class="flex flex-col gap-3">
                        <li v-for="b in [
                            'DUDE מזהה תלמידים שלא מתקדמים ומדווח בזמן אמת',
                            'כל התראה כוללת שם התלמיד + קישור לפרופיל המלא',
                            'סיווג לפי חומרה — תקוע / פערי ידע / הערה קלה',
                            'סימון כנקרא בלחיצה, או סימון הכל בבת אחת',
                        ]" :key="b" class="flex items-start gap-2.5 text-sm text-gray-400">
                            <span class="mt-0.5 w-5 h-5 rounded-full bg-red-400/15 flex items-center justify-center shrink-0">
                                <svg class="w-3 h-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            </span>
                            {{ b }}
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <!-- ══════════════════════════════════════════════════════════════
             GEMINI / AI SECTION
        ══════════════════════════════════════════════════════════════ -->
        <section class="px-6 py-12 max-w-6xl mx-auto" data-reveal>
            <div class="relative bg-gradient-to-br from-[#3CC2EE]/10 via-blue-50 to-violet-50 rounded-3xl border border-[#3CC2EE]/20 p-10 overflow-hidden">
                <div class="absolute inset-0 opacity-20" style="background: radial-gradient(ellipse at 70% 50%, rgba(60,194,238,0.3) 0%, transparent 70%)" />
                <div class="relative z-10 flex flex-col lg:flex-row items-center gap-10" data-stagger>
                    <div class="flex-1 text-right">
                        <div class="inline-flex items-center gap-2 bg-emerald-100 border border-emerald-200 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-bold mb-4">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            מאושר למשרד החינוך מכיתה ז׳ ומעלה
                        </div>
                        <h2 class="text-2xl font-black text-gray-900 mb-3">מופעל על ידי Gemini API</h2>
                        <p class="text-gray-600 leading-relaxed max-w-lg">
                            DUDE מבוסס על Gemini API של Google — מאושר לשימוש חינוכי לפי
                            <a href="https://ecat.education.gov.il/toolsandgames?csrt=7622849689745272831#/pageSize=20&viewMode=list&orderBy=20&pageNumber=1"
                                target="_blank" rel="noopener"
                                class="text-[#3CC2EE] underline underline-offset-2 hover:text-[#2ba9d4] font-semibold transition-colors">
                                רשימת כלי AI של משרד החינוך
                            </a>.
                            הבוט מדבר עם התלמיד בז'רגון מקצועי — ומפתח את הלקסיקון שלו בצורה טבעית לחלוטין.
                        </p>
                    </div>
                    <div class="shrink-0 bg-white/90 backdrop-blur rounded-2xl border border-white shadow-lg px-6 py-4 flex items-center gap-4">
                        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center shadow-md">
                            <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        </div>
                        <div>
                            <p class="font-bold text-gray-900 text-sm">DUDE Bot</p>
                            <p class="text-xs text-emerald-600 font-semibold">Powered by Gemini 1.5</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ══════════════════════════════════════════════════════════════
             TECH STACK + FOOTER
        ══════════════════════════════════════════════════════════════ -->
        <section class="px-6 pb-12 max-w-6xl mx-auto">
            <p class="text-center text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">פותח עם</p>
            <div class="flex flex-wrap justify-center gap-3">
                <div v-for="t in techStack" :key="t.name"
                    class="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm hover:shadow-md transition-all">
                    <svg class="w-4 h-4" :class="t.color" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" v-html="t.icon" />
                    <span class="text-sm font-semibold text-gray-700">{{ t.name }}</span>
                </div>
            </div>
        </section>

        <footer class="border-t border-gray-200 px-6 py-8 flex flex-col items-center gap-2">
            <div class="flex items-center gap-2">
                <div class="w-5 h-5 rounded bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center">
                    <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                </div>
                <span class="text-sm font-bold text-gray-700">TeamSprintUp</span>
            </div>
            <p class="text-xs text-gray-400">פותח במסגרת האקתון משהל 2026 · TechSchool</p>
        </footer>

        <!-- ══════════════════════════════════════════════════════════════
             LOGIN MODAL
        ══════════════════════════════════════════════════════════════ -->
        <Teleport to="body">
            <Transition name="modal">
                <div v-if="loginView !== 'closed'" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" @click.self="closeModal">
                    <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" @click="closeModal" />
                    <div class="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" dir="rtl">
                        <div class="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center shrink-0">
                                <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                            <div class="flex-1">
                                <p class="font-bold text-gray-900 text-sm">{{ loginView === 'students' ? 'בחר/י תלמיד' : 'בחר/י מורה' }}</p>
                                <p class="text-xs text-gray-400 mt-0.5">לחץ/י על המשתמש כדי להיכנס</p>
                            </div>
                            <button class="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer" @click="closeModal">
                                <svg class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div class="flex gap-1 px-4 pt-3">
                            <button :class="['flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer', loginView === 'students' ? 'bg-[#3CC2EE]/10 text-[#3CC2EE]' : 'text-gray-400 hover:text-gray-600']" @click="loginView = 'students'">תלמידים</button>
                            <button :class="['flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer', loginView === 'teachers' ? 'bg-[#3CC2EE]/10 text-[#3CC2EE]' : 'text-gray-400 hover:text-gray-600']" @click="loginView = 'teachers'">מורים</button>
                        </div>
                        <div class="overflow-y-auto p-4 flex-1">
                            <div v-if="!filteredUsers.length" class="flex flex-col items-center py-12 text-gray-400">
                                <svg class="w-10 h-10 mb-3 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                <p class="text-sm">אין משתמשים בקטגוריה זו</p>
                            </div>
                            <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <button
                                    v-for="u in filteredUsers" :key="u.id"
                                    :disabled="selecting !== null"
                                    class="group bg-gray-50 hover:bg-[#3CC2EE]/5 border border-gray-200 hover:border-[#3CC2EE]/40 rounded-2xl p-4 flex flex-col items-center gap-2.5 transition-all cursor-pointer disabled:opacity-60 text-center"
                                    :class="{ 'border-[#3CC2EE] bg-[#3CC2EE]/5 scale-95': selecting === u.id }"
                                    @click="selectUser(u)"
                                >
                                    <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center text-white text-lg font-bold shadow-sm select-none">{{ u.name.charAt(0) }}</div>
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
/* Floating hero card */
@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-12px); }
}
.animate-float { animation: float 3.5s ease-in-out infinite; }

/* Blinking cursor */
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
.animate-blink { animation: blink 1s step-end infinite; }

/* Scroll reveal */
[data-reveal], [data-stagger] {
    opacity: 0;
    transform: translateY(28px);
    transition: opacity 0.55s ease, transform 0.55s ease;
}
.reveal-in, [data-reveal].reveal-in, [data-stagger].reveal-in {
    opacity: 1 !important;
    transform: translateY(0) !important;
}

/* Chat message transitions */
.chat-enter-active { transition: all 0.35s cubic-bezier(0.34, 1.4, 0.64, 1); }
.chat-enter-from   { opacity: 0; transform: translateY(10px) scale(0.95); }
.chat-leave-active { transition: all 0.2s ease; }
.chat-leave-to     { opacity: 0; }

/* Mission team transitions */
.mission-enter-active, .mission-leave-active { transition: all 0.4s ease; }
.mission-enter-from, .mission-leave-to { opacity: 0; transform: translateX(12px); }

/* Alert item transitions */
.alert-item-enter-active { transition: all 0.4s cubic-bezier(0.34, 1.4, 0.64, 1); }
.alert-item-enter-from   { opacity: 0; transform: translateY(-8px); }
.alert-item-leave-active { transition: all 0.25s ease; }
.alert-item-leave-to     { opacity: 0; }

/* Login modal */
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-active .relative, .modal-leave-active .relative {
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
}
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .relative, .modal-leave-to .relative { transform: translateY(24px); opacity: 0; }

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
    .animate-float, .animate-blink, [data-reveal], [data-stagger] {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
    }
}
</style>
