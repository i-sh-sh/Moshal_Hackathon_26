<script setup lang="ts">
const props = defineProps<{
    sprintTitle: string;
    approved: number;
    total: number;
    score: number;
    sprintStatus: string;
}>();

const pct = computed(() =>
    props.total > 0 ? Math.round((props.approved / props.total) * 100) : 0,
);

const statusColor: Record<string, string> = {
    idle: 'bg-gray-400',
    active: 'bg-indigo-500',
    completed: 'bg-emerald-500',
};
</script>

<template>
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
        <!-- Sprint status + score -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-3">
                <span class="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                    ⭐ {{ score }} pts
                </span>
                <span
                    :class="['text-xs font-medium px-2.5 py-1 rounded-full text-white', statusColor[sprintStatus] ?? 'bg-gray-400']"
                >
                    {{ sprintStatus.charAt(0).toUpperCase() + sprintStatus.slice(1) }}
                </span>
            </div>
        </div>

        <!-- Progress bar -->
        <div>
            <div class="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>Tasks approved</span>
                <span class="font-semibold text-gray-700">{{ approved }} / {{ total }}</span>
            </div>
            <div class="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    class="h-full rounded-full transition-all duration-700"
                    :class="pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'"
                    :style="{ width: `${pct}%` }"
                />
            </div>
            <p v-if="pct === 100" class="text-xs text-emerald-600 font-medium mt-1.5">
                🎉 Sprint complete!
            </p>
        </div>
    </div>
</template>
