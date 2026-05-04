<script setup lang="ts">
import type { HintResponse } from '~/types/types';

const props = defineProps<{
    userId: string;
    teamId: string;
}>();

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

interface HintLog {
    id: string;
    hint_text: string;
    hint_number: number;
    points_deducted: number;
    task_id: string | null;
    created_at: string;
}

const history = ref<HintLog[]>([]);
const latestHint = ref<HintResponse | null>(null);
const loading = ref(false);
const isOpen = ref(false);

async function fetchHistory() {
    const data = await $fetch<HintLog[]>(
        `${base}/hints/history?userId=${props.userId}&teamId=${props.teamId}`,
    ).catch(() => []);
    history.value = data;
}

async function requestHint(taskId?: string) {
    loading.value = true;
    latestHint.value = null;
    try {
        const res = await $fetch<HintResponse>(`${base}/hints`, {
            method: 'POST',
            body: { userId: props.userId, teamId: props.teamId, taskId: taskId ?? null },
        });
        latestHint.value = res;
        isOpen.value = true;
        await fetchHistory();
    } catch (e) {
        latestHint.value = {
            hint: 'שגיאה בקבלת רמז. בדוק שהשרת פועל.',
            hintNumber: 0,
            hintsRemaining: 0,
            pointsDeducted: 0,
            isFree: true,
        };
        isOpen.value = true;
    } finally {
        loading.value = false;
    }
}

onMounted(fetchHistory);

defineExpose({ requestHint });
</script>

<template>
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <!-- Header -->
        <button
            class="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            @click="isOpen = !isOpen"
        >
            <div class="flex items-center gap-2">
                <span class="text-lg">💡</span>
                <span class="font-semibold text-gray-800 text-sm">Hints</span>
                <span
                    v-if="history.length"
                    class="text-xs bg-indigo-100 text-indigo-700 font-medium px-2 py-0.5 rounded-full"
                >
                    {{ history.length }}
                </span>
            </div>
            <span class="text-gray-400 text-xs">{{ isOpen ? '▲' : '▼' }}</span>
        </button>

        <Transition name="slide">
            <div v-if="isOpen" class="border-t border-gray-100">
                <!-- Latest hint response -->
                <div
                    v-if="latestHint"
                    class="mx-4 mt-4 p-4 rounded-xl text-sm leading-relaxed"
                    :class="latestHint.isFree ? 'bg-indigo-50 border border-indigo-200' : 'bg-amber-50 border border-amber-200'"
                >
                    <div class="flex items-center gap-1.5 mb-2">
                        <span class="font-bold text-indigo-700">Hint #{{ latestHint.hintNumber }}</span>
                        <span v-if="latestHint.isFree" class="text-xs text-emerald-600 font-medium">✓ Free</span>
                        <span v-else class="text-xs text-amber-600 font-medium">
                            -{{ latestHint.pointsDeducted }} pts
                        </span>
                        <span class="text-xs text-gray-400 ml-auto">
                            {{ latestHint.hintsRemaining }} free left
                        </span>
                    </div>
                    <p class="text-gray-700" dir="auto">{{ latestHint.hint }}</p>
                </div>

                <!-- History list -->
                <div class="px-4 pb-4 mt-3 flex flex-col gap-2 max-h-72 overflow-y-auto">
                    <p v-if="!history.length && !latestHint" class="text-xs text-gray-400 text-center py-3">
                        No hints yet. Use the 💡 button on a task to ask for one.
                    </p>
                    <div
                        v-for="item in [...history].reverse()"
                        :key="item.id"
                        class="bg-gray-50 rounded-lg px-3 py-2.5 text-xs text-gray-600 flex flex-col gap-1"
                    >
                        <div class="flex items-center gap-1.5 text-gray-400">
                            <span class="font-medium text-gray-700">Hint #{{ item.hint_number }}</span>
                            <span v-if="item.points_deducted > 0" class="text-amber-500">
                                -{{ item.points_deducted }} pts
                            </span>
                            <span class="ml-auto">{{ new Date(item.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) }}</span>
                        </div>
                        <p dir="auto" class="leading-relaxed">{{ item.hint_text }}</p>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active { transition: all 0.2s ease; }
.slide-enter-from,
.slide-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
