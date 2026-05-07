<script setup lang="ts">
import type { Task, QaChecklist, StudentRole } from '~/types/types';
import { ROLE_LABELS } from '~/types/types';
import { useUser } from '~/composables/useUser';
import { useLeaderboard } from '~/composables/useLeaderboard';
import { useChat } from '~/composables/useChat';
import { useStudentProfile } from '~/composables/useStudentProfile';
import { usePrivateDude } from '~/composables/usePrivateDude';

useHead({ title: 'TechSchool — לוח תלמיד' });

const { user, logout } = useUser();
const router = useRouter();
const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

// ── Team + sprint data ────────────────────────────────────────────────────────
interface TeamDetail {
    id: string;
    name: string;
    accumulated_score: number;
    sprint_status: string;
    is_completed: boolean;
    current_challenge_id: string | null;
    current_sprint_id: string | null;
    sprints: { id: string; title: string; description: string | null } | null;
}
const team = ref<TeamDetail | null>(null);
const sprintProgress = ref({ total: 0, approved: 0 });

async function fetchTeam() {
    if (!user.value?.currentTeamId) return;
    team.value = await $fetch<TeamDetail>(`${base}/teams/${user.value.currentTeamId}`).catch(() => null);
    if (team.value?.current_sprint_id) {
        const prog = await $fetch<{ total: number; approved: number }>(
            `${base}/teams/${user.value.currentTeamId}/sprint-progress?sprintId=${team.value.current_sprint_id}`,
        ).catch(() => ({ total: 0, approved: 0 }));
        sprintProgress.value = prog;
    }
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
const { tasks, loading: tasksLoading, fetchTasks, submitTask, qaReview, pmReview } = useTasks(
    computed(() => user.value?.currentTeamId ?? ''),
    computed(() => user.value?.id ?? ''),
);

// ── Leaderboard ───────────────────────────────────────────────────────────────
const { rows: leaderboardRows, topIndividuals, fetchLeaderboard } = useLeaderboard();

// ── Auto-refresh every 20 s ───────────────────────────────────────────────────
let refreshTimer: ReturnType<typeof setInterval> | null = null;
const lastRefreshed = ref<Date | null>(null);

async function refreshAll() {
    await Promise.all([fetchTasks(), fetchTeam()]);
    lastRefreshed.value = new Date();
}

// ── Hint panel ref ────────────────────────────────────────────────────────────
const hintPanel = ref<{ requestHint: (taskId?: string) => Promise<void> } | null>(null);

async function onRequestHint(payload: { taskId: string }) {
    await hintPanel.value?.requestHint(payload.taskId);
}

// ── Modal state ───────────────────────────────────────────────────────────────
const activeTaskId = ref<string | null>(null);
const activeModal = ref<'submit' | 'qa' | 'pm' | 'image' | null>(null);

const submitUrl = ref('');
const submitImageUrl = ref('');
const qaChecklist = reactive<QaChecklist>({ isCompleted: false, hasErrors: false, improvements: [] });
const qaImprovementInput = ref('');
const qaNotes = ref('');
const pmNotes = ref('');
const actionLoading = ref(false);
const toast = ref<{ msg: string; type: 'success' | 'error' } | null>(null);

function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toast.value = { msg, type };
    setTimeout(() => { toast.value = null; }, 3500);
}

function openModal(taskId: string, modal: typeof activeModal.value) {
    activeTaskId.value = taskId;
    activeModal.value = modal;
    submitUrl.value = '';
    submitImageUrl.value = '';
    qaChecklist.isCompleted = false;
    qaChecklist.hasErrors = false;
    qaChecklist.improvements = [];
    qaImprovementInput.value = '';
    qaNotes.value = '';
    pmNotes.value = '';
}
function closeModal() { activeTaskId.value = null; activeModal.value = null; }

const activeTask = computed(() => tasks.value.find((t) => t.id === activeTaskId.value) ?? null);

async function handleSubmit() {
    if (!activeTaskId.value) return;
    actionLoading.value = true;
    try {
        await submitTask({ taskId: activeTaskId.value, submissionUrl: submitUrl.value, submissionImageUrl: submitImageUrl.value });
        showToast('Work submitted!');
        closeModal();
        await refreshAll();
    } catch { showToast('Submit failed — try again.', 'error'); }
    finally { actionLoading.value = false; }
}

async function handleQaReview(decision: 'approve' | 'reject') {
    if (!activeTaskId.value) return;
    actionLoading.value = true;
    try {
        await qaReview({
            taskId: activeTaskId.value, decision,
            checklist: { ...qaChecklist, improvements: [...qaChecklist.improvements] },
            notes: qaNotes.value,
        });
        showToast(decision === 'approve' ? 'QA approved ✓' : 'Sent back to dev');
        closeModal();
        await refreshAll();
    } catch { showToast('Review failed — try again.', 'error'); }
    finally { actionLoading.value = false; }
}

async function handlePmReview(decision: 'approve' | 'reject') {
    if (!activeTaskId.value) return;
    actionLoading.value = true;
    try {
        await pmReview({ taskId: activeTaskId.value, decision, notes: pmNotes.value });
        showToast(decision === 'approve' ? 'Sent to teacher ✓' : 'Sent back to QA');
        closeModal();
        await refreshAll();
    } catch { showToast('Review failed — try again.', 'error'); }
    finally { actionLoading.value = false; }
}

function addImprovement() {
    const v = qaImprovementInput.value.trim();
    if (v) { qaChecklist.improvements.push(v); qaImprovementInput.value = ''; }
}

// ── Task card navigation ──────────────────────────────────────────────────────
function navigateToTask(taskId: string, event: MouseEvent, locked: boolean) {
    if (locked) return;
    if ((event.target as HTMLElement).closest('button, a')) return;
    router.push(`/tasks/${taskId}`);
}

// ── Role helpers ──────────────────────────────────────────────────────────────
const role = computed(() => user.value?.currentRole ?? null);
function canSubmit(t: Task) { return (role.value === 'dev' || role.value === 'hardware') && (t.status === 'pending' || t.status === 'rejected'); }
function canQaReview(t: Task) { return role.value === 'qa' && t.status === 'qa_review'; }
function canPmReview(t: Task) { return role.value === 'pm' && t.status === 'pm_review'; }
function canHint(t: Task) { return t.status !== 'approved' && t.status !== 'teacher_review'; }

// ── Status display ────────────────────────────────────────────────────────────
const statusLabels: Record<string, string> = {
    pending: 'Pending', qa_review: 'QA Review', pm_review: 'PM Review',
    teacher_review: 'Teacher Review', approved: 'Approved', rejected: 'Rejected',
};
const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    qa_review: 'bg-yellow-100 text-yellow-800',
    pm_review: 'bg-blue-100 text-blue-800',
    teacher_review: 'bg-purple-100 text-purple-800',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-600',
};
const roleColors: Record<string, string> = {
    pm:       'bg-purple-500',
    qa:       'bg-yellow-500',
    dev:      'bg-blue-500',
    hardware: 'bg-green-500',
};
const roleEmoji: Record<string, string> = {
    pm:       '✂️',
    qa:       '🔍',
    dev:      '📐',
    hardware: '🖨️',
};

function roleDisplay(role: string | null | undefined): string {
    if (!role) return '';
    return ROLE_LABELS[role as StudentRole] ?? role.toUpperCase();
}

// ── Chat (DUDE) ───────────────────────────────────────────────────────────────
const {
    channel,
    messages: chatMessages,
    sending: chatSending,
    initChannel,
    sendMessage,
    startPolling: startChatPolling,
    stopPolling: stopChatPolling,
} = useChat(
    computed(() => user.value?.currentTeamId ?? ''),
    computed(() => user.value?.id ?? ''),
    computed(() => user.value?.name ?? 'תלמיד'),
);

// ── Student profile ───────────────────────────────────────────────────────────
const { profile: myProfile, snapshots: mySnapshots, fetchMyProfile, fetchSnapshots } = useStudentProfile();

// ── Private DUDE mentor chat ──────────────────────────────────────────────────
const {
    messages: dudeMessages,
    sending: dudeSending,
    sendMessage: dudeSendMessage,
} = usePrivateDude(
    computed(() => user.value?.id ?? ''),
    computed(() => user.value?.name ?? 'תלמיד'),
);

// ── Tabs ──────────────────────────────────────────────────────────────────────
const activeTab = ref<'tasks' | 'leaderboard' | 'chat' | 'mentor' | 'progress'>('tasks');

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
    if (!user.value) { router.replace('/'); return; }
    await Promise.all([fetchTeam(), fetchTasks(), fetchLeaderboard()]);
    lastRefreshed.value = new Date();
    refreshTimer = setInterval(refreshAll, 20_000);
    // Init chat channel and profile in background
    if (user.value.currentTeamId) {
        initChannel().then(() => startChatPolling(5000));
    }
    if (user.value.id) {
        fetchMyProfile(user.value.id);
        fetchSnapshots(user.value.id);
    }
});

onUnmounted(() => {
    if (refreshTimer) clearInterval(refreshTimer);
    stopChatPolling();
});

async function handleLogout() { logout(); await router.replace('/'); }

// ── Relative time helper ──────────────────────────────────────────────────────
const refreshLabel = computed(() => {
    if (!lastRefreshed.value) return '';
    const sec = Math.floor((Date.now() - lastRefreshed.value.getTime()) / 1000);
    return sec < 5 ? 'just now' : `${sec}s ago`;
});

// Keep label ticking (client-only — setInterval is not allowed in SSR)
const now = ref(Date.now());
let tickTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
    tickTimer = setInterval(() => { now.value = Date.now(); }, 5000);
});
onUnmounted(() => { if (tickTimer) clearInterval(tickTimer); });

</script>

<template>
    <div class="min-h-screen bg-gray-50 flex" dir="rtl">
        <!-- Right cyan TS sidebar (first in DOM = right side in RTL flex) -->
        <TechSchoolSidebar school-label="School Test 01" :on-logout="handleLogout" :hide-mentor-bot="true" />

        <!-- Page content (fills the rest, on the left in RTL flex) -->
        <div class="flex-1 flex flex-col min-w-0">

        <!-- ── Top nav (TS-style) ──────────────────────────────────────── -->
        <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div class="px-6 h-16 flex items-center gap-3">
                <!-- Score chips -->
                <div class="flex items-center gap-2">
                    <span v-if="team" class="text-sm text-gray-700 font-semibold">{{ team.name }}</span>
                    <span v-if="team" class="text-xs font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-100 px-2.5 py-1 rounded-full">
                        ⭐ {{ team.accumulated_score }} נק'
                    </span>
                </div>

                <div class="flex-1" />

                <!-- Auto-refresh indicator -->
                <button
                    class="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    title="לחץ כדי לרענן"
                    @click="refreshAll"
                >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {{ refreshLabel }}
                </button>

                <!-- User identity -->
                <div class="flex items-center gap-2 mr-2">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {{ user?.name?.charAt(0) }}
                    </div>
                    <span class="text-sm text-gray-700 font-medium hidden sm:inline">{{ user?.name }}</span>
                </div>
            </div>
        </header>

        <!-- ── Main ────────────────────────────────────────────────────── -->
        <main class="flex-1 w-full px-6 py-6 flex flex-col gap-5 max-w-6xl mx-auto">

            <div v-if="!user?.currentTeamId" class="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
                ⚠️ אינך משויך/ת לצוות. בקש/י מהמורה להקצות אותך לצוות.
            </div>

            <SprintProgress
                v-if="team?.sprints"
                :sprint-title="team.sprints.title"
                :approved="sprintProgress.approved"
                :total="sprintProgress.total"
                :score="team.accumulated_score"
                :sprint-status="team.sprint_status"
            />

            <!-- Tabs -->
            <div class="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
                <button :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', activeTab === 'tasks' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700']" @click="activeTab = 'tasks'">
                    📋 My Tasks
                </button>
                <button :class="['px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors', activeTab === 'leaderboard' ? 'bg-white shadow-sm text-[#3CC2EE]' : 'text-gray-500 hover:text-gray-700']" @click="activeTab = 'leaderboard'">
                    🏆 לוח דירוג
                </button>
                <button :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', activeTab === 'chat' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700']" @click="activeTab = 'chat'">
                    💬 צ'אט DUDE
                </button>
                <button :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', activeTab === 'mentor' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700']" @click="activeTab = 'mentor'">
                    🤖 מנטור פרטי
                </button>
                <button :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', activeTab === 'progress' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700']" @click="activeTab = 'progress'">
                    📈 ההתקדמות שלי
                </button>
            </div>

            <!-- ── Tasks tab ──────────────────────────────────────────── -->
            <div v-if="activeTab === 'tasks'" class="flex flex-col gap-5">
                <div v-if="tasksLoading" class="flex justify-center py-12">
                    <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
                </div>

                <div v-else-if="!tasks.length" class="text-center py-16 text-gray-400 text-sm">
                    עדיין לא הוקצו משימות לצוות שלך.
                </div>

                <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <article
                        v-for="(task, index) in tasks"
                        :key="task.id"
                        class="rounded-2xl border shadow-sm flex flex-col overflow-hidden transition-all"
                        :class="index === 0
                            ? 'bg-white border-[#3CC2EE]/30 hover:shadow-md hover:border-[#3CC2EE]/60 cursor-pointer'
                            : 'bg-gray-50 border-gray-200 opacity-55 cursor-not-allowed'"
                        @click="navigateToTask(task.id, $event, index !== 0)"
                    >
                        <!-- Challenge header strip -->
                        <div
                            class="flex items-center justify-between px-4 py-2.5"
                            :class="index === 0
                                ? 'bg-gradient-to-r from-[#3CC2EE] to-cyan-500 text-white'
                                : 'bg-gray-200 text-gray-500'"
                        >
                            <span class="text-sm font-extrabold tracking-wide">
                                אתגר מספר {{ index + 1 }}
                            </span>
                            <span v-if="index > 0" class="text-xs font-semibold flex items-center gap-1 opacity-80">
                                🔒 נעול
                            </span>
                            <span v-else class="text-xs font-semibold opacity-80">פעיל ▸</span>
                        </div>

                        <!-- Card body -->
                        <div class="flex flex-col p-4 gap-3">

                        <!-- Header -->
                        <div class="flex items-start justify-between gap-2">
                            <h3 class="font-semibold text-sm leading-snug flex-1" :class="index === 0 ? 'text-gray-800' : 'text-gray-400'">{{ task.title }}</h3>
                            <span :class="['text-xs font-medium px-2 py-0.5 rounded-full shrink-0', index === 0 ? statusColors[task.status] : 'bg-gray-100 text-gray-400']">
                                <EnglishTerm :term="statusLabels[task.status]" />
                            </span>
                        </div>

                        <p v-if="task.description" class="text-xs text-gray-500 leading-relaxed">{{ task.description }}</p>

                        <!-- Submission image preview -->
                        <button
                            v-if="task.submissionImageUrl"
                            class="rounded-lg overflow-hidden border border-gray-200 hover:border-[#3CC2EE]/40 transition-colors"
                            @click="openModal(task.id, 'image')"
                        >
                            <img :src="task.submissionImageUrl" :alt="`${task.title} submission`" class="w-full h-28 object-cover" />
                        </button>
                        <a v-else-if="task.submissionUrl" :href="task.submissionUrl" target="_blank" class="text-xs text-[#3CC2EE] hover:underline truncate">
                            🔗 צפייה בהגשה
                        </a>

                        <!-- QA notes for PM -->
                        <div v-if="task.qaNotes && role === 'pm' && task.status === 'pm_review'" class="bg-yellow-50 rounded-lg px-3 py-2 text-xs text-yellow-800">
                            💬 QA: {{ task.qaNotes }}
                        </div>

                        <div class="text-xs text-gray-400">
                            תפקיד: <EnglishTerm :term="ROLE_LABELS[task.assignedRole as StudentRole] ?? task.assignedRole" />
                        </div>

                        <!-- Actions -->
                        <div class="mt-auto flex flex-wrap gap-2">
                            <button v-if="canSubmit(task)" class="btn btn-primary" @click="openModal(task.id, 'submit')">
                                <EnglishTerm term="Submit" /> עבודה
                            </button>
                            <button v-if="canQaReview(task)" class="btn btn-yellow" @click="openModal(task.id, 'qa')">
                                QA <EnglishTerm term="Review" />
                            </button>
                            <button v-if="canPmReview(task)" class="btn btn-blue" @click="openModal(task.id, 'pm')">
                                <EnglishTerm term="Editor" /> <EnglishTerm term="Review" />
                            </button>
                            <button v-if="canHint(task)" class="btn btn-ghost mr-auto" @click="onRequestHint({ taskId: task.id })">
                                💡 רמז
                            </button>
                        </div>

                        </div><!-- end card body -->
                    </article>
                </div>

                <HintPanel v-if="user" ref="hintPanel" :user-id="user.id" :team-id="user.currentTeamId ?? ''" />
            </div>

            <!-- ── Chat (DUDE) tab ───────────────────────────────────── -->
            <div v-if="activeTab === 'chat'" class="flex flex-col" style="height: 580px">
                <div v-if="!channel" class="text-center py-12 text-gray-400 text-sm">
                    <div class="w-6 h-6 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
                    מתחבר לצ'אט הצוות...
                </div>
                <ChatChannel
                    v-else
                    class="h-full"
                    :channel-name="channel.name"
                    :messages="chatMessages"
                    :sending="chatSending"
                    :current-user-id="user?.id ?? ''"
                    @send="sendMessage"
                />
            </div>

            <!-- ── Mentor (private DUDE) tab ─────────────────────────── -->
            <div v-if="activeTab === 'mentor'" class="flex flex-col" style="height: 580px">
                <ChatChannel
                    class="h-full"
                    channel-name="DUDE — מנטור אישי 🤖"
                    :messages="dudeMessages"
                    :sending="dudeSending"
                    :current-user-id="user?.id ?? ''"
                    @send="dudeSendMessage"
                />
            </div>

            <!-- ── Progress tab ───────────────────────────────────────── -->
            <div v-if="activeTab === 'progress'" class="flex flex-col gap-5">
                <div v-if="!myProfile" class="text-center py-12 text-gray-400 text-sm">
                    אין עדיין פרופיל לימודי. שלח הודעות בצ'אט כדי לאסוף נתונים.
                </div>
                <StudentProfileCard
                    v-else
                    :profile="myProfile"
                    :snapshots="mySnapshots"
                    :user-name="user?.name"
                />
            </div>

            <!-- ── Leaderboard tab ────────────────────────────────────── -->
            <div v-if="activeTab === 'leaderboard'" class="grid gap-5 lg:grid-cols-2">
                <Leaderboard :rows="leaderboardRows" :highlight-team-id="user?.currentTeamId ?? undefined" />

                <!-- Individual top 3 -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
                    <div class="flex items-center gap-2">
                        <span class="text-lg">⚡</span>
                        <h3 class="font-bold text-gray-800 text-sm">תלמידים מובילים</h3>
                        <span class="text-xs text-gray-400">(טופ 3)</span>
                    </div>

                    <div v-if="!topIndividuals.length" class="text-xs text-gray-400 text-center py-4">
                        אין נתונים עדיין.
                    </div>

                    <div v-else class="flex flex-col gap-3">
                        <div
                            v-for="p in topIndividuals"
                            :key="p.id"
                            class="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                            :class="{ 'bg-cyan-50 border border-cyan-200': p.id === user?.id }"
                        >
                            <span class="text-xl w-8 text-center">{{ ['🥇','🥈','🥉'][p.rank - 1] ?? `#${p.rank}` }}</span>
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-sm text-gray-800 truncate">
                                    {{ p.name }}
                                    <span v-if="p.id === user?.id" class="text-[#3CC2EE] text-xs mr-1">(אתה)</span>
                                </p>
                                <p class="text-xs text-gray-400">{{ p.approvedTasks }} משימות אושרו</p>
                            </div>
                            <span v-if="p.currentRole" class="text-xs text-gray-500 font-medium">{{ roleDisplay(p.currentRole) }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        </div>

        <!-- ── Toast ──────────────────────────────────────────────────── -->
        <Teleport to="body">
            <Transition name="toast">
                <div
                    v-if="toast"
                    :class="['fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-none', toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white']"
                >
                    {{ toast.msg }}
                </div>
            </Transition>
        </Teleport>

        <!-- ── Modal ──────────────────────────────────────────────────── -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div
                    v-if="activeModal && (activeTask || activeModal === 'image')"
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    @click.self="closeModal"
                >
                    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">

                        <!-- Image preview modal -->
                        <template v-if="activeModal === 'image' && activeTask">
                            <div class="flex items-center justify-between">
                                <h2 class="font-bold text-gray-800">תצוגת הגשה</h2>
                                <button class="text-gray-400 hover:text-gray-700" @click="closeModal">✕</button>
                            </div>
                            <img :src="activeTask.submissionImageUrl ?? ''" :alt="activeTask.title" class="rounded-xl w-full object-contain max-h-80" />
                            <a :href="activeTask.submissionUrl ?? '#'" target="_blank" class="text-xs text-[#3CC2EE] hover:underline text-center">
                                פתח קישור הגשה ↗
                            </a>
                        </template>

                        <!-- Submit modal -->
                        <template v-else-if="activeModal === 'submit' && activeTask">
                            <h2 class="text-lg font-bold">
                                הגשת עבודה
                                <span class="text-sm font-normal text-gray-500 mr-2">{{ activeTask.title }}</span>
                            </h2>
                            <label class="field">
                                <span>קישור הגשה</span>
                                <input v-model="submitUrl" type="url" placeholder="https://..." class="input" />
                            </label>
                            <label class="field">
                                <span>קישור תמונה <span class="text-gray-400">(אופציונלי)</span></span>
                                <input v-model="submitImageUrl" type="url" placeholder="https://..." class="input" />
                            </label>
                            <div v-if="submitImageUrl" class="rounded-xl overflow-hidden border border-gray-200">
                                <img :src="submitImageUrl" alt="תצוגה" class="w-full h-32 object-cover" />
                            </div>
                            <div class="flex gap-2 justify-end">
                                <button class="btn btn-ghost" :disabled="actionLoading" @click="closeModal">ביטול</button>
                                <button class="btn btn-primary" :disabled="actionLoading || !submitUrl" @click="handleSubmit">
                                    <span v-if="actionLoading" class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    <span v-else>הגש</span>
                                </button>
                            </div>
                        </template>

                        <!-- QA Review modal -->
                        <template v-else-if="activeModal === 'qa' && activeTask">
                            <h2 class="text-lg font-bold">סקירת QA <span class="text-sm font-normal text-gray-500 mr-2">{{ activeTask.title }}</span></h2>
                            <div v-if="activeTask.submissionUrl" class="bg-cyan-50 rounded-lg px-3 py-2 text-xs text-cyan-700">
                                🔗 <a :href="activeTask.submissionUrl" target="_blank" class="underline">צפייה בהגשה</a>
                            </div>
                            <div v-if="activeTask.submissionImageUrl" class="rounded-xl overflow-hidden border border-gray-200">
                                <img :src="activeTask.submissionImageUrl" alt="Submission" class="w-full h-32 object-cover" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="flex items-center gap-2 text-sm">
                                    <input v-model="qaChecklist.isCompleted" type="checkbox" class="accent-[#3CC2EE]" />
                                    דרישות המשימה הושלמו?
                                </label>
                                <label class="flex items-center gap-2 text-sm">
                                    <input v-model="qaChecklist.hasErrors" type="checkbox" class="accent-red-500" />
                                    נמצאו שגיאות?
                                </label>
                            </div>
                            <div class="field">
                                <span class="label">שיפורים</span>
                                <div class="flex gap-2">
                                    <input v-model="qaImprovementInput" class="input flex-1" placeholder="הוסף שיפור..." @keyup.enter="addImprovement" />
                                    <button class="btn btn-ghost" @click="addImprovement">+</button>
                                </div>
                                <ul v-if="qaChecklist.improvements.length" class="mt-1 space-y-1">
                                    <li v-for="(imp, i) in qaChecklist.improvements" :key="i" class="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                                        {{ imp }}
                                        <button class="text-red-400 hover:text-red-600 mr-2" @click="qaChecklist.improvements.splice(i, 1)">✕</button>
                                    </li>
                                </ul>
                            </div>
                            <label class="field">
                                <span>הערות</span>
                                <textarea v-model="qaNotes" class="input" rows="2" placeholder="הערות אופציונליות..." />
                            </label>
                            <div class="flex gap-2 justify-end">
                                <button class="btn btn-ghost" :disabled="actionLoading" @click="closeModal">ביטול</button>
                                <button class="btn btn-red" :disabled="actionLoading" @click="handleQaReview('reject')">דחה</button>
                                <button class="btn btn-green" :disabled="actionLoading" @click="handleQaReview('approve')">
                                    <span v-if="actionLoading" class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    <span v-else>אשר ✓</span>
                                </button>
                            </div>
                        </template>

                        <!-- Editor Review modal -->
                        <template v-else-if="activeModal === 'pm' && activeTask">
                            <h2 class="text-lg font-bold">סקירת Editor <span class="text-sm font-normal text-gray-500 mr-2">{{ activeTask.title }}</span></h2>
                            <div v-if="activeTask.qaChecklist" class="bg-gray-50 rounded-xl p-3 text-xs space-y-1 border border-gray-200">
                                <p class="font-semibold text-gray-600 mb-1">צ'קליסט QA</p>
                                <p>✅ הושלם: <b>{{ activeTask.qaChecklist.isCompleted ? 'כן' : 'לא' }}</b></p>
                                <p>🐛 שגיאות: <b>{{ activeTask.qaChecklist.hasErrors ? 'כן' : 'לא' }}</b></p>
                                <p v-if="activeTask.qaChecklist.improvements.length">📝 {{ activeTask.qaChecklist.improvements.join(' · ') }}</p>
                                <p v-if="activeTask.qaNotes">💬 {{ activeTask.qaNotes }}</p>
                            </div>
                            <label class="field">
                                <span>הערות Editor</span>
                                <textarea v-model="pmNotes" class="input" rows="2" placeholder="הוסף הערות..." />
                            </label>
                            <div class="flex gap-2 justify-end">
                                <button class="btn btn-ghost" :disabled="actionLoading" @click="closeModal">ביטול</button>
                                <button class="btn btn-red" :disabled="actionLoading" @click="handlePmReview('reject')">→ חזור ל-QA</button>
                                <button class="btn btn-green" :disabled="actionLoading" @click="handlePmReview('approve')">
                                    <span v-if="actionLoading" class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    <span v-else>שלח למורה ←</span>
                                </button>
                            </div>
                        </template>

                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.btn { @apply inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed; }
.btn-primary { @apply bg-[#3CC2EE] text-white hover:bg-[#27b3df] focus:ring-cyan-300; }
.btn-yellow  { @apply bg-yellow-400 text-yellow-900 hover:bg-yellow-500 focus:ring-yellow-400; }
.btn-blue    { @apply bg-purple-500 text-white hover:bg-purple-600 focus:ring-purple-400; }
.btn-green   { @apply bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-400; }
.btn-red     { @apply bg-red-500 text-white hover:bg-red-600 focus:ring-red-400; }
.btn-ghost   { @apply bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300; }
.field { @apply flex flex-col gap-1 text-sm text-gray-700; }
.label { @apply text-sm text-gray-700; }
.input { @apply border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300; }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
