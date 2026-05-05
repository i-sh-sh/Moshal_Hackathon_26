<script setup lang="ts">
useHead({ title: 'Teacher Dashboard — TeamSprintUp' });
const activeTab = ref<'board' | 'analytics'>('board');
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
            <div class="flex gap-1 bg-gray-800 p-1 rounded-xl">
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
            </div>
        </header>

        <!-- Monday board -->
        <div v-if="activeTab === 'board'" class="flex-1">
            <MockMondayBoard />
        </div>

        <!-- Analytics -->
        <div v-else class="flex-1 p-6 bg-gray-50">
            <div class="max-w-5xl mx-auto">
                <h1 class="text-xl font-bold text-gray-800 mb-5">Student Analytics</h1>
                <AnalyticsDashboard />
            </div>
        </div>
    </div>
</template>
