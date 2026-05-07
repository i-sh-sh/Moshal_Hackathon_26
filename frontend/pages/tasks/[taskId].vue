<script setup lang="ts">
import type { StudentRole } from '~/types/types';
import { ROLE_LABELS } from '~/types/types';
import { useUser } from '~/composables/useUser';
import { useQuizzes } from '~/composables/useQuizzes';
import { useChat } from '~/composables/useChat';
import { usePrivateDude } from '~/composables/usePrivateDude';
import type { TeamMember } from '~/components/TechSchoolSidebar.vue';
import { getRoleInfo } from '~/utils/roleInfo';

useHead({ title: 'פרטי משימה — TeamSprintUp' });

const route = useRoute();
const router = useRouter();
const { user } = useUser();
const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

const { tasks, loading, fetchTasks } = useTasks(
    computed(() => user.value?.currentTeamId ?? ''),
    computed(() => user.value?.id ?? ''),
);

interface TeamDetail {
    id: string;
    current_challenge_id: string | null;
    is_completed: boolean;
}
const team = ref<TeamDetail | null>(null);
const teamMembers = ref<TeamMember[]>([]);

// ── Quiz state ────────────────────────────────────────────────────────────────
const { getMine, resetAttempts } = useQuizzes();
const preQuizDone = ref(false);
const postQuizDone = ref(false);
const resetting = ref(false);

onMounted(async () => {
    if (!user.value) { router.replace('/'); return; }
    await fetchTasks();
    if (user.value.currentTeamId) {
        team.value = await $fetch<TeamDetail>(`${base}/teams/${user.value.currentTeamId}`).catch(() => null);
    }
    loadStepProgress();
    // Load team members (filter all users by current team)
    if (user.value.currentTeamId) {
        try {
            const allUsers = await $fetch<{ id: string; name: string; current_team_id: string | null; current_role: string | null }[]>(`${base}/users`);
            teamMembers.value = allUsers
                .filter((u) => u.current_team_id === user.value!.currentTeamId)
                .map((u) => ({ id: u.id, name: u.name, role: u.current_role }));
        } catch { /* silently skip if users endpoint unavailable */ }
    }
    if (team.value?.current_challenge_id && user.value?.id) {
        const [pre, post] = await Promise.all([
            getMine(team.value.current_challenge_id, user.value.id, 'pre'),
            getMine(team.value.current_challenge_id, user.value.id, 'post'),
        ]);
        preQuizDone.value = pre?.attempt.submittedAt != null;
        postQuizDone.value = post?.attempt.submittedAt != null;
    }
});

const task = computed(() => tasks.value.find((t) => t.id === route.params.taskId) ?? null);

const statusLabels: Record<string, string> = {
    pending: 'Pending',
    qa_review: 'QA Review',
    pm_review: 'PM Review',
    teacher_review: 'Teacher Review',
    approved: 'Approved',
    rejected: 'Rejected',
};

const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    qa_review: 'bg-yellow-100 text-yellow-800',
    pm_review: 'bg-blue-100 text-blue-800',
    teacher_review: 'bg-purple-100 text-purple-800',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-600',
};

const roleChipColors: Record<string, string> = {
    pm:       'bg-violet-100 text-violet-700 ring-violet-200',
    qa:       'bg-amber-100  text-amber-700  ring-amber-200',
    dev:      'bg-blue-100   text-blue-700   ring-blue-200',
    hardware: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

// ── Role info popup ───────────────────────────────────────────────────────────
const roleInfoOpen = ref(false);

function openRoleInfo() {
    roleInfoOpen.value = true;
}

// ── Quiz modal ────────────────────────────────────────────────────────────────
const quizModal = ref<{ open: boolean; phase: 'pre' | 'post' }>({ open: false, phase: 'pre' });
function openQuiz(phase: 'pre' | 'post') {
    quizModal.value = { open: true, phase };
}

const toast = ref<{ msg: string; type: 'success' | 'error' } | null>(null);
function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toast.value = { msg, type };
    setTimeout(() => { toast.value = null; }, 3500);
}
function onQuizSubmitted(r: { score: number; total: number; learningGain: number | null }) {
    const wasPreQuiz = quizModal.value.phase === 'pre';
    if (wasPreQuiz) preQuizDone.value = true;
    else postQuizDone.value = true;
    quizModal.value.open = false;
    if (wasPreQuiz) roleInfoOpen.value = true;
    showToast(
        r.learningGain !== null
            ? `Quiz done — score ${r.score}/${r.total} (gain ${r.learningGain >= 0 ? '+' : ''}${r.learningGain})`
            : `Quiz done — score ${r.score}/${r.total}`,
        'success',
    );
}

// ── Reset task ────────────────────────────────────────────────────────────────
async function resetTask() {
    if (!confirm('האם לאפס את המשימה? כל ההתקדמות בבוחנים ובשלבי המשימה תימחק.')) return;
    resetting.value = true;
    try {
        // Clear checklist from localStorage
        try { localStorage.removeItem(storageKey()); } catch { /* ignore */ }
        // Clear in-memory quiz attempts
        if (team.value?.current_challenge_id && user.value?.id) {
            resetAttempts(team.value.current_challenge_id, user.value.id);
        }
        // Reset all local state
        completed.value = new Set();
        preQuizDone.value = false;
        postQuizDone.value = false;
        showToast('המשימה אופסה בהצלחה.', 'success');
    } catch {
        showToast('האיפוס נכשל — נסה שוב.', 'error');
    } finally {
        resetting.value = false;
    }
}

// ── Step checklist ────────────────────────────────────────────────────────────
interface Step { id: number; title: string; explanation: string; }

const DEFAULT_STEPS: Step[] = [
    { id: 1, title: 'הבנת המשימה',           explanation: 'קרא את תיאור המשימה וודא שאתה מבין מה המוצר הסופי הצפוי.' },
    { id: 2, title: 'תכנון האובייקט',         explanation: 'החלט איזה אובייקט תרצה לעצב ואילו חלקים הוא צריך לכלול.' },
    { id: 3, title: 'יצירת המודל התלת-ממדי', explanation: 'בנה את הצורה הבסיסית בתוכנת Fusion 360 / CAD.' },
    { id: 4, title: 'בדיקת מידות וסבילויות', explanation: 'ודא שהגודל, העובי, והחיבורים מתאימים להדפסה תלת-ממדית.' },
    { id: 5, title: 'ייצוא והכנה להדפסה',    explanation: 'ייצא קובץ STL והכן אותו ב-Slicer.' },
    { id: 6, title: 'בדיקה ושיפור',           explanation: 'בחן את התוצאה, תקן בעיות ושפר את העיצוב.' },
];

const completed = ref<Set<number>>(new Set());

function storageKey(): string {
    return `task-steps:${user.value?.id ?? 'anon'}:${route.params.taskId as string}`;
}

function loadStepProgress() {
    if (typeof localStorage === 'undefined') return;
    try {
        const raw = localStorage.getItem(storageKey());
        if (raw) completed.value = new Set(JSON.parse(raw) as number[]);
    } catch { /* ignore */ }
}

function toggleStep(id: number) {
    if (!preQuizDone.value) return;
    if (completed.value.has(id)) completed.value.delete(id);
    else completed.value.add(id);
    completed.value = new Set(completed.value);
    try { localStorage.setItem(storageKey(), JSON.stringify([...completed.value])); } catch { /* ignore */ }
}

const completedCount = computed(() => completed.value.size);
const totalSteps = DEFAULT_STEPS.length;
const allStepsDone = computed(() => completedCount.value === totalSteps);
const nextStepId = computed(() => DEFAULT_STEPS.find((s) => !completed.value.has(s.id))?.id ?? null);

// ── Chat panels ───────────────────────────────────────────────────────────────
const chatTab = ref<'group' | 'private'>('group');

const {
    channel,
    messages: groupMessages,
    sending: groupSending,
    initChannel,
    sendMessage: groupSend,
    startPolling: startChatPolling,
    stopPolling: stopChatPolling,
} = useChat(
    computed(() => user.value?.currentTeamId ?? ''),
    computed(() => user.value?.id ?? ''),
    computed(() => user.value?.name ?? 'תלמיד'),
);

const {
    messages: privateMessages,
    sending: privateSending,
    sendMessage: privateSend,
} = usePrivateDude(
    computed(() => user.value?.id ?? ''),
    computed(() => user.value?.name ?? 'תלמיד'),
);

onMounted(async () => {
    if (user.value?.currentTeamId) {
        await initChannel();
        startChatPolling(5000);
    }
});
onUnmounted(() => stopChatPolling());

// ── Scroll-to-chat ────────────────────────────────────────────────────────────
const chatSection = ref<HTMLElement | null>(null);
function scrollToChat() {
    chatSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex" dir="rtl">
        <TechSchoolSidebar school-label="School Test 01" :team-members="teamMembers" :hide-mentor-bot="true" />

        <div class="flex-1 flex flex-col min-w-0">
        <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div class="px-6 h-14 flex items-center gap-3">
                <button
                    class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                    @click="router.back()"
                >
                    ← חזור
                </button>
                <span class="text-gray-300">|</span>
                <span class="text-sm font-semibold text-gray-700 truncate flex-1">{{ task?.title ?? 'פרטי משימה' }}</span>
                <button
                    v-if="task"
                    class="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-40"
                    :disabled="resetting"
                    @click="resetTask"
                >
                    <span>↺</span>
                    <span>איפוס משימה</span>
                </button>
            </div>
        </header>

        <main class="flex-1 w-full max-w-2xl mx-auto px-6 py-8">
            <div v-if="loading" class="flex justify-center py-16">
                <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
            </div>

            <div v-else-if="!task" class="text-center py-16 text-gray-400 text-sm">
                המשימה לא נמצאה.
            </div>

            <div v-else class="flex flex-col gap-4">

                <!-- ① Main task card ─────────────────────────────────────── -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
                    <div class="flex items-start justify-between gap-3">
                        <h1 class="text-xl font-bold text-gray-800 leading-snug">{{ task.title }}</h1>
                        <span :class="['text-xs font-medium px-2.5 py-1 rounded-full shrink-0', statusColors[task.status]]">
                            {{ statusLabels[task.status] }}
                        </span>
                    </div>

                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs text-gray-400 font-medium">תפקיד למשימה זו:</span>
                        <span :class="['text-xs font-bold px-3 py-1 rounded-full ring-1', roleChipColors[task.assignedRole] ?? 'bg-gray-100 text-gray-600 ring-gray-200']">
                            {{ ROLE_LABELS[task.assignedRole as StudentRole] ?? task.assignedRole }}
                        </span>
                        <!-- Info icon — opens role explanation popup -->
                        <button
                            class="w-5 h-5 rounded-full bg-[#3CC2EE]/15 hover:bg-[#3CC2EE]/30 text-[#3CC2EE] flex items-center justify-center transition-colors shrink-0"
                            title="הסבר על התפקיד"
                            @click="openRoleInfo"
                        >
                            <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none">
                                <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
                                <path d="M8 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                <circle cx="8" cy="5" r="0.75" fill="currentColor"/>
                            </svg>
                        </button>
                    </div>

                    <div v-if="task.description" class="border-t border-gray-100 pt-4">
                        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">הסבר המשימה</h2>
                        <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{{ task.description }}</p>
                    </div>
                    <p v-else class="text-sm text-gray-400 italic">אין הסבר למשימה זו.</p>

                    <a v-if="task.submissionUrl" :href="task.submissionUrl" target="_blank" class="text-sm text-[#3CC2EE] hover:underline">
                        🔗 צפייה בהגשה
                    </a>
                    <div v-if="task.submissionImageUrl" class="rounded-xl overflow-hidden border border-gray-200">
                        <img :src="task.submissionImageUrl" :alt="task.title" class="w-full object-cover max-h-64" />
                    </div>
                </div>

                <!-- ② Before-task quiz ───────────────────────────────────── -->
                <div v-if="team?.current_challenge_id && user?.id" class="bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3"
                    :class="preQuizDone ? 'border-emerald-200' : 'border-[#3CC2EE]/40'"
                >
                    <div class="flex items-center gap-2">
                        <span class="text-base">📝</span>
                        <h2 class="font-bold text-gray-800 text-sm">בוחן לפני המשימה</h2>
                        <span v-if="preQuizDone" class="mr-auto text-xs font-bold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full">
                            הושלם ✓
                        </span>
                    </div>

                    <!-- Completed state -->
                    <div v-if="preQuizDone" class="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
                        <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        בוחן לפני המשימה הושלם — ניתן להתחיל את שלבי המשימה.
                    </div>

                    <!-- Available state -->
                    <template v-else>
                        <p class="text-xs text-gray-500">יש לבצע את הבוחן לפני שמתחילים את המשימה.</p>
                        <button
                            class="self-start px-5 py-2 bg-[#3CC2EE] hover:bg-[#27b3df] text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                            @click="openQuiz('pre')"
                        >
                            התחל בוחן לפני המשימה ▸
                        </button>
                    </template>
                </div>

                <!-- ③ Step checklist ─────────────────────────────────────── -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
                    <div class="flex items-center justify-between gap-2">
                        <h2 class="font-bold text-gray-800 text-sm">שלבי המשימה</h2>
                        <span class="text-xs font-semibold px-2.5 py-1 rounded-full"
                            :class="allStepsDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'"
                        >
                            הושלמו {{ completedCount }} מתוך {{ totalSteps }} שלבים
                        </span>
                    </div>

                    <!-- Lock banner -->
                    <div v-if="!preQuizDone" class="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <span class="text-base shrink-0">🔒</span>
                        יש לבצע את הבוחן לפני המשימה כדי לפתוח את שלבי המשימה.
                    </div>

                    <!-- Progress bar -->
                    <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            class="h-full bg-emerald-400 rounded-full transition-all duration-500"
                            :style="{ width: `${(completedCount / totalSteps) * 100}%` }"
                        />
                    </div>

                    <!-- Steps -->
                    <ol class="flex flex-col gap-2">
                        <li
                            v-for="step in DEFAULT_STEPS"
                            :key="step.id"
                            class="flex gap-3 rounded-xl px-4 py-3.5 select-none transition-all duration-200 border"
                            :class="[
                                !preQuizDone
                                    ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                                    : completed.has(step.id)
                                        ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                                        : step.id === nextStepId
                                            ? 'bg-[#3CC2EE]/5 border-[#3CC2EE]/30 hover:bg-[#3CC2EE]/10 cursor-pointer'
                                            : 'bg-gray-50 border-gray-100 hover:bg-gray-100 cursor-pointer'
                            ]"
                            :aria-disabled="!preQuizDone"
                            @click="toggleStep(step.id)"
                        >
                            <div
                                class="mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                                :class="completed.has(step.id)
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : step.id === nextStepId && preQuizDone
                                        ? 'border-[#3CC2EE] text-[#3CC2EE]'
                                        : 'border-gray-300 text-transparent'"
                            >
                                <svg class="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>

                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-xs font-bold text-gray-400">{{ step.id }}.</span>
                                    <span class="text-sm font-semibold"
                                        :class="completed.has(step.id) ? 'text-emerald-600 line-through decoration-emerald-400/60' : 'text-gray-800'"
                                    >{{ step.title }}</span>
                                    <span v-if="step.id === nextStepId && preQuizDone"
                                        class="text-xs font-bold text-[#3CC2EE] px-2 py-0.5 rounded-full bg-[#3CC2EE]/10"
                                    >הצעד הבא ▸</span>
                                    <span v-if="completed.has(step.id)"
                                        class="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full"
                                    >בוצע ✓</span>
                                </div>
                                <p class="text-xs mt-0.5 leading-relaxed"
                                    :class="completed.has(step.id) ? 'text-emerald-500/70' : 'text-gray-500'"
                                >{{ step.explanation }}</p>
                            </div>
                        </li>
                    </ol>
                </div>

                <!-- ④ After-task quiz ─────────────────────────────────────── -->
                <div v-if="team?.current_challenge_id && user?.id" class="bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3"
                    :class="postQuizDone ? 'border-emerald-200' : 'border-gray-200'"
                >
                    <div class="flex items-center gap-2">
                        <span class="text-base">🎯</span>
                        <h2 class="font-bold text-gray-800 text-sm">בוחן אחרי המשימה</h2>
                        <span v-if="postQuizDone" class="mr-auto text-xs font-bold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full">
                            הושלם ✓
                        </span>
                    </div>

                    <!-- Completed state -->
                    <div v-if="postQuizDone" class="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
                        <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        בוחן אחרי המשימה הושלם.
                    </div>

                    <!-- Locked: steps not done yet -->
                    <template v-else-if="!allStepsDone">
                        <div class="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                            <span class="text-base shrink-0">🔒</span>
                            יש להשלים את כל שלבי המשימה לפני ביצוע הבוחן אחרי המשימה.
                        </div>
                        <button disabled class="self-start px-5 py-2 bg-gray-200 text-gray-400 rounded-full text-sm font-bold cursor-not-allowed opacity-60">
                            בוחן אחרי המשימה
                        </button>
                    </template>

                    <!-- Available state -->
                    <template v-else>
                        <p class="text-xs text-gray-500">כל השלבים הושלמו — ניתן לבצע את הבוחן.</p>
                        <button
                            class="self-start px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                            @click="openQuiz('post')"
                        >
                            התחל בוחן אחרי המשימה ▸
                        </button>
                    </template>
                </div>

                <!-- ⑤ Chat panels ──────────────────────────────────────── -->
                <div ref="chatSection" class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style="height: 480px">
                    <!-- Tab switcher -->
                    <div class="flex border-b border-gray-100">
                        <button
                            :class="['flex-1 py-2.5 text-xs font-semibold transition-colors', chatTab === 'group' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700']"
                            @click="chatTab = 'group'"
                        >
                            💬 צ'אט צוותי
                        </button>
                        <button
                            :class="['flex-1 py-2.5 text-xs font-semibold transition-colors', chatTab === 'private' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700']"
                            @click="chatTab = 'private'"
                        >
                            🤖 מנטור פרטי
                        </button>
                    </div>

                    <!-- Group chat -->
                    <div v-if="chatTab === 'group'" class="flex-1 min-h-0">
                        <div v-if="!channel" class="flex items-center justify-center h-full text-sm text-gray-400">
                            <div class="w-5 h-5 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mr-2" />
                            מתחבר לצ'אט...
                        </div>
                        <ChatChannel
                            v-else
                            class="h-full"
                            :channel-name="channel.name"
                            :messages="groupMessages"
                            :sending="groupSending"
                            :current-user-id="user?.id ?? ''"
                            @send="groupSend"
                        />
                    </div>

                    <!-- Private DUDE chat -->
                    <div v-else class="flex-1 min-h-0">
                        <ChatChannel
                            class="h-full"
                            channel-name="DUDE — מנטור אישי 🤖"
                            :messages="privateMessages"
                            :sending="privateSending"
                            :current-user-id="user?.id ?? ''"
                            @send="privateSend"
                        />
                    </div>
                </div>

            </div>
        </main>

        </div><!-- end flex-1 column -->

        <!-- Role info popup -->
        <RoleInfoPopup
            v-if="roleInfoOpen && task"
            :role-key="task.assignedRole"
            :role-label="ROLE_LABELS[task.assignedRole as StudentRole] ?? task.assignedRole"
            @close="roleInfoOpen = false"
        />

        <!-- Quiz modal -->
        <QuizModal
            v-if="quizModal.open && team?.current_challenge_id && user?.id"
            :challenge-id="team.current_challenge_id"
            :user-id="user.id"
            :phase="quizModal.phase"
            @close="quizModal.open = false"
            @submitted="onQuizSubmitted"
        />

        <!-- Toast -->
        <Teleport to="body">
            <Transition name="toast">
                <div
                    v-if="toast"
                    :class="['fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-none',
                        toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white']"
                >
                    {{ toast.msg }}
                </div>
            </Transition>
        </Teleport>

        <!-- Floating scroll-to-chat button -->
        <Teleport to="body">
            <button
                v-if="task"
                class="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg transition-all"
                title="גלול לצ'אט"
                @click="scrollToChat"
            >
                <span>💬</span>
                <span>צ'אט</span>
                <svg class="w-3.5 h-3.5 rotate-90" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </Teleport>
    </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
