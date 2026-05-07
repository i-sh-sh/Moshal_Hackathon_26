<script setup lang="ts">
import type { StudentProfile } from '~/types/types';
import { useStudentProfile } from '~/composables/useStudentProfile';

useHead({ title: 'Teacher Dashboard — TeamSprintUp' });

const activeTab = ref<'board' | 'analytics' | 'chats' | 'profiles'>('board');

const { allProfiles, fetchAllProfiles } = useStudentProfile();

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

// Enrich profiles with names from users endpoint
const enrichedProfiles = ref<Array<StudentProfile & { name: string }>>([]);

async function loadProfiles() {
    await fetchAllProfiles();
    const users = await $fetch<Array<{ id: string; name: string }>>(`${base}/users`).catch(() => []);
    const nameMap = new Map(users.map((u) => [u.id, u.name]));
    enrichedProfiles.value = allProfiles.value.map((p) => ({
        ...p,
        name: nameMap.get(p.userId) ?? 'תלמיד/ה',
    }));
}

watch(activeTab, (tab) => {
    if (tab === 'profiles') loadProfiles();
});
</script>

<template>
    <div class="min-h-screen bg-gray-900 flex flex-col">
        <!-- Header -->
        <header class="border-b border-gray-700 px-6 h-14 flex items-center gap-4">
            <span class="text-xl">🚀</span>
            <span class="font-bold text-white text-sm tracking-tight">TeamSprintUp</span>
            <span class="text-xs text-gray-400 font-medium px-2 py-0.5 rounded-full bg-gray-800">Teacher</span>

            <div class="flex-1" />

            <!-- Tabs -->
            <div class="flex gap-1 bg-gray-800 p-1 rounded-xl flex-wrap">
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'board' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'board'"
                >
                    📋 Monday Board
                </button>
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'analytics' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'analytics'"
                >
                    📊 Analytics
                </button>
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'chats' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'chats'"
                >
                    💬 צ'אטים DUDE
                </button>
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'profiles' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'profiles'"
                >
                    🧠 פרופילים
                </button>
            </div>
        </header>

        <!-- Monday board -->
        <div v-if="activeTab === 'board'" class="flex-1">
            <MockMondayBoard />
        </div>

        <!-- Analytics -->
        <div v-else-if="activeTab === 'analytics'" class="flex-1 p-6 bg-gray-50">
            <div class="max-w-5xl mx-auto">
                <h1 class="text-xl font-bold text-gray-800 mb-5">Student Analytics</h1>
                <AnalyticsDashboard />
            </div>
        </div>

        <!-- DUDE Chats -->
        <div v-else-if="activeTab === 'chats'" class="flex-1 p-6" style="min-height: 0">
            <div class="max-w-5xl mx-auto h-full" style="height: calc(100vh - 120px)">
                <TeacherChatPanel />
            </div>
        </div>

        <!-- Student Profiles -->
        <div v-else-if="activeTab === 'profiles'" class="flex-1 p-6 bg-gray-50">
            <div class="max-w-5xl mx-auto">
                <div class="flex items-center gap-3 mb-5">
                    <h1 class="text-xl font-bold text-gray-800">פרופילים לימודיים — DUDE</h1>
                    <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{{ enrichedProfiles.length }} תלמידים</span>
                    <button
                        class="ml-auto text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
                        @click="loadProfiles"
                    >
                        רענן
                    </button>
                </div>

                <div v-if="!enrichedProfiles.length" class="text-center py-16 text-gray-400 text-sm">
                    אין פרופילים עדיין. תלמידים יופיעו כאן לאחר שינתחו שיחות.
                </div>

                <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <StudentProfileCard
                        v-for="p in enrichedProfiles"
                        :key="p.id"
                        :profile="p"
                        :user-name="p.name"
                    />
                </div>
            </div>
        </div>
    </div>
</template>
