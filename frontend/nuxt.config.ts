export default defineNuxtConfig({
    modules: ['@nuxtjs/tailwindcss'],

    ssr: true,

    // Netlify preset — set NITRO_PRESET=netlify in Netlify env vars
    // (netlify.toml sets this automatically)

    runtimeConfig: {
        public: {
            apiBaseUrl: 'http://localhost:3001/api', // set via NUXT_PUBLIC_API_BASE_URL
        },
    },


    typescript: {
        strict: true,
    },
});