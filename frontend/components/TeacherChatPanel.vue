<script setup lang="ts">
import type { ChatChannel, ChatMessage } from '~/types/types';

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

const channels = ref<ChatChannel[]>([]);
const selectedChannel = ref<ChatChannel | null>(null);
const messages = ref<ChatMessage[]>([]);
const loadingChannels = ref(false);
const analyzing = ref(false);
const analyzeResult = ref<{ analyzed: number; summary: string } | null>(null);
const toast = ref<string | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchChannels() {
    loadingChannels.value = true;
    try {
        channels.value = await $fetch<ChatChannel[]>(`${base}/chat/channels`);
        if (channels.value.length && !selectedChannel.value) {
            await selectChannel(channels.value[0]);
        }
    } finally {
        loadingChannels.value = false;
    }
}

async function selectChannel(ch: ChatChannel) {
    selectedChannel.value = ch;
    analyzeResult.value = null;
    await fetchMessages();
}

async function fetchMessages() {
    if (!selectedChannel.value) return;
    messages.value = await $fetch<ChatMessage[]>(
        `${base}/chat/channels/${selectedChannel.value.id}/messages`,
    ).catch(() => []);
}

async function runAnalysis() {
    if (!selectedChannel.value) return;
    analyzing.value = true;
    try {
        analyzeResult.value = await $fetch<{ analyzed: number; summary: string }>(
            `${base}/dude/channels/${selectedChannel.value.id}/analyze`,
            { method: 'POST' },
        );
        showToast(`ניתוח הושלם: ${analyzeResult.value.analyzed} הודעות`);
    } catch {
        showToast('ניתוח נכשל. נסה שוב.');
    } finally {
        analyzing.value = false;
    }
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function showToast(msg: string) {
    toast.value = msg;
    setTimeout(() => { toast.value = null; }, 3000);
}

onMounted(async () => {
    await fetchChannels();
    pollTimer = setInterval(fetchMessages, 6000);
});

onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
    <div class="flex h-full gap-4">

        <!-- Sidebar: channel list -->
        <div class="w-56 shrink-0 flex flex-col gap-2">
            <p class="text-xs text-gray-400 font-medium uppercase tracking-wide px-1">צ'אטים</p>

            <div v-if="loadingChannels" class="text-xs text-gray-400 px-1">טוען...</div>

            <button
                v-for="ch in channels"
                :key="ch.id"
                :class="['text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors', selectedChannel?.id === ch.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700']"
                @click="selectChannel(ch)"
            >
                💬 {{ ch.name }}
            </button>

            <div v-if="!channels.length && !loadingChannels" class="text-xs text-gray-500 px-1">
                אין צ'אטים פעילים עדיין.
            </div>
        </div>

        <!-- Main: messages + analyze -->
        <div class="flex-1 flex flex-col gap-3 min-w-0">

            <!-- Toolbar -->
            <div v-if="selectedChannel" class="flex items-center gap-3 flex-wrap">
                <span class="font-semibold text-white text-sm">{{ selectedChannel.name }}</span>
                <span class="text-[11px] text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full">
                    🔇 DUDE שקט — ניתוח בלבד
                </span>
                <button
                    class="mr-auto flex items-center gap-2 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-900/40"
                    :disabled="analyzing"
                    @click="runAnalysis"
                >
                    <span v-if="analyzing" class="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span v-else>🧠</span>
                    <span>{{ analyzing ? 'מנתח...' : 'נתח שיחה עכשיו' }}</span>
                </button>
            </div>

            <!-- Analysis result -->
            <div v-if="analyzeResult" class="bg-indigo-900/60 border border-indigo-600 rounded-xl px-4 py-3 text-xs text-indigo-200 flex items-start gap-3">
                <span class="text-lg shrink-0">✅</span>
                <div>
                    <p class="font-bold text-indigo-100 mb-1">ניתוח הושלם — {{ analyzeResult.analyzed }} הודעות נותחו</p>
                    <p class="text-indigo-300 leading-relaxed">{{ analyzeResult.summary }}</p>
                    <p class="text-indigo-500 mt-1 text-[11px]">פרופילי התלמידים עודכנו. ניתן לצפות בטאב "DUDE Insights".</p>
                </div>
            </div>

            <!-- Messages -->
            <div class="flex-1 overflow-y-auto flex flex-col gap-2 bg-gray-800 rounded-2xl p-4 min-h-0" style="max-height: 520px">
                <div v-if="!messages.length" class="text-center text-sm text-gray-500 py-10">
                    אין הודעות בערוץ זה.
                </div>

                <div
                    v-for="msg in messages"
                    :key="msg.id"
                    class="flex items-start gap-2"
                >
                    <div
                        :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white', msg.isBot ? 'bg-indigo-600' : 'bg-gray-600']"
                    >
                        {{ msg.isBot ? '🤖' : msg.senderName.charAt(0) }}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-2">
                            <span :class="['text-xs font-semibold', msg.isBot ? 'text-indigo-400' : 'text-gray-300']">{{ msg.senderName }}</span>
                            <span class="text-xs text-gray-500">{{ formatTime(msg.createdAt) }}</span>
                        </div>
                        <p class="text-sm text-gray-200 mt-0.5 break-words">{{ msg.content }}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Toast -->
        <Teleport to="body">
            <Transition name="toast">
                <div
                    v-if="toast"
                    class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium bg-indigo-700 text-white pointer-events-none"
                >
                    {{ toast }}
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
