<script setup lang="ts">
import type {
    AttemptQuestion,
    AttemptWithQuestions,
    QuizPhase,
    QuizSubmitResult,
} from '~/types/types';
import { useQuizzes } from '~/composables/useQuizzes';

const props = defineProps<{
    challengeId: string;
    userId: string;
    phase: QuizPhase;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'submitted', result: QuizSubmitResult): void;
}>();

const quizzes = useQuizzes();

const loading = ref(true);
const error = ref<string | null>(null);
const attempt = ref<AttemptWithQuestions['attempt'] | null>(null);
const questions = ref<AttemptQuestion[]>([]);
const answers = reactive<Record<string, number>>({});
const submitting = ref(false);
const result = ref<QuizSubmitResult | null>(null);

const phaseLabel = computed(() =>
    props.phase === 'pre' ? 'בוחן ידע — לפני המשימה' : 'בוחן ידע — אחרי המשימה',
);

const allAnswered = computed(
    () => questions.value.length > 0 && questions.value.every((q) => answers[q.questionId] !== undefined),
);

onMounted(async () => {
    try {
        const data = await quizzes.start(
            props.challengeId,
            props.userId,
            props.phase,
        );
        attempt.value = data.attempt;
        questions.value = data.questions;
        // restore previously selected answers if any
        for (const q of data.questions) {
            if (q.selectedIndex !== null) answers[q.questionId] = q.selectedIndex;
        }
        if (data.attempt.submittedAt) {
            result.value = {
                score: data.attempt.score ?? 0,
                total: data.attempt.total,
                learningGain: data.attempt.learningGain,
            };
        }
    } catch (e: any) {
        error.value = e?.data?.message ?? e?.message ?? 'Failed to load quiz';
    } finally {
        loading.value = false;
    }
});

async function handleSubmit() {
    if (!attempt.value || !allAnswered.value) return;
    submitting.value = true;
    error.value = null;
    try {
        const payload = questions.value.map((q) => ({
            questionId: q.questionId,
            selectedIndex: answers[q.questionId],
        }));
        const r = await quizzes.submit(attempt.value.id, payload);
        result.value = r;
        emit('submitted', r);
    } catch (e: any) {
        error.value = e?.data?.message ?? e?.message ?? 'Submit failed';
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
        <div class="w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <p class="text-xs uppercase font-bold text-[#3CC2EE] tracking-wide">
                        {{ phaseLabel }}
                    </p>
                    <p class="text-xs text-gray-500 mt-0.5">
                        התשובות שלך עוזרות למורה ולמנטור לראות מה אתה יודע.
                    </p>
                </div>
                <button
                    class="text-gray-400 hover:text-gray-700 text-xl"
                    @click="emit('close')"
                >✕</button>
            </div>

            <!-- Body -->
            <div class="px-6 py-5 overflow-y-auto flex-1 space-y-5">
                <p v-if="loading" class="text-sm text-gray-500 text-center py-10">
                    טוען שאלות...
                </p>

                <p v-else-if="error" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {{ error }}
                </p>

                <div v-else-if="result" class="space-y-3 text-center py-6">
                    <p class="text-2xl font-extrabold text-gray-800">
                        {{ result.score }} / {{ result.total }}
                    </p>
                    <p class="text-xs text-gray-400">תוצאה</p>
                    <p
                        v-if="result.learningGain !== null"
                        class="text-sm font-semibold mt-3"
                        :class="result.learningGain >= 0 ? 'text-emerald-600' : 'text-amber-600'"
                    >
                        שיפור מאז הבוחן הראשוני: {{ result.learningGain >= 0 ? '+' : '' }}{{ result.learningGain }}
                    </p>
                    <p v-else class="text-xs text-gray-500 mt-3">
                        הבוחן השני יוצג לאחר סיום המשימה — אז תוכל לראות כמה למדת.
                    </p>
                </div>

                <template v-else>
                    <div
                        v-for="(q, i) in questions"
                        :key="q.id"
                        class="border border-gray-200 rounded-xl p-4"
                    >
                        <p class="text-sm font-semibold text-gray-800 mb-3">
                            {{ i + 1 }}. {{ q.prompt }}
                        </p>
                        <div class="space-y-2">
                            <label
                                v-for="(opt, idx) in q.options"
                                :key="idx"
                                class="flex items-start gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-gray-50"
                                :class="answers[q.questionId] === idx ? 'bg-cyan-50 border border-cyan-200' : 'border border-transparent'"
                            >
                                <input
                                    type="radio"
                                    :name="q.questionId"
                                    :value="idx"
                                    v-model="answers[q.questionId]"
                                    class="mt-0.5 accent-[#3CC2EE]"
                                />
                                <span class="text-gray-700">{{ opt }}</span>
                            </label>
                        </div>
                    </div>
                </template>
            </div>

            <!-- Footer -->
            <div class="px-6 py-3 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                    v-if="!result"
                    :disabled="!allAnswered || submitting"
                    class="px-5 py-2 bg-[#3CC2EE] hover:bg-[#27b3df] disabled:opacity-40 text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                    @click="handleSubmit"
                >
                    {{ submitting ? 'שולח...' : 'שלח תשובות' }}
                </button>
                <button
                    v-else
                    class="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-semibold"
                    @click="emit('close')"
                >
                    סגור
                </button>
            </div>
        </div>
    </div>
</template>
