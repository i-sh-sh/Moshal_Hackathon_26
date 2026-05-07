/**
 * POC composable — returns hardcoded demo data instead of hitting the API.
 * Re-introduce $fetch calls when wiring back to the live backend.
 */

import type {
    Challenge,
    Team,
    StudentRole,
    StudentWithRoleHistory,
    TeacherPublishPayload,
    TeacherAssignRolesPayload,
} from '~/types/types';
import {
    DEMO_MISSIONS,
    DEMO_TEAMS,
    DEMO_STUDENTS_BY_TEAM,
} from '~/services/demoData';

export function useTeacher() {
    const challenges = ref<Challenge[]>([...DEMO_MISSIONS]);
    const teams = ref<Team[]>([...DEMO_TEAMS]);
    const students = ref<StudentWithRoleHistory[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function fetchChallenges() {
        challenges.value = [...DEMO_MISSIONS];
    }

    async function fetchTeams() {
        teams.value = [...DEMO_TEAMS];
    }

    async function fetchStudents(teamId: string) {
        loading.value = true;
        await new Promise((r) => setTimeout(r, 120));
        students.value = (DEMO_STUDENTS_BY_TEAM[teamId] ?? []).map((s) => ({ ...s }));
        loading.value = false;
    }

    async function publishChallenge(
        challengeId: string,
        payload: TeacherPublishPayload,
    ) {
        const team = teams.value.find((t) => t.id === payload.teamId);
        if (team) {
            (team as any).currentChallengeId = challengeId;
            (team as any).current_challenge_id = challengeId;
            (team as any).sprintStatus = 'active';
        }
        for (const c of challenges.value) {
            (c as any).isActive = c.id === challengeId;
        }
        return { ok: true, challengeId, teamId: payload.teamId };
    }

    async function assignRoles(
        teamId: string,
        payload: TeacherAssignRolesPayload,
    ) {
        const list = students.value;
        for (const a of payload.assignments) {
            const s = list.find((x) => x.id === a.userId);
            if (s) {
                if (s.currentRole) s.lastRoles = [s.currentRole, ...s.lastRoles].slice(0, 3);
                s.currentRole = a.role;
                (s.roleCount as any)[a.role] = ((s.roleCount as any)[a.role] ?? 0) + 1;
            }
        }
        return { ok: true, assigned: payload.assignments.length };
    }

    async function autoAssignRoles(_teamId: string, _challengeId?: string) {
        const ROLES: StudentRole[] = ['pm', 'qa', 'dev', 'hardware'];
        const list = students.value;
        const used = new Set<StudentRole>();

        for (const s of list) {
            const candidates = ROLES.filter((r) => !used.has(r));
            const preferred = candidates.find((r) => r !== s.lastRoles[0]) ?? candidates[0];
            if (s.currentRole) s.lastRoles = [s.currentRole, ...s.lastRoles].slice(0, 3);
            s.currentRole = preferred;
            s.suggestedRole = preferred;
            used.add(preferred);
        }
        return [...list];
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
