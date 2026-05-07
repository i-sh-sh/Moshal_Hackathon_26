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

const input = ref('');
const scrollEl = ref<HTMLDivElement | null>(null);

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

// Auto-scroll on new messages
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
            <textarea
                v-model="input"
                rows="1"
                class="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 leading-snug"
                placeholder="כתבו הודעה... DUDE ישיב"
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
    </div>
</template>
