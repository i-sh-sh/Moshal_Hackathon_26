import type { GroupLeaderboardRow } from '~/types/types';

export function useLeaderboard() {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    const rows = ref<GroupLeaderboardRow[]>([]);
    const loading = ref(false);

    async function fetchLeaderboard() {
        loading.value = true;
        try {
            const raw = await $fetch<Record<string, unknown>[]>(`${base}/teams/leaderboard/group`);
            rows.value = raw.map((r) => ({
                id: r.id as string,
                name: r.name as string,
                accumulatedScore: (r.accumulated_score as number) ?? 0,
                sprintStatus: r.sprint_status as string,
                isCompleted: r.is_completed as boolean,
                approvedTaskCount: (r.approved_task_count as number) ?? 0,
            }));
        } catch {
            // silently fail — non-critical
        } finally {
            loading.value = false;
        }
    }

    return { rows: readonly(rows), loading: readonly(loading), fetchLeaderboard };
}
