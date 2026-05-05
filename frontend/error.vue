<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number; message: string } }>();
useHead({ title: `${props.error.statusCode} — TeamSprintUp` });
const handleError = () => clearError({ redirect: '/' });
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 p-6">
        <div class="text-6xl">{{ error.statusCode === 404 ? '🔍' : '⚠️' }}</div>
        <div class="text-center">
            <h1 class="text-3xl font-extrabold text-gray-800 mb-2">
                {{ error.statusCode === 404 ? 'Page not found' : `Error ${error.statusCode}` }}
            </h1>
            <p class="text-gray-400 text-sm max-w-xs">{{ error.message }}</p>
        </div>
        <button
            class="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors"
            @click="handleError"
        >
            ← Back to home
        </button>
    </div>
</template>
