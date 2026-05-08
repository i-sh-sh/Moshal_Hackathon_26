<script setup lang="ts">
import { DEMO_USERS, DEMO_TEAMS, DEMO_MISSIONS, DEMO_STUDENTS_BY_TEAM } from '~/services/demoData';
import type { StudentProfile } from '~/types/types';

useHead({ title: 'ניתוח תלמיד — TeamSprintUp' });

const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

const studentId = route.params.studentId as string;

// ── Static demo data ──────────────────────────────────────────────────────────
const demoUser = DEMO_USERS.find((u) => u.id === studentId) ?? null;
const team = DEMO_TEAMS.find((t) => t.id === demoUser?.current_team_id) ?? null;
const challenge = DEMO_MISSIONS.find((c) => c.id === team?.currentChallengeId) ?? null;
const demoStudent = team
    ? (DEMO_STUDENTS_BY_TEAM[team.id] ?? []).find((s) => s.id === studentId) ?? null
    : null;

const ROLE_LABELS: Record<string, string> = {
    pm: 'Editor (PM)',
    qa: 'QA',
    dev: 'Designer',
    hardware: 'Printer',
};

// ── API shapes ────────────────────────────────────────────────────────────────
interface QuizResult {
    user_id: string;
    phase: 'pre' | 'post';
    score: number | null;
    total: number;
    submitted_at: string | null;
    learning_gain: number | null;
}

interface StudentInsight {
    userId: string;
    totalActiveTimeSeconds: number;
    totalTasks: number;
    approvedTasks: number;
    hintCount: number;
    riskLevel: 'ok' | 'watch' | 'needs_attention';
    insightReason: string;
}

interface StudentNote {
    id: string;
    student_id: string;
    teacher_id: string | null;
    note: string;
    created_at: string;
}

// ── Reactive state ────────────────────────────────────────────────────────────
const profile = ref<StudentProfile | null>(null);
const quizResults = ref<QuizResult[]>([]);
const insight = ref<StudentInsight | null>(null);
const notes = ref<StudentNote[]>([]);
const newNote = ref('');
const savingNote = ref(false);
const loading = ref(true);

onMounted(async () => {
    const fetches: Promise<void>[] = [
        $fetch<StudentProfile>(`${base}/student-profiles/${studentId}`)
            .then((d) => { profile.value = d; })
            .catch(() => {}),
        $fetch<{ students: StudentInsight[] }>(`${base}/teams/analytics/teacher-dashboard`)
            .then((d) => {
                insight.value = (d?.students ?? []).find((s) => s.userId === studentId) ?? null;
            })
            .catch(() => {}),
        $fetch<StudentNote[]>(`${base}/teams/students/${studentId}/notes`)
            .then((d) => { notes.value = Array.isArray(d) ? d : []; })
            .catch(() => {}),
    ];

    if (challenge) {
        fetches.push(
            $fetch<QuizResult[]>(`${base}/quizzes/missions/${challenge.id}/results`)
                .then((d) => {
                    quizResults.value = (Array.isArray(d) ? d : []).filter(
                        (r) => r.user_id === studentId,
                    );
                })
                .catch(() => {}),
        );
    }

    await Promise.allSettled(fetches);
    loading.value = false;
});

// ── Computed analytics ────────────────────────────────────────────────────────
const preQuiz = computed(() =>
    quizResults.value.find((r) => r.phase === 'pre' && r.submitted_at) ?? null,
);
const postQuiz = computed(() =>
    quizResults.value.find((r) => r.phase === 'post' && r.submitted_at) ?? null,
);

function fmtScore(result: QuizResult | null): string {
    if (!result || result.score === null) return 'אין נתון זמין';
    return `${result.score} / ${result.total}`;
}

// Deterministic demo scores per student — stable hash of ID, not saved to DB
function demoQuizScore(id: string, phase: 'pre' | 'post'): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
        h = ((h << 5) - h + id.charCodeAt(i)) | 0;
    }
    const base = Math.abs(h) % 26; // 0–25 → stable per student
    return phase === 'pre' ? 40 + base : 70 + base; // pre: 40–65, post: 70–95
}

const activeTimeLabel = computed(() => {
    const sec = insight.value?.totalActiveTimeSeconds ?? null;
    if (sec === null) return 'אין נתון זמין';
    if (sec < 60) return `${sec} שניות`;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h} שעות ו-${m} דקות` : `${m} דקות`;
});

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

function scoreColor(score: number): string {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-500';
}

// Returns a real CSS color so the bar is never purged by Tailwind's JIT
function barColor(pct: number): string {
    if (pct >= 70) return '#10b981'; // emerald-500
    if (pct >= 40) return '#f59e0b'; // amber-500
    return '#ef4444';                // red-500
}

function clampPct(v: number): number {
    return Math.max(0, Math.min(100, Math.round(v)));
}

// ── Notes ─────────────────────────────────────────────────────────────────────
async function saveNote() {
    if (!newNote.value.trim() || savingNote.value) return;
    savingNote.value = true;
    try {
        const saved = await $fetch<StudentNote>(`${base}/teams/students/${studentId}/notes`, {
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

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('he-IL', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}
</script>

<template>
    <div class="min-h-screen bg-gray-50" dir="rtl">

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
            <span class="font-bold text-gray-900 text-sm">ניתוח תלמיד</span>
            <span v-if="demoUser" class="text-sm text-gray-500 truncate">— {{ demoUser.name }}</span>
        </header>

        <main class="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8">

            <!-- Student header -->
            <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
                    {{ (demoUser?.name ?? '?').charAt(0) }}
                </div>
                <div>
                    <h1 class="text-2xl font-black text-gray-900">{{ demoUser?.name ?? 'תלמיד לא נמצא' }}</h1>
                    <div class="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                        <span v-if="team">👥 {{ team.name }}</span>
                        <span v-if="demoStudent?.currentRole">🎯 {{ ROLE_LABELS[demoStudent.currentRole] ?? demoStudent.currentRole }}</span>
                        <span v-if="challenge">📋 {{ challenge.title }}</span>
                    </div>
                </div>
                <div v-if="insight" class="mr-auto">
                    <span :class="['text-xs font-bold px-3 py-1.5 rounded-full', RISK_CLS[insight.riskLevel]]">
                        {{ RISK_LABEL[insight.riskLevel] }}
                    </span>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex justify-center py-10">
                <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
            </div>

            <template v-else>

                <!-- Analytics cards grid -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

                    <!-- Pre-quiz score -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">ציון שאלון ראשוני</span>
                        <span v-if="preQuiz" :class="['text-2xl font-black', scoreColor(clampPct((preQuiz.score ?? 0) / preQuiz.total * 100))]">
                            {{ fmtScore(preQuiz) }}
                        </span>
                        <span v-else :class="['text-2xl font-black', scoreColor(demoQuizScore(studentId, 'pre'))]">
                            {{ demoQuizScore(studentId, 'pre') }}%
                        </span>
                        <span v-if="preQuiz?.submitted_at" class="text-[10px] text-gray-400">{{ formatDate(preQuiz.submitted_at) }}</span>
                        <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div
                                class="h-full rounded-full transition-all"
                                :style="{
                                    width: (preQuiz
                                        ? clampPct((preQuiz.score ?? 0) / preQuiz.total * 100)
                                        : demoQuizScore(studentId, 'pre')) + '%',
                                    backgroundColor: barColor(preQuiz
                                        ? clampPct((preQuiz.score ?? 0) / preQuiz.total * 100)
                                        : demoQuizScore(studentId, 'pre'))
                                }"
                            />
                        </div>
                    </div>

                    <!-- Post-quiz score -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">ציון שאלון שני</span>
                        <span v-if="postQuiz" :class="['text-2xl font-black', scoreColor(clampPct((postQuiz.score ?? 0) / postQuiz.total * 100))]">
                            {{ fmtScore(postQuiz) }}
                        </span>
                        <span v-else :class="['text-2xl font-black', scoreColor(demoQuizScore(studentId, 'post'))]">
                            {{ demoQuizScore(studentId, 'post') }}%
                        </span>
                        <span v-if="postQuiz?.learning_gain !== null && postQuiz?.learning_gain !== undefined" class="text-[10px]" :class="(postQuiz.learning_gain ?? 0) >= 0 ? 'text-emerald-500' : 'text-amber-500'">
                            שיפור: {{ (postQuiz.learning_gain ?? 0) >= 0 ? '+' : '' }}{{ postQuiz.learning_gain }}
                        </span>
                        <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div
                                class="h-full rounded-full transition-all"
                                :style="{
                                    width: (postQuiz
                                        ? clampPct((postQuiz.score ?? 0) / postQuiz.total * 100)
                                        : demoQuizScore(studentId, 'post')) + '%',
                                    backgroundColor: barColor(postQuiz
                                        ? clampPct((postQuiz.score ?? 0) / postQuiz.total * 100)
                                        : demoQuizScore(studentId, 'post'))
                                }"
                            />
                        </div>
                    </div>

                    <!-- Jargon score (0–100 scale) -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">ציון ז'רגון טכני</span>
                        <span v-if="profile" :class="['text-2xl font-black', scoreColor(profile.jargonScore)]">
                            {{ profile.jargonScore.toFixed(0) }}
                        </span>
                        <span v-else class="text-sm text-gray-400">אין נתון זמין</span>
                        <div v-if="profile" class="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div
                                class="h-full rounded-full transition-all"
                                :style="{
                                    width: clampPct(profile.jargonScore) + '%',
                                    backgroundColor: barColor(profile.jargonScore)
                                }"
                            />
                        </div>
                    </div>

                    <!-- Soft skill score (0–100 scale) -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">רכישת כישורים</span>
                        <span v-if="profile" :class="['text-2xl font-black', scoreColor(profile.softSkillScore)]">
                            {{ profile.softSkillScore.toFixed(0) }}
                        </span>
                        <span v-else class="text-sm text-gray-400">אין נתון זמין</span>
                        <div v-if="profile" class="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div
                                class="h-full rounded-full transition-all"
                                :style="{
                                    width: clampPct(profile.softSkillScore) + '%',
                                    backgroundColor: barColor(profile.softSkillScore)
                                }"
                            />
                        </div>
                    </div>

                    <!-- Hints used -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">כמות רמזים</span>
                        <span v-if="insight !== null" class="text-2xl font-black text-gray-900">{{ insight.hintCount }}</span>
                        <span v-else class="text-sm text-gray-400">אין נתון זמין</span>
                    </div>

                    <!-- Tasks completed -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">משימות שבוצעו</span>
                        <span v-if="insight !== null" class="text-2xl font-black text-gray-900">{{ insight.approvedTasks }}</span>
                        <span v-else class="text-sm text-gray-400">אין נתון זמין</span>
                        <span v-if="insight && insight.totalTasks > 0" class="text-[10px] text-gray-400">מתוך {{ insight.totalTasks }} משימות</span>
                    </div>

                    <!-- Active time (proxy for task time — no dedicated completion timestamp) -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">זמן פעיל במערכת</span>
                        <span class="text-base font-black text-gray-900 leading-snug">{{ activeTimeLabel }}</span>
                        <span class="text-[10px] text-gray-400">זמן השלמת משימה ספציפי אינו זמין</span>
                    </div>

                    <!-- Messages analyzed -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1.5">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">הודעות שנותחו</span>
                        <span v-if="profile" class="text-2xl font-black text-gray-900">{{ profile.messagesAnalyzed }}</span>
                        <span v-else class="text-sm text-gray-400">אין נתון זמין</span>
                    </div>

                </div>

                <!-- Struggle areas & detected terms -->
                <div v-if="profile && (profile.struggleAreas.length || profile.detectedTerms.length)" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-5">
                    <h2 class="font-black text-gray-900 text-sm">פירוט נושאים</h2>

                    <div v-if="profile.struggleAreas.length">
                        <p class="text-xs font-bold text-gray-400 mb-2">⚠️ נושאים שהתקשה בהם</p>
                        <div class="flex flex-wrap gap-1.5">
                            <span
                                v-for="area in profile.struggleAreas"
                                :key="area"
                                class="text-xs bg-red-50 text-red-700 border border-red-100 px-2.5 py-0.5 rounded-full"
                            >
                                {{ area }}
                            </span>
                        </div>
                    </div>

                    <div v-if="profile.detectedTerms.length">
                        <p class="text-xs font-bold text-gray-400 mb-2">✅ מונחים שזוהו</p>
                        <div class="flex flex-wrap gap-1.5">
                            <span
                                v-for="term in profile.detectedTerms"
                                :key="term"
                                class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full"
                            >
                                {{ term }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Teacher notes -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-5">
                    <h2 class="font-black text-gray-900 text-sm">הערות מורה</h2>

                    <div class="flex flex-col gap-2">
                        <textarea
                            v-model="newNote"
                            rows="3"
                            placeholder="הוסף הערה לתלמיד..."
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

                    <div v-if="!notes.length" class="text-sm text-gray-400 text-center py-4">
                        אין הערות עדיין.
                    </div>
                    <ul v-else class="flex flex-col gap-3">
                        <li
                            v-for="n in notes"
                            :key="n.id"
                            class="bg-gray-50 rounded-xl px-4 py-3 flex flex-col gap-1"
                        >
                            <p class="text-sm text-gray-800 whitespace-pre-wrap leading-snug">{{ n.note }}</p>
                            <span class="text-xs text-gray-400">{{ formatDate(n.created_at) }}</span>
                        </li>
                    </ul>
                </div>

            </template>
        </main>
    </div>
</template>
