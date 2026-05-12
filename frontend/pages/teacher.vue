<script setup lang="ts">
import { useTeacher } from '~/composables/useTeacher';
import { useUser } from '~/composables/useUser';
import type { Challenge, StudentProfile } from '~/types/types';
import { LESSONS_PER_MISSION, DEMO_STUDENTS_BY_TEAM } from '~/services/demoData';
import { useStudentProfile } from '~/composables/useStudentProfile';

useHead({ title: 'Teacher Dashboard — TeamSprintUp' });

const { logout } = useUser();
const router = useRouter();
const activeTab = ref<'missions' | 'board' | 'analytics' | 'chats' | 'profiles'>('missions');

const teacherData = useTeacher();
const { 
    allProfiles, 
    alerts, 
    fetchAllProfiles, 
    fetchAlerts, 
    markAlertRead, 
    markAllAlertsRead 
} = useStudentProfile();

const config = useRuntimeConfig();
const base = config.public.apiBaseUrl;

onMounted(() => {
    teacherData.fetchChallenges();
    teacherData.fetchTeams();
    fetchAlerts();
    loadProfiles();
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
    await Promise.all([fetchAllProfiles(), fetchAlerts()]);
    const users = await $fetch<Array<{ id: string; name: string }>>(`${base}/users`).catch(() => []);

    const nameMap = new Map(users.map((u) => [u.id, u.name]));
    
    enrichedProfiles.value = allProfiles.value.map((p) => ({
        ...p,
        // Convert readonly array to mutable array to satisfy StudentProfile interface
        detectedTerms: [...p.detectedTerms],
        struggleAreas: [...p.struggleAreas],
        name: nameMap.get(p.userId) ?? 'תלמיד לא מזוהה',
    }));
}

const highAlerts = computed(() => alerts.value.filter((a) => !a.isRead));

watch(activeTab, (tab) => {
    if (tab === 'profiles') {
        loadProfiles();
    }
});
</script>

<template>
    <div class="min-h-screen bg-[#F8FAFC] flex flex-col" dir="rtl">
        <!-- Header -->
        <header class="bg-white/80 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-30 px-6 h-14 flex items-center gap-3">
            <!-- Logo -->
            <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3CC2EE] to-cyan-600 flex items-center justify-center shadow-sm">
                    <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                </div>
                <span class="font-bold text-gray-900 text-sm tracking-tight">TeamSprintUp</span>
                <span class="text-[10px] text-gray-500 font-semibold px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">Teacher</span>
            </div>

            <div class="flex-1" />

            <!-- Tabs -->
            <div class="flex gap-0.5 bg-gray-100/90 p-1 rounded-2xl border border-gray-200/70 shadow-sm">
                <button
                    :class="['px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer select-none',
                        activeTab === 'missions' ? 'bg-white shadow-sm text-gray-900 ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60']"
                    @click="activeTab = 'missions'"
                >
                    משימות
                </button>
                <button
                    :class="['px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer select-none',
                        activeTab === 'board' ? 'bg-white shadow-sm text-gray-900 ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60']"
                    @click="activeTab = 'board'"
                >
                    Monday Board
                </button>
                <button
                    :class="['px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer select-none',
                        activeTab === 'chats' ? 'bg-white shadow-sm text-gray-900 ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60']"
                    @click="activeTab = 'chats'"
                >
                    DUDE Chats
                </button>
                <button
                    :class="['relative px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer select-none',
                        activeTab === 'profiles' ? 'bg-white shadow-sm text-gray-900 ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60']"
                    @click="activeTab = 'profiles'"
                >
                    אנליזה
                    <span v-if="highAlerts.length" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none">
                        {{ highAlerts.length > 9 ? '9+' : highAlerts.length }}
                    </span>
                </button>
            </div>
        </header>

        <!-- Main Content Area -->
        <main class="flex-1 overflow-auto bg-[#F8FAFC] flex flex-col">

            <!-- 1. Missions Tab -->
            <div v-if="activeTab === 'missions'" class="flex-1 px-8 py-8">
                <div class="max-w-6xl mx-auto">
                    <div class="mb-8">
                        <h1 class="text-xl font-bold text-gray-900">ניהול משימות וצוותים</h1>
                        <p class="text-sm text-gray-500 mt-1">פתחו משימה לצוות, שבצו תפקידים, וסגרו את המשימה כשהיא הושלמה.</p>
                    </div>

                    <!-- Mission cards -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div
                            v-for="c in teacherData.challenges.value"
                            :key="c.id"
                            class="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-gray-300"
                        >
                            <!-- Card header -->
                            <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                                        <svg class="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                                            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/>
                                        </svg>
                                    </div>
                                    <span class="text-[10px] uppercase font-bold tracking-widest text-gray-400">Mission</span>
                                </div>
                                <span :class="['text-[11px] font-bold px-2.5 py-1 rounded-full', stateBadge(missionOverallState(c)).cls]">
                                    {{ stateBadge(missionOverallState(c)).text }}
                                </span>
                            </div>

                            <!-- Body -->
                            <div class="p-5 flex flex-col gap-4">
                                <div>
                                    <h3 class="text-base font-bold text-gray-900 leading-tight">{{ c.title }}</h3>
                                    <p class="text-sm text-gray-500 leading-relaxed line-clamp-3 mt-1.5">{{ c.description }}</p>
                                </div>

                                <div class="flex items-center gap-3 text-xs text-gray-400">
                                    <div class="flex items-center gap-1.5">
                                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                        {{ dateFor(c).toLocaleDateString('he-IL') }}
                                    </div>
                                    <span class="w-1 h-1 bg-gray-300 rounded-full" />
                                    <span>{{ lessonsFor(c) }} שיעורי האתגר</span>
                                </div>

                                <!-- Per-team rows -->
                                <div class="space-y-2 mt-1">
                                    <div
                                        v-for="t in teacherData.teams.value"
                                        :key="t.id"
                                        class="bg-gray-50 rounded-xl border border-gray-200/80 px-4 py-3 flex flex-wrap items-center gap-3"
                                    >
                                        <div class="flex items-center gap-2">
                                            <div class="w-6 h-6 rounded-full bg-[#3CC2EE]/10 flex items-center justify-center shrink-0">
                                                <svg class="w-3.5 h-3.5 text-[#3CC2EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                                    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                                                </svg>
                                            </div>
                                            <div>
                                                <p class="text-sm font-semibold text-gray-800">{{ t.name }}</p>
                                                <span :class="['text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide', stateBadge(teamMissionState(t, c.id)).cls]">
                                                    {{ stateBadge(teamMissionState(t, c.id)).text }}
                                                </span>
                                            </div>
                                        </div>

                                        <div class="flex-1" />

                                        <!-- IDLE -->
                                        <button
                                            v-if="teamMissionState(t, c.id) === 'idle'"
                                            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#3CC2EE] hover:bg-[#2ba9d4] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                            @click="handleOpen(c.id, t.id, t.name)"
                                        >
                                            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                                            פתח לצוות
                                        </button>

                                        <!-- ACTIVE -->
                                        <template v-else-if="teamMissionState(t, c.id) === 'active'">
                                            <button
                                                class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                                @click="openRolePanel(t.id, c.id)"
                                            >
                                                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg>
                                                שבץ תפקידים
                                            </button>
                                            <button
                                                class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                                @click="handleClose(t.id, t.name)"
                                            >
                                                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                                סגור משימה
                                            </button>
                                        </template>

                                        <!-- COMPLETED -->
                                        <button
                                            v-else
                                            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                            @click="handleReopen(t.id, t.name)"
                                        >
                                            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                                            פתח מחדש
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Inline role assignment panel -->
                            <div
                                v-if="rolePanel && rolePanel.challengeId === c.id"
                                class="border-t border-gray-100 bg-gray-50/50 p-5"
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
            <div v-else-if="activeTab === 'board'" class="flex-1 flex flex-col p-6">
                <div class="max-w-6xl mx-auto w-full">
                    <MockMondayBoard />
                </div>
            </div>

            <!-- 3. DUDE Chats Tab -->
            <div v-else-if="activeTab === 'chats'" class="flex-1 p-6" style="min-height: 0">
                <div class="max-w-6xl mx-auto h-full" style="height: calc(100vh - 140px)">
                    <TeacherChatPanel />
                </div>
            </div>

            <!-- 5. Student Profiles Tab -->
            <div v-else-if="activeTab === 'profiles'" class="flex-1 p-6">
                <div class="max-w-6xl mx-auto">
                    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
                        <div>
                            <h1 class="text-xl font-bold text-gray-900">DUDE Insights</h1>
                            <p class="text-sm text-gray-500 mt-0.5">ניתוח מעמיק של דפוסי עבודה וכישורים רכים.</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-semibold text-gray-400 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
                                {{ enrichedProfiles.length }} פרופילים
                            </span>
                            <button
                                class="inline-flex items-center gap-1.5 text-xs bg-[#3CC2EE] hover:bg-[#2ba9d4] text-white px-3.5 py-2 rounded-xl font-bold shadow-sm transition-all cursor-pointer"
                                @click="loadProfiles"
                            >
                                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                                רענן
                            </button>
                        </div>
                    </div>

                    <!-- Alerts banner -->
                    <div v-if="highAlerts.length" class="mb-6 bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
                        <div class="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                            <svg class="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-red-900 mb-2.5">{{ highAlerts.length }} התראות הדורשות התערבות</p>
                            <ul class="flex flex-col gap-1.5">
                                <li
                                    v-for="alert in highAlerts.slice(0, 5)"
                                    :key="alert.id"
                                    class="flex items-center gap-3 text-xs text-red-800 bg-white/70 px-3 py-2 rounded-xl border border-red-100"
                                >
                                    <span class="shrink-0 font-bold px-2 py-0.5 rounded-lg bg-red-100 text-red-700">
                                        {{ alert.alertType === 'stuck' ? 'תקוע' : 'התראה' }}
                                    </span>
                                    <span class="flex-1">{{ alert.message }}</span>
                                    <button class="shrink-0 text-red-400 hover:text-red-600 transition-colors text-xs cursor-pointer" @click="markAlertRead(alert.id)">סמן כנקרא</button>
                                </li>
                            </ul>
                            <button
                                v-if="highAlerts.length > 1"
                                class="mt-3 text-xs text-red-600 font-bold hover:text-red-800 underline cursor-pointer"
                                @click="markAllAlertsRead"
                            >
                                סמן הכל כנקרא
                            </button>
                        </div>
                    </div>

                    <h2 class="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide text-gray-500">תלמידים</h2>

                    <div v-if="!enrichedProfiles.length" class="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                        <div class="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                            <svg class="w-7 h-7 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                            </svg>
                        </div>
                        <p class="text-sm text-gray-400">טרם נותחו פרופילי למידה עבור תלמידים אלו.</p>
                    </div>

                    <div v-else class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <NuxtLink
                            v-for="p in enrichedProfiles"
                            :key="p.id"
                            :to="`/teacher-student/${p.userId}`"
                            class="block hover:scale-[1.01] transition-transform"
                        >
                            <StudentProfileCard
                                :profile="p"
                                :user-name="p.name"
                            />
                        </NuxtLink>
                    </div>

                    <h2 class="text-sm font-bold uppercase tracking-wide text-gray-500 mt-8 mb-4">קבוצות</h2>

                    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <NuxtLink
                            v-for="t in teacherData.teams.value"
                            :key="t.id"
                            :to="`/teacher-group/${t.id}`"
                            class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:border-[#3CC2EE]/40 transition-all cursor-pointer group"
                        >
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex items-center gap-2">
                                    <div class="w-7 h-7 rounded-lg bg-[#3CC2EE]/10 flex items-center justify-center shrink-0 group-hover:bg-[#3CC2EE]/20 transition-colors">
                                        <svg class="w-3.5 h-3.5 text-[#3CC2EE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                            <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                                        </svg>
                                    </div>
                                    <span class="font-bold text-gray-900 text-sm">{{ t.name }}</span>
                                </div>
                                <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', stateBadge(t.sprintStatus as TeamMissionState).cls]">
                                    {{ stateBadge(t.sprintStatus as TeamMissionState).text }}
                                </span>
                            </div>
                            <p class="text-xs text-gray-400">{{ DEMO_STUDENTS_BY_TEAM[t.id]?.length ?? 0 }} תלמידים</p>
                            <p v-if="t.currentChallengeId" class="text-xs text-gray-600">
                                <span class="font-semibold text-gray-400">אתגר פעיל: </span>
                                {{ teacherData.challenges.value.find(c => c.id === t.currentChallengeId)?.title ?? '' }}
                            </p>
                            <p v-else class="text-xs text-gray-400">אין אתגר פעיל</p>
                        </NuxtLink>
                    </div>
                </div>
            </div>
        </main>

        <!-- Toast -->
        <Teleport to="body">
            <Transition name="toast">
                <div
                    v-if="toast"
                    :class="['fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold pointer-events-none transition-all', toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white']"
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

.toast-enter-active,
.toast-leave-active {
    transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    transform: translate(-50%, 12px);
}
</style>