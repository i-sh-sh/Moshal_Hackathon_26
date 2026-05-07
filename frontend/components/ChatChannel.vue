<script setup lang="ts">
import type { ChatMessage } from '~/types/types';

const props = defineProps<{
    channelName: string;
    messages: readonly ChatMessage[];
    sending: boolean;
    currentUserId: string;
}>();

const emit = defineEmits<{
    send: [content: string];
}>();

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

const input = ref('');
const scrollEl = ref<HTMLDivElement | null>(null);

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
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };
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
        if (result.text) {
            input.value = (input.value ? input.value + ' ' : '') + result.text;
        }
    } catch {
        // silent — user can still type manually
    } finally {
        transcribing.value = false;
        audioChunks = [];
    }
}

function toggleMic() {
    if (recording.value) {
        stopRecording();
    } else {
        startRecording();
    }
}

// ── Message handling ──────────────────────────────────────────────────────────
function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function handleSend() {
    const text = input.value.trim();
    if (!text || props.sending) return;
    emit('send', text);
    input.value = '';
}

watch(
    () => props.messages.length,
    async () => {
        await nextTick();
        if (scrollEl.value) {
            scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
        }
    },
);
</script>

<template>
    <div class="flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        <!-- Header -->
        <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-indigo-50">
            <span class="text-lg">💬</span>
            <span class="font-semibold text-indigo-800 text-sm">{{ channelName }}</span>
            <span class="ml-auto text-xs text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">DUDE 🤖 active</span>
        </div>

        <!-- Messages -->
        <div ref="scrollEl" class="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
            <div v-if="!messages.length" class="text-center text-sm text-gray-400 py-10">
                אין הודעות עדיין. התחילו את השיחה!
            </div>

            <div
                v-for="msg in messages"
                :key="msg.id"
                class="flex flex-col gap-0.5"
                :class="msg.senderId === currentUserId ? 'items-end' : 'items-start'"
            >
                <!-- Bot message -->
                <template v-if="msg.isBot">
                    <div class="flex items-end gap-2 max-w-[80%]">
                        <div class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs shrink-0">🤖</div>
                        <div class="bg-indigo-50 border border-indigo-200 text-indigo-900 text-sm rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                            {{ msg.content }}
                        </div>
                    </div>
                    <span class="text-xs text-gray-400 ml-9">DUDE · {{ formatTime(msg.createdAt) }}</span>
                </template>

                <!-- Own message -->
                <template v-else-if="msg.senderId === currentUserId">
                    <div class="bg-indigo-600 text-white text-sm rounded-2xl rounded-br-sm px-3 py-2 shadow-sm max-w-[80%]">
                        {{ msg.content }}
                    </div>
                    <span class="text-xs text-gray-400">{{ formatTime(msg.createdAt) }}</span>
                </template>

                <!-- Other student -->
                <template v-else>
                    <div class="flex items-end gap-2 max-w-[80%]">
                        <div class="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-bold shrink-0">
                            {{ msg.senderName.charAt(0) }}
                        </div>
                        <div>
                            <p class="text-xs text-gray-500 mb-0.5 ml-1">{{ msg.senderName }}</p>
                            <div class="bg-gray-100 text-gray-800 text-sm rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                                {{ msg.content }}
                            </div>
                        </div>
                    </div>
                    <span class="text-xs text-gray-400 ml-9">{{ formatTime(msg.createdAt) }}</span>
                </template>
            </div>
        </div>

        <!-- Input -->
        <div class="border-t border-gray-100 px-3 py-2 flex gap-2 items-end">

            <!-- Mic button -->
            <button
                class="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                :class="recording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
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
                class="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 leading-snug"
                :placeholder="recording ? '🔴 מקליט... לחץ על המיקרופון לסיום' : 'כתבו הודעה... DUDE ישיב'"
                style="max-height: 100px; overflow-y: auto"
                @keydown.enter.exact.prevent="handleSend"
            />

            <button
                class="bg-indigo-600 text-white rounded-xl px-3 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                :disabled="sending || !input.trim()"
                @click="handleSend"
            >
                <span v-if="sending" class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span v-else>שלח</span>
            </button>
        </div>

        <!-- Recording indicator -->
        <div v-if="recording" class="bg-red-50 border-t border-red-200 px-4 py-1.5 flex items-center gap-2 text-xs text-red-600">
            <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            מקליט... לחץ על 🎤 שוב לסיום ולהמרה לטקסט
        </div>
    </div>
</template>
