import type {
    Challenge,
    Team,
    StudentWithRoleHistory,
    TeacherPublishPayload,
    TeacherAssignRolesPayload,
} from '~/types/types';

export function useTeacher() {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    const challenges = ref<Challenge[]>([]);
    const teams = ref<Team[]>([]);
    const students = ref<StudentWithRoleHistory[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function fetchChallenges() {
        loading.value = true;
        try {
            challenges.value = await $fetch<Challenge[]>(`${base}/teacher/challenges`);
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to load challenges';
        } finally {
            loading.value = false;
        }
    }

    async function fetchTeams() {
        loading.value = true;
        try {
            teams.value = await $fetch<Team[]>(`${base}/teacher/teams`);
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to load teams';
        } finally {
            loading.value = false;
        }
    }

    async function fetchStudents(teamId: string) {
        loading.value = true;
        try {
            students.value = await $fetch<StudentWithRoleHistory[]>(
                `${base}/teacher/teams/${teamId}/students-with-role-history`,
            );
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to load students';
        } finally {
            loading.value = false;
        }
    }

    async function publishChallenge(
        challengeId: string,
        payload: TeacherPublishPayload,
    ) {
        return $fetch(`${base}/teacher/challenges/${challengeId}/publish`, {
            method: 'POST',
            body: payload,
        });
    }

    async function assignRoles(
        teamId: string,
        payload: TeacherAssignRolesPayload,
    ) {
        return $fetch(`${base}/teacher/teams/${teamId}/assign-roles`, {
            method: 'POST',
            body: payload,
        });
    }

    async function autoAssignRoles(teamId: string, challengeId?: string) {
        const result = await $fetch<StudentWithRoleHistory[]>(
            `${base}/teacher/teams/${teamId}/auto-assign-roles`,
            { method: 'POST', body: { challengeId } },
        );
        students.value = result;
        return result;
    }

    return {
        challenges,
        teams,
        students,
        loading,
        error,
        fetchChallenges,
        fetchTeams,
        fetchStudents,
        publishChallenge,
        assignRoles,
        autoAssignRoles,
    };
}
