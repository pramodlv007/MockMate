import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, CircleAlert, Pause, Play } from 'lucide-react';
import clsx from 'clsx';
import { segment } from '../lib/evidence';

// A sample answer to the bank's question b1, graded the way the real grader returns it.
const QUESTION = 'Tell me about a time you had to deliver a project under a tight deadline.';
const TRANSCRIPT =
    'Last year our team had three weeks to ship invoice export for our biggest customer. I was asked to own ' +
    'the backend. We cut the scope to CSV and built the export as a background job. It shipped two days early ' +
    'and cut export support tickets by 40 percent.';
const POINTS: { id: string; label: string; span: string | null; feedback?: string }[] = [
    { id: 'situation', label: 'Situation', span: 'our team had three weeks to ship invoice export for our biggest customer' },
    { id: 'task', label: 'Task', span: 'I was asked to own the backend' },
    { id: 'action', label: 'Action', span: 'We cut the scope to CSV and built the export as a background job' },
    { id: 'result', label: 'Result', span: 'It shipped two days early' },
    { id: 'measurable_outcome', label: 'A number', span: 'cut export support tickets by 40 percent' },
    { id: 'own_role', label: 'Your part', span: null, feedback: 'Every action is “we”. Say which part you built yourself.' },
];
const CYCLE = 3200; // motion.md --m-cycle: one point a cycle, then the next

/** The product itself in the hero: a graded answer whose rubric points light their own evidence. */
export const RubricDemo = ({ className }: { className?: string }) => {
    const reduced = useReducedMotion();
    const [sel, setSel] = useState(0);
    const [playing, setPlaying] = useState(!reduced);
    const [held, setHeld] = useState(false);
    const segs = useMemo(() => segment(TRANSCRIPT, POINTS), []);
    const covered = POINTS.filter(p => p.span).length;
    const point = POINTS[sel];

    useEffect(() => {
        if (!playing || held || reduced) return;
        const t = setInterval(() => setSel(i => (i + 1) % POINTS.length), CYCLE);
        return () => clearInterval(t);
    }, [playing, held, reduced]);

    const choose = (i: number) => { setSel(i); setPlaying(false); };

    return (
        <div
            className={clsx('relative overflow-hidden rounded-card border border-white/10 bg-surface shadow-2xl shadow-black/40', className)}
            onPointerEnter={e => e.pointerType === 'mouse' && setHeld(true)}
            onPointerLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
        >
            {/* window chrome */}
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                <div className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                </div>
                <span className="truncate text-xs font-medium text-muted">Practice · Behavioral<span className="hidden sm:inline"> · sample answer</span></span>
                <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-action/15 px-2.5 py-1 text-xs font-semibold text-action">
                    {covered} of {POINTS.length} points
                </span>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
                <p className="text-sm font-semibold text-ink">{QUESTION}</p>

                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <p className="text-[0.9rem] leading-7 text-soft">
                        {segs.map((s, i) => s.ids.length
                            ? <mark key={i} className={clsx('evidence', s.ids.includes(point.id) && 'is-on')}>{s.text}</mark>
                            : <span key={i}>{s.text}</span>)}
                    </p>

                    <ul className="flex flex-wrap gap-2 md:w-44 md:flex-col md:flex-nowrap md:gap-1" aria-label="Rubric points">
                        {POINTS.map((p, i) => (
                            <li key={p.id}>
                                <button
                                    type="button"
                                    aria-pressed={sel === i}
                                    onClick={() => choose(i)}
                                    className={clsx(
                                        'flex min-h-[44px] w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors duration-150 md:min-h-[36px]',
                                        sel === i ? 'border-white/25 bg-white/[.07] text-ink' : 'border-transparent text-soft hover:bg-white/[.04] hover:text-ink',
                                    )}
                                >
                                    {p.span
                                        ? <Check size={15} className="shrink-0 text-action" aria-label="covered" />
                                        : <CircleAlert size={15} className="shrink-0 text-accent" aria-label="missing" />}
                                    {p.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* what the chosen point says, in a fixed-height line so nothing jumps */}
                {/* pr-12 keeps the pause button's band clear of the words */}
                <div className="h-14 rounded-lg bg-black/20 py-2 pl-3 pr-12 text-sm">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.p
                            key={point.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, transition: { duration: 0.12 } }}
                            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                            className={point.span ? 'text-soft' : 'text-accent'}
                        >
                            <span className="font-semibold text-ink">{point.label}: </span>
                            {point.span ? 'covered, quoted from the answer.' : point.feedback}
                        </motion.p>
                    </AnimatePresence>
                </div>
            </div>

            {!reduced && (
                <button
                    type="button"
                    onClick={() => setPlaying(p => !p)}
                    aria-label={playing ? 'Pause the demo' : 'Play the demo'}
                    className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-ink text-bg transition-opacity duration-150 hover:opacity-90"
                >
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
            )}
        </div>
    );
};
