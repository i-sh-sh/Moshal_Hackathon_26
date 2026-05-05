<script setup lang="ts">
import type { Task, QaChecklist } from '~/types/types';
import { useUser } from '~/composables/useUser';
import { useLeaderboard } from '~/composables/useLeaderboard';

useHead({ title: 'TeamSprintUp — Student Dashboard' });

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
const roleColors: Record<string, string> = { pm: 'bg-purple-500', qa: 'bg-yellow-500', dev: 'bg-blue-500', hardware: 'bg-orange-500' };
const roleEmoji: Record<string, string> = { pm: '📋', qa: '🔍', dev: '💻', hardware: '🔧' };

// ── Tabs ──────────────────────────────────────────────────────────────────────
const activeTab = ref<'tasks' | 'leaderboard'>('tasks');

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
    if (!user.value) { router.replace('/'); return; }
    await Promise.all([fetchTeam(), fetchTasks(), fetchLeaderboard()]);
    lastRefreshed.value = new Date();
    refreshTimer = setInterval(refreshAll, 20_000);
});

onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer); });

async function handleLogout() { logout(); await router.replace('/'); }

// ── Relative time helper ──────────────────────────────────────────────────────
const refreshLabel = computed(() => {
    if (!lastRefreshed.value) return '';
    const sec = Math.floor((Date.now() - lastRefreshed.value.getTime()) / 1000);
    return sec < 5 ? 'just now' : `${sec}s ago`;
});

// Keep label ticking
const now = ref(Date.now());
const tickTimer = setInterval(() => { now.value = Date.now(); }, 5000);
onUnmounted(() => clearInterval(tickTimer));
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex flex-col">

        <!-- ── Top nav ──────────────────────────────────────────────────── -->
        <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div class="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
                <span class="text-xl">🚀</span>
                <span class="font-bold text-gray-800 text-sm tracking-tight">TeamSprintUp</span>

                <div class="flex-1" />

                <!-- Auto-refresh indicator -->
                <button
                    class="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    title="Click to refresh now"
                    @click="refreshAll"
                >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {{ refreshLabel }}
                </button>

                <span v-if="role" class="text-xs text-white font-bold px-2.5 py-1 rounded-full" :class="roleColors[role] ?? 'bg-gray-400'">
                    {{ roleEmoji[role] }} {{ role.toUpperCase() }}
                </span>
                <span v-if="team" class="text-sm text-gray-600 font-medium hidden sm:inline">{{ team.name }}</span>
                <span v-if="team" class="text-sm font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">⭐ {{ team.accumulated_score }} pts</span>

                <div class="flex items-center gap-2 ml-2">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {{ user?.name?.charAt(0) }}
                    </div>
                    <span class="text-sm text-gray-700 font-medium hidden sm:inline">{{ user?.name }}</span>
                    <button class="text-xs text-gray-400 hover:text-gray-700 transition-colors ml-1" @click="handleLogout">Exit</button>
                </div>
            </div>
        </header>

        <!-- ── Main ────────────────────────────────────────────────────── -->
        <main class="flex-1 max-w-6xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

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
            <div class="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', activeTab === 'tasks' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700']" @click="activeTab = 'tasks'">
                    📋 My Tasks
                </button>
                <button :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-colors', activeTab === 'leaderboard' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700']" @click="activeTab = 'leaderboard'">
                    🏆 Leaderboard
                </button>
            </div>

            <!-- ── Tasks tab ──────────────────────────────────────────── -->
            <div v-if="activeTab === 'tasks'" class="flex flex-col gap-5">
                <div v-if="tasksLoading" class="flex justify-center py-12">
                    <div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>

                <div v-else-if="!tasks.length" class="text-center py-16 text-gray-400 text-sm">
                    No tasks assigned to your team yet.
                </div>

                <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <article
                        v-for="task in tasks"
                        :key="task.id"
                        class="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col p-4 gap-3 hover:shadow-md transition-shadow"
                    >
                        <!-- Header -->
                        <div class="flex items-start justify-between gap-2">
                            <h3 class="font-semibold text-gray-800 text-sm leading-snug flex-1">{{ task.title }}</h3>
                            <span :class="['text-xs font-medium px-2 py-0.5 rounded-full shrink-0', statusColors[task.status]]">
                                <EnglishTerm :term="statusLabels[task.status]" />
                            </span>
                        </div>

                        <p v-if="task.description" class="text-xs text-gray-500 leading-relaxed">{{ task.description }}</p>

                        <!-- Submission image preview -->
                        <button
                            v-if="task.submissionImageUrl"
                            class="rounded-lg overflow-hidden border border-gray-200 hover:border-indigo-300 transition-colors"
                            @click="openModal(task.id, 'image')"
                        >
                            <img :src="task.submissionImageUrl" :alt="`${task.title} submission`" class="w-full h-28 object-cover" />
                        </button>
                        <a v-else-if="task.submissionUrl" :href="task.submissionUrl" target="_blank" class="text-xs text-indigo-500 hover:underline truncate">
                            🔗 View submission
                        </a>

                        <!-- QA notes for PM -->
                        <div v-if="task.qaNotes && role === 'pm' && task.status === 'pm_review'" class="bg-yellow-50 rounded-lg px-3 py-2 text-xs text-yellow-800">
                            💬 QA: {{ task.qaNotes }}
                        </div>

                        <div class="text-xs text-gray-400">
                            Role: <EnglishTerm :term="task.assignedRole === 'pm' ? 'PM' : task.assignedRole.toUpperCase()" />
                        </div>

                        <!-- Actions -->
                        <div class="mt-auto flex flex-wrap gap-2">
                            <button v-if="canSubmit(task)" class="btn btn-primary" @click="openModal(task.id, 'submit')">
                                <EnglishTerm term="Submit" /> Work
                            </button>
                            <button v-if="canQaReview(task)" class="btn btn-yellow" @click="openModal(task.id, 'qa')">
                                QA <EnglishTerm term="Review" />
                            </button>
                            <button v-if="canPmReview(task)" class="btn btn-blue" @click="openModal(task.id, 'pm')">
                                <EnglishTerm term="PM" /> <EnglishTerm term="Review" />
                            </button>
                            <button v-if="canHint(task)" class="btn btn-ghost ml-auto" @click="onRequestHint({ taskId: task.id })">
                                💡 Hint
                            </button>
                        </div>
                    </article>
                </div>

                <HintPanel v-if="user" ref="hintPanel" :user-id="user.id" :team-id="user.currentTeamId ?? ''" />
            </div>

            <!-- ── Leaderboard tab ────────────────────────────────────── -->
            <div v-if="activeTab === 'leaderboard'" class="grid gap-5 lg:grid-cols-2">
                <Leaderboard :rows="leaderboardRows" :highlight-team-id="user?.currentTeamId ?? undefined" />

                <!-- Individual top 3 -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
                    <div class="flex items-center gap-2">
                        <span class="text-lg">⚡</span>
                        <h3 class="font-bold text-gray-800 text-sm">Top Performers</h3>
                        <span class="text-xs text-gray-400">(top 3)</span>
                    </div>

                    <div v-if="!topIndividuals.length" class="text-xs text-gray-400 text-center py-4">
                        No data yet.
                    </div>

                    <div v-else class="flex flex-col gap-3">
                        <div
                            v-for="p in topIndividuals"
                            :key="p.id"
                            class="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                            :class="{ 'bg-indigo-50 border border-indigo-200': p.id === user?.id }"
                        >
                            <span class="text-xl w-8 text-center">{{ ['🥇','🥈','🥉'][p.rank - 1] ?? `#${p.rank}` }}</span>
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-sm text-gray-800 truncate">
                                    {{ p.name }}
                                    <span v-if="p.id === user?.id" class="text-indigo-500 text-xs ml-1">(you)</span>
                                </p>
                                <p class="text-xs text-gray-400">{{ p.approvedTasks }} tasks approved</p>
                            </div>
                            <span v-if="p.currentRole" class="text-xs text-gray-500 font-medium">{{ p.currentRole.toUpperCase() }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>

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
                                <h2 class="font-bold text-gray-800">Submission Preview</h2>
                                <button class="text-gray-400 hover:text-gray-700" @click="closeModal">✕</button>
                            </div>
                            <img :src="activeTask.submissionImageUrl ?? ''" :alt="activeTask.title" class="rounded-xl w-full object-contain max-h-80" />
                            <a :href="activeTask.submissionUrl ?? '#'" target="_blank" class="text-xs text-indigo-500 hover:underline text-center">
                                Open submission link ↗
                            </a>
                        </template>

                        <!-- Submit modal -->
                        <template v-else-if="activeModal === 'submit' && activeTask">
                            <h2 class="text-lg font-bold">
                                <EnglishTerm term="Submit" /> Work
                                <span class="text-sm font-normal text-gray-500 ml-2">{{ activeTask.title }}</span>
                            </h2>
                            <label class="field">
                                <span>Submission URL</span>
                                <input v-model="submitUrl" type="url" placeholder="https://..." class="input" />
                            </label>
                            <label class="field">
                                <span>Image URL <span class="text-gray-400">(optional)</span></span>
                                <input v-model="submitImageUrl" type="url" placeholder="https://..." class="input" />
                            </label>
                            <div v-if="submitImageUrl" class="rounded-xl overflow-hidden border border-gray-200">
                                <img :src="submitImageUrl" alt="Preview" class="w-full h-32 object-cover" />
                            </div>
                            <div class="flex gap-2 justify-end">
                                <button class="btn btn-ghost" :disabled="actionLoading" @click="closeModal">Cancel</button>
                                <button class="btn btn-primary" :disabled="actionLoading || !submitUrl" @click="handleSubmit">
                                    <span v-if="actionLoading" class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    <span v-else><EnglishTerm term="Submit" /></span>
                                </button>
                            </div>
                        </template>

                        <!-- QA Review modal -->
                        <template v-else-if="activeModal === 'qa' && activeTask">
                            <h2 class="text-lg font-bold">QA <EnglishTerm term="Review" /> <span class="text-sm font-normal text-gray-500 ml-2">{{ activeTask.title }}</span></h2>
                            <div v-if="activeTask.submissionUrl" class="bg-indigo-50 rounded-lg px-3 py-2 text-xs text-indigo-700">
                                🔗 <a :href="activeTask.submissionUrl" target="_blank" class="underline">View submission</a>
                            </div>
                            <div v-if="activeTask.submissionImageUrl" class="rounded-xl overflow-hidden border border-gray-200">
                                <img :src="activeTask.submissionImageUrl" alt="Submission" class="w-full h-32 object-cover" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="flex items-center gap-2 text-sm">
                                    <input v-model="qaChecklist.isCompleted" type="checkbox" class="accent-indigo-600" />
                                    Task requirements completed?
                                </label>
                                <label class="flex items-center gap-2 text-sm">
                                    <input v-model="qaChecklist.hasErrors" type="checkbox" class="accent-red-500" />
                                    Errors found?
                                </label>
                            </div>
                            <div class="field">
                                <span class="label">Improvements</span>
                                <div class="flex gap-2">
                                    <input v-model="qaImprovementInput" class="input flex-1" placeholder="Add improvement..." @keyup.enter="addImprovement" />
                                    <button class="btn btn-ghost" @click="addImprovement">+</button>
                                </div>
                                <ul v-if="qaChecklist.improvements.length" class="mt-1 space-y-1">
                                    <li v-for="(imp, i) in qaChecklist.improvements" :key="i" class="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                                        {{ imp }}
                                        <button class="text-red-400 hover:text-red-600 ml-2" @click="qaChecklist.improvements.splice(i, 1)">✕</button>
                                    </li>
                                </ul>
                            </div>
                            <label class="field">
                                <span>Notes</span>
                                <textarea v-model="qaNotes" class="input" rows="2" placeholder="Optional notes..." />
                            </label>
                            <div class="flex gap-2 justify-end">
                                <button class="btn btn-ghost" :disabled="actionLoading" @click="closeModal">Cancel</button>
                                <button class="btn btn-red" :disabled="actionLoading" @click="handleQaReview('reject')">Reject</button>
                                <button class="btn btn-green" :disabled="actionLoading" @click="handleQaReview('approve')">
                                    <span v-if="actionLoading" class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    <span v-else>Approve ✓</span>
                                </button>
                            </div>
                        </template>

                        <!-- PM Review modal -->
                        <template v-else-if="activeModal === 'pm' && activeTask">
                            <h2 class="text-lg font-bold"><EnglishTerm term="PM" /> <EnglishTerm term="Review" /> <span class="text-sm font-normal text-gray-500 ml-2">{{ activeTask.title }}</span></h2>
                            <div v-if="activeTask.qaChecklist" class="bg-gray-50 rounded-xl p-3 text-xs space-y-1 border border-gray-200">
                                <p class="font-semibold text-gray-600 mb-1">QA Checklist</p>
                                <p>✅ Completed: <b>{{ activeTask.qaChecklist.isCompleted ? 'Yes' : 'No' }}</b></p>
                                <p>🐛 Errors: <b>{{ activeTask.qaChecklist.hasErrors ? 'Yes' : 'No' }}</b></p>
                                <p v-if="activeTask.qaChecklist.improvements.length">📝 {{ activeTask.qaChecklist.improvements.join(' · ') }}</p>
                                <p v-if="activeTask.qaNotes">💬 {{ activeTask.qaNotes }}</p>
                            </div>
                            <label class="field">
                                <span>PM Notes</span>
                                <textarea v-model="pmNotes" class="input" rows="2" placeholder="Add your notes..." />
                            </label>
                            <div class="flex gap-2 justify-end">
                                <button class="btn btn-ghost" :disabled="actionLoading" @click="closeModal">Cancel</button>
                                <button class="btn btn-red" :disabled="actionLoading" @click="handlePmReview('reject')">← Back to QA</button>
                                <button class="btn btn-green" :disabled="actionLoading" @click="handlePmReview('approve')">
                                    <span v-if="actionLoading" class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    <span v-else>Send to Teacher →</span>
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
.btn { @apply inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed; }
.btn-primary { @apply bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500; }
.btn-yellow  { @apply bg-yellow-400 text-yellow-900 hover:bg-yellow-500 focus:ring-yellow-400; }
.btn-blue    { @apply bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-400; }
.btn-green   { @apply bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-400; }
.btn-red     { @apply bg-red-500 text-white hover:bg-red-600 focus:ring-red-400; }
.btn-ghost   { @apply bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300; }
.field { @apply flex flex-col gap-1 text-sm text-gray-700; }
.label { @apply text-sm text-gray-700; }
.input { @apply border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400; }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
