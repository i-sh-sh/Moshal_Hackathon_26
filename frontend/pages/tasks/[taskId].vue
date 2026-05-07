<script setup lang="ts">
import type { StudentRole } from '~/types/types';
import { ROLE_LABELS } from '~/types/types';
import { useUser } from '~/composables/useUser';

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

onMounted(async () => {
    if (!user.value) { router.replace('/'); return; }
    await fetchTasks();
    if (user.value.currentTeamId) {
        team.value = await $fetch<TeamDetail>(`${base}/teams/${user.value.currentTeamId}`).catch(() => null);
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

// ── Quiz ──────────────────────────────────────────────────────────────────────
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
    quizModal.value.open = false;
    showToast(
        r.learningGain !== null
            ? `Quiz done — score ${r.score}/${r.total} (gain ${r.learningGain >= 0 ? '+' : ''}${r.learningGain})`
            : `Quiz done — score ${r.score}/${r.total}`,
        'success',
    );
}
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
        <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div class="px-6 h-14 flex items-center gap-3">
                <button
                    class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                    @click="router.back()"
                >
                    ← חזור
                </button>
                <span class="text-gray-300">|</span>
                <span class="text-sm font-semibold text-gray-700 truncate">{{ task?.title ?? 'פרטי משימה' }}</span>
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
                <!-- Main task card -->
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
                    <!-- Title + status -->
                    <div class="flex items-start justify-between gap-3">
                        <h1 class="text-xl font-bold text-gray-800 leading-snug">{{ task.title }}</h1>
                        <span :class="['text-xs font-medium px-2.5 py-1 rounded-full shrink-0', statusColors[task.status]]">
                            {{ statusLabels[task.status] }}
                        </span>
                    </div>

                    <!-- Task-specific role -->
                    <p class="text-sm text-gray-500">
                        תפקיד למשימה זו:
                        <span class="font-medium text-gray-700">
                            {{ ROLE_LABELS[task.assignedRole as StudentRole] ?? task.assignedRole }}
                        </span>
                    </p>

                    <!-- Description -->
                    <div v-if="task.description" class="border-t border-gray-100 pt-4">
                        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">הסבר המשימה</h2>
                        <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{{ task.description }}</p>
                    </div>
                    <p v-else class="text-sm text-gray-400 italic">אין הסבר למשימה זו.</p>

                    <!-- Submission link -->
                    <a
                        v-if="task.submissionUrl"
                        :href="task.submissionUrl"
                        target="_blank"
                        class="text-sm text-[#3CC2EE] hover:underline"
                    >
                        🔗 צפייה בהגשה
                    </a>

                    <!-- Submission image -->
                    <div v-if="task.submissionImageUrl" class="rounded-xl overflow-hidden border border-gray-200">
                        <img :src="task.submissionImageUrl" :alt="task.title" class="w-full object-cover max-h-64" />
                    </div>
                </div>

                <!-- Quiz section -->
                <div
                    v-if="team?.current_challenge_id && user?.id"
                    class="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap items-center gap-3 shadow-sm"
                >
                    <span class="text-sm text-gray-700 font-semibold ml-2">📝 בדיקת ידע:</span>
                    <button
                        class="px-4 py-1.5 bg-[#3CC2EE] hover:bg-[#27b3df] text-white rounded-full text-xs font-bold transition-colors shadow-sm"
                        @click="openQuiz('pre')"
                    >
                        בוחן לפני המשימה
                    </button>
                    <button
                        class="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white rounded-full text-xs font-bold transition-colors shadow-sm"
                        :disabled="!team?.is_completed"
                        :title="team?.is_completed ? '' : 'יהיה זמין בסיום המשימה'"
                        @click="openQuiz('post')"
                    >
                        בוחן אחרי המשימה
                    </button>
                    <span class="text-xs text-gray-400 mr-auto">
                        עוזר למורה ולמנטור לראות מה למדת.
                    </span>
                </div>
            </div>
        </main>

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
                    :class="['fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-none', toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white']"
                >
                    {{ toast.msg }}
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
