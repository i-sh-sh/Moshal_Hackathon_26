<script setup lang="ts">
import type { StudentProfile, ProfileSnapshot } from '~/types/types';

const props = defineProps<{
    profile: StudentProfile;
    snapshots?: readonly ProfileSnapshot[];
    userName?: string;
    compact?: boolean;
}>();

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('he-IL');
}

function scoreColor(score: number): string {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
}

function scoreBar(score: number): string {
    if (score >= 70) return 'bg-emerald-400';
    if (score >= 40) return 'bg-amber-400';
    return 'bg-red-400';
}

const alertConfig = computed(() => {
    switch (props.profile.alertLevel) {
        case 'high':   return { label: 'דורש תשומת לב', dot: 'bg-red-500',   cls: 'bg-red-50 border-red-200 text-red-700' };
        case 'medium': return { label: 'בדוק/י',        dot: 'bg-amber-400',  cls: 'bg-amber-50 border-amber-200 text-amber-700' };
        case 'low':    return { label: 'הערה קלה',      dot: 'bg-blue-400',   cls: 'bg-blue-50 border-blue-200 text-blue-700' };
        default:       return null;
    }
});

const initials = computed(() =>
    (props.userName ?? 'U')
        .split(' ')
        .map((w) => w[0] ?? '')
        .slice(0, 2)
        .join('')
        .toUpperCase(),
);

const avatarGradient = computed(() => {
    switch (props.profile.alertLevel) {
        case 'high':   return 'from-red-400 to-rose-500';
        case 'medium': return 'from-amber-400 to-orange-500';
        default:       return 'from-[#3CC2EE] to-cyan-600';
    }
});
</script>

<template>
    <!-- ── Compact card (teacher list) ───────────────────────────────────── -->
    <div
        v-if="compact"
        class="bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4 transition-all hover:shadow-md hover:border-[#3CC2EE]/40 cursor-pointer group"
        :class="profile.alertLevel === 'high' ? 'border-red-200' : profile.alertLevel === 'medium' ? 'border-amber-200' : 'border-gray-200'"
    >
        <!-- Avatar -->
        <div
            class="w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm"
            :class="avatarGradient"
        >
            {{ initials }}
        </div>

        <!-- Name + date -->
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
                <p class="font-semibold text-gray-800 text-sm truncate">{{ userName ?? 'תלמיד/ה' }}</p>
                <!-- Alert dot + label -->
                <span
                    v-if="alertConfig"
                    :class="['inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', alertConfig.cls]"
                >
                    <span :class="['w-1.5 h-1.5 rounded-full shrink-0', alertConfig.dot]" />
                    {{ alertConfig.label }}
                </span>
            </div>
            <p class="text-xs text-gray-400 mt-0.5">{{ profile.messagesAnalyzed }} הודעות · {{ formatDate(profile.lastAnalyzedAt) }}</p>

            <!-- Key scores row -->
            <div class="flex items-center gap-3 mt-2">
                <div class="flex items-center gap-1.5">
                    <span class="text-[10px] text-gray-400 font-medium">ז'רגון</span>
                    <span :class="['text-sm font-bold', scoreColor(profile.jargonScore)]">{{ profile.jargonScore.toFixed(0) }}</span>
                    <div class="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div :class="['h-full rounded-full', scoreBar(profile.jargonScore)]" :style="`width:${profile.jargonScore}%`" />
                    </div>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="text-[10px] text-gray-400 font-medium">כישורים</span>
                    <span :class="['text-sm font-bold', scoreColor(profile.softSkillScore)]">{{ profile.softSkillScore.toFixed(0) }}</span>
                    <div class="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div :class="['h-full rounded-full', scoreBar(profile.softSkillScore)]" :style="`width:${profile.softSkillScore}%`" />
                    </div>
                </div>
                <span
                    v-if="profile.struggleAreas?.length"
                    class="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full font-semibold"
                >
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {{ profile.struggleAreas.length }} נושאי קושי
                </span>
            </div>
        </div>

        <!-- Arrow -->
        <svg class="w-4 h-4 text-gray-300 group-hover:text-[#3CC2EE] transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
        </svg>
    </div>

    <!-- ── Full card (student own view) ──────────────────────────────────── -->
    <div
        v-else
        class="bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-4 transition-all"
        :class="profile.alertLevel === 'high' ? 'border-red-300' : profile.alertLevel === 'medium' ? 'border-amber-300' : 'border-gray-200'"
    >
        <!-- Header -->
        <div class="flex items-center gap-3">
            <div
                class="w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shrink-0"
                :class="avatarGradient"
            >
                {{ initials }}
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-800 text-sm">{{ userName ?? 'תלמיד/ה' }}</p>
                <p class="text-xs text-gray-400">{{ profile.messagesAnalyzed }} הודעות נותחו · {{ formatDate(profile.lastAnalyzedAt) }}</p>
            </div>
        </div>

        <!-- Alert banner -->
        <div v-if="alertConfig" :class="['rounded-xl border px-3 py-2 text-xs font-medium flex items-start gap-2', alertConfig.cls]">
            <span :class="['w-2 h-2 rounded-full mt-0.5 shrink-0', alertConfig.dot]" />
            <div>
                <span class="font-bold">{{ alertConfig.label }}</span>
                <span v-if="profile.lastAlertMessage" class="block font-normal mt-0.5 opacity-80">{{ profile.lastAlertMessage }}</span>
            </div>
        </div>

        <!-- Scores -->
        <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 rounded-xl p-3">
                <p class="text-xs text-gray-500 mb-1">ז'רגון טכני</p>
                <p :class="['text-2xl font-bold', scoreColor(profile.jargonScore)]">{{ profile.jargonScore.toFixed(0) }}</p>
                <div class="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div :class="['h-full rounded-full transition-all', scoreBar(profile.jargonScore)]" :style="`width:${profile.jargonScore}%`" />
                </div>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
                <p class="text-xs text-gray-500 mb-1">רכישת כישורים</p>
                <p :class="['text-2xl font-bold', scoreColor(profile.softSkillScore)]">{{ profile.softSkillScore.toFixed(0) }}</p>
                <div class="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div :class="['h-full rounded-full transition-all', scoreBar(profile.softSkillScore)]" :style="`width:${profile.softSkillScore}%`" />
                </div>
            </div>
        </div>

        <!-- Struggle areas -->
        <div v-if="profile.struggleAreas?.length">
            <p class="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                נושאים שהתקשה בהם
            </p>
            <div class="flex flex-wrap gap-1.5">
                <span v-for="area in profile.struggleAreas.slice(0, 8)" :key="area"
                    class="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full">
                    {{ area }}
                </span>
                <span v-if="profile.struggleAreas.length > 8" class="text-xs text-gray-400">+{{ profile.struggleAreas.length - 8 }}</span>
            </div>
        </div>

        <!-- Detected terms -->
        <div v-if="profile.detectedTerms.length">
            <p class="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                מונחים שזוהו
            </p>
            <div class="flex flex-wrap gap-1.5">
                <span v-for="term in profile.detectedTerms.slice(0, 10)" :key="term"
                    class="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                    {{ term }}
                </span>
                <span v-if="profile.detectedTerms.length > 10" class="text-xs text-gray-400">+{{ profile.detectedTerms.length - 10 }}</span>
            </div>
        </div>

        <!-- Progress sparkline -->
        <div v-if="snapshots && snapshots.length > 1" class="flex flex-col gap-1">
            <p class="text-xs text-gray-500">התקדמות ז'רגון לאורך זמן</p>
            <div class="flex items-end gap-0.5 h-10">
                <div
                    v-for="snap in snapshots.slice(-16)"
                    :key="snap.id"
                    class="flex-1 rounded-sm transition-all"
                    :class="scoreBar(snap.jargonScore)"
                    :style="`height: ${Math.max(4, snap.jargonScore)}%`"
                    :title="`${new Date(snap.snapshotAt).toLocaleDateString('he-IL')}: ${snap.jargonScore.toFixed(0)}`"
                />
            </div>
        </div>
    </div>
</template>
