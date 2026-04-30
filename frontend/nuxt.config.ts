export default defineNuxtConfig({
    modules: ['@nuxtjs/tailwindcss'],

    runtimeConfig: {
        // Server-only (never exposed to browser)
        supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
        // Public (available in browser)
        public: {
            supabaseUrl: process.env.SUPABASE_URL ?? '',
            supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
            apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3001/api',
        },
    },

    typescript: {
        strict: true,
    },
});