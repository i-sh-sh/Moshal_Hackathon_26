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
    const pct = Math.min(Math.max(score, 0), 100);
    if (pct >= 70) return 'bg-emerald-400';
    if (pct >= 40) return 'bg-amber-400';
    return 'bg-red-400';
}
</script>

<template>
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">

        <!-- Header -->
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {{ (userName ?? 'U').charAt(0) }}
            </div>
            <div>
                <p class="font-semibold text-gray-800 text-sm">{{ userName ?? 'תלמיד/ה' }}</p>
                <p class="text-xs text-gray-400">{{ profile.messagesAnalyzed }} הודעות נותחו · עדכון אחרון: {{ formatDate(profile.lastAnalyzedAt) }}</p>
            </div>
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

        <!-- Detected terms -->
        <div v-if="profile.detectedTerms.length">
            <p class="text-xs text-gray-500 mb-1.5">מונחים שזוהו</p>
            <div class="flex flex-wrap gap-1.5">
                <span
                    v-for="term in profile.detectedTerms.slice(0, 12)"
                    :key="term"
                    class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full"
                >
                    {{ term }}
                </span>
                <span v-if="profile.detectedTerms.length > 12" class="text-xs text-gray-400">+{{ profile.detectedTerms.length - 12 }}</span>
            </div>
        </div>

        <!-- Progress sparkline (snapshots) -->
        <div v-if="snapshots && snapshots.length > 1" class="flex flex-col gap-1">
            <p class="text-xs text-gray-500">התקדמות ז'רגון לאורך זמן</p>
            <div class="flex items-end gap-0.5 h-10">
                <div
                    v-for="(snap, i) in snapshots.slice(-16)"
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
