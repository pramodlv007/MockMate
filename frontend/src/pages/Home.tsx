import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { ArrowRight, Mic, Video } from 'lucide-react';
import { endpoints, type InterviewSession } from '../api';
import { useAuth } from '../context/AuthContext';
import { RubricDemo } from '../components/RubricDemo';
import { Gauge, toneOf } from '../components/Gauge';
import { useHeroEntrance } from '../lib/motion';

const STATEMENT = "Interviewers don't grade the answer you meant to give. They grade the one you said.";

/** The page's one dealt moment (taste-skill word-highlight): the statement lights word by word
 *  while its own section is pinned. Dim words keep 4.5:1, and reduced motion shows it lit. */
const WordHighlight = () => {
    const ref = useRef<HTMLElement>(null);
    const reduced = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
    const words = STATEMENT.split(' ');
    return (
        <section ref={ref} data-moment="word-highlight" aria-labelledby="moment-h" className="relative h-[170vh] border-y border-white/10 bg-[#0b1222]">
            <div className="sticky top-16 mx-auto flex h-[calc(100svh-4rem)] max-w-5xl items-center px-4 sm:px-6">
                <h2 id="moment-h" className="text-[2.2rem] font-bold leading-[1.15] sm:text-6xl">
                    {reduced
                        ? STATEMENT
                        : words.map((w, i) => <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>{w}</Word>)}
                </h2>
            </div>
        </section>
    );
};

const Word = ({ progress, range, children }: { progress: MotionValue<number>; range: [number, number]; children: string }) => {
    const color = useTransform(progress, range, ['#94a3b8', '#f8fafc']);
    return <motion.span style={{ color }}>{children} </motion.span>;
};

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const Home = () => {
    useHeroEntrance();
    const { user } = useAuth();
    const [sessions, setSessions] = useState<InterviewSession[] | null>(null);

    useEffect(() => {
        endpoints.getUserInterviews().then(r => setSessions(r.data)).catch(() => setSessions([]));
    }, []);

    const firstName = user?.full_name?.trim().split(/\s+/)[0];
    const scored = (sessions ?? []).filter(s => (s.overall_score ?? 0) > 0);
    const avg = scored.length ? Math.round(scored.reduce((a, s) => a + (s.overall_score ?? 0), 0) / scored.length) : null;
    const best = scored.length ? Math.max(...scored.map(s => s.overall_score ?? 0)) : null;
    const recent = [...(sessions ?? [])].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 3);

    return (
        <div>
            {/* ── hero: enters once a visit; the product itself is the picture ─────────────── */}
            <section className="hero ground-lit relative overflow-hidden border-b border-white/10" data-enter aria-labelledby="home-h">
                <div className="ground-grid pointer-events-none absolute inset-0" aria-hidden="true" />
                <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:py-20">
                    <div className="space-y-6">
                        <p className="eyebrow">Welcome back{firstName ? `, ${firstName}` : ''}</p>
                        <h1 id="home-h" className="text-[2.5rem] font-extrabold leading-[1.04] sm:text-6xl">
                            Interview practice for software engineers
                        </h1>
                        <p className="max-w-lg text-lg text-soft">
                            Answer out loud and get graded against a rubric: six points for every behavioral answer,
                            each one quoted from what you said, and a fix for the ones you missed.
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link to="/new-interview" className="btn btn--primary btn--xl">Start a mock interview</Link>
                            <Link to="/practice" className="btn btn--secondary btn--xl">Practice one question</Link>
                        </div>
                    </div>
                    <RubricDemo className="hero__window" />
                </div>
            </section>

            {/* ── your practice: only real numbers from your own sessions ──────────────────── */}
            <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="progress-h">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <h2 id="progress-h" className="text-3xl font-bold sm:text-4xl">Your practice so far</h2>
                    {!!sessions?.length && <Link to="/history" className="link">All sessions</Link>}
                </div>

                {sessions === null ? (
                    <div className="mt-8 grid gap-4 md:grid-cols-3" aria-busy="true" aria-label="Loading your sessions">
                        {[0, 1, 2].map(i => <div key={i} className="h-36 animate-pulse rounded-card bg-white/5" />)}
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="surface mt-8 flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-lg font-semibold">No sessions yet.</p>
                            <p className="mt-1 text-soft">Your scores and recent interviews show up here after your first one.</p>
                        </div>
                        <Link to="/practice" className="btn btn--primary">Practice one question</Link>
                    </div>
                ) : (
                    <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                        <div className="surface flex items-center gap-6">
                            <Gauge value={avg ?? 0} max={100} size={112} still>
                                <span>
                                    <span className="block text-3xl font-bold tabular-nums">{avg ?? '–'}</span>
                                    <span className="text-xs text-muted">of 100</span>
                                </span>
                            </Gauge>
                            <dl className="space-y-3">
                                <div><dt className="text-sm text-muted">Average score</dt><dd className="font-semibold">{avg === null ? 'No scores yet' : `${avg} across ${scored.length} scored`}</dd></div>
                                <div><dt className="text-sm text-muted">Best</dt><dd className="font-semibold tabular-nums">{best ?? '–'}</dd></div>
                                <div><dt className="text-sm text-muted">Sessions</dt><dd className="font-semibold tabular-nums">{sessions.length}</dd></div>
                            </dl>
                        </div>

                        <ul className="grid gap-3" aria-label="Recent sessions">
                            {recent.map(s => (
                                <li key={s.id}>
                                    <Link to={`/results/${s.id}`} className="card flex items-center gap-4 px-5 py-4">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-semibold">{s.company_name}{s.target_role ? ` · ${s.target_role}` : ''}</p>
                                            <p className="text-sm text-muted">{when(s.created_at)} · {s.questions_count} questions</p>
                                        </div>
                                        {(s.overall_score ?? 0) > 0
                                            ? <span className="text-lg font-bold tabular-nums" style={{ color: toneOf((s.overall_score ?? 0) / 100) }}>{s.overall_score}</span>
                                            : <span className="chip">{s.status === 'error' ? 'Not scored' : 'Evaluating'}</span>}
                                        <ArrowRight size={18} className="m-arrow shrink-0 text-muted" aria-hidden="true" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            {/* ── two ways to practice ─────────────────────────────────────────────────────── */}
            <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6" aria-labelledby="modes-h">
                <h2 id="modes-h" className="text-3xl font-bold sm:text-4xl">Two ways to practice</h2>
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                    <Link to="/new-interview" className="card group flex flex-col gap-4 p-7">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-action/15 text-action"><Video size={22} aria-hidden="true" /></span>
                        <h3 className="text-xl font-semibold">Full mock interview</h3>
                        <p className="text-soft">
                            Paste a job description and add your resume. MockMate writes questions about your own
                            projects, you answer on camera, and you get a score for each answer plus a 7-day plan.
                        </p>
                        <span className="mt-auto inline-flex items-center gap-2 font-semibold text-action">Start a mock interview <ArrowRight size={18} className="m-arrow" aria-hidden="true" /></span>
                    </Link>
                    <Link to="/practice" className="card group flex flex-col gap-4 p-7">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent"><Mic size={22} aria-hidden="true" /></span>
                        <h3 className="text-xl font-semibold">Rubric practice</h3>
                        <p className="text-soft">
                            One behavioral or technical question at a time. Answer by voice or by typing, then see
                            which rubric points you hit, the sentence that earned each one, and what to add.
                        </p>
                        <span className="mt-auto inline-flex items-center gap-2 font-semibold text-accent">Practice one question <ArrowRight size={18} className="m-arrow" aria-hidden="true" /></span>
                    </Link>
                </div>
            </section>

            <WordHighlight />

            {/* ── close ─────────────────────────────────────────────────────────────────────── */}
            <section className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-24 sm:px-6" aria-labelledby="close-h">
                <h2 id="close-h" className="max-w-3xl text-4xl font-extrabold sm:text-5xl">Say it out loud before it counts.</h2>
                <p className="max-w-xl text-lg text-soft">A practice question takes a couple of minutes, and the feedback names the exact sentence to keep or fix.</p>
                <Link to="/practice" className="btn btn--primary btn--xl">Practice one question</Link>
            </section>
        </div>
    );
};
