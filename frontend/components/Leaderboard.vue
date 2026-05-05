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
        <div class="flex items-center gap-2">
            <span class="text-lg">🏆</span>
            <h3 class="font-bold text-gray-800 text-sm">Team Leaderboard</h3>
        </div>

        <div v-if="!rows.length" class="text-xs text-gray-400 text-center py-4">
            No teams yet.
        </div>

        <div v-else class="flex flex-col gap-2">
            <div
                v-for="(row, i) in rows"
                :key="row.id"
                :class="[
                    'rounded-xl px-4 py-3 flex flex-col gap-1.5 transition-colors',
                    row.id === highlightTeamId
                        ? 'bg-indigo-50 border border-indigo-200'
                        : 'bg-gray-50 border border-transparent',
                ]"
            >
                <div class="flex items-center gap-2">
                    <span class="text-base w-6 text-center shrink-0">
                        {{ medals[i] ?? `#${i + 1}` }}
                    </span>
                    <span class="font-semibold text-gray-800 text-sm flex-1 truncate">
                        {{ row.name }}
                        <span v-if="row.id === highlightTeamId" class="text-indigo-500 text-xs ml-1">(you)</span>
                    </span>
                    <span class="text-sm font-bold text-gray-700 shrink-0">
                        {{ row.accumulatedScore }} pts
                    </span>
                </div>
                <!-- Score bar -->
                <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden ml-8">
                    <div
                        class="h-full rounded-full bg-indigo-400 transition-all duration-700"
                        :style="{ width: `${(row.accumulatedScore / maxScore) * 100}%` }"
                    />
                </div>
                <div class="flex gap-3 ml-8 text-xs text-gray-400">
                    <span>{{ row.approvedTaskCount }} tasks approved</span>
                    <span v-if="row.isCompleted" class="text-emerald-500 font-medium">✓ Complete</span>
                </div>
            </div>
        </div>
    </div>
</template>
