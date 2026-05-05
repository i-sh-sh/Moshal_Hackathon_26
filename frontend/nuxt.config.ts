export default defineNuxtConfig({
    modules: ['@nuxtjs/tailwindcss'],

    ssr: true,

    runtimeConfig: {
        public: {
            apiBaseUrl: 'http://localhost:3001/api', // override via NUXT_PUBLIC_API_BASE_URL
        },
    },

    router: {
        middleware: ['auth'],
    },

    typescript: {
        strict: true,
    },
});