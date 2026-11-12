/** @type {import('tailwindcss').Config} */
// Design system: ui-ux-pro-max "Dark Mode (OLED)" for an AI interview-practice SaaS:
// code green (covered / primary action) + difficulty amber (missing / accent) on slate.
// Semantic colours read the CSS variables in index.css so opacity modifiers (bg-action/10) work.
const v = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg:      v('bg'),
                surface: v('card'),
                ink:     v('ink'),
                soft:    v('ink-2'),
                muted:   v('muted-ink'),
                action:  v('action'),
                accent:  v('accent'),
                danger:  v('danger'),
                // legacy names used across older pages, remapped onto the system
                primary: {
                    50: '#f0fdf4', 100: '#dcfce7', 400: '#4ade80', 500: '#22c55e',
                    600: '#16a34a', 700: '#15803d', 900: '#14532d',
                },
                gold: { 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
                navy: {
                    50: '#f8fafc', 100: '#f1f5f9', 700: '#1e293b',
                    800: '#192134', 900: '#0f172a', 950: '#0b1222',
                },
                dark: { bg: '#0f172a', surface: '#192134', text: '#f8fafc', muted: '#94a3b8' },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
            },
            borderRadius: {
                btn: 'var(--r-btn)',
                card: 'var(--r-card)',
            },
            transitionTimingFunction: {
                ui: 'cubic-bezier(.2,.8,.2,1)',
                enter: 'cubic-bezier(.22,1,.36,1)',
            },
        },
    },
    plugins: [],
}
