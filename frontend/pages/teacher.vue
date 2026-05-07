<script setup lang="ts">
import { useTeacher } from '~/composables/useTeacher';
import { useUser } from '~/composables/useUser';
import type { Challenge, Team } from '~/types/types';
import { LESSONS_PER_MISSION } from '~/services/demoData';

useHead({ title: 'TechSchool — לוח מורה' });

const { logout } = useUser();
const router = useRouter();

const activeTab = ref<'missions' | 'board' | 'analytics' | 'roles'>('missions');

const teacherData = useTeacher();

// Selected mission/team for publish action
const selectedChallengeId = ref('');
const selectedTeamId = ref('');
const showRolePanel = ref(false);
const publishing = ref(false);
const publishMsg = ref('');
const publishError = ref(false);

onMounted(() => {
    teacherData.fetchChallenges();
    teacherData.fetchTeams();
});

watch(activeTab, () => {
    if (!teacherData.challenges.value.length) teacherData.fetchChallenges();
    if (!teacherData.teams.value.length) teacherData.fetchTeams();
});

async function handlePublish() {
    if (!selectedChallengeId.value || !selectedTeamId.value) return;
    publishing.value = true;
    publishMsg.value = '';
    publishError.value = false;
    try {
        await teacherData.publishChallenge(selectedChallengeId.value, {
            teamId: selectedTeamId.value,
        });
        publishMsg.value = 'אתגר פורסם! עכשיו אפשר לשבץ תפקידים.';
        showRolePanel.value = true;
        await teacherData.fetchTeams();
    } catch (e: any) {
        publishError.value = true;
        publishMsg.value = e?.data?.message ?? 'הפרסום נכשל';
    } finally {
        publishing.value = false;
    }
}

function publishFromCard(challenge: Challenge) {
    selectedChallengeId.value = challenge.id;
    activeTab.value = 'roles';
    if (!selectedTeamId.value && teacherData.teams.value.length) {
        selectedTeamId.value = teacherData.teams.value[0].id;
    }
}

function teamsOnChallenge(challengeId: string): Team[] {
    return teacherData.teams.value.filter(
        (t: any) => (t.currentChallengeId ?? t.current_challenge_id) === challengeId,
    );
}

function lessonsFor(c: Challenge): number {
    return LESSONS_PER_MISSION[c.id] ?? 0;
}

function dateFor(c: Challenge): Date {
    const raw = (c as any).createdAt ?? (c as any).created_at;
    return raw ? new Date(raw) : new Date();
}

function statusBadgeFor(c: Challenge) {
    const onTeams = teamsOnChallenge(c.id);
    const active = (c as any).isActive ?? (c as any).is_active;
    if (onTeams.length > 0 || active) {
        return { text: 'פעיל', cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' };
    }
    return { text: 'לא פעיל', cls: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200' };
}

function handleLogout() {
    logout();
    router.push('/');
}
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex" dir="rtl">
        <!-- Right cyan TS sidebar (first in DOM = right side in RTL flex) -->
        <TechSchoolSidebar school-label="School Test 01" :on-logout="handleLogout" />

        <!-- Page content (fills the rest, on the left in RTL flex) -->
        <div class="flex-1 flex flex-col min-w-0">
            <!-- Top score bar (TS-style) -->
            <header class="bg-white border-b border-gray-200">
                <div class="px-6 h-16 flex items-center gap-4">
                    <!-- Score chips -->
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

                    <!-- Tabs -->
                    <div class="flex gap-1 bg-gray-100 p-1 rounded-xl">
                        <button
                            :class="['px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', activeTab === 'missions' ? 'bg-white text-[#3CC2EE] shadow-sm' : 'text-gray-500 hover:text-gray-800']"
                            @click="activeTab = 'missions'"
                        >🎯 משימות</button>
                        <button
                            :class="['px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', activeTab === 'roles' ? 'bg-white text-[#3CC2EE] shadow-sm' : 'text-gray-500 hover:text-gray-800']"
                            @click="activeTab = 'roles'"
                        >👥 שיבוץ תפקידים</button>
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

            <!-- Breadcrumb / page heading -->
            <div class="px-8 pt-6 pb-2">
                <p class="text-xs text-gray-400 mb-1">
                    <span class="text-[#3CC2EE] font-semibold">לוח מורה</span>
                    <span class="mx-1">›</span>
                    <span>
                        {{ activeTab === 'missions' ? 'המשימות שלי' :
                           activeTab === 'roles' ? 'שיבוץ תפקידים' :
                           activeTab === 'board' ? 'לוח Monday' : 'ניתוחים' }}
                    </span>
                </p>
            </div>

            <!-- ─── MISSIONS TAB ─── -->
            <div v-if="activeTab === 'missions'" class="flex-1 px-8 pb-10">
                <div class="mb-6">
                    <h1 class="text-2xl font-extrabold text-gray-900">אתגרים פעילים</h1>
                    <p class="text-sm text-gray-500 mt-1">בחר אתגר כדי לפרסם לצוות ולשבץ תפקידים לתלמידים.</p>
                </div>

                <!-- Loading -->
                <div v-if="teacherData.loading.value" class="text-gray-400 text-center py-16">
                    טוען משימות...
                </div>

                <!-- Empty -->
                <div
                    v-else-if="!teacherData.challenges.value.length"
                    class="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-gray-400"
                >
                    אין משימות במאגר. הרץ <code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">npm run seed</code>.
                </div>

                <!-- Mission cards (TS-style) -->
                <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl">
                    <div
                        v-for="c in teacherData.challenges.value"
                        :key="c.id"
                        class="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-[#3CC2EE]/40 transition-all flex flex-col overflow-hidden"
                    >
                        <!-- Header strip with trophy + status -->
                        <div class="px-5 py-3 bg-gradient-to-l from-cyan-50 to-white border-b border-gray-100 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-2xl">🏆</span>
                                <span class="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                                    {{ teamsOnChallenge(c.id).length ? 'פעיל לצוות' : 'אתגר' }}
                                </span>
                            </div>
                            <span :class="['text-[11px] font-semibold px-2 py-0.5 rounded-full', statusBadgeFor(c).cls]">
                                {{ statusBadgeFor(c).text }}
                            </span>
                        </div>

                        <!-- Body -->
                        <div class="p-5 flex flex-col gap-3 flex-1">
                            <h3 class="text-base font-extrabold text-gray-900 leading-snug">{{ c.title }}</h3>
                            <p class="text-xs text-gray-500 leading-relaxed line-clamp-3">{{ c.description }}</p>

                            <!-- Date + lessons -->
                            <div class="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                <span class="flex items-center gap-1">
                                    <span>📅</span>
                                    <span>{{ dateFor(c).toLocaleDateString('he-IL') }}</span>
                                </span>
                                <span class="text-gray-300">·</span>
                                <span>{{ lessonsFor(c) }} שיעורי האתגר</span>
                            </div>

                            <!-- Progress bar (placeholder visual) -->
                            <div class="flex items-center gap-2 text-xs">
                                <span class="text-gray-400">0/{{ lessonsFor(c) }}</span>
                                <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div class="h-full bg-[#3CC2EE] rounded-full" style="width: 0%"></div>
                                </div>
                                <span class="text-gray-400">0%</span>
                            </div>

                            <!-- Teams currently on this mission -->
                            <div v-if="teamsOnChallenge(c.id).length" class="flex flex-wrap gap-1.5 mt-1">
                                <span
                                    v-for="t in teamsOnChallenge(c.id)"
                                    :key="t.id"
                                    class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100"
                                >
                                    👥 {{ t.name }}
                                </span>
                            </div>

                            <div class="flex-1" />

                            <button
                                class="w-full mt-2 px-4 py-2 bg-[#3CC2EE] hover:bg-[#27b3df] text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                                @click="publishFromCard(c)"
                            >
                                פרסם ושבץ תפקידים →
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ─── ROLES TAB ─── -->
            <div v-else-if="activeTab === 'roles'" class="flex-1 px-8 pb-10">
                <div class="max-w-5xl space-y-6">
                    <div>
                        <h1 class="text-2xl font-extrabold text-gray-900">פרסום משימה ושיבוץ תפקידים</h1>
                        <p class="text-sm text-gray-500 mt-1">בחר משימה וצוות, פרסם, ואז שבץ תפקידים לתלמידים.</p>
                    </div>

                    <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                        <div class="flex gap-4 items-end flex-wrap">
                            <div class="flex-1 min-w-[200px]">
                                <label class="block text-xs text-gray-500 mb-1 font-semibold">משימה</label>
                                <select
                                    v-model="selectedChallengeId"
                                    class="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CC2EE]/40"
                                >
                                    <option value="">— בחר משימה —</option>
                                    <option v-for="c in teacherData.challenges.value" :key="c.id" :value="c.id">
                                        {{ c.title }}
                                    </option>
                                </select>
                            </div>
                            <div class="flex-1 min-w-[200px]">
                                <label class="block text-xs text-gray-500 mb-1 font-semibold">צוות</label>
                                <select
                                    v-model="selectedTeamId"
                                    class="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CC2EE]/40"
                                >
                                    <option value="">— בחר צוות —</option>
                                    <option v-for="t in teacherData.teams.value" :key="t.id" :value="t.id">
                                        {{ t.name }}
                                    </option>
                                </select>
                            </div>
                            <button
                                :disabled="!selectedChallengeId || !selectedTeamId || publishing"
                                class="px-5 py-2 bg-[#3CC2EE] hover:bg-[#27b3df] disabled:opacity-50 text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                                @click="handlePublish"
                            >
                                🚀 פרסם משימה
                            </button>
                        </div>
                        <p v-if="publishMsg" class="text-sm mt-3" :class="publishError ? 'text-red-600' : 'text-emerald-600'">
                            {{ publishMsg }}
                        </p>
                    </div>

                    <RoleAssignmentPanel
                        v-if="selectedTeamId && showRolePanel"
                        :team-id="selectedTeamId"
                        :challenge-id="selectedChallengeId || undefined"
                        @close="showRolePanel = false"
                        @saved="publishMsg = 'התפקידים נשמרו בהצלחה.'"
                    />
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
    </div>
</template>

<style scoped>
.line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>
