<script setup lang="ts">
export interface TeamMember {
    id: string;
    name: string;
    role: string | null;
}

defineProps<{
    schoolLabel?: string;
    onLogout?: () => void;
    teamMembers?: TeamMember[];
}>();

const TS_LOGO_URL =
    'https://il-lms.techschool.org/wp-content/themes/techschool-IL/assets/img/tech_school_logo.png';

interface NavItem {
    label: string;
    icon: string;
    onClick?: () => void;
}

const navItems: NavItem[] = [
    { label: 'המצב שלי',     icon: '🟦' },
    { label: 'האתגרים שלי',  icon: '🏆' },
    { label: 'לוח אירועים',   icon: '📅' },
    { label: 'תפעול מדפסת',  icon: '🛠️' },
    { label: 'המעבדה',       icon: '🧪' },
];

const ROLE_DISPLAY: Record<string, string> = {
    pm:       'Editor',
    qa:       'QA',
    dev:      'Designer',
    hardware: 'Printer',
};

const ROLE_CHIP: Record<string, string> = {
    pm:       'bg-violet-100 text-violet-700',
    qa:       'bg-amber-100  text-amber-700',
    dev:      'bg-blue-100   text-blue-700',
    hardware: 'bg-emerald-100 text-emerald-700',
};

const INITIAL_BG: Record<string, string> = {
    pm:       'bg-violet-400',
    qa:       'bg-amber-400',
    dev:      'bg-blue-400',
    hardware: 'bg-emerald-400',
};

function initials(name: string): string {
    return name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}
</script>

<template>
    <aside class="w-[200px] bg-[#3CC2EE] flex flex-col items-stretch py-5 px-4 gap-3 shrink-0 min-h-screen">
        <!-- Logo -->
        <div class="bg-white rounded-xl p-2 shadow-md flex items-center justify-center">
            <img
                :src="TS_LOGO_URL"
                alt="TechSchool"
                class="max-h-12 object-contain"
                referrerpolicy="no-referrer"
            />
        </div>

        <!-- School label -->
        <p
            v-if="schoolLabel"
            class="text-white text-xs font-semibold text-center mt-1 mb-2"
        >
            {{ schoolLabel }}
        </p>

        <!-- Nav buttons -->
        <button
            v-for="item in navItems"
            :key="item.label"
            class="bg-white hover:bg-gray-50 rounded-full px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm flex items-center justify-between gap-2 transition-colors"
            @click="item.onClick"
        >
            <span>{{ item.label }}</span>
            <span>{{ item.icon }}</span>
        </button>

        <!-- "הכר את הצוות" panel — shown only when teamMembers prop is passed -->
        <div v-if="teamMembers && teamMembers.length" class="mt-2 bg-white/20 rounded-2xl p-3 flex flex-col gap-2">
            <p class="text-white text-xs font-extrabold text-center tracking-wide">הכר את הצוות</p>
            <div
                v-for="member in teamMembers"
                :key="member.id"
                class="flex items-center gap-2"
            >
                <!-- Initials circle -->
                <div
                    class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    :class="member.role ? (INITIAL_BG[member.role] ?? 'bg-gray-400') : 'bg-gray-400'"
                >
                    {{ initials(member.name) }}
                </div>
                <!-- Name + role -->
                <div class="flex flex-col min-w-0">
                    <span class="text-white text-xs font-semibold leading-tight truncate">{{ member.name }}</span>
                    <span
                        v-if="member.role"
                        class="text-xs font-bold px-1.5 py-0.5 rounded-full mt-0.5 self-start leading-tight"
                        :class="ROLE_CHIP[member.role] ?? 'bg-gray-100 text-gray-600'"
                    >
                        {{ ROLE_DISPLAY[member.role] ?? member.role }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Bot avatar -->
        <div class="mt-4 flex flex-col items-center gap-2">
            <div class="w-16 h-16 rounded-2xl bg-yellow-300 flex items-center justify-center text-3xl shadow-md">
                🤖
            </div>
            <p class="text-white text-xs font-bold">מנטור הבוט</p>
        </div>

        <div class="flex-1" />

        <!-- Logout -->
        <button
            v-if="onLogout"
            class="bg-white/90 hover:bg-white rounded-full px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm flex items-center justify-center gap-2 transition-colors"
            @click="onLogout"
        >
            <span>↩</span><span>התנתק</span>
        </button>
    </aside>
</template>
