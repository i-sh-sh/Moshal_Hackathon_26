import type { ChatMessage } from '~/types/types';

interface HistoryItem {
    role: 'user' | 'assistant';
    content: string;
}

export function usePrivateDude(userId: Ref<string>, userName: Ref<string>) {
    const config = useRuntimeConfig();
    const base = config.public.apiBaseUrl;

    const messages = ref<ChatMessage[]>([]);
    const sending = ref(false);

    function makeId() {
        return Math.random().toString(36).slice(2);
    }

    async function sendMessage(content: string): Promise<void> {
        if (!content.trim() || !userId.value) return;

        const userMsg: ChatMessage = {
            id: makeId(),
            channelId: 'private',
            senderId: userId.value,
            senderName: userName.value,
            isBot: false,
            content: content.trim(),
            createdAt: new Date().toISOString(),
        };
        messages.value = [...messages.value, userMsg];

        sending.value = true;
        try {
            const history: HistoryItem[] = messages.value
                .slice(-12)
                .map((m) => ({ role: m.isBot ? 'assistant' : 'user', content: m.content }));

            const { reply } = await $fetch<{ reply: string }>(`${base}/dude/private/${userId.value}/chat`, {
                method: 'POST',
                body: { message: content.trim(), history },
            });

            const botMsg: ChatMessage = {
                id: makeId(),
                channelId: 'private',
                senderId: null,
                senderName: 'DUDE 🤖',
                isBot: true,
                content: reply,
                createdAt: new Date().toISOString(),
            };
            messages.value = [...messages.value, botMsg];
        } catch {
            const errMsg: ChatMessage = {
                id: makeId(),
                channelId: 'private',
                senderId: null,
                senderName: 'DUDE 🤖',
                isBot: true,
                content: 'שגיאה זמנית — נסה שוב בעוד רגע.',
                createdAt: new Date().toISOString(),
            };
            messages.value = [...messages.value, errMsg];
        } finally {
            sending.value = false;
        }
    }

    return {
        messages: readonly(messages),
        sending: readonly(sending),
        sendMessage,
    };
}
