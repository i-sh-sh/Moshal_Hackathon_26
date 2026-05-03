<script setup lang="ts">
const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

// ── State ─────────────────────────────────────────────────────────────────────
const challenges = ref<{ id: string; title: string; isActive: boolean }[]>([]);
const selectedChallengeId = ref<string | null>(null);
const board = ref<any | null>(null);
const loading = ref(false);
const actionLoading = ref<string | null>(null); // taskId currently being acted on
const toast = ref<{ msg: string; type: 'success' | 'error' } | null>(null);

// ── Boot ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
    challenges.value = await $fetch(`${base}/mock-monday/challenges`);
    if (challenges.value.length > 0) {
        selectedChallengeId.value = challenges.value[0].id;
        await loadBoard();
    }
});

watch(selectedChallengeId, loadBoard);

async function loadBoard() {
    if (!selectedChallengeId.value) return;
    loading.value = true;
    try {
        board.value = await $fetch(`${base}/mock-monday/board/${selectedChallengeId.value}`);
    } finally {
        loading.value = false;
    }
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function kickoff() {
    if (!selectedChallengeId.value) return;
    await act(selectedChallengeId.value, async () => {
        await $fetch(`${base}/mock-monday/kickoff/${selectedChallengeId.value}`, { method: 'POST' });
        showToast('Challenge kicked off for all teams!', 'success');
        await loadBoard();
    });
}

async function approveTask(taskId: string) {
    await act(taskId, async () => {
        await $fetch(`${base}/mock-monday/approve/${taskId}`, { method: 'POST' });
        showToast('Task approved!', 'success');
        await loadBoard();
    });
}

async function rejectTask(taskId: string) {
    await act(taskId, async () => {
        await $fetch(`${base}/mock-monday/reject/${taskId}`, { method: 'POST' });
        showToast('Task returned to PM.', 'error');
        await loadBoard();
    });
}

async function act(id: string, fn: () => Promise<void>) {
    actionLoading.value = id;
    try {
        await fn();
    } catch (e: any) {
        showToast(e?.data?.message ?? 'Something went wrong', 'error');
    } finally {
        actionLoading.value = null;
    }
}

function showToast(msg: string, type: 'success' | 'error') {
    toast.value = { msg, type };
    setTimeout(() => (toast.value = null), 3000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const roleLabel: Record<string, string> = {
    pm: 'PM', qa: 'QA', dev: 'Dev', hardware: 'Hardware',
};

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
    <div class="mock-monday min-h-screen bg-[#1f1f2e] text-white font-sans">

        <!-- ── Top bar ──────────────────────────────────────────────────── -->
        <header class="flex items-center gap-4 px-6 py-3 bg-[#292942] border-b border-white/10 shadow-lg">
            <!-- Monday-style logo -->
            <div class="flex items-center gap-2 shrink-0">
                <span class="text-2xl font-black tracking-tight">
                    <span class="text-[#ff7575]">m</span><span class="text-[#ffcb00]">o</span><span class="text-[#00c875]">n</span><span class="text-white">day</span>
                    <span class="text-xs font-normal text-white/40 ml-1">simulator</span>
                </span>
            </div>

            <!-- Challenge selector -->
            <select
                v-model="selectedChallengeId"
                class="ml-4 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#579bfc]"
            >
                <option v-for="c in challenges" :key="c.id" :value="c.id">
                    {{ c.title }} {{ c.isActive ? '🟢' : '⚪' }}
                </option>
            </select>

            <!-- Kickoff button -->
            <button
                class="ml-auto flex items-center gap-2 bg-[#00c875] hover:bg-[#00b368] text-black font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                :disabled="actionLoading === selectedChallengeId"
                @click="kickoff"
            >
                <span v-if="actionLoading === selectedChallengeId">⏳</span>
                <span v-else>🚀</span>
                Kickoff Challenge
            </button>

            <!-- Refresh -->
            <button
                class="text-white/50 hover:text-white text-lg transition-colors"
                title="Refresh board"
                @click="loadBoard"
            >
                ↻
            </button>
        </header>

        <!-- ── Board title ────────────────────────────────────────────────── -->
        <div class="px-6 py-4 flex items-center gap-3">
            <h1 class="text-xl font-bold text-white/90">
                {{ board?.challengeTitle ?? 'Loading...' }}
            </h1>
            <span class="text-xs text-white/40">Teacher Dashboard</span>
        </div>

        <!-- ── Loading ───────────────────────────────────────────────────── -->
        <div v-if="loading" class="flex justify-center py-20 text-white/40 text-sm">
            Loading board...
        </div>

        <!-- ── Kanban columns ─────────────────────────────────────────────── -->
        <div
            v-else-if="board"
            class="flex gap-3 px-6 pb-8 overflow-x-auto"
        >
            <div
                v-for="col in board.columns"
                :key="col.label"
                class="flex-none w-64 flex flex-col gap-2"
            >
                <!-- Column header -->
                <div class="flex items-center gap-2 mb-1">
                    <span
                        class="w-3 h-3 rounded-full shrink-0"
                        :style="{ background: col.color }"
                    />
                    <span class="text-xs font-semibold text-white/70 uppercase tracking-wide">
                        {{ col.label }}
                    </span>
                    <span class="ml-auto text-xs text-white/30 bg-white/10 rounded-full px-2">
                        {{ col.items.length }}
                    </span>
                </div>

                <!-- Items -->
                <div
                    v-for="item in col.items"
                    :key="item.id"
                    class="bg-[#292942] border border-white/10 rounded-xl p-3 flex flex-col gap-2 hover:border-white/25 transition-colors"
                >
                    <!-- Item title + role badge -->
                    <div class="flex items-start justify-between gap-1">
                        <p class="text-sm font-medium text-white/90 leading-snug">{{ item.title }}</p>
                        <span
                            class="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                            :style="{ background: col.color + '33', color: col.color }"
                        >
                            {{ roleLabel[item.assignedRole] ?? item.assignedRole }}
                        </span>
                    </div>

                    <!-- Team + time -->
                    <div class="flex items-center gap-2 text-xs text-white/40">
                        <span>👥 {{ item.teamName }}</span>
                        <span class="ml-auto">{{ formatTime(item.submittedAt) }}</span>
                    </div>

                    <!-- Submission link -->
                    <a
                        v-if="item.submissionUrl"
                        :href="item.submissionUrl"
                        target="_blank"
                        class="text-xs text-[#579bfc] hover:underline truncate"
                    >
                        🔗 View submission
                    </a>

                    <!-- Teacher action buttons — only on Pending Teacher Review column -->
                    <div
                        v-if="item.status === 'teacher_review'"
                        class="flex gap-2 mt-1"
                    >
                        <button
                            class="flex-1 text-xs font-semibold py-1 rounded-lg bg-[#00c875]/20 text-[#00c875] hover:bg-[#00c875]/40 transition-colors disabled:opacity-40"
                            :disabled="actionLoading === item.id"
                            @click="approveTask(item.id)"
                        >
                            {{ actionLoading === item.id ? '...' : '✓ Approve' }}
                        </button>
                        <button
                            class="flex-1 text-xs font-semibold py-1 rounded-lg bg-[#ff7575]/20 text-[#ff7575] hover:bg-[#ff7575]/40 transition-colors disabled:opacity-40"
                            :disabled="actionLoading === item.id"
                            @click="rejectTask(item.id)"
                        >
                            {{ actionLoading === item.id ? '...' : '✕ Reject' }}
                        </button>
                    </div>
                </div>

                <!-- Empty state -->
                <div
                    v-if="col.items.length === 0"
                    class="border-2 border-dashed border-white/10 rounded-xl py-8 text-center text-xs text-white/25"
                >
                    No items
                </div>
            </div>
        </div>

        <!-- ── Toast ─────────────────────────────────────────────────────── -->
        <Transition name="toast">
            <div
                v-if="toast"
                class="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-50"
                :class="toast.type === 'success' ? 'bg-[#00c875] text-black' : 'bg-[#ff7575] text-white'"
            >
                {{ toast.msg }}
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
