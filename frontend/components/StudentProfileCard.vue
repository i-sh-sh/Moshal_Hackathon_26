<script setup lang="ts">
import type { StudentProfile, ProfileSnapshot } from '~/types/types';

const props = defineProps<{
    profile: StudentProfile;
    snapshots?: readonly ProfileSnapshot[];
    userName?: string;
}>();

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('he-IL');
}

function scoreColor(score: number): string {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-500';
}

function scoreBar(score: number): string {
    if (score >= 70) return 'bg-emerald-400';
    if (score >= 40) return 'bg-amber-400';
    return 'bg-red-400';
}

const alertConfig = computed(() => {
    switch (props.profile.alertLevel) {
        case 'high':   return { label: '🔴 דורש תשומת לב', cls: 'bg-red-50 border-red-200 text-red-700' };
        case 'medium': return { label: '🟡 בדוק/י', cls: 'bg-amber-50 border-amber-200 text-amber-700' };
        case 'low':    return { label: '🔵 הערה קלה', cls: 'bg-blue-50 border-blue-200 text-blue-700' };
        default:       return null;
    }
});
</script>

<template>
    <div
        class="bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-4 transition-all"
        :class="profile.alertLevel === 'high' ? 'border-red-300' : profile.alertLevel === 'medium' ? 'border-amber-300' : 'border-gray-200'"
    >
        <!-- Header -->
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {{ (userName ?? 'U').charAt(0) }}
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-800 text-sm">{{ userName ?? 'תלמיד/ה' }}</p>
                <p class="text-xs text-gray-400">{{ profile.messagesAnalyzed }} הודעות נותחו · {{ formatDate(profile.lastAnalyzedAt) }}</p>
            </div>
        </div>

        <!-- Alert banner -->
        <div v-if="alertConfig" :class="['rounded-xl border px-3 py-2 text-xs font-medium', alertConfig.cls]">
            {{ alertConfig.label }}
            <span v-if="profile.lastAlertMessage" class="block font-normal mt-0.5 opacity-80">{{ profile.lastAlertMessage }}</span>
        </div>

        <!-- Scores -->
        <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 rounded-xl p-3">
                <p class="text-xs text-gray-500 mb-1">ז'רגון טכני</p>
                <p :class="['text-2xl font-bold', scoreColor(profile.jargonScore)]">{{ profile.jargonScore.toFixed(0) }}</p>
                <div class="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div :class="['h-full rounded-full transition-all', scoreBar(profile.jargonScore)]" :style="`width: ${profile.jargonScore}%`" />
                </div>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
                <p class="text-xs text-gray-500 mb-1">כישורים רכים</p>
                <p :class="['text-2xl font-bold', scoreColor(profile.softSkillScore)]">{{ profile.softSkillScore.toFixed(0) }}</p>
                <div class="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div :class="['h-full rounded-full transition-all', scoreBar(profile.softSkillScore)]" :style="`width: ${profile.softSkillScore}%`" />
                </div>
            </div>
        </div>

        <!-- Struggle areas -->
        <div v-if="profile.struggleAreas?.length">
            <p class="text-xs text-gray-500 mb-1.5">⚠️ נושאים שהתקשה בהם</p>
            <div class="flex flex-wrap gap-1.5">
                <span
                    v-for="area in profile.struggleAreas.slice(0, 8)"
                    :key="area"
                    class="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full"
                >
                    {{ area }}
                </span>
                <span v-if="profile.struggleAreas.length > 8" class="text-xs text-gray-400">+{{ profile.struggleAreas.length - 8 }}</span>
            </div>
        </div>

        <!-- Detected terms -->
        <div v-if="profile.detectedTerms.length">
            <p class="text-xs text-gray-500 mb-1.5">✅ מונחים שזוהו</p>
            <div class="flex flex-wrap gap-1.5">
                <span
                    v-for="term in profile.detectedTerms.slice(0, 10)"
                    :key="term"
                    class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full"
                >
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
