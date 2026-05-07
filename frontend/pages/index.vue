<script setup lang="ts">
import type { UserRole, StudentRole } from '~/types/types';
import { ROLE_LABELS } from '~/types/types';
import { useUser } from '~/composables/useUser';

useHead({ title: 'TechSchool — התחברות' });

const TS_LOGO_URL =
    'https://il-lms.techschool.org/wp-content/themes/techschool-IL/assets/img/tech_school_logo.png';

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
    account_type?: string;
}

const users = ref<ApiUser[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const selecting = ref<string | null>(null);

onMounted(async () => {
    try {
        users.value = await $fetch<ApiUser[]>(`${base}/users`);
    } catch (e) {
        error.value = 'לא הצלחנו לטעון משתמשים — בדוק שהשרת רץ.';
    } finally {
        loading.value = false;
    }
});

const roleColors: Record<string, string> = {
    designer: 'bg-blue-100 text-blue-700',
    editor:   'bg-purple-100 text-purple-700',
    qa:       'bg-yellow-100 text-yellow-700',
    printer:  'bg-green-100 text-green-700',
};

const roleEmoji: Record<string, string> = {
    designer: '📐',
    editor:   '✂️',
    qa:       '🔍',
    printer:  '🖨️',
};

function roleDisplay(role: string | null): string {
    if (!role) return '';
    return ROLE_LABELS[role as StudentRole] ?? role.toUpperCase();
}

async function selectUser(u: ApiUser) {
    selecting.value = u.id;
    login({
        id: u.id,
        name: u.name,
        email: u.email,
        currentTeamId: u.current_team_id,
        currentRole: u.current_role as UserRole | null,
    });
    // teachers/admins land on the teacher dashboard, students on /student
    if (u.account_type === 'teacher' || u.account_type === 'admin') {
        await router.push('/teacher');
    } else {
        await router.push('/student');
    }
}
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
        <div class="w-full max-w-3xl">
            <!-- Logo card -->
            <div class="flex flex-col items-center mb-8">
                <div class="bg-white rounded-2xl px-6 py-4 shadow-md mb-4">
                    <img
                        :src="TS_LOGO_URL"
                        alt="TechSchool"
                        class="h-14 object-contain"
                        referrerpolicy="no-referrer"
                    />
                </div>
                <h1 class="text-2xl font-extrabold text-gray-800 tracking-tight">SprintUp · School Test 01</h1>
                <p class="text-gray-500 mt-1.5 text-sm">בחר/י את המשתמש שלך כדי להיכנס</p>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex flex-col items-center gap-3 text-gray-400 py-10">
                <div class="w-8 h-8 border-4 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
                <p class="text-sm">טוען משתמשים...</p>
            </div>

            <!-- Error -->
            <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-4 text-sm max-w-sm text-center mx-auto">
                {{ error }}
            </div>

            <!-- Empty -->
            <div v-else-if="!users.length" class="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-gray-400 max-w-md mx-auto">
                אין משתמשים במאגר. הרץ <code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">npm run seed</code>.
            </div>

            <!-- User grid -->
            <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                <button
                    v-for="u in users"
                    :key="u.id"
                    :disabled="selecting !== null"
                    class="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-[#3CC2EE]/50 p-5 flex flex-col items-center gap-3 transition-all disabled:opacity-60 text-center"
                    :class="{ 'border-[#3CC2EE] shadow-[#3CC2EE]/20 scale-95': selecting === u.id }"
                    @click="selectUser(u)"
                >
                    <!-- Avatar -->
                    <div class="w-14 h-14 rounded-full bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center text-white text-xl font-bold shadow-inner select-none">
                        {{ u.name.charAt(0) }}
                    </div>

                    <!-- Name -->
                    <div>
                        <p class="font-semibold text-gray-800 text-sm leading-tight">{{ u.name }}</p>
                        <p class="text-gray-400 text-xs mt-0.5 truncate max-w-[120px]">{{ u.email }}</p>
                    </div>

                    <!-- Role badge -->
                    <span
                        v-if="u.current_role"
                        :class="['text-xs font-medium px-2.5 py-0.5 rounded-full', roleColors[u.current_role] ?? 'bg-gray-100 text-gray-600']"
                    >
                        {{ roleEmoji[u.current_role] ?? '' }} {{ roleDisplay(u.current_role) }}
                    </span>
                    <span v-else-if="u.account_type === 'teacher'" class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                        🎓 מורה
                    </span>
                    <span v-else-if="u.account_type === 'admin'" class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-200 text-gray-700">
                        🛡️ אדמין
                    </span>
                    <span v-else class="text-xs text-gray-300">ללא תפקיד</span>

                    <!-- Spinner on select -->
                    <div v-if="selecting === u.id" class="w-4 h-4 border-2 border-[#3CC2EE]/30 border-t-[#3CC2EE] rounded-full animate-spin" />
                </button>
            </div>

            <p class="mt-10 text-xs text-gray-300 text-center">
                TechSchool · SprintUp v1.1 · monday.com Foundation
            </p>
        </div>
    </div>
</template>
