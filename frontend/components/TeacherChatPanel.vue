<script setup lang="ts">
import type { ChatChannel, ChatMessage } from '~/types/types';

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

// ── Panel tab ─────────────────────────────────────────────────────────────────
const panelTab = ref<'group' | 'private'>('group');

// ── Group chat ────────────────────────────────────────────────────────────────
const channels       = ref<ChatChannel[]>([]);
const selectedCh     = ref<ChatChannel | null>(null);
const groupMessages  = ref<ChatMessage[]>([]);
const loadingCh      = ref(false);
const analyzingGroup = ref(false);
const groupResult    = ref<{ analyzed: number; summary: string } | null>(null);

async function fetchChannels() {
    loadingCh.value = true;
    try {
        const all = await $fetch<ChatChannel[]>(`${base}/chat/channels`);
        // Deduplicate by name — until all teams have unique channel names
        const seen = new Set<string>();
        channels.value = all.filter((ch) => {
            if (seen.has(ch.name)) return false;
            seen.add(ch.name);
            return true;
        });
        if (channels.value.length && !selectedCh.value) await selectChannel(channels.value[0]);
    } finally { loadingCh.value = false; }
}

async function selectChannel(ch: ChatChannel) {
    selectedCh.value = ch;
    groupResult.value = null;
    groupMessages.value = await $fetch<ChatMessage[]>(`${base}/chat/channels/${ch.id}/messages`).catch(() => []);
}

async function runGroupAnalysis() {
    if (!selectedCh.value) return;
    analyzingGroup.value = true;
    try {
        groupResult.value = await $fetch<{ analyzed: number; summary: string }>(
            `${base}/dude/channels/${selectedCh.value.id}/analyze`, { method: 'POST' },
        );
        showToast('ניתוח קבוצתי הושלם ✅');
    } catch { showToast('ניתוח נכשל — נסה שוב'); }
    finally { analyzingGroup.value = false; }
}

// ── Private chats ─────────────────────────────────────────────────────────────
interface StudentRow { id: string; name: string; email: string }
interface PrivateMsg { id: string; role: 'student' | 'dude'; content: string; createdAt: string }

const students         = ref<StudentRow[]>([]);
const selectedStudent  = ref<StudentRow | null>(null);
const privateMsgs      = ref<PrivateMsg[]>([]);
const loadingStudents  = ref(false);
const loadingPrivate   = ref(false);
const analyzingPrivate = ref(false);
const privateResult    = ref<{ analyzed: number; summary: string } | null>(null);

async function fetchStudents() {
    loadingStudents.value = true;
    try {
        const all = await $fetch<{ id: string; name: string; email: string; account_type: string }[]>(`${base}/users`);
        students.value = all.filter((u) => u.account_type === 'student');
        if (students.value.length && !selectedStudent.value) await selectStudent(students.value[0]);
    } finally { loadingStudents.value = false; }
}

async function selectStudent(s: StudentRow) {
    selectedStudent.value = s;
    privateResult.value = null;
    await fetchPrivateMsgs();
}

const migrationPending = ref(false);

async function fetchPrivateMsgs() {
    if (!selectedStudent.value) return;
    loadingPrivate.value = true;
    migrationPending.value = false;
    try {
        const result = await $fetch<PrivateMsg[]>(`${base}/dude/private/${selectedStudent.value.id}/messages`);
        privateMsgs.value = result;
        migrationPending.value = false;
    } catch (e: any) {
        privateMsgs.value = [];
        if (String(e?.message ?? e).includes('42P01') || String(e?.data ?? '').includes('42P01')) {
            migrationPending.value = true;
        }
    } finally { loadingPrivate.value = false; }
}

async function runPrivateAnalysis() {
    if (!selectedStudent.value) return;
    analyzingPrivate.value = true;
    try {
        privateResult.value = await $fetch<{ analyzed: number; summary: string }>(
            `${base}/dude/private/${selectedStudent.value.id}/analyze`, { method: 'POST' },
        );
        showToast('ניתוח שיחה פרטית הושלם ✅');
    } catch { showToast('ניתוח נכשל — נסה שוב'); }
    finally { analyzingPrivate.value = false; }
}

// ── Shared ────────────────────────────────────────────────────────────────────
const toast = ref<string | null>(null);
function showToast(msg: string) {
    toast.value = msg;
    setTimeout(() => { toast.value = null; }, 3000);
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
    await Promise.all([fetchChannels(), fetchStudents()]);
    pollTimer = setInterval(() => {
        if (panelTab.value === 'group') selectChannel(selectedCh.value!).catch(() => undefined);
        else fetchPrivateMsgs().catch(() => undefined);
    }, 8000);
});

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>

<template>
    <div class="flex h-full gap-4" dir="rtl">

        <!-- ══ LEFT SIDEBAR ══════════════════════════════════════════════════ -->
        <div class="w-52 shrink-0 flex flex-col gap-3">

            <!-- Tab toggle -->
            <div class="flex rounded-xl overflow-hidden border border-gray-700 text-xs font-bold">
                <button
                    :class="['flex-1 py-2 transition-colors', panelTab === 'group' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700']"
                    @click="panelTab = 'group'"
                >
                    💬 קבוצתי
                </button>
                <button
                    :class="['flex-1 py-2 transition-colors', panelTab === 'private' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700']"
                    @click="panelTab = 'private'"
                >
                    🤖 פרטי
                </button>
            </div>

            <!-- Group: channel list -->
            <template v-if="panelTab === 'group'">
                <p class="text-[11px] text-gray-500 font-semibold uppercase tracking-wider px-1">ערוצי צוות</p>
                <div v-if="loadingCh" class="text-xs text-gray-500 px-1">טוען...</div>
                <button
                    v-for="ch in channels"
                    :key="ch.id"
                    :class="['text-right px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full',
                        selectedCh?.id === ch.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700']"
                    @click="selectChannel(ch)"
                >
                    💬 {{ ch.name }}
                </button>
                <div v-if="!channels.length && !loadingCh" class="text-xs text-gray-500 px-1">אין צ'אטים פעילים.</div>
            </template>

            <!-- Private: student list -->
            <template v-else>
                <p class="text-[11px] text-gray-500 font-semibold uppercase tracking-wider px-1">תלמידים</p>
                <div v-if="loadingStudents" class="text-xs text-gray-500 px-1">טוען...</div>
                <button
                    v-for="s in students"
                    :key="s.id"
                    :class="['text-right px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full',
                        selectedStudent?.id === s.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700']"
                    @click="selectStudent(s)"
                >
                    🤖 {{ s.name }}
                </button>
                <div v-if="!students.length && !loadingStudents" class="text-xs text-gray-500 px-1">אין תלמידים.</div>
            </template>
        </div>

        <!-- ══ MAIN PANEL ════════════════════════════════════════════════════ -->

        <!-- GROUP CHAT panel -->
        <div v-if="panelTab === 'group'" class="flex-1 flex flex-col gap-3 min-w-0">

            <!-- Header + analyze button -->
            <div class="flex items-center gap-3 flex-wrap">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0" />
                    <span class="font-semibold text-white text-sm">{{ selectedCh?.name ?? 'בחר ערוץ' }}</span>
                </div>
                <span class="text-[11px] text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">🔇 DUDE שקט</span>
                <button
                    v-if="selectedCh"
                    class="mr-auto flex items-center gap-2 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50"
                    :disabled="analyzingGroup"
                    @click="runGroupAnalysis"
                >
                    <span v-if="analyzingGroup" class="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>{{ analyzingGroup ? 'מנתח...' : '🧠 נתח שיחה' }}</span>
                </button>
            </div>

            <!-- Group analysis result -->
            <div v-if="groupResult" class="bg-indigo-900/60 border border-indigo-600 rounded-xl px-4 py-3 text-xs flex items-start gap-3">
                <span class="text-base shrink-0">✅</span>
                <div class="text-indigo-200">
                    <p class="font-bold text-indigo-100 mb-0.5">{{ groupResult.analyzed }} הודעות נותחו</p>
                    <p>{{ groupResult.summary }}</p>
                    <p class="text-indigo-500 mt-1">פרופילי תלמידים עודכנו ← "DUDE Insights"</p>
                </div>
            </div>

            <!-- Messages -->
            <div class="flex-1 overflow-y-auto flex flex-col gap-2 bg-gray-800 rounded-2xl p-4 min-h-0" style="max-height: 480px">
                <div v-if="!groupMessages.length" class="text-center text-sm text-gray-500 py-10">
                    אין הודעות בערוץ זה.
                </div>
                <div v-for="msg in groupMessages" :key="msg.id" class="flex items-start gap-2">
                    <div :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white',
                        msg.isBot ? 'bg-indigo-600' : 'bg-gray-600']">
                        {{ msg.isBot ? '🤖' : msg.senderName.charAt(0) }}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-2">
                            <span :class="['text-xs font-semibold', msg.isBot ? 'text-indigo-400' : 'text-gray-300']">{{ msg.senderName }}</span>
                            <span class="text-xs text-gray-500">{{ formatTime(msg.createdAt) }}</span>
                        </div>
                        <p class="text-sm text-gray-200 mt-0.5 break-words">{{ msg.content }}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- PRIVATE DUDE panel -->
        <div v-else class="flex-1 flex flex-col gap-3 min-w-0">

            <!-- Header + analyze button -->
            <div class="flex items-center gap-3 flex-wrap">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0" />
                    <span class="font-semibold text-white text-sm">
                        {{ selectedStudent ? `${selectedStudent.name} ← מנטור פרטי` : 'בחר תלמיד' }}
                    </span>
                </div>
                <span class="text-[11px] text-violet-300 border border-violet-700 bg-violet-900/40 px-2 py-0.5 rounded-full">🤖 1-on-1 DUDE</span>
                <button
                    v-if="selectedStudent"
                    class="mr-auto flex items-center gap-2 bg-violet-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-violet-500 active:scale-95 transition-all disabled:opacity-50"
                    :disabled="analyzingPrivate"
                    @click="runPrivateAnalysis"
                >
                    <span v-if="analyzingPrivate" class="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>{{ analyzingPrivate ? 'מנתח...' : '🧠 נתח שיחה פרטית' }}</span>
                </button>
            </div>

            <!-- Private analysis result -->
            <div v-if="privateResult" class="bg-violet-900/60 border border-violet-600 rounded-xl px-4 py-3 text-xs flex items-start gap-3">
                <span class="text-base shrink-0">✅</span>
                <div class="text-violet-200">
                    <p class="font-bold text-violet-100 mb-0.5">{{ privateResult.analyzed }} הודעות נותחו (שיחה פרטית)</p>
                    <p>{{ privateResult.summary }}</p>
                    <p class="text-violet-500 mt-1">פרופיל תלמיד עודכן ← "DUDE Insights"</p>
                </div>
            </div>

            <!-- Migration pending warning -->
            <div v-if="migrationPending" class="bg-amber-900/50 border border-amber-600 rounded-xl px-4 py-3 text-xs text-amber-200 flex items-start gap-2">
                <span class="shrink-0">⚠️</span>
                <span>טבלת השיחות הפרטיות עוד לא נוצרה — הרץ את migration 007 בסואפאבייס.</span>
            </div>

            <!-- Private messages -->
            <div
                v-if="loadingPrivate"
                class="flex-1 flex items-center justify-center bg-gray-800 rounded-2xl"
                style="max-height: 480px"
            >
                <div class="w-6 h-6 border-4 border-violet-700 border-t-violet-400 rounded-full animate-spin" />
            </div>
            <div
                v-else
                class="flex-1 overflow-y-auto flex flex-col gap-2 rounded-2xl p-4 min-h-0 border border-violet-800/50"
                style="max-height: 480px; background: #1a1025"
            >
                <div v-if="!privateMsgs.length" class="text-center text-sm text-gray-500 py-10">
                    {{ selectedStudent ? 'עדיין אין שיחה פרטית עם DUDE.' : 'בחר תלמיד משמאל.' }}
                </div>
                <div v-for="msg in privateMsgs" :key="msg.id"
                    class="flex items-start gap-2"
                    :class="msg.role === 'student' ? 'flex-row-reverse' : ''"
                >
                    <!-- Avatar -->
                    <div :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white',
                        msg.role === 'dude' ? 'bg-violet-600' : 'bg-gray-600']">
                        {{ msg.role === 'dude' ? '🤖' : (selectedStudent?.name.charAt(0) ?? '?') }}
                    </div>
                    <!-- Bubble -->
                    <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-2" :class="msg.role === 'student' ? 'flex-row-reverse' : ''">
                            <span :class="['text-xs font-semibold', msg.role === 'dude' ? 'text-violet-400' : 'text-gray-300']">
                                {{ msg.role === 'dude' ? 'DUDE 🤖' : selectedStudent?.name }}
                            </span>
                            <span class="text-xs text-gray-500">{{ formatTime(msg.createdAt) }}</span>
                        </div>
                        <p :class="['text-sm mt-0.5 break-words', msg.role === 'dude' ? 'text-violet-100' : 'text-gray-200']">
                            {{ msg.content }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Toast -->
        <Teleport to="body">
            <Transition name="toast">
                <div
                    v-if="toast"
                    :class="['fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-none',
                        panelTab === 'group' ? 'bg-indigo-700 text-white' : 'bg-violet-700 text-white']"
                >
                    {{ toast }}
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
