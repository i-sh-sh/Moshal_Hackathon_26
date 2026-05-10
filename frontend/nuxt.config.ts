export default defineNuxtConfig({
    modules: ['@nuxtjs/tailwindcss'],

    ssr: true,

    app: {
        head: {
            link: [
                { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
                { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
                { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap' },
            ],
        },
    },

    // Netlify preset — set NITRO_PRESET=netlify in Netlify env vars
    // (netlify.toml sets this automatically)

    runtimeConfig: {
        public: {
            apiBaseUrl: 'http://localhost:3001/api', // set via NUXT_PUBLIC_API_BASE_URL
            supabaseUrl: '', // set via NUXT_PUBLIC_SUPABASE_URL
            supabaseAnonKey: '', // set via NUXT_PUBLIC_SUPABASE_ANON_KEY
        },
    },


    typescript: {
        strict: true,
    },
});