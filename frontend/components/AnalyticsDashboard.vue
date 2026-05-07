<script setup lang="ts">
import { ROLE_LABELS } from '~/types/types';
import type { 
    UserRole, 
    TeacherDashboardResponse, 
    StudentInsight,
    DifficultTask,
    TeamProgress
} from '~/types/types';

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

const data = ref<TeacherDashboardResponse | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
    try {
        data.value = await $fetch<TeacherDashboardResponse>(`${base}/teams/analytics/teacher-dashboard`);
    } catch (e) {
        error.value = 'שגיאה בטעינת הנתונים מהשרת. נסה שוב מאוחר יותר.';
    } finally {
        loading.value = false;
    }
});

function formatTime(seconds: number): string {
    if (!seconds) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

const roleColors: Record<string, string> = {
    pm:       'bg-purple-100 text-purple-700',
    qa:       'bg-yellow-100 text-yellow-700',
    dev:      'bg-blue-100 text-blue-700',
    hardware: 'bg-green-100 text-green-700',
};

function roleDisplay(role: UserRole | null): string {
    if (!role) return 'ללא תפקיד';
    return ROLE_LABELS[role] ?? role.toUpperCase();
}

const needsAttention = computed(() => data.value?.students.filter(s => s.riskLevel === 'needs_attention') ?? []);
const watchList = computed(() => data.value?.students.filter(s => s.riskLevel === 'watch') ?? []);

const riskBadgeClasses: Record<string, string> = {
    needs_attention: 'bg-rose-100 text-rose-700 border-rose-200',
    watch:           'bg-amber-100 text-amber-700 border-amber-200',
    ok:              'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const riskLabels: Record<string, string> = {
    needs_attention: 'דורש תשומת לב',
    watch:           'במעקב',
    ok:              'תקין',
};
</script>

<template>
    <div class="flex flex-col gap-8 pb-10" dir="rtl">
        <!-- Loading -->
        <div v-if="loading" class="flex justify-center py-20">
            <div class="w-10 h-10 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-5 text-sm">
            {{ error }}
        </div>

        <template v-else-if="data">
            <!-- Summary Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 transition-all hover:shadow-md">
                    <p class="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">סך הכל תלמידים</p>
                    <p class="text-3xl font-black text-gray-900">{{ data.summary.totalStudents }}</p>
                </div>
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 transition-all hover:shadow-md">
                    <p class="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">צוותים פעילים</p>
                    <p class="text-3xl font-black text-emerald-600">{{ data.summary.activeTeams }} <span class="text-sm font-medium text-gray-400">/ {{ data.summary.totalTeams }}</span></p>
                </div>
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 transition-all hover:shadow-md">
                    <p class="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">משימות שאושרו</p>
                    <p class="text-3xl font-black text-[#3CC2EE]">{{ data.summary.approvedTasks }} <span class="text-sm font-medium text-gray-400">/ {{ data.summary.totalTasks }}</span></p>
                </div>
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 transition-all hover:shadow-md">
                    <p class="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">התקדמות ממוצעת</p>
                    <div class="flex items-end gap-2">
                        <p class="text-3xl font-black text-purple-600">{{ data.summary.averageProgressPercent }}%</p>
                        <div class="h-2 w-20 bg-gray-100 rounded-full mb-2 overflow-hidden">
                            <div class="h-full bg-purple-500" :style="{ width: `${data.summary.averageProgressPercent}%` }" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Attention Section -->
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-8 bg-rose-500 rounded-full" />
                    <h2 class="text-xl font-bold text-gray-900">תלמידים שדורשים התערבות</h2>
                </div>
                
                <div v-if="needsAttention.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div 
                        v-for="s in needsAttention" 
                        :key="s.userId"
                        class="bg-rose-50 border-2 border-rose-100 rounded-2xl p-5 relative overflow-hidden group transition-all hover:border-rose-300"
                    >
                        <div class="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg class="w-12 h-12 text-rose-900" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                        </div>
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h3 class="font-bold text-gray-900 text-lg">{{ s.name }}</h3>
                                <p class="text-sm text-gray-500 font-medium">{{ s.teamName || 'ללא צוות' }} • {{ roleDisplay(s.role) }}</p>
                            </div>
                            <span class="px-2.5 py-1 rounded-lg bg-rose-200 text-rose-800 text-xs font-bold">{{ s.hintCount }} רמזים</span>
                        </div>
                        <div class="bg-white/50 rounded-xl p-3 border border-rose-100">
                            <p class="text-xs font-bold text-rose-900 uppercase mb-1">סיבה לעירנות:</p>
                            <p class="text-sm text-rose-800 leading-relaxed">{{ s.insightReason }}</p>
                        </div>
                        <div class="mt-4 flex justify-between items-center text-xs font-medium text-gray-500">
                            <span>משימות: {{ s.approvedTasks }} / {{ s.totalTasks }}</span>
                            <span>זמן פעיל: {{ formatTime(s.totalActiveTimeSeconds) }}</span>
                        </div>
                    </div>
                </div>
                <div v-else class="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
                    <p class="text-emerald-800 font-medium text-sm">כל הכבוד! אין תלמידים שדורשים התערבות דחופה כרגע.</p>
                </div>
            </div>

            <!-- Watch List & Difficult Tasks -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Watch List -->
                <div class="space-y-4">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-6 bg-amber-400 rounded-full" />
                        <h2 class="text-lg font-bold text-gray-800">רשימת מעקב</h2>
                    </div>
                    <div v-if="watchList.length" class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div 
                            v-for="s in watchList" 
                            :key="s.userId"
                            class="flex items-center justify-between p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                        >
                            <div class="flex flex-col">
                                <span class="font-bold text-gray-900">{{ s.name }}</span>
                                <span class="text-xs text-gray-500">{{ s.teamName }} • {{ s.insightReason }}</span>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="text-right">
                                    <p class="text-xs font-bold text-amber-600">{{ s.hintCount }} רמזים</p>
                                    <p class="text-[10px] text-gray-400">{{ s.approvedTasks }} / {{ s.totalTasks }} משימות</p>
                                </div>
                                <div class="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            </div>
                        </div>
                    </div>
                    <div v-else class="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
                        <p class="text-gray-500 text-xs">רשימת המעקב ריקה.</p>
                    </div>
                </div>

                <!-- Difficult Tasks -->
                <div class="space-y-4">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-6 bg-purple-400 rounded-full" />
                        <h2 class="text-lg font-bold text-gray-800">משימות מאתגרות</h2>
                    </div>
                    <div v-if="data.difficultTasks.length" class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div 
                            v-for="t in data.difficultTasks" 
                            :key="t.taskId"
                            class="flex items-center justify-between p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                        >
                            <div class="flex flex-col max-w-[70%]">
                                <span class="font-bold text-gray-900 truncate">{{ t.title }}</span>
                                <span class="text-xs text-gray-500">{{ t.teamName }}</span>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="text-left bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">
                                    <span class="text-sm font-black text-purple-700">{{ t.hintCount }}</span>
                                    <span class="text-[10px] text-purple-600 mr-1 italic">רמזים</span>
                                </div>
                                <div class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 uppercase">
                                    {{ t.status }}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else class="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
                        <p class="text-gray-500 text-xs">אין משימות בעייתיות כרגע.</p>
                    </div>
                </div>
            </div>

            <!-- Team Progress -->
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-6 bg-emerald-500 rounded-full" />
                    <h2 class="text-lg font-bold text-gray-800">התקדמות צוותים</h2>
                </div>
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div 
                        v-for="team in data.teams" 
                        :key="team.teamId"
                        class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
                    >
                        <div class="flex justify-between items-start mb-3">
                            <h3 class="font-bold text-gray-900">{{ team.teamName }}</h3>
                            <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{{ team.score }} נק'</span>
                        </div>
                        <div class="mb-4">
                            <div class="flex justify-between text-xs text-gray-500 mb-1 font-medium">
                                <span>התקדמות משימות</span>
                                <span>{{ team.progressPercent }}%</span>
                            </div>
                            <div class="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    class="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                                    :style="{ width: `${team.progressPercent}%` }"
                                />
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-center">
                            <div class="bg-gray-50 rounded-xl py-2 border border-gray-100">
                                <p class="text-[10px] text-gray-400 font-bold uppercase">משימות</p>
                                <p class="text-sm font-bold text-gray-700">{{ team.approvedTasks }} / {{ team.totalTasks }}</p>
                            </div>
                            <div class="bg-gray-50 rounded-xl py-2 border border-gray-100">
                                <p class="text-[10px] text-gray-400 font-bold uppercase">רמזים</p>
                                <p class="text-sm font-bold text-gray-700">{{ team.totalHints }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Detailed Student Table -->
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-6 bg-gray-400 rounded-full" />
                    <h2 class="text-lg font-bold text-gray-800">פירוט תלמידים</h2>
                </div>
                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm text-right">
                            <thead>
                                <tr class="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-bold uppercase tracking-wider">
                                    <th class="px-5 py-4">תלמיד</th>
                                    <th class="px-5 py-4">צוות</th>
                                    <th class="px-5 py-4">תפקיד</th>
                                    <th class="px-5 py-4">זמן פעיל</th>
                                    <th class="px-5 py-4">משימות</th>
                                    <th class="px-5 py-4">רמזים</th>
                                    <th class="px-5 py-4">קצב (משימה/שעה)</th>
                                    <th class="px-5 py-4 text-center">סטטוס</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="s in data.students"
                                    :key="s.userId"
                                    class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                                >
                                    <td class="px-5 py-4">
                                        <div class="flex flex-col">
                                            <span class="font-bold text-gray-900">{{ s.name }}</span>
                                            <span class="text-[10px] text-gray-400">{{ s.email }}</span>
                                        </div>
                                    </td>
                                    <td class="px-5 py-4 text-gray-600 font-medium">{{ s.teamName || '-' }}</td>
                                    <td class="px-5 py-4">
                                        <span
                                            v-if="s.role"
                                            :class="['text-[10px] font-bold px-2.5 py-1 rounded-lg', roleColors[s.role] ?? 'bg-gray-100 text-gray-600']"
                                        >
                                            {{ roleDisplay(s.role) }}
                                        </span>
                                        <span v-else class="text-gray-300">-</span>
                                    </td>
                                    <td class="px-5 py-4 text-gray-600 font-mono">{{ formatTime(s.totalActiveTimeSeconds) }}</td>
                                    <td class="px-5 py-4">
                                        <div class="flex items-center gap-2">
                                            <div class="h-1.5 w-12 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    class="h-full bg-emerald-400 rounded-full transition-all duration-700"
                                                    :style="{ width: `${(s.approvedTasks / Math.max(1, s.totalTasks)) * 100}%` }"
                                                />
                                            </div>
                                            <span class="font-bold tabular-nums">{{ s.approvedTasks }} / {{ s.totalTasks }}</span>
                                        </div>
                                    </td>
                                    <td class="px-5 py-4 text-gray-600 font-bold tabular-nums">{{ s.hintCount }}</td>
                                    <td class="px-5 py-4 text-gray-500 tabular-nums">
                                        {{ s.tasksPerHour != null ? s.tasksPerHour.toFixed(1) : '-' }}
                                    </td>
                                    <td class="px-5 py-4">
                                        <div 
                                            class="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase"
                                            :class="riskBadgeClasses[s.riskLevel]"
                                        >
                                            <div class="w-1.5 h-1.5 rounded-full" :class="s.riskLevel === 'ok' ? 'bg-emerald-500' : s.riskLevel === 'watch' ? 'bg-amber-500' : 'bg-rose-500'" />
                                            {{ riskLabels[s.riskLevel] }}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
