<script setup lang="ts">
import type { UserRole, StudentRole } from '~/types/types';
import { ROLE_LABELS } from '~/types/types';
import { useUser } from '~/composables/useUser';
import { DEMO_USERS } from '~/services/demoData';

useHead({ title: 'TechSchool — התחברות' });

const TS_LOGO_URL =
    'https://il-lms.techschool.org/wp-content/themes/techschool-IL/assets/img/tech_school_logo.png';

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

// POC: hardcoded demo users — no backend dependency.
const users = ref<ApiUser[]>([...DEMO_USERS]);
const loading = ref(false);
const error = ref<string | null>(null);
const selecting = ref<string | null>(null);

type View = 'landing' | 'students' | 'teachers';
const view = ref<View>('landing');

const filteredUsers = computed(() =>
    view.value === 'students'
        ? users.value.filter(u => u.account_type === 'student')
        : view.value === 'teachers'
            ? users.value.filter(u => u.account_type === 'teacher' || u.account_type === 'admin')
            : [],
);

const roleColors: Record<string, string> = {
    pm:       'bg-purple-100 text-purple-700',
    qa:       'bg-yellow-100 text-yellow-700',
    dev:      'bg-blue-100 text-blue-700',
    hardware: 'bg-green-100 text-green-700',
};

const roleEmoji: Record<string, string> = {
    pm:       '✂️',
    qa:       '🔍',
    dev:      '📐',
    hardware: '🖨️',
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
            <!-- Logo -->
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
                <p class="text-gray-500 mt-1.5 text-sm">
                    <span v-if="view === 'landing'">ברוכים הבאים — בחר/י את סוג הממשק</span>
                    <span v-else-if="view === 'students'">ממשק תלמיד — בחר/י משתמש</span>
                    <span v-else>ממשק מורה — בחר/י משתמש</span>
                </p>
            </div>

            <!-- ── Landing: two big cards ── -->
            <div v-if="view === 'landing'" class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <button
                    class="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-[#3CC2EE]/60 p-10 flex flex-col items-center gap-4 transition-all"
                    @click="view = 'students'"
                >
                    <span class="text-5xl">🎒</span>
                    <span class="text-xl font-bold text-gray-800">ממשק תלמיד</span>
                    <span class="text-sm text-gray-400">Student Interface</span>
                </button>

                <button
                    class="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-rose-300 p-10 flex flex-col items-center gap-4 transition-all"
                    @click="view = 'teachers'"
                >
                    <span class="text-5xl">🎓</span>
                    <span class="text-xl font-bold text-gray-800">ממשק מורה</span>
                    <span class="text-sm text-gray-400">Teacher Interface</span>
                </button>
            </div>

            <!-- ── User selection grid (students or teachers) ── -->
            <template v-else>
                <!-- Back button -->
                <button
                    class="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                    @click="view = 'landing'; selecting = null"
                >
                    <span>→</span> חזרה
                </button>

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
                <div v-else-if="!filteredUsers.length" class="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-gray-400 max-w-md mx-auto">
                    אין משתמשים במאגר. הרץ <code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">npm run seed</code>.
                </div>

                <!-- User grid -->
                <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    <button
                        v-for="u in filteredUsers"
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
            </template>

            <p class="mt-10 text-xs text-gray-300 text-center">
                TechSchool · SprintUp v1.1 · monday.com Foundation
            </p>
        </div>
    </div>
</template>
