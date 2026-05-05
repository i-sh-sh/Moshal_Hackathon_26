import type { GroupLeaderboardRow, IndividualLeaderboardRow } from '~/types/types';

export function useLeaderboard() {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    const rows = ref<GroupLeaderboardRow[]>([]);
    const topIndividuals = ref<IndividualLeaderboardRow[]>([]);
    const loading = ref(false);

    async function fetchLeaderboard() {
        loading.value = true;
        try {
            const [groupRaw, indivRaw] = await Promise.all([
                $fetch<Record<string, unknown>[]>(`${base}/teams/leaderboard/group`),
                $fetch<Record<string, unknown>[]>(`${base}/teams/leaderboard/individual`).catch(() => []),
            ]);

            rows.value = groupRaw.map((r) => ({
                id: r.id as string,
                name: r.name as string,
                accumulatedScore: (r.accumulated_score as number) ?? 0,
                sprintStatus: r.sprint_status as string,
                isCompleted: r.is_completed as boolean,
                approvedTaskCount: (r.approved_task_count as number) ?? 0,
            }));

            topIndividuals.value = (indivRaw as Record<string, unknown>[]).map((r) => ({
                id: r.id as string,
                name: r.name as string,
                currentTeamId: (r.current_team_id as string) ?? null,
                currentRole: (r.current_role as IndividualLeaderboardRow['currentRole']) ?? null,
                approvedTasks: (r.approved_tasks as number) ?? 0,
                totalActiveTime: (r.total_active_time as number) ?? 0,
                rank: (r.rank as number) ?? 0,
            }));
        } catch {
            // silently fail — non-critical
        } finally {
            loading.value = false;
        }
    }

    return {
        rows: readonly(rows),
        topIndividuals: readonly(topIndividuals),
        loading: readonly(loading),
        fetchLeaderboard,
    };
}
