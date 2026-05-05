<script setup lang="ts">
import type { UserRole } from '~/types/types';
import { useUser } from '~/composables/useUser';

useHead({ title: 'TeamSprintUp — Log in' });

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;
const { login } = useUser();
const router = useRouter();

interface ApiUser {
    id: string;
    name: string;
    email: string;
    current_team_id: string | null;
    current_role: string | null;
}

const users = ref<ApiUser[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const selecting = ref<string | null>(null);

onMounted(async () => {
    try {
        users.value = await $fetch<ApiUser[]>(`${base}/users`);
    } catch (e) {
        error.value = 'Could not load users — is the backend running?';
    } finally {
        loading.value = false;
    }
});

const roleColors: Record<string, string> = {
    pm: 'bg-purple-100 text-purple-700',
    qa: 'bg-yellow-100 text-yellow-700',
    dev: 'bg-blue-100 text-blue-700',
    hardware: 'bg-orange-100 text-orange-700',
};

const roleEmoji: Record<string, string> = {
    pm: '📋',
    qa: '🔍',
    dev: '💻',
    hardware: '🔧',
};

async function selectUser(u: ApiUser) {
    selecting.value = u.id;
    login({
        id: u.id,
        name: u.name,
        email: u.email,
        currentTeamId: u.current_team_id,
        currentRole: u.current_role as UserRole | null,
    });
    await router.push('/student');
}
</script>

<template>
    <div class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center p-6">
        <!-- Logo / Title -->
        <div class="text-center mb-10">
            <div class="text-5xl mb-3">🚀</div>
            <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">TeamSprintUp</h1>
            <p class="text-gray-500 mt-2 text-sm">בחר/י את המשתמש שלך כדי להיכנס</p>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex flex-col items-center gap-3 text-gray-400">
            <div class="w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
            <p class="text-sm">Loading users...</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-4 text-sm max-w-sm text-center">
            {{ error }}
        </div>

        <!-- User grid -->
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full max-w-3xl">
            <button
                v-for="u in users"
                :key="u.id"
                :disabled="selecting !== null"
                class="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 p-5 flex flex-col items-center gap-3 transition-all disabled:opacity-60 text-left"
                :class="{ 'border-indigo-400 shadow-indigo-100 scale-95': selecting === u.id }"
                @click="selectUser(u)"
            >
                <!-- Avatar -->
                <div class="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow-inner select-none">
                    {{ u.name.charAt(0) }}
                </div>

                <!-- Name -->
                <div class="text-center">
                    <p class="font-semibold text-gray-800 text-sm leading-tight">{{ u.name }}</p>
                    <p class="text-gray-400 text-xs mt-0.5 truncate max-w-[120px]">{{ u.email }}</p>
                </div>

                <!-- Role badge -->
                <span
                    v-if="u.current_role"
                    :class="['text-xs font-medium px-2.5 py-0.5 rounded-full', roleColors[u.current_role] ?? 'bg-gray-100 text-gray-600']"
                >
                    {{ roleEmoji[u.current_role] ?? '' }} {{ u.current_role.toUpperCase() }}
                </span>
                <span v-else class="text-xs text-gray-300">No role assigned</span>

                <!-- Spinner on select -->
                <div v-if="selecting === u.id" class="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
            </button>
        </div>

        <p class="mt-10 text-xs text-gray-300">Tech School · TeamSprintUp v1.0</p>
    </div>
</template>
