<script setup lang="ts">
import type { GroupLeaderboardRow } from '~/types/types';

const props = defineProps<{
    rows: GroupLeaderboardRow[];
    highlightTeamId?: string;
}>();

const medals = ['🥇', '🥈', '🥉'];
const maxScore = computed(() =>
    Math.max(1, ...props.rows.map((r) => r.accumulatedScore)),
);
</script>

<template>
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
        <!-- Header -->
        <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
                    <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/>
                </svg>
            </div>
            <h3 class="font-bold text-gray-800 text-sm">לוח דירוג צוותים</h3>
        </div>

        <div v-if="!rows.length" class="text-xs text-gray-400 text-center py-6">
            אין צוותים עדיין.
        </div>

        <div v-else class="flex flex-col gap-2">
            <div
                v-for="(row, i) in rows"
                :key="row.id"
                :class="[
                    'rounded-xl px-4 py-3 flex flex-col gap-1.5 transition-colors border',
                    row.id === highlightTeamId
                        ? 'bg-cyan-50 border-[#3CC2EE]/30'
                        : 'bg-gray-50 border-transparent',
                ]"
            >
                <div class="flex items-center gap-2">
                    <span class="text-base w-7 text-center shrink-0">
                        {{ medals[i] ?? `#${i + 1}` }}
                    </span>
                    <span class="font-semibold text-gray-800 text-sm flex-1 truncate">
                        {{ row.name }}
                        <span v-if="row.id === highlightTeamId" class="text-[#3CC2EE] text-xs mr-1">(אתם)</span>
                    </span>
                    <span class="text-sm font-bold text-gray-700 shrink-0">
                        {{ row.accumulatedScore }} נק'
                    </span>
                </div>

                <!-- Score bar -->
                <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden mr-9">
                    <div
                        class="h-full rounded-full bg-[#3CC2EE] transition-all duration-700"
                        :style="{ width: `${(row.accumulatedScore / maxScore) * 100}%` }"
                    />
                </div>

                <div class="flex gap-3 mr-9 text-xs text-gray-400">
                    <span>{{ row.approvedTaskCount }} משימות אושרו</span>
                    <span v-if="row.isCompleted" class="text-emerald-500 font-semibold flex items-center gap-1">
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        הושלם
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
