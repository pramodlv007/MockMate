import { motion } from 'framer-motion';

/** green from 70%, amber from 40%, red below: colour backs up the number, never replaces it */
export const toneOf = (ratio: number) =>
    ratio >= 0.7 ? 'var(--action)' : ratio >= 0.4 ? 'var(--accent)' : 'var(--danger)';

/**
 * A ring that fills once to `value / max` when it appears. The figure and its meaning are
 * always printed as text beside or inside it (ui-ux-pro-max: a gauge never speaks in colour alone).
 */
export const Gauge = ({ value, max, size = 120, stroke = 10, still = false, children }: {
    value: number; max: number; size?: number; stroke?: number;
    /** a summary that was already true before the visit: drawn at rest, no fill */
    still?: boolean; children?: React.ReactNode;
}) => {
    const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (
        <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / .08)" strokeWidth={stroke} />
                <motion.circle
                    cx={size / 2} cy={size / 2} r={r} fill="none" stroke={toneOf(ratio)} strokeWidth={stroke}
                    strokeLinecap="round" strokeDasharray={c}
                    initial={{ strokeDashoffset: still ? c * (1 - ratio) : c }}
                    animate={{ strokeDashoffset: c * (1 - ratio) }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
        </div>
    );
};
