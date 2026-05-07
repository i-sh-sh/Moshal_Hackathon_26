<script setup lang="ts">
import type { ChatMessage } from '~/types/types';

const props = defineProps<{
    channelName: string;
    messages: readonly ChatMessage[];
    sending: boolean;
    currentUserId: string;
    isPrivate?: boolean;
}>();

const emit = defineEmits<{
    send: [content: string];
}>();

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

const input = ref('');
const scrollEl = ref<HTMLDivElement | null>(null);

// ── Avatar colors ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
    'bg-amber-500',  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500',
];
const colorCache = new Map<string, string>();
function avatarColor(id: string): string {
    if (!colorCache.has(id)) {
        let hash = 0;
        for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xff;
        colorCache.set(id, AVATAR_COLORS[hash % AVATAR_COLORS.length]);
    }
    return colorCache.get(id)!;
}
function initials(name: string): string {
    return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Date separators ───────────────────────────────────────────────────────────
interface DayGroup { date: string; label: string; messages: ChatMessage[] }

const grouped = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    let current: DayGroup | null = null;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    for (const msg of props.messages) {
        const d = new Date(msg.createdAt);
        const key = d.toDateString();
        const label =
            key === today ? 'היום' :
            key === yesterday ? 'אתמול' :
            d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });

        if (!current || current.date !== key) {
            current = { date: key, label, messages: [] };
            groups.push(current);
        }
        current.messages.push(msg);
    }
    return groups;
});

// ── Time format ───────────────────────────────────────────────────────────────
function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

// ── Speech-to-text ────────────────────────────────────────────────────────────
const recording = ref(false);
const transcribing = ref(false);
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            await sendAudioForTranscription();
        };
        mediaRecorder.start();
        recording.value = true;
    } catch {
        alert('לא ניתן לגשת למיקרופון. בדוק הרשאות בדפדפן.');
    }
}

function stopRecording() {
    mediaRecorder?.stop();
    recording.value = false;
}

async function sendAudioForTranscription() {
    if (!audioChunks.length) return;
    transcribing.value = true;
    try {
        const mimeType = mediaRecorder?.mimeType ?? 'audio/webm';
        const blob = new Blob(audioChunks, { type: mimeType });
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        const result = await $fetch<{ text: string }>(`${base}/chat/transcribe`, {
            method: 'POST',
            body: formData,
        });
        if (result.text) input.value = (input.value ? input.value + ' ' : '') + result.text;
    } catch { /* silent */ } finally {
        transcribing.value = false;
        audioChunks = [];
    }
}

function toggleMic() {
    recording.value ? stopRecording() : startRecording();
}

// ── Send ──────────────────────────────────────────────────────────────────────
function handleSend() {
    const text = input.value.trim();
    if (!text || props.sending) return;
    emit('send', text);
    input.value = '';
}

function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
}

// ── Auto-scroll ───────────────────────────────────────────────────────────────
watch(
    () => props.messages.length,
    async () => {
        await nextTick();
        if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
    },
);

onMounted(async () => {
    await nextTick();
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
});
</script>

<template>
    <div class="flex flex-col h-full bg-white overflow-hidden">

        <!-- Header -->
        <div class="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50 shrink-0">
            <span class="text-base">{{ isPrivate ? '🤖' : '💬' }}</span>
            <span class="font-semibold text-gray-800 text-sm truncate flex-1">{{ channelName }}</span>
            <span v-if="messages.length" class="text-xs text-gray-400">{{ messages.length }} הודעות</span>
        </div>

        <!-- Messages -->
        <div ref="scrollEl" class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1 min-h-0">
            <div v-if="!messages.length" class="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                <span class="text-3xl">{{ isPrivate ? '🤖' : '💬' }}</span>
                <p class="text-sm">{{ isPrivate ? 'שאל/י את DUDE כל דבר על האתגר' : 'אין הודעות עדיין. התחילו את השיחה!' }}</p>
            </div>

            <template v-for="group in grouped" :key="group.date">
                <!-- Date separator -->
                <div class="flex items-center gap-3 my-2">
                    <div class="flex-1 h-px bg-gray-100" />
                    <span class="text-xs text-gray-400 font-medium shrink-0">{{ group.label }}</span>
                    <div class="flex-1 h-px bg-gray-100" />
                </div>

                <!-- Messages in this day -->
                <div
                    v-for="msg in group.messages"
                    :key="msg.id"
                    class="flex flex-col"
                    :class="msg.senderId === currentUserId ? 'items-end' : 'items-start'"
                >
                    <!-- Bot message (private DUDE chat) -->
                    <template v-if="msg.isBot">
                        <div class="flex items-end gap-2 max-w-[78%]">
                            <div class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs shrink-0 mb-0.5">🤖</div>
                            <div class="bg-indigo-50 border border-indigo-100 text-gray-800 text-sm rounded-2xl rounded-bl-none px-3.5 py-2 leading-relaxed">
                                {{ msg.content }}
                            </div>
                        </div>
                        <span class="text-[11px] text-gray-400 mt-0.5 ml-9">{{ formatTime(msg.createdAt) }}</span>
                    </template>

                    <!-- Own message -->
                    <template v-else-if="msg.senderId === currentUserId">
                        <div class="bg-indigo-600 text-white text-sm rounded-2xl rounded-br-none px-3.5 py-2 max-w-[78%] leading-relaxed shadow-sm">
                            {{ msg.content }}
                        </div>
                        <span class="text-[11px] text-gray-400 mt-0.5">{{ formatTime(msg.createdAt) }}</span>
                    </template>

                    <!-- Other student -->
                    <template v-else>
                        <div class="flex items-end gap-2 max-w-[78%]">
                            <div
                                :class="['w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mb-0.5', avatarColor(msg.senderId ?? msg.senderName)]"
                            >
                                {{ initials(msg.senderName) }}
                            </div>
                            <div>
                                <p class="text-[11px] text-gray-400 mb-0.5 mr-1">{{ msg.senderName }}</p>
                                <div class="bg-gray-100 text-gray-800 text-sm rounded-2xl rounded-bl-none px-3.5 py-2 leading-relaxed shadow-sm">
                                    {{ msg.content }}
                                </div>
                            </div>
                        </div>
                        <span class="text-[11px] text-gray-400 mt-0.5 ml-9">{{ formatTime(msg.createdAt) }}</span>
                    </template>
                </div>
            </template>

            <!-- Typing indicator -->
            <div v-if="sending" class="flex items-end gap-2 mt-1">
                <div class="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <span class="text-[10px] text-gray-500">···</span>
                </div>
                <div class="bg-gray-100 rounded-2xl rounded-bl-none px-3.5 py-2.5 flex gap-1 items-center">
                    <span v-for="i in 3" :key="i"
                        class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                        :style="`animation-delay: ${(i - 1) * 150}ms`"
                    />
                </div>
            </div>
        </div>

        <!-- Input area -->
        <div class="border-t border-gray-100 px-3 py-2 flex gap-2 items-end shrink-0 bg-white">
            <!-- Mic -->
            <button
                class="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                :class="recording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                :title="recording ? 'עצור הקלטה' : 'הקלט הודעה קולית'"
                :disabled="transcribing"
                @click="toggleMic"
            >
                <span v-if="transcribing" class="inline-block w-4 h-4 border-2 border-gray-400/40 border-t-gray-600 rounded-full animate-spin" />
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 18.93V22h2v-2.07A8.001 8.001 0 0 0 20 12h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z"/>
                </svg>
            </button>

            <textarea
                v-model="input"
                rows="1"
                class="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 leading-snug bg-gray-50 placeholder:text-gray-400"
                :placeholder="recording ? '🔴 מקליט...' : (isPrivate ? 'שאל/י את DUDE...' : 'כתבו הודעה...')"
                style="max-height: 100px; overflow-y: auto"
                @keydown="handleKeydown"
            />

            <button
                class="shrink-0 bg-indigo-600 text-white rounded-xl px-3 py-2 text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-40"
                :disabled="sending || !input.trim()"
                @click="handleSend"
            >
                <svg v-if="sending" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10" stroke-linecap="round"/>
                </svg>
                <svg v-else class="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
            </button>
        </div>

        <!-- Recording banner -->
        <div v-if="recording" class="bg-red-50 border-t border-red-100 px-4 py-1.5 flex items-center gap-2 text-xs text-red-600 shrink-0">
            <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            מקליט... לחץ על 🎤 שוב לסיום ולהמרה לטקסט
        </div>
    </div>
</template>

<style scoped>
@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-4px); }
}
.animate-bounce { animation: bounce 1s ease-in-out infinite; }
</style>
