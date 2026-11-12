import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleAlert, Loader2, Mic, Square, RotateCcw, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { endpoints, type RubricQuestion, type RubricResult } from '../api';
import { Gauge } from '../components/Gauge';
import { segment } from '../lib/evidence';

type Stage = 'pick' | 'answer' | 'feedback' | 'report';
const STEPS: { stage: Stage; label: string }[] = [
    { stage: 'pick', label: 'Choose' }, { stage: 'answer', label: 'Answer' }, { stage: 'feedback', label: 'Review' },
];
const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ── small parts ────────────────────────────────────────────────────────────────── */

const Stepper = ({ stage }: { stage: Stage }) => {
    const at = stage === 'report' ? STEPS.length : STEPS.findIndex(s => s.stage === stage);
    return (
        <ol className="flex items-center gap-2 text-sm" aria-label={`Step ${Math.min(at + 1, STEPS.length)} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
                <li key={s.stage} className="flex items-center gap-2" aria-current={i === at ? 'step' : undefined}>
                    <span className={clsx('grid h-6 w-6 place-items-center rounded-full text-xs font-bold transition-colors duration-200',
                        i < at ? 'bg-action text-bg' : i === at ? 'bg-ink text-bg' : 'bg-white/10 text-muted')}>
                        {i < at ? <Check size={13} aria-hidden="true" /> : i + 1}
                    </span>
                    <span className={i === at ? 'font-semibold text-ink' : 'text-muted'}>{s.label}</span>
                    {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-white/15 sm:w-10" aria-hidden="true" />}
                </li>
            ))}
        </ol>
    );
};

/** taste-skill tabs: one ink pill slides to the chosen option by transform alone, 240ms */
function Segmented<T extends string>({ id, label, value, options, onChange }: {
    id: string; label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
    return (
        <div role="group" aria-label={label} className="inline-flex rounded-btn border border-white/10 bg-black/25 p-1">
            {options.map(o => (
                <button
                    key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
                    className="relative min-h-[44px] rounded-lg px-5 text-sm font-semibold"
                >
                    {value === o.value && (
                        <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-ink"
                            transition={{ duration: 0.24, ease: [0.65, 0, 0.35, 1] }} />
                    )}
                    <span className={clsx('relative transition-colors duration-150', value === o.value ? 'text-bg' : 'text-soft hover:text-ink')}>{o.label}</span>
                </button>
            ))}
        </div>
    );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Microphone recording with a live level meter. The bars are driven straight from the analyser
 * through refs (transform only), so the meter never re-renders React sixty times a second.
 */
function useRecorder(onDone: (audio: Blob) => void) {
    const [recording, setRecording] = useState(false);
    const [secs, setSecs] = useState(0);
    const bars = useRef<(HTMLSpanElement | null)[]>([]);
    const stopRef = useRef<() => void>(() => {});
    const done = useRef(onDone);
    done.current = onDone;

    const start = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks: Blob[] = [];
        const rec = new MediaRecorder(stream);
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const bins = new Uint8Array(analyser.frequencyBinCount);
        let raf = 0;
        const draw = () => {
            analyser.getByteFrequencyData(bins);
            bars.current.forEach((bar, i) => {
                if (!bar) return;
                const v = bins[2 + i * 6] / 255;                       // voice sits in the low bins
                bar.style.transform = `scaleY(${Math.max(0.12, v)})`;
            });
            raf = requestAnimationFrame(draw);
        };
        draw();
        const started = Date.now();
        const tick = setInterval(() => setSecs(Math.floor((Date.now() - started) / 1000)), 250);

        const release = () => {
            cancelAnimationFrame(raf);
            clearInterval(tick);
            stream.getTracks().forEach(t => t.stop());
            ctx.close().catch(() => {});
        };
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = () => { release(); setRecording(false); done.current(new Blob(chunks, { type: 'audio/webm' })); };
        rec.start();
        setSecs(0);
        setRecording(true);
        stopRef.current = () => rec.state !== 'inactive' && rec.stop();
        return release;
    };

    // leaving the page mid-answer stops the microphone without grading
    useEffect(() => () => { done.current = () => {}; stopRef.current(); }, []);

    return { recording, secs, bars, start, stop: () => stopRef.current() };
}

/* ── the page ───────────────────────────────────────────────────────────────────── */

export const Practice = () => {
    const [stage, setStage] = useState<Stage>('pick');
    const [type, setType] = useState<'behavioral' | 'technical'>('behavioral');
    const [role, setRole] = useState('backend');
    const [question, setQuestion] = useState<RubricQuestion | null>(null);
    const [results, setResults] = useState<{ q: RubricQuestion; r: RubricResult }[]>([]);
    const [typed, setTyped] = useState('');
    const [busy, setBusy] = useState<'' | 'audio' | 'text'>('');
    const [error, setError] = useState('');

    // mediaDevices is undefined on plain HTTP, so typing stays available as a fallback
    const canRecord = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
    const last = results[results.length - 1];

    const next = async () => {
        setError('');
        try {
            const { data } = await endpoints.getRubricQuestions(type, role);
            const seen = new Set(results.map(x => x.q.id));
            const pool = data.filter(q => !seen.has(q.id));
            if (!pool.length) { setError('No more questions in this category.'); setStage(results.length ? 'report' : 'pick'); return; }
            setQuestion(pool[Math.floor(Math.random() * pool.length)]);
            setTyped('');
            setStage('answer');
        } catch { setError('Could not load questions.'); }
    };

    const submit = async (audio: Blob | null) => {
        if (!question) return;
        setBusy(audio ? 'audio' : 'text'); setError('');
        try {
            const { data } = await endpoints.submitRubricAnswer(question.id, audio, typed);
            setResults(prev => [...prev, { q: question, r: data }]);
            setStage('feedback');
        } catch (e: any) {
            setError(e?.response?.data?.detail ?? 'Grading failed.');
        } finally { setBusy(''); }
    };

    const mic = useRecorder(blob => submit(blob));
    const record = async () => {
        setError('');
        try { await mic.start(); } catch { setError('Microphone unavailable. Type your answer instead.'); }
    };

    return (
        <div className="mx-auto max-w-4xl space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="eyebrow">Rubric practice</p>
                    <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{stage === 'report' ? 'Session report' : 'Practice an answer'}</h1>
                </div>
                {stage !== 'report' && <Stepper stage={stage} />}
            </div>

            {error && <p role="alert" className="rounded-btn border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={stage + (question?.id ?? '')}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                >
                    {/* ── 1. choose ────────────────────────────────────────────────────── */}
                    {stage === 'pick' && (
                        <div className="surface space-y-6 p-6 sm:p-8">
                            <div className="space-y-3">
                                <p className="font-semibold">What kind of question?</p>
                                <Segmented id="type" label="Question type" value={type} onChange={setType}
                                    options={[{ value: 'behavioral', label: 'Behavioral' }, { value: 'technical', label: 'Technical' }]} />
                                <p className="text-sm text-muted">
                                    {type === 'behavioral'
                                        ? 'Graded on six points: situation, task, action, result, a number, and your own part.'
                                        : 'Graded on the key ideas a strong answer covers, plus the misconceptions to avoid.'}
                                </p>
                            </div>
                            {type === 'technical' && (
                                <div className="space-y-3">
                                    <p className="font-semibold">Which track?</p>
                                    <Segmented id="role" label="Track" value={role} onChange={setRole}
                                        options={[{ value: 'backend', label: 'Backend' }, { value: 'frontend', label: 'Frontend' }]} />
                                </div>
                            )}
                            <button className="btn btn--primary btn--xl" onClick={next}>Get a question <ArrowRight size={18} className="m-arrow" aria-hidden="true" /></button>
                        </div>
                    )}

                    {/* ── 2. answer ────────────────────────────────────────────────────── */}
                    {stage === 'answer' && question && (
                        <div className="space-y-4">
                            <div className="surface p-6 sm:p-8">
                                <p className="eyebrow">Question {results.length + 1} · {question.type}</p>
                                <p className="mt-3 text-xl font-semibold leading-snug sm:text-2xl">{question.text}</p>
                                <p className="mt-3 text-sm text-muted">Aim for one to three minutes, as you would say it in the room.</p>
                            </div>

                            {busy ? (
                                <div className="surface flex items-center gap-4 p-6" aria-busy="true">
                                    <Loader2 size={22} className="animate-spin text-action" aria-hidden="true" />
                                    <p role="status" className="text-soft">
                                        {busy === 'audio' ? 'Transcribing your answer, then grading it against the rubric…' : 'Grading your answer against the rubric…'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                                    <div className="surface flex flex-col items-center justify-center gap-5 p-6 text-center">
                                        {canRecord ? (
                                            <>
                                                <div className="flex h-12 items-end gap-1.5" aria-hidden="true">
                                                    {[0, 1, 2, 3, 4, 5, 6].map(i => (
                                                        <span key={i} ref={el => { mic.bars.current[i] = el; }}
                                                            className={clsx('h-12 w-2 origin-bottom rounded-full', mic.recording ? 'bg-action' : 'bg-white/15')}
                                                            style={{ transform: 'scaleY(.12)' }} />
                                                    ))}
                                                </div>
                                                <p className="flex items-center gap-2 text-sm" role="status">
                                                    {mic.recording
                                                        ? <><span className="live-dot" aria-hidden="true" /><span>Recording</span><span className="tabular-nums text-muted" aria-hidden="true">{clock(mic.secs)}</span></>
                                                        : <span className="text-muted">Your microphone, your words</span>}
                                                </p>
                                                {mic.recording
                                                    ? <button className="btn btn--primary btn--xl w-full" onClick={mic.stop}><Square size={16} aria-hidden="true" />Stop and grade</button>
                                                    : <button className="btn btn--primary btn--xl w-full" onClick={record}><Mic size={18} aria-hidden="true" />Record answer</button>}
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted">Recording needs HTTPS. Type your answer instead.</p>
                                        )}
                                    </div>

                                    <div className="surface flex flex-col gap-3 p-6">
                                        <label htmlFor="typed-answer" className="font-semibold">{canRecord ? 'Or type it' : 'Type your answer'}</label>
                                        <textarea
                                            id="typed-answer" value={typed} onChange={e => setTyped(e.target.value)} rows={6}
                                            disabled={mic.recording} placeholder="Start with the situation…"
                                            className="input-field min-h-[150px] flex-1 resize-y"
                                        />
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-xs text-muted tabular-nums">{typed.trim() ? typed.trim().split(/\s+/).length : 0} words</span>
                                            <button className="btn btn--secondary" disabled={!typed.trim() || mic.recording} onClick={() => submit(null)}>Grade my answer</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── 3. review ────────────────────────────────────────────────────── */}
                    {stage === 'feedback' && last && (
                        <Review q={last.q} r={last.r} onNext={next} onFinish={() => setStage('report')} />
                    )}

                    {/* ── report ───────────────────────────────────────────────────────── */}
                    {stage === 'report' && (
                        <Report results={results} onRestart={() => { setResults([]); setStage('pick'); }} />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

/* ── review: the points and the sentences that earned them ──────────────────────────── */

const Review = ({ q, r, onNext, onFinish }: { q: RubricQuestion; r: RubricResult; onNext: () => void; onFinish: () => void }) => {
    const hit = r.points.filter(p => p.covered).length;
    const firstLit = r.points.find(p => p.covered && p.evidence_valid)?.point_id ?? null;
    const [sel, setSel] = useState<string | null>(firstLit);
    const segs = useMemo(
        () => segment(r.transcript, r.points.filter(p => p.covered && p.evidence_valid).map(p => ({ id: p.point_id, span: p.evidence_span }))),
        [r],
    );

    return (
        <div className="space-y-4">
            <div className="surface flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
                <Gauge value={hit} max={r.points.length} size={128}>
                    <span>
                        <span className="block text-3xl font-bold tabular-nums">{hit}/{r.points.length}</span>
                        <span className="text-xs text-muted">points</span>
                    </span>
                </Gauge>
                <div className="space-y-2">
                    <p role="status" className="text-2xl font-bold">
                        {hit === r.points.length ? 'Every rubric point covered.' : `${hit} of ${r.points.length} rubric points covered.`}
                    </p>
                    <p className="text-soft">{q.text}</p>
                    <p className="text-xs text-muted">Graded in {(r.grade_ms / 1000).toFixed(1)}s{r.asr_ms ? ` · transcribed in ${(r.asr_ms / 1000).toFixed(1)}s` : ''}</p>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <div className="surface p-6">
                    <p className="eyebrow">Your answer</p>
                    <p className="mt-3 leading-7 text-soft">
                        {segs.map((s, i) => s.ids.length
                            ? <mark key={i} className={clsx('evidence', sel && s.ids.includes(sel) && 'is-on')}>{s.text}</mark>
                            : <span key={i}>{s.text}</span>)}
                    </p>
                </div>

                <ul className="space-y-2" aria-label="Rubric points">
                    {r.points.map((p, i) => {
                        const quoted = p.covered && p.evidence_valid;
                        const row = 'flex w-full gap-3 rounded-card border p-4 text-left transition-colors duration-150';
                        const body = (
                            <>
                                {p.covered
                                    ? <Check size={18} className="mt-0.5 shrink-0 text-action" aria-label="covered" />
                                    : <CircleAlert size={18} className="mt-0.5 shrink-0 text-accent" aria-label="missing" />}
                                <span className="space-y-1">
                                    <span className="block font-semibold text-ink">{p.label}</span>
                                    <span className={clsx('block text-sm', p.covered ? 'text-muted' : 'text-accent')}>
                                        {quoted ? `“${p.evidence_span}”` : p.feedback}
                                    </span>
                                </span>
                            </>
                        );
                        return (
                            <motion.li
                                key={p.point_id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 + i * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            >
                                {/* a quoted point lights its sentence in the answer; the others are plain rows */}
                                {quoted ? (
                                    <button
                                        type="button" aria-pressed={sel === p.point_id} onClick={() => setSel(p.point_id)}
                                        className={clsx(row, sel === p.point_id ? 'border-action/50 bg-action/[.08]' : 'border-white/10 bg-surface hover:border-white/25')}
                                    >
                                        {body}
                                    </button>
                                ) : (
                                    <div className={clsx(row, 'border-accent/25 bg-surface')}>{body}</div>
                                )}
                            </motion.li>
                        );
                    })}
                </ul>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
                <button className="btn btn--primary btn--xl" onClick={onNext}>Next question <ArrowRight size={18} className="m-arrow" aria-hidden="true" /></button>
                <button className="btn btn--secondary btn--xl" onClick={onFinish}>Finish session</button>
            </div>
        </div>
    );
};

/* ── report: the whole session at a glance ───────────────────────────────────────── */

const Report = ({ results, onRestart }: { results: { q: RubricQuestion; r: RubricResult }[]; onRestart: () => void }) => {
    const hit = results.reduce((a, x) => a + x.r.points.filter(p => p.covered).length, 0);
    const total = results.reduce((a, x) => a + x.r.points.length, 0);
    return (
        <div className="space-y-4">
            <div className="surface flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
                <Gauge value={hit} max={total} size={128}>
                    <span>
                        <span className="block text-3xl font-bold tabular-nums">{total ? Math.round((hit / total) * 100) : 0}%</span>
                        <span className="text-xs text-muted">covered</span>
                    </span>
                </Gauge>
                <div>
                    <p className="text-2xl font-bold">{hit} of {total} rubric points across {results.length} {results.length === 1 ? 'answer' : 'answers'}</p>
                    <p className="mt-1 text-soft">The amber points are the ones to rehearse before the real thing.</p>
                </div>
            </div>

            {results.map(({ q, r }, i) => {
                const n = r.points.filter(p => p.covered).length;
                return (
                    <div key={q.id} className="surface space-y-4 p-6">
                        <div className="flex items-start justify-between gap-4">
                            <p className="font-semibold">{i + 1}. {q.text}</p>
                            <span className="chip shrink-0 tabular-nums">{n}/{r.points.length}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                            <motion.div className="h-full origin-left rounded-full bg-action"
                                initial={{ scaleX: 0 }} animate={{ scaleX: n / r.points.length }}
                                transition={{ duration: 0.8, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }} />
                        </div>
                        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                            {r.points.map(p => (
                                <li key={p.point_id} className="flex items-start gap-2">
                                    {p.covered
                                        ? <Check size={16} className="mt-0.5 shrink-0 text-action" aria-label="covered" />
                                        : <CircleAlert size={16} className="mt-0.5 shrink-0 text-accent" aria-label="missing" />}
                                    <span className={p.covered ? 'text-soft' : 'text-ink'}>{p.label}</span>
                                </li>
                            ))}
                        </ul>
                        {r.misconceptions.length > 0 && (
                            <div className="text-sm">
                                <p className="font-semibold">Common misconceptions</p>
                                <ul className="ml-5 mt-1 list-disc space-y-1 text-soft">{r.misconceptions.map(m => <li key={m}>{m}</li>)}</ul>
                            </div>
                        )}
                        <details className="group rounded-btn border border-white/10 px-4 py-3 text-sm">
                            <summary className="cursor-pointer font-semibold text-ink marker:text-muted">A strong sample answer</summary>
                            <p className="mt-2 leading-6 text-soft">{r.sample_answer}</p>
                        </details>
                    </div>
                );
            })}

            <button className="btn btn--primary btn--xl" onClick={onRestart}><RotateCcw size={18} aria-hidden="true" />Start a new session</button>
        </div>
    );
};
