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

const statusConfig: Record<string, { label: string; dotClass: string; textClass: string; bgClass: string; borderClass: string }> = {
    idle:      { label: 'לא התחיל', dotClass: 'bg-gray-400',    textClass: 'text-gray-500',    bgClass: 'bg-gray-100',       borderClass: 'border-gray-200' },
    active:    { label: 'פעיל',     dotClass: 'bg-[#3CC2EE]',   textClass: 'text-[#1e8db4]',   bgClass: 'bg-[#3CC2EE]/8',    borderClass: 'border-[#3CC2EE]/20' },
    completed: { label: 'הושלם',    dotClass: 'bg-emerald-500', textClass: 'text-emerald-700', bgClass: 'bg-emerald-50',     borderClass: 'border-emerald-200' },
};
const status = computed(() => statusConfig[props.sprintStatus] ?? statusConfig.idle);
</script>

<template>
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4 flex-wrap">

        <!-- Score pill -->
        <div class="flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-full shrink-0">
            <svg class="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span class="text-xs font-bold text-amber-700">{{ score }} נק'</span>
        </div>

        <!-- Status badge -->
        <div :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-full border shrink-0', status.bgClass, status.borderClass]">
            <span :class="['w-1.5 h-1.5 rounded-full shrink-0', status.dotClass, sprintStatus === 'active' ? 'animate-pulse' : '']" />
            <span :class="['text-xs font-semibold', status.textClass]">{{ status.label }}</span>
        </div>

        <!-- Progress bar -->
        <div class="flex-1 min-w-40">
            <div class="flex items-center justify-between text-xs mb-1.5">
                <span class="text-gray-500">משימות שאושרו</span>
                <span class="font-bold text-gray-700">{{ approved }} / {{ total }}</span>
            </div>
            <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                    class="h-full rounded-full transition-all duration-700"
                    :class="pct === 100 ? 'bg-emerald-500' : 'bg-[#3CC2EE]'"
                    :style="{ width: `${pct}%` }"
                />
            </div>
        </div>

        <!-- Complete badge -->
        <div v-if="pct === 100" class="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full shrink-0">
            <svg class="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span class="text-xs font-bold text-emerald-700">Sprint הושלם!</span>
        </div>

    </div>
</template>
