import type { ChatChannel, ChatMessage } from '~/types/types';

export function useChat(teamId: Ref<string>, userId: Ref<string>, userName: Ref<string>, teamName: Ref<string> = ref('')) {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    const channel = ref<ChatChannel | null>(null);
    const messages = ref<ChatMessage[]>([]);
    const loading = ref(false);
    const sending = ref(false);
    const error = ref<string | null>(null);

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function initChannel(): Promise<void> {
        if (!teamId.value) return;
        loading.value = true;
        try {
            const existing = await $fetch<ChatChannel | null>(
                `${base}/chat/teams/${teamId.value}/channel`,
            ).catch(() => null);

            if (existing) {
                channel.value = existing;
            } else {
                channel.value = await $fetch<ChatChannel>(
                    `${base}/chat/teams/${teamId.value}/channel?teamName=${encodeURIComponent(teamName.value || teamId.value)}`,
                    { method: 'POST' },
                );
            }
            await fetchMessages();
        } catch (e) {
            error.value = (e as Error).message;
        } finally {
            loading.value = false;
        }
    }

    async function fetchMessages(): Promise<void> {
        if (!channel.value) return;
        try {
            messages.value = await $fetch<ChatMessage[]>(
                `${base}/chat/channels/${channel.value.id}/messages`,
            );
        } catch {
            // silent — keep existing messages on poll failure
        }
    }

    async function sendMessage(content: string): Promise<void> {
        if (!channel.value || !content.trim()) return;
        sending.value = true;
        try {
            // Route through DUDE endpoint so the bot can respond
            await $fetch(`${base}/dude/channels/${channel.value.id}/messages`, {
                method: 'POST',
                body: {
                    senderId: userId.value,
                    senderName: userName.value,
                    content: content.trim(),
                },
            });
            await fetchMessages();
        } catch (e) {
            error.value = (e as Error).message;
        } finally {
            sending.value = false;
        }
    }

    function startPolling(intervalMs = 5000): void {
        stopPolling();
        pollTimer = setInterval(fetchMessages, intervalMs);
    }

    function stopPolling(): void {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    return {
        channel: readonly(channel),
        messages: readonly(messages),
        loading: readonly(loading),
        sending: readonly(sending),
        error: readonly(error),
        initChannel,
        fetchMessages,
        sendMessage,
        startPolling,
        stopPolling,
    };
}
