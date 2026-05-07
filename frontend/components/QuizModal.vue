<script setup lang="ts">
import type { AttemptQuestion, QuizPhase, QuizSubmitResult } from '~/types/types';
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

// ── Quiz state ────────────────────────────────────────────────────────────────
const loading = ref(true);
const error = ref<string | null>(null);
const questions = ref<AttemptQuestion[]>([]);
const attemptId = ref<string | null>(null);
const currentIndex = ref(0);
const answers = reactive<Record<string, number>>({});   // questionId → selectedIndex
const selectedForCurrent = ref<number | null>(null);    // brief visual selected state
const submitting = ref(false);
const result = ref<QuizSubmitResult | null>(null);

const currentQuestion = computed(() => questions.value[currentIndex.value] ?? null);
const answeredCount = computed(() => Object.keys(answers).length);
const allAnswered = computed(() => questions.value.length > 0 && answeredCount.value === questions.value.length);
const inSummary = computed(() => allAnswered.value && result.value === null && !loading.value && !error.value);
const phaseLabel = computed(() => props.phase === 'pre' ? 'בוחן לפני המשימה' : 'בוחן אחרי המשימה');

const BUBBLE_COLORS = [
    'bg-violet-500 hover:bg-violet-400',
    'bg-amber-500  hover:bg-amber-400',
    'bg-emerald-500 hover:bg-emerald-400',
    'bg-rose-500   hover:bg-rose-400',
    'bg-sky-500    hover:bg-sky-400',
    'bg-pink-500   hover:bg-pink-400',
];

// ── Load ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
    try {
        const data = await quizzes.start(props.challengeId, props.userId, props.phase);
        attemptId.value = data.attempt.id;
        questions.value = data.questions;
        for (const q of data.questions) {
            if (q.selectedIndex !== null) answers[q.questionId] = q.selectedIndex;
        }
        if (data.attempt.submittedAt) {
            result.value = {
                score: data.attempt.score ?? 0,
                total: data.attempt.total,
                learningGain: data.attempt.learningGain,
            };
        } else {
            const firstUnanswered = data.questions.findIndex((q) => q.selectedIndex === null);
            if (firstUnanswered >= 0) currentIndex.value = firstUnanswered;
        }
    } catch (e: any) {
        error.value = e?.data?.message ?? e?.message ?? 'Failed to load quiz';
    } finally {
        loading.value = false;
    }
});

onUnmounted(() => stopBgMusic());

// ── Answer selection ──────────────────────────────────────────────────────────
let bgMusicStarted = false;

function selectAnswer(optionIndex: number) {
    if (!currentQuestion.value || selectedForCurrent.value !== null) return;

    if (!bgMusicStarted) {
        startBgMusic();
        bgMusicStarted = true;
    }

    selectedForCurrent.value = optionIndex;
    setTimeout(() => {
        if (currentQuestion.value) {
            answers[currentQuestion.value.questionId] = optionIndex;
        }
        selectedForCurrent.value = null;
        if (currentIndex.value < questions.value.length - 1) {
            currentIndex.value++;
        }
        // if last question, allAnswered becomes true → inSummary shows
    }, 320);
}

// ── Submit ────────────────────────────────────────────────────────────────────
async function handleSubmit() {
    if (!attemptId.value || !allAnswered.value || submitting.value) return;
    submitting.value = true;
    error.value = null;
    try {
        const payload = questions.value.map((q) => ({
            questionId: q.questionId,
            selectedIndex: answers[q.questionId],
        }));
        const r = await quizzes.submit(attemptId.value, payload);
        stopBgMusic();
        playVictorySound();
        result.value = r;
        emit('submitted', r);
    } catch (e: any) {
        error.value = e?.data?.message ?? e?.message ?? 'Submit failed';
    } finally {
        submitting.value = false;
    }
}

// ── Audio — Web Audio API (no external files needed) ─────────────────────────
// To use real audio files instead, replace the startBgMusic / playVictorySound
// implementations with:
//   const bgAudio = new Audio('/audio/quiz-bg.mp3');  bgAudio.loop = true;
//   const winAudio = new Audio('/audio/quiz-victory.mp3');
// Place files at: frontend/public/audio/quiz-bg.mp3 and quiz-victory.mp3

let audioCtx: AudioContext | null = null;
let bgSchedulerTimer: ReturnType<typeof setInterval> | null = null;
let bgNoteIndex = 0;
let bgNextTime = 0;

// Bright C-major pentatonic pattern — loops cheerfully
const BG_SCALE = [523.25, 659.25, 783.99, 880.00, 1046.50, 880.00, 783.99, 659.25];

function getCtx(): AudioContext | null {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    } catch { return null; }
}

function scheduleBgNote(ctx: AudioContext) {
    const now = ctx.currentTime;
    if (bgNextTime < now) bgNextTime = now;
    const NOTE = 0.17;
    const AHEAD = 0.5;
    while (bgNextTime < now + AHEAD) {
        const freq = BG_SCALE[bgNoteIndex % BG_SCALE.length];
        bgNoteIndex++;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.028, bgNextTime);
        gain.gain.exponentialRampToValueAtTime(0.001, bgNextTime + NOTE * 0.85);
        osc.start(bgNextTime);
        osc.stop(bgNextTime + NOTE);
        bgNextTime += NOTE;
    }
}

function startBgMusic() {
    const ctx = getCtx();
    if (!ctx) return;
    bgNextTime = ctx.currentTime;
    bgNoteIndex = 0;
    scheduleBgNote(ctx);
    bgSchedulerTimer = setInterval(() => scheduleBgNote(ctx), 150);
}

function stopBgMusic() {
    if (bgSchedulerTimer) { clearInterval(bgSchedulerTimer); bgSchedulerTimer = null; }
}

function playVictorySound() {
    const ctx = getCtx();
    if (!ctx) return;
    // Rising C-major arpeggio: C5 E5 G5 C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    let t = ctx.currentTime + 0.05;
    for (const freq of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.start(t);
        osc.stop(t + 0.4);
        t += 0.13;
    }
}
</script>

<template>
    <div class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" dir="rtl">
        <div class="w-full max-w-md bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col">

            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-[#3CC2EE] uppercase tracking-wide">{{ phaseLabel }}</span>
                    <span v-if="!loading && questions.length > 0 && !result" class="text-xs text-white/40 mt-0.5">
                        שאלה {{ Math.min(currentIndex + 1, questions.length) }} מתוך {{ questions.length }}
                    </span>
                </div>
                <button class="text-white/40 hover:text-white/90 text-xl leading-none transition-colors" @click="emit('close')">✕</button>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex justify-center py-16">
                <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
            </div>

            <!-- Error -->
            <div v-else-if="error && !result" class="px-6 py-10 text-center flex flex-col items-center gap-4">
                <p class="text-red-400 text-sm">{{ error }}</p>
                <button class="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition-colors" @click="emit('close')">סגור</button>
            </div>

            <!-- Result screen (after submit) -->
            <div v-else-if="result" class="px-6 py-10 flex flex-col items-center gap-5">
                <div class="text-5xl">🏆</div>
                <div class="text-4xl font-extrabold text-white">{{ result.score }} / {{ result.total }}</div>
                <div class="text-sm font-medium">
                    <span v-if="result.learningGain !== null"
                        :class="result.learningGain >= 0 ? 'text-emerald-400' : 'text-amber-400'"
                    >
                        שיפור: {{ result.learningGain >= 0 ? '+' : '' }}{{ result.learningGain }}
                    </span>
                    <span v-else class="text-white/40">הבוחן השני יגלה כמה למדת</span>
                </div>
                <button
                    class="mt-2 px-8 py-3 bg-[#3CC2EE] hover:bg-[#27b3df] text-white rounded-full font-bold transition-colors shadow-lg"
                    @click="emit('close')"
                >
                    חזור למשימה ←
                </button>
            </div>

            <!-- Summary screen (all answered, not yet submitted) -->
            <div v-else-if="inSummary" class="px-6 py-10 flex flex-col items-center gap-5">
                <div class="text-5xl animate-bounce">🎉</div>
                <div class="text-xl font-extrabold text-white text-center">כל הכבוד!</div>
                <div class="text-sm text-white/60 text-center">
                    ענית על {{ questions.length }} מתוך {{ questions.length }} שאלות
                </div>
                <p v-if="error" class="text-red-400 text-xs text-center">{{ error }}</p>
                <button
                    class="mt-2 px-8 py-3 bg-[#3CC2EE] hover:bg-[#27b3df] disabled:opacity-40 text-white rounded-full font-bold transition-colors shadow-lg"
                    :disabled="submitting"
                    @click="handleSubmit"
                >
                    <span v-if="submitting" class="flex items-center gap-2">
                        <span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                        שולח...
                    </span>
                    <span v-else>שלח תשובות ▸</span>
                </button>
            </div>

            <!-- Game — question + answer bubbles -->
            <div v-else-if="currentQuestion" class="px-5 py-6 flex flex-col items-center gap-5">

                <!-- Progress dots -->
                <div class="flex gap-1.5 flex-wrap justify-center">
                    <div
                        v-for="(q, i) in questions"
                        :key="q.id"
                        class="w-2 h-2 rounded-full transition-colors duration-300"
                        :class="i < currentIndex
                            ? 'bg-[#3CC2EE]'
                            : i === currentIndex
                                ? 'bg-white/80 scale-125'
                                : 'bg-white/20'"
                    />
                </div>

                <!-- Question bubble — large circle -->
                <div class="w-52 h-52 rounded-full bg-gradient-to-br from-[#3CC2EE] to-cyan-700 flex items-center justify-center text-center shadow-2xl ring-4 ring-[#3CC2EE]/30 p-7 shrink-0">
                    <p class="text-white font-bold text-sm leading-snug">{{ currentQuestion.prompt }}</p>
                </div>

                <!-- Instruction -->
                <p class="text-white/40 text-xs">בחר את התשובה הנכונה</p>

                <!-- Answer bubbles — 2-column pill grid -->
                <div class="grid grid-cols-2 gap-3 w-full">
                    <button
                        v-for="(opt, i) in currentQuestion.options"
                        :key="i"
                        class="rounded-2xl py-5 px-3 text-white text-xs font-bold text-center leading-snug shadow-lg min-h-[76px] transition-all duration-200 select-none"
                        :class="[
                            BUBBLE_COLORS[i % BUBBLE_COLORS.length],
                            selectedForCurrent === i
                                ? 'opacity-60 scale-95'
                                : selectedForCurrent === null
                                    ? 'hover:scale-105 active:scale-95'
                                    : 'opacity-40 cursor-not-allowed'
                        ]"
                        :disabled="selectedForCurrent !== null"
                        @click="selectAnswer(i)"
                    >
                        {{ opt }}
                    </button>
                </div>
            </div>

        </div>
    </div>
</template>
