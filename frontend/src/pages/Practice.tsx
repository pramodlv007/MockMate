import { useRef, useState } from 'react';
import { endpoints, type RubricQuestion, type RubricResult } from '../api';

type Stage = 'pick' | 'answer' | 'feedback' | 'report';

export const Practice = () => {
    const [stage, setStage] = useState<Stage>('pick');
    const [type, setType] = useState<'behavioral' | 'technical'>('behavioral');
    const [role, setRole] = useState('backend');
    const [question, setQuestion] = useState<RubricQuestion | null>(null);
    const [results, setResults] = useState<{ q: RubricQuestion; r: RubricResult }[]>([]);
    const [recording, setRecording] = useState(false);
    const [typed, setTyped] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const recorder = useRef<MediaRecorder | null>(null);
    const chunks = useRef<Blob[]>([]);

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
        setBusy(true); setError('');
        try {
            const { data } = await endpoints.submitRubricAnswer(question.id, audio, typed);
            setResults(prev => [...prev, { q: question, r: data }]);
            setStage('feedback');
        } catch (e: any) {
            setError(e?.response?.data?.detail ?? 'Grading failed.');
        } finally { setBusy(false); }
    };

    const toggleRecording = async () => {
        if (recording) { recorder.current?.stop(); setRecording(false); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            chunks.current = [];
            const rec = new MediaRecorder(stream);
            rec.ondataavailable = e => chunks.current.push(e.data);
            rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); submit(new Blob(chunks.current, { type: 'audio/webm' })); };
            rec.start();
            recorder.current = rec;
            setRecording(true);
        } catch { setError('Microphone unavailable. Type your answer instead.'); }
    };

    const card = 'rounded-2xl p-6 space-y-4';
    const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' };
    const btn = 'px-5 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40';
    const btnStyle = { background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)' };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {error && <div className="text-sm text-red-400">{error}</div>}

            {stage === 'pick' && (
                <div className={card} style={cardStyle}>
                    <h1 className="text-xl font-bold">Practice an answer</h1>
                    <div className="flex gap-3">
                        <select value={type} onChange={e => setType(e.target.value as any)} className="bg-transparent border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                            <option className="text-black" value="behavioral">Behavioral</option>
                            <option className="text-black" value="technical">Technical</option>
                        </select>
                        {type === 'technical' && (
                            <select value={role} onChange={e => setRole(e.target.value)} className="bg-transparent border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                                <option className="text-black" value="backend">Backend</option>
                                <option className="text-black" value="frontend">Frontend</option>
                            </select>
                        )}
                    </div>
                    <button className={btn} style={btnStyle} onClick={next}>Get a question</button>
                </div>
            )}

            {stage === 'answer' && question && (
                <div className={card} style={cardStyle}>
                    <div className="text-xs uppercase tracking-wider text-slate-400">Question {results.length + 1}</div>
                    <p className="text-lg font-medium">{question.text}</p>
                    <p className="text-xs text-slate-400">Aim for 60–180 seconds.</p>
                    {canRecord && (
                        <button disabled={busy} className={btn} style={{ ...btnStyle, background: recording ? '#ef4444' : btnStyle.background }} onClick={toggleRecording}>
                            {recording ? 'Stop and grade' : 'Record answer'}
                        </button>
                    )}
                    <textarea value={typed} onChange={e => setTyped(e.target.value)} rows={4} placeholder={canRecord ? 'Or type your answer…' : 'Recording needs HTTPS — type your answer…'}
                        className="w-full bg-transparent border rounded-lg p-3 text-sm" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
                    <button disabled={busy || !typed.trim()} className={btn} style={btnStyle} onClick={() => submit(null)}>Grade typed answer</button>
                    {busy && <div className="text-sm text-slate-400 animate-pulse">Grading…</div>}
                </div>
            )}

            {stage === 'feedback' && last && (
                <div className={card} style={cardStyle}>
                    <p className="font-medium">{last.q.text}</p>
                    <ul className="space-y-3">
                        {last.r.points.map(p => (
                            <li key={p.point_id} className="text-sm">
                                <span style={{ color: p.covered ? '#34d399' : '#f87171' }}>{p.covered ? '✓' : '✗'}</span> {p.label}
                                {p.covered && p.evidence_valid && <blockquote className="ml-5 mt-1 italic text-slate-400">“{p.evidence_span}”</blockquote>}
                                {!p.covered && <div className="ml-5 text-slate-400">{p.feedback}</div>}
                            </li>
                        ))}
                    </ul>
                    <div className="text-xs text-slate-500">Graded in {(last.r.grade_ms / 1000).toFixed(1)}s</div>
                    <div className="flex gap-3">
                        <button className={btn} style={btnStyle} onClick={next}>Next question</button>
                        <button className={btn} style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => setStage('report')}>Finish session</button>
                    </div>
                </div>
            )}

            {stage === 'report' && (
                <div className="space-y-4">
                    <h1 className="text-xl font-bold">Session report</h1>
                    {results.map(({ q, r }, i) => (
                        <div key={q.id} className={card} style={cardStyle}>
                            <p className="font-medium">{i + 1}. {q.text}</p>
                            <p className="text-sm text-slate-400">{r.points.filter(p => p.covered).length}/{r.points.length} rubric points covered</p>
                            <ul className="text-sm space-y-1">
                                {r.points.map(p => <li key={p.point_id}><span style={{ color: p.covered ? '#34d399' : '#f87171' }}>{p.covered ? '✓' : '✗'}</span> {p.label}</li>)}
                            </ul>
                            {r.misconceptions.length > 0 && (
                                <div className="text-sm"><div className="text-slate-400">Common misconceptions</div>
                                    <ul className="list-disc ml-5">{r.misconceptions.map(m => <li key={m}>{m}</li>)}</ul></div>
                            )}
                            <div className="text-sm"><div className="text-slate-400">Sample strong answer (reading material)</div>{r.sample_answer}</div>
                        </div>
                    ))}
                    <button className={btn} style={btnStyle} onClick={() => { setResults([]); setStage('pick'); }}>New session</button>
                </div>
            )}
        </div>
    );
};
