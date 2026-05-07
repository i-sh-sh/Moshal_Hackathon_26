<script setup lang="ts">
import { ROLE_LABELS, ROLE_PRIORITY } from '~/types/types';
import type { StudentRole, StudentWithRoleHistory } from '~/types/types';
import { useTeacher } from '~/composables/useTeacher';

const props = defineProps<{
    teamId: string;
    challengeId?: string;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'saved'): void;
}>();

const teacher = useTeacher();
const { students, loading } = teacher;

const localStudents = ref<StudentWithRoleHistory[]>([]);
const assignments = reactive<Record<string, StudentRole | ''>>({});
const dirty = ref(false);
const busy = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

watch(
    students,
    (val) => {
        localStudents.value = [...val];
        for (const s of val) {
            if (!assignments[s.id]) assignments[s.id] = s.currentRole ?? '';
        }
    },
    { immediate: true, deep: true },
);

watch(
    () => props.teamId,
    (id) => {
        if (id) teacher.fetchStudents(id);
    },
    { immediate: true },
);

const ROLE_COLOR: Record<string, string> = {
    designer: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    editor:   'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
    qa:       'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200',
    printer:  'bg-green-100 text-green-700 ring-1 ring-green-200',
};

function roleColorClass(role: StudentRole | null) {
    if (!role) return 'bg-gray-100 text-gray-500 ring-1 ring-gray-200';
    return ROLE_COLOR[role] ?? 'bg-gray-100 text-gray-500 ring-1 ring-gray-200';
}

async function handleAutoAssign() {
    busy.value = true;
    errorMsg.value = '';
    successMsg.value = '';
    try {
        const result = await teacher.autoAssignRoles(props.teamId, props.challengeId);
        for (const s of result) assignments[s.id] = s.currentRole ?? '';
        localStudents.value = result;
        dirty.value = false;
        successMsg.value = 'התפקידים שובצו אוטומטית ונשמרו.';
        emit('saved');
    } catch (e: any) {
        errorMsg.value = e?.data?.message ?? 'השיבוץ האוטומטי נכשל';
    } finally {
        busy.value = false;
    }
}

async function handleSave() {
    busy.value = true;
    errorMsg.value = '';
    successMsg.value = '';
    try {
        const payload = {
            assignments: Object.entries(assignments)
                .filter(([, role]) => !!role)
                .map(([userId, role]) => ({ userId, role: role as StudentRole })),
            challengeId: props.challengeId,
        };
        await teacher.assignRoles(props.teamId, payload);
        dirty.value = false;
        successMsg.value = 'השיבוץ נשמר.';
        emit('saved');
    } catch (e: any) {
        errorMsg.value = e?.data?.message ?? 'השמירה נכשלה';
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="bg-white border border-gray-200 rounded-2xl p-6 space-y-5 shadow-sm" dir="rtl">
        <div class="flex items-center justify-between">
            <h2 class="text-lg font-extrabold text-gray-900">שיבוץ תפקידים</h2>
            <button
                class="text-gray-400 hover:text-gray-700 transition-colors text-xl"
                @click="emit('close')"
            >
                ✕
            </button>
        </div>

        <div v-if="loading" class="text-gray-400 text-center py-8 text-sm">
            טוען תלמידים...
        </div>

        <template v-else>
            <div class="flex gap-3 flex-wrap">
                <button
                    :disabled="busy"
                    class="px-4 py-2 bg-[#3CC2EE] hover:bg-[#27b3df] disabled:opacity-50 text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                    @click="handleAutoAssign"
                >
                    ⚡ שיבוץ אוטומטי
                </button>
                <button
                    :disabled="busy || !dirty"
                    class="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                    @click="handleSave"
                >
                    💾 שמור שיבוץ
                </button>
            </div>

            <div class="space-y-3">
                <div
                    v-for="student in localStudents"
                    :key="student.id"
                    class="bg-gray-50 rounded-xl p-4 flex flex-col gap-2 border border-gray-200"
                >
                    <div class="flex items-center justify-between">
                        <span class="text-gray-900 font-semibold">{{ student.name }}</span>
                        <span
                            v-if="student.currentRole"
                            class="text-xs px-2 py-0.5 rounded-full font-medium"
                            :class="roleColorClass(student.currentRole)"
                        >
                            {{ ROLE_LABELS[student.currentRole] ?? student.currentRole }}
                        </span>
                    </div>

                    <div v-if="student.lastRoles.length" class="flex gap-1 flex-wrap items-center">
                        <span class="text-xs text-gray-400">תפקידים אחרונים:</span>
                        <template v-for="(r, i) in student.lastRoles" :key="i">
                            <span class="text-xs text-gray-500">
                                {{ ROLE_LABELS[r] ?? r }}<span v-if="i < student.lastRoles.length - 1">,</span>
                            </span>
                        </template>
                    </div>

                    <select
                        v-model="assignments[student.id]"
                        class="mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                        @change="dirty = true"
                    >
                        <option value="">— בחר תפקיד —</option>
                        <option v-for="role in ROLE_PRIORITY" :key="role" :value="role">
                            {{ ROLE_LABELS[role] }}
                        </option>
                    </select>

                    <div v-if="student.suggestedRole" class="text-xs text-[#3CC2EE]">
                        מומלץ: {{ ROLE_LABELS[student.suggestedRole] }}
                    </div>
                </div>

                <p v-if="!localStudents.length" class="text-sm text-gray-400 text-center py-6">
                    אין תלמידים בצוות הזה.
                </p>
            </div>
        </template>

        <p v-if="errorMsg" class="text-red-600 text-sm">{{ errorMsg }}</p>
        <p v-if="successMsg" class="text-emerald-600 text-sm">{{ successMsg }}</p>
    </div>
</template>
