import type { UserRole } from '~/types/types';

export interface UserSession {
    id: string;
    name: string;
    email: string;
    currentTeamId: string | null;
    currentRole: UserRole | null;
}

const SESSION_KEY = 'tsu_user_session';

export function useUser() {
    const user = useState<UserSession | null>('current_user', () => {
        if (import.meta.client) {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? (JSON.parse(raw) as UserSession) : null;
        }
        return null;
    });

    function login(session: UserSession) {
        user.value = session;
        if (import.meta.client) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
    }

    function logout() {
        user.value = null;
        if (import.meta.client) {
            localStorage.removeItem(SESSION_KEY);
        }
    }

    const isLoggedIn = computed(() => !!user.value);

    return { user: readonly(user), isLoggedIn, login, logout };
}
