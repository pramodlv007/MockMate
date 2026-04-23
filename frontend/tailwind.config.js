/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50:  '#eff6ff',
                    100: '#dbeafe',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    900: '#1e3a8a',
                },
                gold: {
                    300: '#fcd34d',
                    400: '#d4a843',
                    500: '#c9a855',
                    600: '#b07d2a',
                    700: '#92650f',
                },
                navy: {
                    50:  '#f0f4ff',
                    100: '#e0e9ff',
                    700: '#1a2744',
                    800: '#0d1a30',
                    900: '#080f1e',
                    950: '#050c17',
                },
                dark: {
                    bg:      '#080f1e',
                    surface: '#0d1a30',
                    text:    '#f1f5f9',
                    muted:   '#64748b',
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            animation: {
                'fade-in':    'fadeIn 0.5s ease-out',
                'slide-up':   'slideUp 0.5s ease-out',
                'pulse-slow': 'pulse 3s infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%':   { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%':   { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                }
            }
        },
    },
    plugins: [],
}
