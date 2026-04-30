import type { Config } from 'tailwindcss';

export default {
    content: [
        './components/**/*.{vue,ts}',
        './layouts/**/*.vue',
        './pages/**/*.vue',
        './plugins/**/*.ts',
        './app.vue',
    ],
    theme: {
        extend: {
            colors: {
                // Brand palette — swap freely
                brand: {
                    50: '#f0f9ff',
                    500: '#0ea5e9',
                    900: '#0c4a6e',
                },
            },
        },
    },
    plugins: [],
} satisfies Config;