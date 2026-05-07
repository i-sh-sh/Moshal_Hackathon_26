<script setup lang="ts">
import { useTeacher } from '~/composables/useTeacher';
import { useUser } from '~/composables/useUser';
import type { Challenge, StudentProfile } from '~/types/types';
import { LESSONS_PER_MISSION } from '~/services/demoData';
import { useStudentProfile } from '~/composables/useStudentProfile';

useHead({ title: 'Teacher Dashboard — TeamSprintUp' });

const { logout } = useUser();
const router = useRouter();
const activeTab = ref<'missions' | 'board' | 'analytics' | 'chats' | 'profiles'>('missions');

const teacherData = useTeacher();
const { allProfiles, fetchAllProfiles } = useStudentProfile();

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

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

// ── Profile Enrichment (from recent master) ───────────────────────────
const enrichedProfiles = ref<Array<StudentProfile & { name: string }>>([]);

async function loadProfiles() {
    await fetchAllProfiles();
    const users = await $fetch<Array<{ id: string; name: string }>>(`${base}/users`).catch(() => []);
    const nameMap = new Map(users.map((u) => [u.id, u.name]));
    
    enrichedProfiles.value = allProfiles.value.map((p) => ({
        ...p,
        // Convert readonly array to mutable array to satisfy StudentProfile interface
        detectedTerms: [...p.detectedTerms],
        name: nameMap.get(p.userId) ?? 'תלמיד לא מזוהה',
    }));
}

watch(activeTab, (tab) => {
    if (tab === 'profiles') loadProfiles();
});
</script>

<template>
    <div class="min-h-screen bg-gray-900 flex flex-col" dir="rtl">
        <!-- Header -->
        <header class="border-b border-gray-700 px-6 h-14 flex items-center gap-4">
            <span class="text-xl">🚀</span>
            <span class="font-bold text-white text-sm tracking-tight">TeamSprintUp</span>
            <span class="text-xs text-gray-400 font-medium px-2 py-0.5 rounded-full bg-gray-800 uppercase tracking-wide">Teacher</span>

            <div class="flex-1" />

            <!-- Tabs -->
            <div class="flex gap-1 bg-gray-800 p-1 rounded-xl flex-wrap">
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'missions' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'missions'"
                >
                    🎯 משימות
                </button>
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'board' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'board'"
                >
                    📊 Monday Board
                </button>
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'analytics' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'analytics'"
                >
                    📈 Analytics
                </button>
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'chats' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'chats'"
                >
                    💬 DUDE Chats
                </button>
                <button
                    :class="['px-4 py-1.5 rounded-lg text-xs font-medium transition-colors', activeTab === 'profiles' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200']"
                    @click="activeTab = 'profiles'"
                >
                    🧠 פרופילים
                </button>
            </div>
        </header>

        <!-- Main Content Area -->
        <main class="flex-1 overflow-auto bg-gray-50 flex flex-col">
            
            <!-- 1. Missions Tab -->
            <div v-if="activeTab === 'missions'" class="flex-1 px-8 py-10">
                <div class="max-w-6xl mx-auto">
                    <div class="mb-8">
                        <h1 class="text-3xl font-black text-gray-900 tracking-tight">ניהול משימות וצוותים</h1>
                        <p class="text-sm text-gray-500 mt-1">פתחו משימה לצוות, שבצו תפקידים, וסגרו את המשימה כשהיא הושלמה.</p>
                    </div>

                    <!-- Mission cards -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div
                            v-for="c in teacherData.challenges.value"
                            :key="c.id"
                            class="bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md"
                        >
                            <!-- Header strip -->
                            <div class="px-6 py-4 bg-gradient-to-l from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <span class="text-2xl">🏆</span>
                                    <span class="text-[11px] uppercase font-black tracking-widest text-gray-400">Mission</span>
                                </div>
                                <span :class="['text-[11px] font-bold px-3 py-1 rounded-full shadow-sm', stateBadge(missionOverallState(c)).cls]">
                                    {{ stateBadge(missionOverallState(c)).text }}
                                </span>
                            </div>

                            <!-- Body -->
                            <div class="p-6 flex flex-col gap-4">
                                <h3 class="text-xl font-black text-gray-900 leading-tight">{{ c.title }}</h3>
                                <p class="text-sm text-gray-500 leading-relaxed line-clamp-3">{{ c.description }}</p>

                                <div class="flex items-center gap-4 text-xs text-gray-400 font-bold">
                                    <span class="flex items-center gap-1.5">
                                        <span>📅</span>
                                        <span>{{ dateFor(c).toLocaleDateString('he-IL') }}</span>
                                    </span>
                                    <span class="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    <span>{{ lessonsFor(c) }} שיעורי האתגר</span>
                                </div>

                                <!-- Per-team rows -->
                                <div class="mt-4 space-y-3">
                                    <div
                                        v-for="t in teacherData.teams.value"
                                        :key="t.id"
                                        class="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3"
                                    >
                                        <div class="flex flex-col">
                                            <span class="text-sm font-black text-gray-900">👥 {{ t.name }}</span>
                                            <span :class="['mt-1 w-fit text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider', stateBadge(teamMissionState(t, c.id)).cls]">
                                                {{ stateBadge(teamMissionState(t, c.id)).text }}
                                            </span>
                                        </div>

                                        <div class="flex-1" />

                                        <!-- IDLE: open -->
                                        <button
                                            v-if="teamMissionState(t, c.id) === 'idle'"
                                            class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-100"
                                            @click="handleOpen(c.id, t.id, t.name)"
                                        >
                                            🚀 פתח לצוות
                                        </button>

                                        <!-- ACTIVE: assign roles + close -->
                                        <template v-else-if="teamMissionState(t, c.id) === 'active'">
                                            <button
                                                class="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-100"
                                                @click="openRolePanel(t.id, c.id)"
                                            >
                                                👥 שבץ תפקידים
                                            </button>
                                            <button
                                                class="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-100"
                                                @click="handleClose(t.id, t.name)"
                                            >
                                                🏁 סגור משימה
                                            </button>
                                        </template>

                                        <!-- COMPLETED: reopen -->
                                        <button
                                            v-else
                                            class="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-100"
                                            @click="handleReopen(t.id, t.name)"
                                        >
                                            🔄 פתח מחדש
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Inline role assignment panel -->
                            <div
                                v-if="rolePanel && rolePanel.challengeId === c.id"
                                class="border-t border-gray-100 bg-gray-50/50 p-6"
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
            </div>

            <!-- 2. Board Tab -->
            <div v-else-if="activeTab === 'board'" class="flex-1 flex flex-col">
                <MockMondayBoard />
            </div>

            <!-- 3. Analytics Tab -->
            <div v-else-if="activeTab === 'analytics'" class="flex-1 p-6">
                <div class="max-w-6xl mx-auto">
                    <div class="mb-6">
                        <h1 class="text-2xl font-black text-gray-900 tracking-tight">Student Analytics</h1>
                        <p class="text-sm text-gray-500 mt-1">מדדי ביצוע, רמת סיכון ותובנות למידה בזמן אמת.</p>
                    </div>
                    <AnalyticsDashboard />
                </div>
            </div>

            <!-- 4. DUDE Chats Tab -->
            <div v-else-if="activeTab === 'chats'" class="flex-1 p-6" style="min-height: 0">
                <div class="max-w-6xl mx-auto h-full" style="height: calc(100vh - 140px)">
                    <TeacherChatPanel />
                </div>
            </div>

            <!-- 5. Student Profiles Tab -->
            <div v-else-if="activeTab === 'profiles'" class="flex-1 p-6">
                <div class="max-w-6xl mx-auto">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <h1 class="text-2xl font-black text-gray-900 tracking-tight italic uppercase">DUDE Insights</h1>
                            <p class="text-sm text-gray-500 mt-1">ניתוח מעמיק של דפוסי עבודה וכישורים רכים.</p>
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="text-xs font-bold text-gray-400 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">{{ enrichedProfiles.length }} פרופילים נטענו</span>
                            <button
                                class="text-xs bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:translate-y-0"
                                @click="loadProfiles"
                            >
                                רענן נתונים
                            </button>
                        </div>
                    </div>

                    <div v-if="!enrichedProfiles.length" class="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                        <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-3xl">📭</div>
                        <p class="text-gray-400 font-medium">טרם נותחו פרופילי למידה עבור תלמידים אלו.</p>
                    </div>

                    <div v-else class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <StudentProfileCard
                            v-for="p in enrichedProfiles"
                            :key="p.id"
                            :profile="p"
                            :user-name="p.name"
                        />
                    </div>
                </div>
            </div>
        </main>

        <!-- Toast -->
        <Teleport to="body">
            <Transition name="toast">
                <div
                    v-if="toast"
                    :class="['fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-black pointer-events-none transition-all', toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white']"
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
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
