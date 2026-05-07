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
        // Convert readonly array to mutable array to satisfy StudentProfile interface
        detectedTerms: [...p.detectedTerms],
        name: nameMap.get(p.userId) ?? 'תלמיד לא מזוהה',
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
            <span class="text-xs text-gray-400 font-medium px-2 py-0.5 rounded-full bg-gray-800 uppercase tracking-wide">Teacher</span>

            <div class="flex-1" />

            <!-- Tabs -->
            <div class="flex gap-1 bg-gray-800 p-1 rounded-xl flex-wrap">
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'board' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'board'"
                >
                    📊 Monday Board
                </button>
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'analytics' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'analytics'"
                >
                    📈 Analytics
                </button>
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'chats' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'chats'"
                >
                    💬 DUDE Chats
                </button>
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'profiles' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'profiles'"
                >
                    🧠 פרופילים
                </button>
            </div>
        </header>

        <!-- Main Content Area -->
        <main class="flex-1 overflow-auto bg-gray-50 flex flex-col">
            
            <!-- 1. Board Tab -->
            <div v-if="activeTab === 'board'" class="flex-1 flex flex-col">
                <MockMondayBoard />
            </div>

            <!-- 2. Analytics Tab -->
            <div v-else-if="activeTab === 'analytics'" class="flex-1 p-6">
                <div class="max-w-6xl mx-auto">
                    <div class="mb-6">
                        <h1 class="text-2xl font-black text-gray-900 tracking-tight">Student Analytics</h1>
                        <p class="text-sm text-gray-500 mt-1">מדדי ביצוע, רמת סיכון ותובנות למידה בזמן אמת.</p>
                    </div>
                    <AnalyticsDashboard />
                </div>
            </div>

            <!-- 3. DUDE Chats Tab -->
            <div v-else-if="activeTab === 'chats'" class="flex-1 p-6" style="min-height: 0">
                <div class="max-w-6xl mx-auto h-full" style="height: calc(100vh - 140px)">
                    <TeacherChatPanel />
                </div>
            </div>

            <!-- 4. Student Profiles Tab -->
            <div v-else-if="activeTab === 'profiles'" class="flex-1 p-6">
                <div class="max-w-6xl mx-auto">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <h1 class="text-2xl font-black text-gray-900 tracking-tight italic uppercase">DUDE Insights</h1>
                            <p class="text-sm text-gray-500 mt-1">ניתוח מעמיק של דפוסי עבודה וכישורים רכים.</p>
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="text-xs font-bold text-gray-400 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">{{ enrichedProfiles.length }} פרופילים נטענו</span>
                            <button
                                class="text-xs bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:translate-y-0"
                                @click="loadProfiles"
                            >
                                רענן נתונים
                            </button>
                        </div>
                    </div>

                    <div v-if="!enrichedProfiles.length" class="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                        <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-3xl">📭</div>
                        <p class="text-gray-400 font-medium">טרם נותחו פרופילי למידה עבור תלמידים אלו.</p>
                    </div>

                    <div v-else class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <StudentProfileCard
                            v-for="p in enrichedProfiles"
                            :key="p.id"
                            :profile="p"
                            :user-name="p.name"
                        />
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>

<style scoped>
.line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
