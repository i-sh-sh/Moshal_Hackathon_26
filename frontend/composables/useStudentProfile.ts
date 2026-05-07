import type { StudentProfile, ProfileSnapshot } from '~/types/types';

export function useStudentProfile() {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    const profile = ref<StudentProfile | null>(null);
    const snapshots = ref<ProfileSnapshot[]>([]);
    const allProfiles = ref<StudentProfile[]>([]);
    const loading = ref(false);

    async function fetchMyProfile(userId: string): Promise<void> {
        loading.value = true;
        try {
            profile.value = await $fetch<StudentProfile>(`${base}/student-profiles/${userId}`).catch(() => null);
        } finally {
            loading.value = false;
        }
    }

    async function fetchSnapshots(userId: string): Promise<void> {
        try {
            snapshots.value = await $fetch<ProfileSnapshot[]>(`${base}/student-profiles/${userId}/snapshots`);
        } catch {
            snapshots.value = [];
        }
    }

    async function fetchAllProfiles(): Promise<void> {
        loading.value = true;
        try {
            allProfiles.value = await $fetch<StudentProfile[]>(`${base}/student-profiles`);
        } finally {
            loading.value = false;
        }
    }

    async function triggerAnalysis(channelId: string): Promise<{ analyzed: number; summary: string }> {
        return $fetch(`${base}/dude/channels/${channelId}/analyze`, { method: 'POST' });
    }

    return {
        profile: readonly(profile),
        snapshots: readonly(snapshots),
        allProfiles: readonly(allProfiles),
        loading: readonly(loading),
        fetchMyProfile,
        fetchSnapshots,
        fetchAllProfiles,
        triggerAnalysis,
    };
}
