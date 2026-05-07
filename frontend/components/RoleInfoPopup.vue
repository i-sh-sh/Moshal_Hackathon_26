<script setup lang="ts">
import { getRoleInfo } from '~/utils/roleInfo';

const props = defineProps<{
    roleKey: string;
    roleLabel: string;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

const info = computed(() => getRoleInfo(props.roleKey));

function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) emit('close');
}

onMounted(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close'); };
    window.addEventListener('keydown', handler);
    onUnmounted(() => window.removeEventListener('keydown', handler));
});
</script>

<template>
    <div
        class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        dir="rtl"
        @click="onBackdrop"
    >
        <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

            <!-- Header -->
            <div class="bg-gradient-to-r from-[#3CC2EE] to-cyan-500 px-6 py-5 flex items-start justify-between gap-3">
                <div>
                    <p class="text-white/80 text-xs font-semibold uppercase tracking-wide">מה התפקיד שלי?</p>
                    <h2 class="text-white text-xl font-extrabold mt-0.5">{{ info?.title ?? roleLabel }}</h2>
                    <p v-if="info?.subtitle" class="text-white/80 text-sm mt-0.5">{{ info.subtitle }}</p>
                </div>
                <button class="text-white/60 hover:text-white text-xl leading-none mt-0.5 shrink-0" @click="emit('close')">✕</button>
            </div>

            <!-- Body -->
            <div class="px-6 py-5 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">

                <!-- No info fallback -->
                <p v-if="!info" class="text-sm text-gray-500">אין מידע זמין לתפקיד זה.</p>

                <template v-else>
                    <!-- Responsibility bullets -->
                    <div>
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">מה אתה אחראי?</p>
                        <ul class="flex flex-col gap-2">
                            <li
                                v-for="(bullet, i) in info.bullets"
                                :key="i"
                                class="flex gap-2 text-sm text-gray-700 leading-snug"
                            >
                                <span class="text-[#3CC2EE] font-bold shrink-0 mt-0.5">•</span>
                                <span>{{ bullet }}</span>
                            </li>
                        </ul>
                    </div>

                    <!-- Jargon / terms -->
                    <div v-if="info.jargon && info.jargon.length" class="border-t border-gray-100 pt-4">
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">מילון מונחים</p>
                        <dl class="flex flex-col gap-2">
                            <div v-for="item in info.jargon" :key="item.term" class="flex gap-2 text-sm">
                                <dt class="font-bold text-gray-800 shrink-0">{{ item.term }}:</dt>
                                <dd class="text-gray-600 leading-snug">{{ item.explanation }}</dd>
                            </div>
                        </dl>
                    </div>
                </template>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-100 flex items-center">
                <button
                    class="px-6 py-2.5 bg-[#3CC2EE] hover:bg-[#27b3df] text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                    @click="emit('close')"
                >
                    הבנתי ✓
                </button>
            </div>

        </div>
    </div>
</template>
