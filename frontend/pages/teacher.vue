<script setup lang="ts">
import { useTeacher } from '~/composables/useTeacher';
import { useUser } from '~/composables/useUser';
import type { Challenge, Team } from '~/types/types';
import { LESSONS_PER_MISSION } from '~/services/demoData';

useHead({ title: 'TechSchool — לוח מורה' });

const { logout } = useUser();
const router = useRouter();

const activeTab = ref<'missions' | 'board' | 'analytics'>('missions');

const teacherData = useTeacher();

onMounted(() => {
    teacherData.fetchChallenges();
    teacherData.fetchTeams();
});

// ── Inline role panel state ────────────────────────────────────────────
const rolePanel = ref<{ teamId: string; challengeId: string } | null>(null);

function openRolePanel(teamId: string, challengeId: string) {
    rolePanel.value = { teamId, challengeId };
    teacherData.fetchStudents(teamId);
}
function closeRolePanel() {
    rolePanel.value = null;
}

// ── Toast ──────────────────────────────────────────────────────────────
const toast = ref<{ msg: string; type: 'success' | 'error' } | null>(null);
function showToast(msg: string, type: 'success' | 'error' = 'success') {
    toast.value = { msg, type };
    setTimeout(() => { toast.value = null; }, 2800);
}

// ── Mission helpers ────────────────────────────────────────────────────
type TeamMissionState = 'idle' | 'active' | 'completed';

function teamMissionState(team: any, missionId: string): TeamMissionState {
    const onMission = (team.currentChallengeId ?? team.current_challenge_id) === missionId;
    if (!onMission) return 'idle';
    if (team.isCompleted ?? team.is_completed) return 'completed';
    return 'active';
}

function stateBadge(state: TeamMissionState) {
    if (state === 'active') {
        return { text: 'פעיל', cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' };
    }
    if (state === 'completed') {
        return { text: 'הושלם', cls: 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200' };
    }
    return { text: 'לא התחיל', cls: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200' };
}

function missionOverallState(c: Challenge): TeamMissionState {
    const states = teacherData.teams.value.map((t) => teamMissionState(t, c.id));
    if (states.some((s) => s === 'active')) return 'active';
    if (states.some((s) => s === 'completed')) return 'completed';
    return 'idle';
}

function lessonsFor(c: Challenge): number {
    return LESSONS_PER_MISSION[c.id] ?? 0;
}

function dateFor(c: Challenge): Date {
    const raw = (c as any).createdAt ?? (c as any).created_at;
    return raw ? new Date(raw) : new Date();
}

// ── Mission lifecycle handlers ─────────────────────────────────────────
async function handleOpen(challengeId: string, teamId: string, teamName: string) {
    await teacherData.openMission(challengeId, teamId);
    showToast(`המשימה נפתחה ל${teamName}`);
}

async function handleClose(teamId: string, teamName: string) {
    if (!confirm(`לסגור את המשימה הנוכחית של ${teamName}?`)) return;
    await teacherData.closeMission(teamId);
    showToast(`המשימה של ${teamName} נסגרה`);
    if (rolePanel.value?.teamId === teamId) closeRolePanel();
}

async function handleReopen(teamId: string, teamName: string) {
    await teacherData.reopenMission(teamId);
    showToast(`המשימה של ${teamName} נפתחה מחדש`);
}

function handleLogout() {
    logout();
    router.push('/');
}
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex" dir="rtl">
        <TechSchoolSidebar school-label="School Test 01" :on-logout="handleLogout" />

        <div class="flex-1 flex flex-col min-w-0">
            <!-- Top score bar -->
            <header class="bg-white border-b border-gray-200">
                <div class="px-6 h-16 flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <div class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 ring-1 ring-amber-100">
                            <span class="text-lg">🥇</span>
                            <span class="text-sm font-extrabold text-amber-600 tabular-nums">62</span>
                            <span class="text-[10px] text-gray-500 font-semibold">קהילה</span>
                        </div>
                        <div class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 ring-1 ring-amber-100">
                            <span class="text-lg">🏆</span>
                            <span class="text-sm font-extrabold text-amber-600 tabular-nums">90</span>
                            <span class="text-[10px] text-gray-500 font-semibold">קבוצתי</span>
                        </div>
                        <div class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 ring-1 ring-amber-100">
                            <span class="text-lg">🥉</span>
                            <span class="text-sm font-extrabold text-amber-600 tabular-nums">0</span>
                            <span class="text-[10px] text-gray-500 font-semibold">אישי</span>
                        </div>
                    </div>

                    <div class="flex-1" />

                    <div class="flex gap-1 bg-gray-100 p-1 rounded-xl">
                        <button
                            :class="['px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', activeTab === 'missions' ? 'bg-white text-[#3CC2EE] shadow-sm' : 'text-gray-500 hover:text-gray-800']"
                            @click="activeTab = 'missions'"
                        >🎯 משימות</button>
                        <button
                            :class="['px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', activeTab === 'board' ? 'bg-white text-[#3CC2EE] shadow-sm' : 'text-gray-500 hover:text-gray-800']"
                            @click="activeTab = 'board'"
                        >📋 לוח Monday</button>
                        <button
                            :class="['px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', activeTab === 'analytics' ? 'bg-white text-[#3CC2EE] shadow-sm' : 'text-gray-500 hover:text-gray-800']"
                            @click="activeTab = 'analytics'"
                        >📊 ניתוחים</button>
                    </div>
                </div>
            </header>

            <!-- Breadcrumb -->
            <div class="px-8 pt-6 pb-2">
                <p class="text-xs text-gray-400 mb-1">
                    <span class="text-[#3CC2EE] font-semibold">לוח מורה</span>
                    <span class="mx-1">›</span>
                    <span>
                        {{ activeTab === 'missions' ? 'ניהול משימות' :
                           activeTab === 'board' ? 'לוח Monday' : 'ניתוחים' }}
                    </span>
                </p>
            </div>

            <!-- ─── MISSIONS TAB ─── -->
            <div v-if="activeTab === 'missions'" class="flex-1 px-8 pb-10">
                <div class="mb-6">
                    <h1 class="text-2xl font-extrabold text-gray-900">ניהול משימות וצוותים</h1>
                    <p class="text-sm text-gray-500 mt-1">
                        פתחו משימה לצוות, שבצו תפקידים, וסגרו את המשימה כשהיא הושלמה.
                    </p>
                </div>

                <!-- Mission cards -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
                    <div
                        v-for="c in teacherData.challenges.value"
                        :key="c.id"
                        class="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden"
                    >
                        <!-- Header strip -->
                        <div class="px-5 py-3 bg-gradient-to-l from-cyan-50 to-white border-b border-gray-100 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-2xl">🏆</span>
                                <span class="text-[10px] uppercase font-bold tracking-wider text-gray-400">אתגר</span>
                            </div>
                            <span :class="['text-[11px] font-semibold px-2 py-0.5 rounded-full', stateBadge(missionOverallState(c)).cls]">
                                {{ stateBadge(missionOverallState(c)).text }}
                            </span>
                        </div>

                        <!-- Body -->
                        <div class="p-5 flex flex-col gap-3">
                            <h3 class="text-base font-extrabold text-gray-900 leading-snug">{{ c.title }}</h3>
                            <p class="text-xs text-gray-500 leading-relaxed line-clamp-3">{{ c.description }}</p>

                            <div class="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                <span class="flex items-center gap-1">
                                    <span>📅</span>
                                    <span>{{ dateFor(c).toLocaleDateString('he-IL') }}</span>
                                </span>
                                <span class="text-gray-300">·</span>
                                <span>{{ lessonsFor(c) }} שיעורי האתגר</span>
                            </div>

                            <!-- Per-team rows -->
                            <div class="mt-2 space-y-2">
                                <div
                                    v-for="t in teacherData.teams.value"
                                    :key="t.id"
                                    class="bg-gray-50 rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-2"
                                >
                                    <span class="text-sm font-semibold text-gray-800">👥 {{ t.name }}</span>
                                    <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-full', stateBadge(teamMissionState(t, c.id)).cls]">
                                        {{ stateBadge(teamMissionState(t, c.id)).text }}
                                    </span>

                                    <div class="flex-1" />

                                    <!-- IDLE: open -->
                                    <button
                                        v-if="teamMissionState(t, c.id) === 'idle'"
                                        class="px-3 py-1 bg-[#3CC2EE] hover:bg-[#27b3df] text-white rounded-full text-xs font-bold transition-colors shadow-sm"
                                        @click="handleOpen(c.id, t.id, t.name)"
                                    >
                                        🚀 פתח לצוות
                                    </button>

                                    <!-- ACTIVE: assign roles + close -->
                                    <template v-else-if="teamMissionState(t, c.id) === 'active'">
                                        <button
                                            class="px-3 py-1 bg-purple-500 hover:bg-purple-400 text-white rounded-full text-xs font-bold transition-colors shadow-sm"
                                            @click="openRolePanel(t.id, c.id)"
                                        >
                                            👥 שבץ תפקידים
                                        </button>
                                        <button
                                            class="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full text-xs font-bold transition-colors shadow-sm"
                                            @click="handleClose(t.id, t.name)"
                                        >
                                            🏁 סגור משימה
                                        </button>
                                    </template>

                                    <!-- COMPLETED: reopen -->
                                    <button
                                        v-else
                                        class="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-white rounded-full text-xs font-bold transition-colors shadow-sm"
                                        @click="handleReopen(t.id, t.name)"
                                    >
                                        🔄 פתח מחדש
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Inline role assignment panel (when this card is the active one) -->
                        <div
                            v-if="rolePanel && rolePanel.challengeId === c.id"
                            class="border-t border-gray-200 bg-gray-50 p-4"
                        >
                            <RoleAssignmentPanel
                                :team-id="rolePanel.teamId"
                                :challenge-id="rolePanel.challengeId"
                                @close="closeRolePanel"
                                @saved="showToast('שיבוץ התפקידים נשמר')"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- ─── BOARD TAB ─── -->
            <div v-else-if="activeTab === 'board'" class="flex-1">
                <MockMondayBoard />
            </div>

            <!-- ─── ANALYTICS TAB ─── -->
            <div v-else class="flex-1 px-8 pb-10">
                <div class="max-w-5xl">
                    <h1 class="text-2xl font-extrabold text-gray-900 mb-4">ניתוחי תלמידים</h1>
                    <AnalyticsDashboard />
                </div>
            </div>
        </div>

        <!-- Toast -->
        <Teleport to="body">
            <Transition name="toast">
                <div
                    v-if="toast"
                    :class="['fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-bold pointer-events-none', toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white']"
                    dir="rtl"
                >
                    {{ toast.msg }}
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
