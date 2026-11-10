import { useEffect } from 'react';

// motion.js (taste-skill) is loaded by index.html and runs once at page load, before React has drawn the hero
const MOTION_URL = '/assets/motion/motion.js';

/**
 * Plays the hero's entrance once a visit: hands the freshly mounted `.hero[data-enter]` to
 * motion.js, then drops html.m-enter so a later visit to the page shows the hero standing.
 */
export function useHeroEntrance() {
    useEffect(() => {
        const html = document.documentElement;
        if (!html.classList.contains('m-enter')) return;
        // An inline module resolves to the instance index.html already loaded. A source import() would
        // go through Vite, which refuses files from public/.
        const s = document.createElement('script');
        s.type = 'module';
        s.textContent = `import { refresh } from '${MOTION_URL}'; refresh();`;
        document.head.appendChild(s);
        const t = setTimeout(() => { html.classList.remove('m-enter'); s.remove(); }, 1300);
        return () => { clearTimeout(t); s.remove(); };
    }, []);
}
