<script setup lang="ts">
defineProps<{
    schoolLabel?: string;
    onLogout?: () => void;
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
