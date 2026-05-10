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
            fontFamily: {
                sans: ['Heebo', 'system-ui', 'sans-serif'],
            },
            colors: {
                primary: {
                    50:  '#ecfbff',
                    100: '#d0f4ff',
                    200: '#aaeaff',
                    300: '#70dbff',
                    400: '#3CC2EE', // TechSchool brand
                    500: '#2ba9d4',
                    600: '#1e8db4',
                    700: '#1a7292',
                    800: '#1a5c74',
                    900: '#1a4c61',
                },
                // Role palette — consistent across app
                role: {
                    pm:       '#8b5cf6', // violet-500
                    qa:       '#eab308', // yellow-500
                    dev:      '#3b82f6', // blue-500
                    hardware: '#22c55e', // green-500
                },
            },
            borderRadius: {
                card: '1rem',    // 16px — all cards
                dialog: '1.5rem', // 24px — modals only
            },
            boxShadow: {
                card:  '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
                hover: '0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
            },
        },
    },
    plugins: [],
} satisfies Config;
