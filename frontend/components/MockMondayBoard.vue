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
// Internal keys are pm/qa/dev/hardware; display labels match the new mapping.
const roleLabel: Record<string, string> = {
    pm:       'Editor',
    qa:       'QA',
    dev:      'Designer',
    hardware: 'Printer',
};

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
    <div class="bg-gray-50 min-h-full" dir="rtl">

        <!-- ── Top bar ──────────────────────────────────────────────────── -->
        <header class="flex items-center gap-4 px-6 py-4 bg-white border-b border-gray-200">
            <span class="text-sm font-bold text-gray-900">לוח משימות</span>

            <!-- Challenge selector -->
            <select
                v-model="selectedChallengeId"
                class="mr-4 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
                <option v-for="c in challenges" :key="c.id" :value="c.id">
                    {{ c.title }} {{ c.isActive ? '🟢' : '⚪' }}
                </option>
            </select>

            <div class="flex-1" />

            <!-- Kickoff button -->
            <button
                class="flex items-center gap-2 bg-[#3CC2EE] hover:bg-[#27b3df] text-white font-bold px-4 py-1.5 rounded-full text-sm transition-colors disabled:opacity-50 shadow-sm"
                :disabled="actionLoading === selectedChallengeId"
                @click="kickoff"
            >
                <span v-if="actionLoading === selectedChallengeId">⏳</span>
                <span v-else>🚀</span>
                הפעל אתגר
            </button>

            <!-- Refresh -->
            <button
                class="text-gray-400 hover:text-gray-700 text-lg transition-colors"
                title="רענן לוח"
                @click="loadBoard"
            >
                ↻
            </button>
        </header>

        <!-- ── Board title ────────────────────────────────────────────────── -->
        <div class="px-6 py-4 flex items-center gap-3">
            <h1 class="text-xl font-bold text-gray-900">
                {{ board?.challengeTitle ?? 'טוען...' }}
            </h1>
            <span class="text-xs text-gray-400">לוח מורה</span>
        </div>

        <!-- ── Loading ───────────────────────────────────────────────────── -->
        <div v-if="loading" class="flex justify-center py-20 text-gray-400 text-sm">
            טוען לוח...
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
                    <span class="text-xs font-bold text-gray-600 uppercase tracking-wide">
                        {{ col.label }}
                    </span>
                    <span class="mr-auto text-xs text-gray-500 bg-gray-100 rounded-full px-2 font-semibold">
                        {{ col.items.length }}
                    </span>
                </div>

                <!-- Items -->
                <div
                    v-for="item in col.items"
                    :key="item.id"
                    class="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2 hover:border-[#3CC2EE]/40 hover:shadow-sm transition-all shadow-sm"
                >
                    <!-- Item title + role badge -->
                    <div class="flex items-start justify-between gap-1">
                        <p class="text-sm font-semibold text-gray-800 leading-snug">{{ item.title }}</p>
                        <span
                            class="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                            :style="{ background: col.color + '20', color: col.color }"
                        >
                            {{ roleLabel[item.assignedRole] ?? item.assignedRole }}
                        </span>
                    </div>

                    <!-- Team + time -->
                    <div class="flex items-center gap-2 text-xs text-gray-400">
                        <span>👥 {{ item.teamName }}</span>
                        <span class="mr-auto">{{ formatTime(item.submittedAt) }}</span>
                    </div>

                    <!-- Submission link -->
                    <a
                        v-if="item.submissionUrl"
                        :href="item.submissionUrl"
                        target="_blank"
                        class="text-xs text-[#3CC2EE] hover:underline truncate"
                    >
                        🔗 צפייה בהגשה
                    </a>

                    <!-- Teacher action buttons — only on Pending Teacher Review column -->
                    <div
                        v-if="item.status === 'teacher_review'"
                        class="flex gap-2 mt-1"
                    >
                        <button
                            class="flex-1 text-xs font-bold py-1 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-40"
                            :disabled="actionLoading === item.id"
                            @click="approveTask(item.id)"
                        >
                            {{ actionLoading === item.id ? '...' : '✓ אשר' }}
                        </button>
                        <button
                            class="flex-1 text-xs font-bold py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-40"
                            :disabled="actionLoading === item.id"
                            @click="rejectTask(item.id)"
                        >
                            {{ actionLoading === item.id ? '...' : '✕ דחה' }}
                        </button>
                    </div>
                </div>

                <!-- Empty state -->
                <div
                    v-if="col.items.length === 0"
                    class="border-2 border-dashed border-gray-200 rounded-xl py-8 text-center text-xs text-gray-300"
                >
                    אין פריטים
                </div>
            </div>
        </div>

        <!-- ── Toast ─────────────────────────────────────────────────────── -->
        <Transition name="toast">
            <div
                v-if="toast"
                class="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm font-bold shadow-hover z-50"
                :class="toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'"
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
