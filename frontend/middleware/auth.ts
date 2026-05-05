const SESSION_KEY = 'tsu_user_session';

export default defineNuxtRouteMiddleware((to) => {
    // Pages that don't require login
    if (to.path === '/' || to.path === '/teacher') return;

    // Server-side: can't read localStorage — skip (client will redirect if needed)
    if (import.meta.server) return;

    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
        return navigateTo('/');
    }
});
