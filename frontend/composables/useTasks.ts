import type { Task, QaChecklist, HintResponse } from '~/types/types';

export function useTasks(teamId: Ref<string>, userId: Ref<string>) {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    const tasks = ref<Task[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function fetchTasks() {
        loading.value = true;
        error.value = null;
        try {
            tasks.value = await $fetch<Task[]>(`${base}/tasks/team/${teamId.value}`);
        } catch (e) {
            error.value = (e as Error).message;
        } finally {
            loading.value = false;
        }
    }

    async function submitTask(payload: {
        taskId: string;
        submissionUrl: string;
        submissionImageUrl: string;
    }) {
        await $fetch(`${base}/tasks/submit`, {
            method: 'POST',
            body: { ...payload, userId: userId.value },
        });
        await fetchTasks();
    }

    async function qaReview(payload: {
        taskId: string;
        decision: 'approve' | 'reject';
        checklist: QaChecklist;
        notes: string;
    }) {
        await $fetch(`${base}/tasks/qa-review`, {
            method: 'POST',
            body: { ...payload, userId: userId.value },
        });
        await fetchTasks();
    }

    async function pmReview(payload: {
        taskId: string;
        decision: 'approve' | 'reject';
        notes: string;
    }) {
        await $fetch(`${base}/tasks/pm-review`, {
            method: 'POST',
            body: { ...payload, userId: userId.value },
        });
        await fetchTasks();
    }

    async function requestHint(payload: {
        taskId: string;
        taskDescription: string;
    }): Promise<HintResponse> {
        return $fetch<HintResponse>(`${base}/hints`, {
            method: 'POST',
            body: {
                userId: userId.value,
                teamId: teamId.value,
                taskId: payload.taskId,
                taskDescription: payload.taskDescription,
            },
        });
    }

    return {
        tasks: readonly(tasks),
        loading: readonly(loading),
        error: readonly(error),
        fetchTasks,
        submitTask,
        qaReview,
        pmReview,
        requestHint,
    };
}
