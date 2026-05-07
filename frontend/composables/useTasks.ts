import type { Task, QaChecklist, HintResponse } from '~/types/types';

function mapTask(r: Record<string, unknown>): Task {
    return {
        id:                r.id as string,
        sprintId:          r.sprint_id as string,
        teamId:            r.team_id as string,
        assignedRole:      r.assigned_role as Task['assignedRole'],
        title:             r.title as string,
        description:       (r.description ?? null) as string | null,
        status:            r.status as Task['status'],
        submissionUrl:     (r.submission_url ?? null) as string | null,
        submissionImageUrl:(r.submission_image_url ?? null) as string | null,
        mondayItemId:      (r.monday_item_id ?? null) as number | null,
        qaChecklist:       (r.qa_checklist ?? null) as QaChecklist | null,
        qaNotes:           (r.qa_notes ?? null) as string | null,
        pmNotes:           (r.pm_notes ?? null) as string | null,
        submittedBy:       (r.submitted_by ?? null) as string | null,
        reviewedByQa:      (r.reviewed_by_qa ?? null) as string | null,
        reviewedByPm:      (r.reviewed_by_pm ?? null) as string | null,
        createdAt:         r.created_at as string,
        updatedAt:         r.updated_at as string,
    };
}

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
            const raw = await $fetch<Record<string, unknown>[]>(`${base}/tasks/team/${teamId.value}`);
            tasks.value = raw.map(mapTask);
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
