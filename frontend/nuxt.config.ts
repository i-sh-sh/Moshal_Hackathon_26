export default defineNuxtConfig({
    modules: ['@nuxtjs/tailwindcss'],

    // SSR enabled (default). Vercel auto-detects Nuxt 3 and sets NITRO_PRESET=vercel.
    ssr: true,

    runtimeConfig: {
        // Server-only — never sent to the browser
        supabaseServiceKey: '',   // set via NUXT_SUPABASE_SERVICE_KEY in Vercel dashboard
        // Public — available on both server and client
        public: {
            supabaseUrl: '',      // set via NUXT_PUBLIC_SUPABASE_URL
            supabaseAnonKey: '',  // set via NUXT_PUBLIC_SUPABASE_ANON_KEY
            apiBaseUrl: 'http://localhost:3001/api', // set via NUXT_PUBLIC_API_BASE_URL
        },
    },

    router: {
        middleware: ['auth'],
    },

    typescript: {
        strict: true,
    },
});