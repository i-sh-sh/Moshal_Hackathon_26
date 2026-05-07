<script setup lang="ts">
const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

interface AnalyticsRow {
    id: string;
    name: string;
    team_name: string | null;
    current_role: string | null;
    approved_tasks: number;
    total_active_time: number;   // seconds
    tasks_per_hour: number | null;
}

const rows = ref<AnalyticsRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
    try {
        rows.value = await $fetch<AnalyticsRow[]>(`${base}/teams/analytics`);
    } catch (e) {
        error.value = 'לא הצלחנו לטעון אנליטיקה — בדוק שהשרת רץ.';
    } finally {
        loading.value = false;
    }
});

function formatTime(seconds: number): string {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

import { ROLE_LABELS } from '~/types/types';
import type { StudentRole } from '~/types/types';

const roleColors: Record<string, string> = {
    pm:       'bg-purple-100 text-purple-700',
    qa:       'bg-yellow-100 text-yellow-700',
    dev:      'bg-blue-100 text-blue-700',
    hardware: 'bg-green-100 text-green-700',
};

function roleDisplay(role: string | null): string {
    if (!role) return '';
    return ROLE_LABELS[role as StudentRole] ?? role.toUpperCase();
}

const maxApproved = computed(() => Math.max(1, ...rows.value.map((r) => r.approved_tasks)));
</script>

<template>
    <div class="flex flex-col gap-5" dir="rtl">
        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-16">
            <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 text-sm">
            {{ error }}
        </div>

        <template v-else>
            <!-- Summary cards -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center">
                    <p class="text-2xl font-extrabold text-[#3CC2EE]">{{ rows.length }}</p>
                    <p class="text-xs text-gray-500 mt-1">תלמידים</p>
                </div>
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center">
                    <p class="text-2xl font-extrabold text-emerald-600">{{ rows.reduce((s, r) => s + r.approved_tasks, 0) }}</p>
                    <p class="text-xs text-gray-500 mt-1">משימות שאושרו</p>
                </div>
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center">
                    <p class="text-2xl font-extrabold text-amber-500">
                        {{ formatTime(Math.round(rows.reduce((s, r) => s + r.total_active_time, 0) / Math.max(1, rows.length))) }}
                    </p>
                    <p class="text-xs text-gray-500 mt-1">זמן פעילות ממוצע</p>
                </div>
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center">
                    <p class="text-2xl font-extrabold text-purple-600">
                        {{ rows.filter((r) => r.approved_tasks > 0).length }}
                    </p>
                    <p class="text-xs text-gray-500 mt-1">תלמידים מתקדמים</p>
                </div>
            </div>

            <!-- Table -->
            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-gray-50 text-left text-xs text-gray-500 font-semibold uppercase tracking-wide">
                            <th class="px-5 py-3">תלמיד</th>
                            <th class="px-5 py-3">צוות</th>
                            <th class="px-5 py-3">תפקיד</th>
                            <th class="px-5 py-3">זמן פעילות</th>
                            <th class="px-5 py-3">משימות שאושרו</th>
                            <th class="px-5 py-3">משימות/שעה</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="row in rows"
                            :key="row.id"
                            class="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                            <td class="px-5 py-3 font-medium text-gray-800">{{ row.name }}</td>
                            <td class="px-5 py-3 text-gray-500">{{ row.team_name ?? '—' }}</td>
                            <td class="px-5 py-3">
                                <span
                                    v-if="row.current_role"
                                    :class="['text-xs font-medium px-2 py-0.5 rounded-full', roleColors[row.current_role] ?? 'bg-gray-100 text-gray-600']"
                                >
                                    {{ roleDisplay(row.current_role) }}
                                </span>
                                <span v-else class="text-gray-300">—</span>
                            </td>
                            <td class="px-5 py-3 text-gray-600">{{ formatTime(row.total_active_time) }}</td>
                            <td class="px-5 py-3">
                                <div class="flex items-center gap-2">
                                    <div class="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            class="h-full bg-emerald-400 rounded-full transition-all duration-700"
                                            :style="{ width: `${(row.approved_tasks / maxApproved) * 100}%` }"
                                        />
                                    </div>
                                    <span class="text-gray-700 font-medium tabular-nums">{{ row.approved_tasks }}</span>
                                </div>
                            </td>
                            <td class="px-5 py-3 text-gray-500 tabular-nums">
                                {{ row.tasks_per_hour != null ? row.tasks_per_hour.toFixed(1) : '—' }}
                            </td>
                        </tr>
                        <tr v-if="!rows.length">
                            <td colspan="6" class="px-5 py-10 text-center text-gray-400 text-sm">אין נתונים עדיין.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </template>
    </div>
</template>
