<script setup lang="ts">
import { DEMO_TEAMS, DEMO_STUDENTS_BY_TEAM, DEMO_MISSIONS } from '~/services/demoData';

useHead({ title: 'ניתוח קבוצה — TeamSprintUp' });

const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

const teamId = route.params.teamId as string;

// ── Static demo data ──────────────────────────────────────────────────────────
const team = DEMO_TEAMS.find((t) => t.id === teamId) ?? null;
const challenge = DEMO_MISSIONS.find((c) => c.id === team?.currentChallengeId) ?? null;
const demoStudents = DEMO_STUDENTS_BY_TEAM[teamId] ?? [];

// ── API response shapes ───────────────────────────────────────────────────────
interface ApiTask {
    id: string;
    title: string;
    status: string;
    assigned_role: string;
    created_at: string;
    updated_at: string;
}

interface ApiStudentInsight {
    userId: string;
    teamId: string | null;
    role: string | null;
    totalActiveTimeSeconds: number;
    totalTasks: number;
    approvedTasks: number;
    riskLevel: 'ok' | 'watch' | 'needs_attention';
    insightReason: string;
}

interface ApiNote {
    id: string;
    team_id: string;
    teacher_id: string | null;
    note: string;
    created_at: string;
}

// ── Reactive state ────────────────────────────────────────────────────────────
const tasks = ref<ApiTask[]>([]);
const studentInsights = ref<ApiStudentInsight[]>([]);
const notes = ref<ApiNote[]>([]);
const newNote = ref('');
const savingNote = ref(false);
const loading = ref(true);

onMounted(async () => {
    await Promise.allSettled([
        $fetch<ApiTask[]>(`${base}/tasks/team/${teamId}`)
            .then((data) => { tasks.value = Array.isArray(data) ? data : []; })
            .catch(() => {}),
        $fetch<{ students: ApiStudentInsight[] }>(`${base}/teams/analytics/teacher-dashboard`)
            .then((data) => {
                studentInsights.value = (data?.students ?? []).filter((s) => s.teamId === teamId);
            })
            .catch(() => {}),
        $fetch<ApiNote[]>(`${base}/teams/${teamId}/notes`)
            .then((data) => { notes.value = Array.isArray(data) ? data : []; })
            .catch(() => {}),
    ]);
    loading.value = false;
});

// ── Role / risk helpers ───────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
    pm: 'Editor',
    qa: 'QA',
    dev: 'Designer',
    hardware: 'Printer',
};

const RISK_LABEL: Record<string, string> = {
    ok: 'תקין',
    watch: 'לשים לב',
    needs_attention: 'דורש התערבות',
};

const RISK_CLS: Record<string, string> = {
    ok: 'bg-emerald-100 text-emerald-700',
    watch: 'bg-amber-100 text-amber-700',
    needs_attention: 'bg-red-100 text-red-700',
};

// ── Analytics computations ────────────────────────────────────────────────────

// Earliest task created_at as sprint-start proxy
const sprintStartMs = computed(() => {
    if (!tasks.value.length) return null;
    const ms = tasks.value.map((t) => new Date(t.created_at).getTime()).filter(isFinite);
    return ms.length ? Math.min(...ms) : null;
});

const taskDuration = computed(() => {
    if (!sprintStartMs.value) return null;
    const diff = Date.now() - sprintStartMs.value;
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return h > 0 ? `${h} שעות ו-${m} דקות` : `${m} דקות`;
});

const taskStartDate = computed(() => {
    if (!sprintStartMs.value) return null;
    return new Date(sprintStartMs.value).toLocaleDateString('he-IL', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
});

const totalTasks = computed(() => tasks.value.length);
const approvedTasks = computed(() => tasks.value.filter((t) => t.status === 'approved').length);
const completionPercent = computed(() =>
    totalTasks.value > 0 ? Math.round((approvedTasks.value / totalTasks.value) * 100) : 0,
);

const statusLabel = computed(() => {
    if (!team) return 'אין נתון זמין';
    if (team.isCompleted) return 'הושלם';
    if (team.sprintStatus === 'idle') return 'לא התחיל';
    return 'בתהליך';
});

const taskBlockedAt = computed(() => {
    if (!tasks.value.length) return 'אין פעולה פתוחה כרגע';
    // Check by priority — most urgent first
    const checks: Array<[string, string]> = [
        ['teacher_review', 'ממתין לאישור מורה'],
        ['pm_review', 'ממתין לאישור Editor (PM)'],
        ['qa_review', 'ממתין לבדיקת QA'],
    ];
    for (const [status, label] of checks) {
        if (tasks.value.some((t) => t.status === status)) return label;
    }
    const pending = tasks.value.find((t) => t.status === 'pending');
    if (pending) return `ממתין להגשה מ-${ROLE_LABELS[pending.assigned_role] ?? pending.assigned_role}`;
    if (tasks.value.every((t) => t.status === 'approved')) return 'כל המשימות אושרו ✓';
    return 'אין פעולה פתוחה כרגע';
});

// ── Per-student rows (merge demo list + backend insights) ─────────────────────
const studentRows = computed(() =>
    demoStudents.map((s) => {
        const insight = studentInsights.value.find((i) => i.userId === s.id);
        const sec = insight?.totalActiveTimeSeconds ?? null;
        const activeTime = sec !== null
            ? sec < 60 ? `${sec} שניות` : `${Math.floor(sec / 60)} דקות`
            : 'אין נתון זמין';
        return {
            id: s.id,
            name: s.name,
            role: s.currentRole ? (ROLE_LABELS[s.currentRole] ?? s.currentRole) : '—',
            activeTime,
            approved: insight ? String(insight.approvedTasks) : 'אין נתון',
            riskLevel: insight?.riskLevel ?? null,
            insightReason: insight?.insightReason ?? null,
        };
    }),
);

// ── Notes ─────────────────────────────────────────────────────────────────────
async function saveNote() {
    if (!newNote.value.trim() || savingNote.value) return;
    savingNote.value = true;
    try {
        const saved = await $fetch<ApiNote>(`${base}/teams/${teamId}/notes`, {
            method: 'POST',
            body: { note: newNote.value.trim() },
        });
        notes.value = [saved, ...notes.value];
        newNote.value = '';
    } catch {
        // fail silently in POC mode
    } finally {
        savingNote.value = false;
    }
}

function formatNoteDate(iso: string) {
    return new Date(iso).toLocaleString('he-IL', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}
</script>

<template>
    <div class="min-h-screen bg-gray-100" dir="rtl">

        <!-- Header -->
        <header class="bg-white border-b border-gray-200 px-6 h-14 flex items-center gap-4">
            <button
                class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                @click="router.push('/teacher')"
            >
                <span>→</span>
                <span>חזור</span>
            </button>
            <div class="w-px h-5 bg-gray-200 shrink-0" />
            <span class="font-bold text-gray-900 text-sm">ניתוח קבוצה</span>
            <span v-if="team" class="text-sm text-gray-500 truncate">— {{ team.name }}</span>
        </header>

        <main class="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">

            <!-- Page title -->
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-black text-gray-900">{{ team?.name ?? 'קבוצה לא נמצאה' }}</h1>
                    <p v-if="challenge" class="text-sm text-gray-500 mt-1">📋 {{ challenge.title }}</p>
                    <p v-else class="text-sm text-gray-400 mt-1">אין אתגר פעיל</p>
                </div>
                <span
                    v-if="team"
                    :class="[
                        'text-xs font-bold px-3 py-1.5 rounded-full shrink-0 mt-1',
                        team.isCompleted ? 'bg-emerald-100 text-emerald-700' :
                        team.sprintStatus === 'active' ? 'bg-cyan-100 text-cyan-700' :
                        'bg-gray-100 text-gray-500'
                    ]"
                >
                    {{ team.isCompleted ? '✓ הושלם' : team.sprintStatus === 'active' ? '● פעיל' : 'ממתין' }}
                </span>
            </div>

            <!-- Loading spinner -->
            <div v-if="loading" class="flex justify-center py-10">
                <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
            </div>

            <template v-else>

                <!-- Analytics summary cards -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

                    <!-- Task duration — cyan accent -->
                    <div class="bg-white rounded-2xl border border-cyan-100 shadow-sm p-5 flex flex-col gap-1.5 border-r-4 border-r-cyan-400">
                        <div class="flex items-center gap-1.5 mb-0.5">
                            <span class="text-base">⏱</span>
                            <span class="text-[10px] font-bold text-cyan-600 uppercase tracking-wide">זמן פעילות</span>
                        </div>
                        <span v-if="taskDuration" class="text-base font-black text-gray-900 leading-snug">{{ taskDuration }}</span>
                        <span v-else class="text-sm text-gray-400">אין נתון זמין</span>
                        <span v-if="taskStartDate" class="text-[10px] text-gray-400">מ-{{ taskStartDate }}</span>
                    </div>

                    <!-- Completion — SVG circular progress -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col items-center gap-2">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide self-start">אחוז השלמה</span>
                        <!-- Radial progress: r=15.9155 → circumference ≈ 100 -->
                        <svg viewBox="0 0 36 36" class="w-20 h-20 -rotate-90">
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" stroke-width="3" />
                            <circle
                                cx="18" cy="18" r="15.9155" fill="none"
                                stroke-width="3"
                                stroke-linecap="round"
                                :stroke="completionPercent >= 70 ? '#10b981' : completionPercent >= 40 ? '#f59e0b' : '#ef4444'"
                                :stroke-dasharray="`${completionPercent} ${100 - completionPercent}`"
                            />
                        </svg>
                        <!-- percentage label overlaid via absolute positioning substitute -->
                        <span
                            :class="[
                                'text-2xl font-black -mt-16 mb-8',
                                completionPercent >= 70 ? 'text-emerald-600' : completionPercent >= 40 ? 'text-amber-500' : 'text-red-500'
                            ]"
                        >{{ completionPercent }}%</span>
                        <span class="text-[10px] text-gray-400">{{ approvedTasks }} / {{ totalTasks }} משימות</span>
                    </div>

                    <!-- Status — color by state -->
                    <div
                        :class="[
                            'rounded-2xl border shadow-sm p-5 flex flex-col gap-1.5 border-r-4',
                            team?.isCompleted
                                ? 'bg-emerald-50 border-emerald-100 border-r-emerald-500'
                                : team?.sprintStatus === 'active'
                                    ? 'bg-blue-50 border-blue-100 border-r-blue-500'
                                    : 'bg-gray-50 border-gray-200 border-r-gray-400'
                        ]"
                    >
                        <div class="flex items-center gap-1.5 mb-0.5">
                            <span class="text-base">📊</span>
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">סטטוס</span>
                        </div>
                        <span
                            :class="[
                                'text-base font-black',
                                team?.isCompleted ? 'text-emerald-700' :
                                team?.sprintStatus === 'active' ? 'text-blue-700' : 'text-gray-600'
                            ]"
                        >{{ statusLabel }}</span>
                    </div>

                    <!-- Who has task — amber if stuck, emerald if done -->
                    <div
                        :class="[
                            'rounded-2xl border shadow-sm p-5 flex flex-col gap-1.5 border-r-4',
                            taskBlockedAt.includes('אושרו')
                                ? 'bg-emerald-50 border-emerald-100 border-r-emerald-500'
                                : taskBlockedAt.includes('מורה')
                                    ? 'bg-purple-50 border-purple-100 border-r-purple-500'
                                    : 'bg-amber-50 border-amber-100 border-r-amber-400'
                        ]"
                    >
                        <div class="flex items-center gap-1.5 mb-0.5">
                            <span class="text-base">🎯</span>
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">אצל מי</span>
                        </div>
                        <span
                            :class="[
                                'text-sm font-bold leading-snug',
                                taskBlockedAt.includes('אושרו') ? 'text-emerald-700' :
                                taskBlockedAt.includes('מורה') ? 'text-purple-700' : 'text-amber-700'
                            ]"
                        >{{ taskBlockedAt }}</span>
                    </div>

                </div>

                <!-- Student progress table -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        <span class="text-base">👥</span>
                        <h2 class="font-black text-gray-800 text-sm">התקדמות תלמידים</h2>
                    </div>
                    <div v-if="!studentRows.length" class="px-6 py-8 text-sm text-gray-400 text-center">
                        אין תלמידים בקבוצה זו.
                    </div>
                    <div v-else class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                                <tr>
                                    <th class="text-right px-5 py-3">תלמיד</th>
                                    <th class="text-right px-5 py-3">תפקיד</th>
                                    <th class="text-right px-5 py-3">זמן פעיל</th>
                                    <th class="text-right px-5 py-3">משימות שאושרו</th>
                                    <th class="text-right px-5 py-3">סטטוס</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                <tr
                                    v-for="s in studentRows"
                                    :key="s.id"
                                    class="hover:bg-gray-50 transition-colors"
                                    :class="s.riskLevel === 'needs_attention' ? 'bg-red-50/40' : ''"
                                >
                                    <td class="px-5 py-3">
                                        <span class="font-semibold text-gray-800">{{ s.name }}</span>
                                    </td>
                                    <td class="px-5 py-3">
                                        <span
                                            :class="[
                                                'text-[11px] font-bold px-2 py-0.5 rounded-full',
                                                s.role === 'QA' ? 'bg-amber-100 text-amber-700' :
                                                s.role === 'Editor' ? 'bg-purple-100 text-purple-700' :
                                                s.role === 'Designer' ? 'bg-sky-100 text-sky-700' :
                                                s.role === 'Printer' ? 'bg-orange-100 text-orange-700' :
                                                'bg-gray-100 text-gray-500'
                                            ]"
                                        >{{ s.role }}</span>
                                    </td>
                                    <td class="px-5 py-3 text-gray-600">{{ s.activeTime }}</td>
                                    <td class="px-5 py-3">
                                        <span
                                            :class="[
                                                'font-bold',
                                                s.approved !== 'אין נתון' && Number(s.approved) > 0
                                                    ? 'text-emerald-600' : 'text-gray-400'
                                            ]"
                                        >{{ s.approved }}</span>
                                    </td>
                                    <td class="px-5 py-3">
                                        <span
                                            v-if="s.riskLevel"
                                            :class="['text-[11px] font-bold px-2.5 py-0.5 rounded-full', RISK_CLS[s.riskLevel]]"
                                            :title="s.insightReason ?? ''"
                                        >
                                            {{ RISK_LABEL[s.riskLevel] }}
                                        </span>
                                        <span v-else class="text-gray-300 text-xs">—</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Teacher notes -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-5">
                    <div class="flex items-center gap-2">
                        <span class="text-base">📝</span>
                        <h2 class="font-black text-gray-900 text-sm">הערות מורה</h2>
                    </div>

                    <!-- Add note -->
                    <div class="flex flex-col gap-2">
                        <textarea
                            v-model="newNote"
                            rows="3"
                            placeholder="הוסף הערה לקבוצה..."
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#3CC2EE]/40 focus:border-[#3CC2EE] transition-all"
                        />
                        <button
                            :disabled="!newNote.trim() || savingNote"
                            class="self-end px-5 py-2 bg-[#3CC2EE] hover:bg-[#27b3df] disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                            @click="saveNote"
                        >
                            <span v-if="savingNote">שומר...</span>
                            <span v-else>שמור הערה</span>
                        </button>
                    </div>

                    <!-- Notes list -->
                    <div v-if="!notes.length" class="text-sm text-gray-400 text-center py-4">
                        אין הערות עדיין.
                    </div>
                    <ul v-else class="flex flex-col gap-3">
                        <li
                            v-for="n in notes"
                            :key="n.id"
                            class="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex flex-col gap-1"
                        >
                            <p class="text-sm text-gray-800 whitespace-pre-wrap leading-snug">{{ n.note }}</p>
                            <span class="text-xs text-gray-400">{{ formatNoteDate(n.created_at) }}</span>
                        </li>
                    </ul>
                </div>

            </template>
        </main>
    </div>
</template>
