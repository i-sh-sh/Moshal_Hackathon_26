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
    pending:        'bg-gray-100 text-gray-600',
    qa_review:      'bg-amber-100 text-amber-700',
    pm_review:      'bg-violet-100 text-violet-700',
    teacher_review: 'bg-blue-100 text-blue-700',
    approved:       'bg-emerald-100 text-emerald-700',
    rejected:       'bg-red-100 text-red-600',
};

// Role accent bar (right border in RTL = visual start of card)
const roleBarColors: Record<string, string> = {
    pm:       'bg-violet-400',
    qa:       'bg-amber-400',
    dev:      'bg-blue-400',
    hardware: 'bg-emerald-400',
};

// Role chip colors inside card
const roleChipColors: Record<string, string> = {
    pm:       'bg-violet-100 text-violet-700',
    qa:       'bg-amber-100 text-amber-700',
    dev:      'bg-blue-100 text-blue-700',
    hardware: 'bg-emerald-100 text-emerald-700',
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
    computed(() => team.value?.name ?? ''),
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
const activeTab = ref<'tasks' | 'leaderboard' | 'chat' | 'mentor' | 'progress' | 'events' | 'printer' | 'lab'>('tasks');

const tabs = [
    { id: 'tasks',       label: 'משימות' },
    { id: 'leaderboard', label: 'דירוג' },
    { id: 'chat',        label: "צ'אט" },
    { id: 'mentor',      label: 'מנטור' },
    { id: 'progress',    label: 'התקדמות' },
    { id: 'events',      label: 'אירועים' },
    { id: 'printer',     label: 'מדפסת' },
    { id: 'lab',         label: 'מעבדה' },
] as const;

// ── Sidebar view → tab mapping ────────────────────────────────────────────────
type SidebarView = 'status' | 'challenges' | 'events' | 'printer' | 'lab';
const sidebarTabMap: Record<SidebarView, typeof activeTab.value> = {
    status:     'progress',
    challenges: 'tasks',
    events:     'events',
    printer:    'printer',
    lab:        'lab',
};

const sidebarActiveView = computed<SidebarView>(() => {
    const reverse = Object.entries(sidebarTabMap).find(([, t]) => t === activeTab.value);
    return (reverse?.[0] as SidebarView) ?? 'challenges';
});

function onSidebarNavigate(view: SidebarView) {
    activeTab.value = sidebarTabMap[view];
}

// ── Events (לוח אירועים) ──────────────────────────────────────────────────────
const events = ref<any[]>([]);
const eventsLoading = ref(false);

async function fetchEvents() {
    if (!user.value?.currentTeamId) return;
    eventsLoading.value = true;
    try {
        events.value = await $fetch(`${base}/events?teamId=${user.value.currentTeamId}`);
    } catch {
        events.value = [];
    } finally {
        eventsLoading.value = false;
    }
}

const eventTypeLabel: Record<string, string> = {
    event:        'אירוע',
    deadline:     'מועד אחרון',
    announcement: 'הודעה',
};
const eventTypeColor: Record<string, string> = {
    event:        'bg-blue-100 text-blue-700',
    deadline:     'bg-red-100 text-red-700',
    announcement: 'bg-amber-100 text-amber-700',
};

function formatEventDate(iso: string) {
    return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', weekday: 'long' });
}

// ── Printer jobs ──────────────────────────────────────────────────────────────
const printerJobs = ref<any[]>([]);
const printerLoading = ref(false);
const printerForm = reactive({ title: '', description: '', fileUrl: '', copies: 1 });
const printerSubmitting = ref(false);

async function fetchPrinterJobs() {
    if (!user.value?.currentTeamId) return;
    printerLoading.value = true;
    try {
        printerJobs.value = await $fetch(`${base}/printer/jobs?teamId=${user.value.currentTeamId}`);
    } catch {
        printerJobs.value = [];
    } finally {
        printerLoading.value = false;
    }
}

async function submitPrintJob() {
    if (!printerForm.title.trim() || !user.value?.currentTeamId) return;
    printerSubmitting.value = true;
    try {
        await $fetch(`${base}/printer/jobs`, {
            method: 'POST',
            body: { teamId: user.value.currentTeamId, ...printerForm },
        });
        printerForm.title = '';
        printerForm.description = '';
        printerForm.fileUrl = '';
        printerForm.copies = 1;
        await fetchPrinterJobs();
        showToast('עבודת הדפסה נשלחה!');
    } catch {
        showToast('שגיאה בשליחת העבודה', 'error');
    } finally {
        printerSubmitting.value = false;
    }
}

async function updateJobStatus(id: string, status: string) {
    try {
        await $fetch(`${base}/printer/jobs/${id}/status`, { method: 'PATCH', body: { status } });
        await fetchPrinterJobs();
        showToast('סטטוס עודכן');
    } catch {
        showToast('שגיאה בעדכון', 'error');
    }
}

const jobStatusLabel: Record<string, string> = {
    pending:  'ממתין',
    printing: 'מודפס',
    done:     'הושלם',
    cancelled: 'בוטל',
};
const jobStatusColor: Record<string, string> = {
    pending:  'bg-amber-100 text-amber-700',
    printing: 'bg-blue-100 text-blue-700',
    done:     'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-gray-100 text-gray-500',
};

// ── Lab sessions ──────────────────────────────────────────────────────────────
const labTools = ref<any[]>([]);
const labSessions = ref<any[]>([]);
const labLoading = ref(false);
const labForm = reactive({ toolId: '', purpose: '' });
const labSubmitting = ref(false);

async function fetchLab() {
    if (!user.value?.currentTeamId) return;
    labLoading.value = true;
    try {
        const [tools, sessions] = await Promise.all([
            $fetch<any[]>(`${base}/lab/tools`),
            $fetch<any[]>(`${base}/lab/sessions?teamId=${user.value.currentTeamId}`),
        ]);
        labTools.value = tools;
        labSessions.value = sessions;
    } catch {
        labTools.value = [];
        labSessions.value = [];
    } finally {
        labLoading.value = false;
    }
}

async function startLabSession() {
    if (!labForm.purpose.trim() || !user.value?.currentTeamId) return;
    labSubmitting.value = true;
    try {
        await $fetch(`${base}/lab/sessions`, {
            method: 'POST',
            body: { teamId: user.value.currentTeamId, toolId: labForm.toolId || undefined, purpose: labForm.purpose },
        });
        labForm.purpose = '';
        labForm.toolId = '';
        await fetchLab();
        showToast('סשן מעבדה נפתח!');
    } catch {
        showToast('שגיאה בפתיחת סשן', 'error');
    } finally {
        labSubmitting.value = false;
    }
}

async function endLabSession(id: string) {
    try {
        await $fetch(`${base}/lab/sessions/${id}/end`, { method: 'PATCH', body: { status: 'completed' } });
        await fetchLab();
        showToast('סשן הסתיים');
    } catch {
        showToast('שגיאה', 'error');
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
    if (!user.value) { router.replace('/'); return; }
    await Promise.all([fetchTeam(), fetchTasks(), fetchLeaderboard()]);
    lastRefreshed.value = new Date();
    refreshTimer = setInterval(refreshAll, 20_000);
    if (user.value.currentTeamId) {
        initChannel().then(() => startChatPolling(5000));
    }
    if (user.value.id) {
        fetchMyProfile(user.value.id);
        fetchSnapshots(user.value.id);
    }
});

// Lazy-load feature data when switching tabs
watch(activeTab, (tab) => {
    if (tab === 'events'  && !events.value.length)       fetchEvents();
    if (tab === 'printer' && !printerJobs.value.length)  fetchPrinterJobs();
    if (tab === 'lab'     && !labTools.value.length)     fetchLab();
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
    return sec < 5 ? 'עכשיו' : `לפני ${sec}ש'`;
});

const now = ref(Date.now());
let tickTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
    tickTimer = setInterval(() => { now.value = Date.now(); }, 5000);
});
onUnmounted(() => { if (tickTimer) clearInterval(tickTimer); });
</script>

<template>
    <div class="min-h-screen bg-[#F8FAFC] flex" dir="rtl">

        <!-- Sidebar -->
        <TechSchoolSidebar
            school-label="School Test 01"
            :on-logout="handleLogout"
            :hide-mentor-bot="true"
            :active-view="sidebarActiveView"
            @navigate="onSidebarNavigate"
        />

        <!-- Main content -->
        <div class="flex-1 flex flex-col min-w-0">

            <!-- ── Header ──────────────────────────────────────────────── -->
            <header class="bg-white/80 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-30">
                <div class="px-6 h-14 flex items-center gap-3">

                    <!-- Live indicator + team name + score -->
                    <div class="flex items-center gap-2.5">
                        <span class="relative flex h-2 w-2">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span v-if="team" class="text-sm font-semibold text-gray-800">{{ team.name }}</span>
                        <span
                            v-if="team"
                            class="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-2.5 py-0.5 rounded-full"
                        >
                            ⭐ {{ team.accumulated_score }} נק'
                        </span>
                    </div>

                    <div class="flex-1" />

                    <!-- Refresh -->
                    <button
                        class="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2.5 py-1 rounded-full hover:bg-gray-100 cursor-pointer"
                        title="לחץ לרענן"
                        @click="refreshAll"
                    >
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                        </svg>
                        {{ refreshLabel }}
                    </button>

                    <!-- User avatar -->
                    <div class="flex items-center gap-2 mr-1">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center text-white text-xs font-bold shadow-sm ring-2 ring-white">
                            {{ user?.name?.charAt(0) }}
                        </div>
                        <span class="text-sm text-gray-700 font-medium hidden sm:inline">{{ user?.name }}</span>
                    </div>
                </div>
            </header>

            <!-- ── Main ───────────────────────────────────────────────── -->
            <main class="flex-1 w-full px-6 py-6 flex flex-col gap-5 max-w-6xl mx-auto">

                <!-- No team warning -->
                <div v-if="!user?.currentTeamId" class="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800 flex items-center gap-3">
                    <svg class="w-5 h-5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    אינך משויך/ת לצוות. בקש/י מהמורה להקצות אותך לצוות.
                </div>

                <!-- Sprint progress -->
                <SprintProgress
                    v-if="team?.sprints"
                    :sprint-title="team.sprints.title"
                    :approved="sprintProgress.approved"
                    :total="sprintProgress.total"
                    :score="team.accumulated_score"
                    :sprint-status="team.sprint_status"
                />

                <!-- ── Tabs ────────────────────────────────────────────── -->
                <div class="flex gap-0.5 bg-gray-100/90 p-1 rounded-2xl w-fit flex-wrap border border-gray-200/70 shadow-sm">
                    <button
                        v-for="tab in tabs"
                        :key="tab.id"
                        :class="[
                            'px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer select-none',
                            activeTab === tab.id
                                ? 'bg-white shadow-sm text-gray-900 ring-1 ring-black/5'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-white/60',
                        ]"
                        @click="activeTab = tab.id"
                    >
                        {{ tab.label }}
                    </button>
                </div>

                <!-- ── Tasks tab ──────────────────────────────────────── -->
                <div v-if="activeTab === 'tasks'" class="flex flex-col gap-5">

                    <div v-if="tasksLoading" class="flex justify-center py-16">
                        <div class="w-8 h-8 rounded-full animate-spin" style="border: 3px solid #d0f4ff; border-top-color: #3CC2EE;" />
                    </div>

                    <div v-else-if="!tasks.length" class="text-center py-20">
                        <div class="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                            <svg class="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                            </svg>
                        </div>
                        <p class="text-sm text-gray-400">עדיין לא הוקצו משימות לצוות שלך.</p>
                    </div>

                    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <article
                            v-for="(task, index) in tasks"
                            :key="task.id"
                            class="group relative rounded-2xl border flex flex-col overflow-hidden transition-all duration-200"
                            :class="index === 0
                                ? 'bg-white border-gray-200 hover:border-[#3CC2EE]/50 hover:shadow-[0_4px_24px_0_rgb(60_194_238_/_0.10)] cursor-pointer'
                                : 'bg-gray-50/70 border-gray-200/60 cursor-not-allowed select-none'"
                            @click="navigateToTask(task.id, $event, index !== 0)"
                        >
                            <!-- Role accent bar on right (= visual start in RTL) -->
                            <div
                                class="absolute inset-y-0 right-0 w-1 rounded-r-2xl"
                                :class="index === 0 ? roleBarColors[task.assignedRole] : 'bg-gray-200'"
                            />

                            <div class="flex flex-col p-4 pr-5 gap-3 flex-1">

                                <!-- Challenge number -->
                                <div class="flex items-center justify-between gap-2">
                                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        אתגר {{ index + 1 }}
                                    </span>
                                    <!-- Role chip -->
                                    <span
                                        class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        :class="index === 0 ? roleChipColors[task.assignedRole] : 'bg-gray-100 text-gray-400'"
                                    >
                                        <EnglishTerm :term="ROLE_LABELS[task.assignedRole as StudentRole] ?? task.assignedRole" />
                                    </span>
                                </div>

                                <!-- Title + status badge -->
                                <div class="flex items-start justify-between gap-2">
                                    <h3
                                        class="font-semibold text-sm leading-snug flex-1"
                                        :class="index === 0 ? 'text-gray-800' : 'text-gray-400'"
                                    >
                                        {{ task.title }}
                                    </h3>
                                    <span
                                        class="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                                        :class="index === 0 ? statusColors[task.status] : 'bg-gray-100 text-gray-400'"
                                    >
                                        <EnglishTerm :term="statusLabels[task.status]" />
                                    </span>
                                </div>

                                <p v-if="task.description" class="text-xs text-gray-500 leading-relaxed line-clamp-2">
                                    {{ task.description }}
                                </p>

                                <!-- Submission preview -->
                                <button
                                    v-if="task.submissionImageUrl"
                                    class="rounded-xl overflow-hidden border border-gray-200 hover:border-[#3CC2EE]/40 transition-colors"
                                    @click.stop="openModal(task.id, 'image')"
                                >
                                    <img :src="task.submissionImageUrl" :alt="`${task.title} submission`" class="w-full h-28 object-cover" />
                                </button>
                                <a
                                    v-else-if="task.submissionUrl"
                                    :href="task.submissionUrl"
                                    target="_blank"
                                    class="text-xs text-[#3CC2EE] hover:underline truncate flex items-center gap-1"
                                    @click.stop
                                >
                                    <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                                    </svg>
                                    צפייה בהגשה
                                </a>

                                <!-- QA notes for PM -->
                                <div
                                    v-if="task.qaNotes && role === 'pm' && task.status === 'pm_review'"
                                    class="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-800"
                                >
                                    💬 QA: {{ task.qaNotes }}
                                </div>

                                <!-- Actions -->
                                <div class="mt-auto flex flex-wrap gap-2 pt-1">
                                    <button v-if="canSubmit(task)" class="btn btn-primary btn-sm" @click.stop="openModal(task.id, 'submit')">
                                        הגש עבודה
                                    </button>
                                    <button v-if="canQaReview(task)" class="btn btn-yellow btn-sm" @click.stop="openModal(task.id, 'qa')">
                                        QA Review
                                    </button>
                                    <button v-if="canPmReview(task)" class="btn btn-indigo btn-sm" @click.stop="openModal(task.id, 'pm')">
                                        Editor Review
                                    </button>
                                    <button v-if="canHint(task)" class="btn btn-ghost btn-sm mr-auto" @click.stop="onRequestHint({ taskId: task.id })">
                                        💡 רמז
                                    </button>
                                </div>

                            </div>

                            <!-- Locked overlay -->
                            <div
                                v-if="index !== 0"
                                class="absolute inset-0 bg-white/50 backdrop-blur-[1.5px] flex items-center justify-center rounded-2xl"
                            >
                                <div class="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm">
                                    <svg class="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                        <path d="M7 11V7a5 5 0 0110 0v4"/>
                                    </svg>
                                    <span class="text-xs text-gray-500 font-semibold">נעול</span>
                                </div>
                            </div>
                        </article>
                    </div>

                    <HintPanel v-if="user" ref="hintPanel" :user-id="user.id" :team-id="user.currentTeamId ?? ''" />
                </div>

                <!-- ── Chat tab ────────────────────────────────────────── -->
                <div v-if="activeTab === 'chat'" class="flex flex-col" style="height: 580px">
                    <div v-if="!channel" class="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                        <div class="w-8 h-8 rounded-full animate-spin" style="border: 3px solid #d0f4ff; border-top-color: #3CC2EE;" />
                        <span class="text-sm">מתחבר לצ'אט הצוות...</span>
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

                <!-- ── Mentor tab ──────────────────────────────────────── -->
                <div v-if="activeTab === 'mentor'" class="flex flex-col" style="height: 580px">
                    <ChatChannel
                        class="h-full"
                        channel-name="DUDE — מנטור אישי"
                        :messages="dudeMessages"
                        :sending="dudeSending"
                        :current-user-id="user?.id ?? ''"
                        @send="dudeSendMessage"
                    />
                </div>

                <!-- ── Progress tab ────────────────────────────────────── -->
                <div v-if="activeTab === 'progress'" class="flex flex-col gap-5">
                    <div v-if="!myProfile" class="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                        <div class="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                            <svg class="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
                            </svg>
                        </div>
                        <p class="text-sm">אין עדיין פרופיל לימודי. שלח הודעות בצ'אט כדי לאסוף נתונים.</p>
                    </div>
                    <StudentProfileCard
                        v-else
                        :profile="myProfile"
                        :snapshots="mySnapshots"
                        :user-name="user?.name"
                    />
                </div>

                <!-- ── Events tab ─────────────────────────────────────── -->
                <div v-if="activeTab === 'events'" class="flex flex-col gap-4">
                    <div v-if="eventsLoading" class="flex justify-center py-16">
                        <div class="w-8 h-8 rounded-full animate-spin" style="border: 3px solid #d0f4ff; border-top-color: #3CC2EE;" />
                    </div>
                    <div v-else-if="!events.length" class="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                        <div class="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                            <svg class="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                        </div>
                        <p class="text-sm">אין אירועים קרובים.</p>
                    </div>
                    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div
                            v-for="ev in events"
                            :key="ev.id"
                            class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
                        >
                            <div class="flex items-center justify-between gap-2">
                                <span :class="['text-[11px] font-bold px-2 py-0.5 rounded-full', eventTypeColor[ev.event_type] ?? 'bg-gray-100 text-gray-600']">
                                    {{ eventTypeLabel[ev.event_type] ?? ev.event_type }}
                                </span>
                                <span class="text-xs text-gray-400">{{ formatEventDate(ev.event_date) }}</span>
                            </div>
                            <h3 class="font-semibold text-sm text-gray-800">{{ ev.title }}</h3>
                            <p v-if="ev.description" class="text-xs text-gray-500 leading-relaxed">{{ ev.description }}</p>
                        </div>
                    </div>
                </div>

                <!-- ── Printer tab ─────────────────────────────────────── -->
                <div v-if="activeTab === 'printer'" class="flex flex-col gap-5">
                    <!-- Submit form -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
                        <h3 class="font-bold text-gray-800 text-sm">שליחת עבודת הדפסה חדשה</h3>
                        <div class="grid gap-3 sm:grid-cols-2">
                            <label class="field">
                                <span>שם העבודה *</span>
                                <input v-model="printerForm.title" class="input" placeholder="לדוג׳ — מכסה מדפסת 3D" />
                            </label>
                            <label class="field">
                                <span>קישור לקובץ</span>
                                <input v-model="printerForm.fileUrl" type="url" class="input" placeholder="https://..." />
                            </label>
                            <label class="field sm:col-span-2">
                                <span>תיאור</span>
                                <textarea v-model="printerForm.description" class="input" rows="2" placeholder="פירוט מה להדפיס, חומר, גודל..." />
                            </label>
                            <label class="field">
                                <span>עותקים</span>
                                <input v-model.number="printerForm.copies" type="number" min="1" max="20" class="input w-24" />
                            </label>
                        </div>
                        <button
                            class="btn btn-primary btn-md self-start"
                            :disabled="!printerForm.title.trim() || printerSubmitting"
                            @click="submitPrintJob"
                        >
                            <span v-if="printerSubmitting" class="w-4 h-4 rounded-full animate-spin shrink-0" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: white;" />
                            <span v-else>שלח לתור הדפסה</span>
                        </button>
                    </div>

                    <!-- Jobs list -->
                    <div v-if="printerLoading" class="flex justify-center py-8">
                        <div class="w-7 h-7 rounded-full animate-spin" style="border: 3px solid #d0f4ff; border-top-color: #3CC2EE;" />
                    </div>
                    <div v-else-if="!printerJobs.length" class="text-center py-10 text-sm text-gray-400">
                        אין עבודות בתור.
                    </div>
                    <div v-else class="flex flex-col gap-3">
                        <div
                            v-for="job in printerJobs"
                            :key="job.id"
                            class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-start gap-4"
                        >
                            <div class="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                <svg class="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                                    <rect x="6" y="14" width="12" height="8"/>
                                </svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between gap-2 flex-wrap">
                                    <p class="font-semibold text-sm text-gray-800">{{ job.title }}</p>
                                    <span :class="['text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0', jobStatusColor[job.status] ?? 'bg-gray-100 text-gray-600']">
                                        {{ jobStatusLabel[job.status] ?? job.status }}
                                    </span>
                                </div>
                                <p v-if="job.description" class="text-xs text-gray-500 mt-1">{{ job.description }}</p>
                                <div class="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                    <span>{{ job.copies }} עותקים</span>
                                    <span v-if="job.submitter">{{ job.submitter.name }}</span>
                                </div>
                                <!-- Hardware role: update status -->
                                <div v-if="role === 'hardware' && job.status !== 'done' && job.status !== 'cancelled'" class="flex gap-2 mt-3">
                                    <button v-if="job.status === 'pending'"  class="btn btn-primary btn-sm"  @click="updateJobStatus(job.id, 'printing')">התחל הדפסה</button>
                                    <button v-if="job.status === 'printing'" class="btn btn-success btn-sm" @click="updateJobStatus(job.id, 'done')">סמן כהושלם</button>
                                    <button class="btn btn-ghost btn-sm" @click="updateJobStatus(job.id, 'cancelled')">בטל</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── Lab tab ─────────────────────────────────────────── -->
                <div v-if="activeTab === 'lab'" class="flex flex-col gap-5">
                    <!-- Start session form -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
                        <h3 class="font-bold text-gray-800 text-sm">פתיחת סשן מעבדה</h3>
                        <div class="grid gap-3 sm:grid-cols-2">
                            <label class="field">
                                <span>כלי / ציוד</span>
                                <select v-model="labForm.toolId" class="input">
                                    <option value="">בחר כלי (אופציונלי)</option>
                                    <option v-for="t in labTools" :key="t.id" :value="t.id">{{ t.name }}</option>
                                </select>
                            </label>
                            <label class="field">
                                <span>מטרת הסשן *</span>
                                <input v-model="labForm.purpose" class="input" placeholder="לדוג׳ — הדפסת מעטפת למכשיר" />
                            </label>
                        </div>
                        <button
                            class="btn btn-primary btn-md self-start"
                            :disabled="!labForm.purpose.trim() || labSubmitting"
                            @click="startLabSession"
                        >
                            <span v-if="labSubmitting" class="w-4 h-4 rounded-full animate-spin shrink-0" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: white;" />
                            <span v-else">פתח סשן</span>
                        </button>
                    </div>

                    <!-- Sessions list -->
                    <div v-if="labLoading" class="flex justify-center py-8">
                        <div class="w-7 h-7 rounded-full animate-spin" style="border: 3px solid #d0f4ff; border-top-color: #3CC2EE;" />
                    </div>
                    <div v-else-if="!labSessions.length" class="text-center py-10 text-sm text-gray-400">
                        אין סשנים קודמים.
                    </div>
                    <div v-else class="flex flex-col gap-3">
                        <div
                            v-for="s in labSessions"
                            :key="s.id"
                            class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-start gap-4"
                        >
                            <div class="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                                <svg class="w-5 h-5 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
                                </svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between gap-2 flex-wrap">
                                    <p class="font-semibold text-sm text-gray-800">{{ s.purpose }}</p>
                                    <span :class="['text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0',
                                        s.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                        s.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                        'bg-gray-100 text-gray-500']">
                                        {{ s.status === 'active' ? 'פעיל' : s.status === 'completed' ? 'הושלם' : 'בוטל' }}
                                    </span>
                                </div>
                                <p v-if="s.tool" class="text-xs text-gray-500 mt-1">{{ s.tool.name }}</p>
                                <div class="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                    <span>{{ new Date(s.started_at).toLocaleDateString('he-IL') }}</span>
                                    <span v-if="s.user">{{ s.user.name }}</span>
                                </div>
                                <button
                                    v-if="s.status === 'active'"
                                    class="btn btn-success btn-sm mt-3"
                                    @click="endLabSession(s.id)"
                                >
                                    סיים סשן
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── Leaderboard tab ─────────────────────────────────── -->
                <div v-if="activeTab === 'leaderboard'" class="grid gap-5 lg:grid-cols-2">
                    <Leaderboard :rows="leaderboardRows" :highlight-team-id="user?.currentTeamId ?? undefined" />

                    <!-- Individual top 3 -->
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
                        <div class="flex items-center gap-2">
                            <div class="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center">
                                <svg class="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                                </svg>
                            </div>
                            <h3 class="font-bold text-gray-800 text-sm">תלמידים מובילים</h3>
                            <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">טופ 3</span>
                        </div>

                        <div v-if="!topIndividuals.length" class="text-xs text-gray-400 text-center py-4">
                            אין נתונים עדיין.
                        </div>

                        <div v-else class="flex flex-col gap-2">
                            <div
                                v-for="p in topIndividuals.slice(0, 3)"
                                :key="p.id"
                                class="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors"
                                :class="p.id === user?.id
                                    ? 'bg-cyan-50 border border-[#3CC2EE]/30'
                                    : 'bg-gray-50 border border-transparent'"
                            >
                                <span class="text-xl w-8 text-center shrink-0">
                                    {{ ['🥇','🥈','🥉'][p.rank - 1] ?? `#${p.rank}` }}
                                </span>
                                <div class="flex-1 min-w-0">
                                    <p class="font-semibold text-sm text-gray-800 truncate">
                                        {{ p.name }}
                                        <span v-if="p.id === user?.id" class="text-[#3CC2EE] text-xs mr-1">(אתה)</span>
                                    </p>
                                    <p class="text-xs text-gray-400">{{ p.approvedTasks }} משימות אושרו</p>
                                </div>
                                <span v-if="p.currentRole" class="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                                    {{ roleDisplay(p.currentRole) }}
                                </span>
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
                    :class="[
                        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold pointer-events-none',
                        toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white',
                    ]"
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
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    @click.self="closeModal"
                >
                    <div class="bg-white rounded-2xl shadow-hover w-full max-w-md p-6 flex flex-col gap-4">

                        <!-- Image preview modal -->
                        <template v-if="activeModal === 'image' && activeTask">
                            <div class="flex items-center justify-between">
                                <h2 class="font-bold text-gray-800">תצוגת הגשה</h2>
                                <button class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer" @click="closeModal">
                                    <svg class="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                            <img :src="activeTask.submissionImageUrl ?? ''" :alt="activeTask.title" class="rounded-xl w-full object-contain max-h-80" />
                            <a :href="activeTask.submissionUrl ?? '#'" target="_blank" class="text-xs text-[#3CC2EE] hover:underline text-center">
                                פתח קישור הגשה ↗
                            </a>
                        </template>

                        <!-- Submit modal -->
                        <template v-else-if="activeModal === 'submit' && activeTask">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h2 class="text-base font-bold text-gray-800">הגשת עבודה</h2>
                                    <p class="text-xs text-gray-400 mt-0.5">{{ activeTask.title }}</p>
                                </div>
                                <button class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer" @click="closeModal">
                                    <svg class="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                            <label class="field">
                                <span>קישור הגשה</span>
                                <input v-model="submitUrl" type="url" placeholder="https://..." class="input" />
                            </label>
                            <label class="field">
                                <span>קישור תמונה <span class="text-gray-400 font-normal">(אופציונלי)</span></span>
                                <input v-model="submitImageUrl" type="url" placeholder="https://..." class="input" />
                            </label>
                            <div v-if="submitImageUrl" class="rounded-xl overflow-hidden border border-gray-200">
                                <img :src="submitImageUrl" alt="תצוגה" class="w-full h-32 object-cover" />
                            </div>
                            <div class="flex gap-2 justify-end pt-1">
                                <button class="btn btn-ghost btn-md" :disabled="actionLoading" @click="closeModal">ביטול</button>
                                <button class="btn btn-primary btn-md" :disabled="actionLoading || !submitUrl" @click="handleSubmit">
                                    <span v-if="actionLoading" class="w-4 h-4 rounded-full animate-spin shrink-0" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: white;" />
                                    <span v-else>הגש עבודה</span>
                                </button>
                            </div>
                        </template>

                        <!-- QA Review modal -->
                        <template v-else-if="activeModal === 'qa' && activeTask">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h2 class="text-base font-bold text-gray-800">סקירת QA</h2>
                                    <p class="text-xs text-gray-400 mt-0.5">{{ activeTask.title }}</p>
                                </div>
                                <button class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer" @click="closeModal">
                                    <svg class="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                            <div v-if="activeTask.submissionUrl" class="bg-[#3CC2EE]/8 border border-[#3CC2EE]/20 rounded-xl px-3 py-2 text-xs text-[#1e8db4] flex items-center gap-2">
                                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                                <a :href="activeTask.submissionUrl" target="_blank" class="underline hover:no-underline">צפייה בהגשה</a>
                            </div>
                            <div v-if="activeTask.submissionImageUrl" class="rounded-xl overflow-hidden border border-gray-200">
                                <img :src="activeTask.submissionImageUrl" alt="Submission" class="w-full h-32 object-cover" />
                            </div>
                            <div class="flex flex-col gap-2.5 bg-gray-50 rounded-xl p-3 border border-gray-200">
                                <label class="flex items-center gap-2.5 text-sm cursor-pointer">
                                    <input v-model="qaChecklist.isCompleted" type="checkbox" class="accent-[#3CC2EE] w-4 h-4 rounded" />
                                    <span class="text-gray-700">דרישות המשימה הושלמו?</span>
                                </label>
                                <label class="flex items-center gap-2.5 text-sm cursor-pointer">
                                    <input v-model="qaChecklist.hasErrors" type="checkbox" class="accent-red-500 w-4 h-4 rounded" />
                                    <span class="text-gray-700">נמצאו שגיאות?</span>
                                </label>
                            </div>
                            <div class="field">
                                <span class="label">שיפורים</span>
                                <div class="flex gap-2">
                                    <input v-model="qaImprovementInput" class="input flex-1" placeholder="הוסף שיפור..." @keyup.enter="addImprovement" />
                                    <button class="btn btn-ghost btn-md px-3" @click="addImprovement">+</button>
                                </div>
                                <ul v-if="qaChecklist.improvements.length" class="mt-1.5 space-y-1">
                                    <li v-for="(imp, i) in qaChecklist.improvements" :key="i" class="flex items-center justify-between text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                                        <span class="text-gray-700">{{ imp }}</span>
                                        <button class="text-gray-400 hover:text-red-500 transition-colors mr-2 cursor-pointer" @click="qaChecklist.improvements.splice(i, 1)">
                                            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                        </button>
                                    </li>
                                </ul>
                            </div>
                            <label class="field">
                                <span>הערות</span>
                                <textarea v-model="qaNotes" class="input" rows="2" placeholder="הערות אופציונליות..." />
                            </label>
                            <div class="flex gap-2 justify-end pt-1">
                                <button class="btn btn-ghost btn-md" :disabled="actionLoading" @click="closeModal">ביטול</button>
                                <button class="btn btn-danger btn-md" :disabled="actionLoading" @click="handleQaReview('reject')">דחה</button>
                                <button class="btn btn-success btn-md" :disabled="actionLoading" @click="handleQaReview('approve')">
                                    <span v-if="actionLoading" class="w-4 h-4 rounded-full animate-spin shrink-0" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: white;" />
                                    <span v-else>אשר ✓</span>
                                </button>
                            </div>
                        </template>

                        <!-- Editor Review modal -->
                        <template v-else-if="activeModal === 'pm' && activeTask">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h2 class="text-base font-bold text-gray-800">סקירת Editor</h2>
                                    <p class="text-xs text-gray-400 mt-0.5">{{ activeTask.title }}</p>
                                </div>
                                <button class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer" @click="closeModal">
                                    <svg class="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                            <div v-if="activeTask.qaChecklist" class="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5 border border-gray-200">
                                <p class="font-semibold text-gray-600 mb-2 text-xs uppercase tracking-wide">צ'קליסט QA</p>
                                <p class="flex items-center gap-1.5 text-gray-700">
                                    <span :class="activeTask.qaChecklist.isCompleted ? 'text-emerald-500' : 'text-gray-400'">
                                        {{ activeTask.qaChecklist.isCompleted ? '✓' : '✗' }}
                                    </span>
                                    הושלם: <b>{{ activeTask.qaChecklist.isCompleted ? 'כן' : 'לא' }}</b>
                                </p>
                                <p class="flex items-center gap-1.5 text-gray-700">
                                    <span :class="activeTask.qaChecklist.hasErrors ? 'text-red-500' : 'text-gray-400'">
                                        {{ activeTask.qaChecklist.hasErrors ? '⚠' : '✓' }}
                                    </span>
                                    שגיאות: <b>{{ activeTask.qaChecklist.hasErrors ? 'כן' : 'לא' }}</b>
                                </p>
                                <p v-if="activeTask.qaChecklist.improvements.length" class="text-gray-600">
                                    📝 {{ activeTask.qaChecklist.improvements.join(' · ') }}
                                </p>
                                <p v-if="activeTask.qaNotes" class="text-gray-600">💬 {{ activeTask.qaNotes }}</p>
                            </div>
                            <label class="field">
                                <span>הערות Editor</span>
                                <textarea v-model="pmNotes" class="input" rows="2" placeholder="הוסף הערות..." />
                            </label>
                            <div class="flex gap-2 justify-end pt-1">
                                <button class="btn btn-ghost btn-md" :disabled="actionLoading" @click="closeModal">ביטול</button>
                                <button class="btn btn-danger btn-md" :disabled="actionLoading" @click="handlePmReview('reject')">→ חזור ל-QA</button>
                                <button class="btn btn-success btn-md" :disabled="actionLoading" @click="handlePmReview('approve')">
                                    <span v-if="actionLoading" class="w-4 h-4 rounded-full animate-spin shrink-0" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: white;" />
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
.field { @apply flex flex-col gap-1.5 text-sm; }
.label { @apply text-sm font-medium text-gray-700; }
.input { @apply w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3CC2EE]/40 focus:border-[#3CC2EE] transition-colors placeholder:text-gray-400; }

/* Local btn overrides for this page (scoped) */
.btn { @apply inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all duration-150 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed; }
.btn-sm  { @apply text-xs px-3 py-1.5; }
.btn-md  { @apply text-sm px-4 py-2; }
.btn-primary { @apply bg-[#3CC2EE] hover:bg-[#2ba9d4] active:bg-[#1e8db4] text-white focus-visible:ring-[#3CC2EE] shadow-sm; }
.btn-yellow  { @apply bg-amber-400 hover:bg-amber-500 text-amber-900 focus-visible:ring-amber-400; }
.btn-indigo  { @apply bg-indigo-600 hover:bg-indigo-700 text-white focus-visible:ring-indigo-500 shadow-sm; }
.btn-success { @apply bg-emerald-500 hover:bg-emerald-600 text-white focus-visible:ring-emerald-400 shadow-sm; }
.btn-danger  { @apply bg-red-500 hover:bg-red-600 text-white focus-visible:ring-red-400 shadow-sm; }
.btn-ghost   { @apply bg-gray-100 hover:bg-gray-200 text-gray-700 focus-visible:ring-gray-300; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
