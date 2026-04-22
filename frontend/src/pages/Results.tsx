import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { endpoints } from '../api';
import type { InterviewSession, EvaluationFeedback, PerQuestionResult, Mistake } from '../api';
import {
    CheckCircle, RefreshCw, ChevronLeft, ChevronDown, ChevronUp,
    Target, Eye, MessageSquare, Clock, AlertTriangle,
    Calendar, Lightbulb, FileText, Award, BarChart3,
    Mic, TrendingUp, TrendingDown, Minus, ArrowRight,
    XCircle, ShieldCheck, ShieldAlert, User
} from 'lucide-react';

// ── Circular Score Ring ────────────────────────────────────────────────────────
const ScoreRing = ({ score, size = 80, label, color }: { score: number; size?: number; label: string; color: string }) => {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="5" fill="none" />
                    <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth="5" fill="none"
                        strokeDasharray={circumference} strokeDashoffset={offset}
                        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-white">{score}</span>
                </div>
            </div>
            <span className="text-xs text-slate-400 uppercase tracking-wide text-center">{label}</span>
        </div>
    );
};

// ── Dimension Bar ─────────────────────────────────────────────────────────────
const DimBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 w-36 text-right shrink-0">{label}</span>
        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${value}%`, background: color }} />
        </div>
        <span className="text-xs text-white w-8 text-right">{value}</span>
    </div>
);

// ── Score Color Helper ────────────────────────────────────────────────────────
const scoreColor = (n: number) => n >= 70 ? '#10b981' : n >= 40 ? '#f59e0b' : '#ef4444';
const scoreBg    = (n: number) => n >= 70 ? 'rgba(16,185,129,0.12)' : n >= 40 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';

const hireColor = (rec: string) =>
    rec.includes('Strong Yes') ? '#10b981' : rec === 'Yes' ? '#34d399' :
    rec === 'Maybe' ? '#f59e0b' : rec === 'No' ? '#ef4444' : '#dc2626';

// ── Category Dot ──────────────────────────────────────────────────────────────
const CategoryDot = ({ cat }: { cat: string }) => {
    const map: Record<string, { color: string; label: string }> = {
        STRONG:   { color: '#10b981', label: 'Strong' },
        ADEQUATE: { color: '#f59e0b', label: 'Adequate' },
        WEAK:     { color: '#ef4444', label: 'Weak' },
    };
    const { color, label } = map[cat] || { color: '#94a3b8', label: cat };
    return (
        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-semibold uppercase"
            style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
            {label}
        </span>
    );
};

// ── Collapsible Ideal Answer ──────────────────────────────────────────────────
const IdealAnswer = ({ outline }: { outline: string }) => {
    const [open, setOpen] = useState(false);
    if (!outline || outline === 'N/A') return null;
    return (
        <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(139,92,246,0.2)' }}>
            <button onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors"
                style={{ background: 'rgba(139,92,246,0.08)', color: '#a78bfa' }}>
                <span className="flex items-center gap-1.5"><Lightbulb size={12} /> Ideal Answer Outline</span>
                {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {open && (
                <div className="px-3 py-3" style={{ background: 'rgba(139,92,246,0.04)' }}>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{outline}</p>
                </div>
            )}
        </div>
    );
};

// ── Question Card ─────────────────────────────────────────────────────────────
const QuestionCard = ({ pq, idx }: { pq: PerQuestionResult; idx: number }) => {
    const [expanded, setExpanded] = useState(idx === 0);
    const sc = scoreColor(pq.overall);
    const sb = scoreBg(pq.overall);

    return (
        <div className="card" style={{ borderLeft: `3px solid ${sc}` }}>
            {/* Header (always visible) */}
            <button className="w-full text-left" onClick={() => setExpanded(e => !e)}>
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: sb, color: sc }}>{pq.overall}</div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <CategoryDot cat={pq.category} />
                            <span className="text-xs text-slate-500">Q{idx + 1}</span>
                        </div>
                        <p className="text-white text-sm font-medium leading-snug">{pq.question}</p>
                    </div>
                    <div className="shrink-0 text-slate-500">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                </div>
            </button>

            {/* Expanded body */}
            {expanded && (
                <div className="mt-4 space-y-4">
                    {/* Your answer */}
                    {pq.answer_summary && (
                        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div className="text-xs text-slate-500 mb-1.5">Your Answer</div>
                            <p className="text-sm text-slate-300">{pq.answer_summary}</p>
                        </div>
                    )}

                    {/* Dimension bars */}
                    <div className="space-y-2.5">
                        {([
                            { key: 'technical_accuracy', label: 'Technical Accuracy', color: '#10b981' },
                            { key: 'depth',              label: 'Depth',              color: '#06b6d4' },
                            { key: 'relevance',          label: 'Relevance',          color: '#8b5cf6' },
                            { key: 'structure',          label: 'Structure',          color: '#f59e0b' },
                            { key: 'resume_alignment',   label: 'Resume Alignment',   color: '#ec4899' },
                        ] as { key: keyof PerQuestionResult['scores']; label: string; color: string }[]).map(({ key, label, color }) => (
                            <DimBar key={key} label={label} value={pq.scores?.[key] ?? 0} color={color} />
                        ))}
                    </div>

                    {/* What was good */}
                    {pq.what_was_good && pq.what_was_good !== 'N/A — no substantive answer provided' && (
                        <div className="rounded-lg p-3 text-sm text-slate-300"
                            style={{ background: 'rgba(16,185,129,0.05)', borderLeft: '2px solid rgba(16,185,129,0.3)' }}>
                            <div className="text-xs text-emerald-400 mb-1 flex items-center gap-1"><CheckCircle size={11} /> What Worked</div>
                            {pq.what_was_good}
                        </div>
                    )}

                    {/* What was missing */}
                    {pq.what_was_missing && (
                        <div className="rounded-lg p-3 text-sm text-slate-300"
                            style={{ background: 'rgba(245,158,11,0.05)', borderLeft: '2px solid rgba(245,158,11,0.3)' }}>
                            <div className="text-xs text-amber-400 mb-1 flex items-center gap-1"><AlertTriangle size={11} /> What Was Missing</div>
                            {pq.what_was_missing}
                        </div>
                    )}

                    {/* Resume gap flag */}
                    {pq.resume_gap_flag && (
                        <div className="rounded-lg p-3 flex items-start gap-2"
                            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <ShieldAlert size={14} className="text-red-400 shrink-0 mt-0.5" />
                            <div>
                                <div className="text-xs text-red-400 font-semibold mb-0.5">Resume Gap</div>
                                <p className="text-xs text-red-300">{pq.resume_gap_flag}</p>
                            </div>
                        </div>
                    )}

                    <IdealAnswer outline={pq.ideal_answer_outline} />
                </div>
            )}
        </div>
    );
};


export const Results = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [session, setSession] = useState<InterviewSession | null>(null);
    const [feedback, setFeedback] = useState<EvaluationFeedback | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'mistakes' | 'training' | 'speech'>('overview');

    useEffect(() => {
        if (!id) return;
        const fetch = async () => {
            try {
                const { data } = await endpoints.getInterview(id);
                setSession(data);
                if ((data.status === 'evaluated' || data.status === 'completed') && data.feedback_summary) {
                    try { setFeedback(JSON.parse(data.feedback_summary)); } catch { /* ignore */ }
                }
            } catch (e) { console.error('Failed to fetch session:', e); }
        };
        fetch();
        const iv = setInterval(() => {
            if (!session || (session.status !== 'evaluated' && session.status !== 'completed')) fetch();
        }, 3000);
        return () => clearInterval(iv);
    }, [id, session?.status]);

    if (!session) return (
        <div className="text-center pt-20 text-emerald-400 animate-pulse text-lg">Loading Results...</div>
    );

    if (session.status === 'evaluating' || session.status === 'generated' || session.status === 'created') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-in">
                <div className="w-20 h-20 rounded-full animate-spin"
                    style={{ border: '3px solid rgba(16,185,129,0.2)', borderTopColor: '#10b981' }} />
                <div className="text-center space-y-3">
                    <h2 className="text-2xl font-bold text-white">Analyzing Your Performance</h2>
                    <p className="text-slate-400">AI is evaluating your video, speech, and body language...</p>
                    <div className="flex justify-center gap-6 mt-4 text-sm text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1.5"><Mic size={14} /> Transcribing</span>
                        <span className="flex items-center gap-1.5"><Eye size={14} /> Analyzing body language</span>
                        <span className="flex items-center gap-1.5"><BarChart3 size={14} /> Scoring answers</span>
                    </div>
                </div>
            </div>
        );
    }

    const pqResults: PerQuestionResult[] = feedback?.per_question_results ?? [];
    const speechMetrics = feedback?.speech_metrics;
    const nonVerbal = feedback?.non_verbal_dashboard;
    const mistakes: Mistake[] = feedback?.top_mistakes ?? [];
    const trainingPlan = feedback?.training_plan_7_day ?? {};
    const overallScore = feedback?.overall_score ?? session.overall_score ?? 0;
    const hireRec = feedback?.hire_recommendation ?? 'N/A';
    const breakdown = feedback?.score_breakdown;
    const resumeAlign = feedback?.resume_alignment_summary;
    const roleComp = feedback?.comparison_to_role;

    const tabs = [
        { key: 'overview',   label: 'Overview',      icon: Target },
        { key: 'questions',  label: 'Per-Question',  icon: FileText },
        { key: 'mistakes',   label: 'Mistakes',      icon: AlertTriangle },
        { key: 'training',   label: '7-Day Plan',    icon: Calendar },
        { key: 'speech',     label: 'Speech & Body', icon: Mic },
    ] as const;

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-slide-up pb-12">

            {/* ── Hero Header ──────────────────────────────────────────────── */}
            <div className="card glow-emerald" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(6,182,212,0.05) 100%)' }}>
                <div className="flex items-start justify-between gap-6 flex-wrap">
                    <div className="space-y-3">
                        <h1 className="text-3xl font-bold text-white">Interview Analysis</h1>
                        <p className="text-slate-400">{session.company_name}{session.target_role ? ` — ${session.target_role}` : ''}</p>
                        {hireRec !== 'N/A' && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold"
                                style={{ background: `${hireColor(hireRec)}18`, color: hireColor(hireRec), border: `1px solid ${hireColor(hireRec)}35` }}>
                                <Award size={14} /> {hireRec}
                            </div>
                        )}
                        {feedback?.executive_summary && (
                            <p className="text-slate-300 text-sm max-w-xl leading-relaxed">{feedback.executive_summary}</p>
                        )}
                    </div>
                    <div className="text-center shrink-0">
                        <div className="text-6xl font-extrabold text-gradient">{overallScore}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Overall Score</div>
                    </div>
                </div>
            </div>

            {/* ── Tab Navigation ───────────────────────────────────────────── */}
            <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.03)' }}>
                {tabs.map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setActiveTab(key)}
                        className={`flex-1 min-w-max flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                            activeTab === key
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}>
                        <Icon size={15} /> {label}
                    </button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB 1: OVERVIEW                                               */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-fade-in">

                    {/* Score Breakdown Cards */}
                    {breakdown && (
                        <div className="grid md:grid-cols-3 gap-4">
                            {/* Content */}
                            <div className="card flex flex-col items-center gap-4 py-6">
                                <ScoreRing score={breakdown.content.score} label="Content" color="#10b981" size={88} />
                                <div className="text-center space-y-1">
                                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">{breakdown.content.weight} weight</div>
                                    <p className="text-xs text-slate-400">{breakdown.content.explanation}</p>
                                </div>
                            </div>
                            {/* Communication */}
                            <div className="card flex flex-col items-center gap-4 py-6">
                                <ScoreRing score={breakdown.communication.score} label="Communication" color="#06b6d4" size={88} />
                                <div className="w-full space-y-1 text-center">
                                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">{breakdown.communication.weight} weight</div>
                                    {breakdown.communication.penalties.map((p, i) => (
                                        <div key={i} className="text-xs px-2 py-0.5 rounded"
                                            style={{ background: p.startsWith('No penalties') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', color: p.startsWith('No penalties') ? '#10b981' : '#f87171' }}>
                                            {p}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Presence */}
                            <div className="card flex flex-col items-center gap-4 py-6">
                                <ScoreRing score={breakdown.presence.score} label="Presence" color="#8b5cf6" size={88} />
                                <div className="w-full space-y-2">
                                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wider text-center mb-2">{breakdown.presence.weight} weight</div>
                                    {([
                                        { label: 'Eye Contact', key: 'eye_contact', color: '#10b981' },
                                        { label: 'Posture',     key: 'posture',     color: '#06b6d4' },
                                        { label: 'Engagement',  key: 'engagement',  color: '#8b5cf6' },
                                    ] as { label: string; key: keyof typeof breakdown.presence.components; color: string }[]).map(({ label, key, color }) => (
                                        <div key={key} className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400 w-20 text-right">{label}</span>
                                            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                                <div className="h-full rounded-full" style={{ width: `${breakdown.presence.components[key]}%`, background: color }} />
                                            </div>
                                            <span className="text-xs text-white w-8">{breakdown.presence.components[key]}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Resume Alignment */}
                    {resumeAlign && (
                        <div className="card">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                                <User className="text-emerald-400" size={18} /> Resume Alignment
                            </h3>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="rounded-lg p-4" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-3">
                                        <ShieldCheck size={13} /> Verified Claims
                                    </div>
                                    {resumeAlign.verified_claims.length > 0
                                        ? resumeAlign.verified_claims.map((c, i) => (
                                            <div key={i} className="flex items-start gap-1.5 text-xs text-slate-300 mb-1.5">
                                                <CheckCircle size={11} className="text-emerald-400 shrink-0 mt-0.5" />{c}
                                            </div>
                                        ))
                                        : <p className="text-xs text-slate-500">None identified</p>
                                    }
                                </div>
                                <div className="rounded-lg p-4" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                                    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold mb-3">
                                        <ShieldAlert size={13} /> Unverified Claims
                                    </div>
                                    {resumeAlign.unverified_claims.length > 0
                                        ? resumeAlign.unverified_claims.map((c, i) => (
                                            <div key={i} className="flex items-start gap-1.5 text-xs text-slate-300 mb-1.5">
                                                <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" />{c}
                                            </div>
                                        ))
                                        : <p className="text-xs text-slate-500">None — great alignment</p>
                                    }
                                </div>
                                <div className="rounded-lg p-4" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                    <div className="flex items-center gap-1.5 text-xs text-red-400 font-semibold mb-3">
                                        <XCircle size={13} /> JD Gaps
                                    </div>
                                    {resumeAlign.gaps_vs_jd.length > 0
                                        ? resumeAlign.gaps_vs_jd.map((g, i) => (
                                            <div key={i} className="flex items-start gap-1.5 text-xs text-slate-300 mb-1.5">
                                                <Minus size={11} className="text-red-400 shrink-0 mt-0.5" />{g}
                                            </div>
                                        ))
                                        : <p className="text-xs text-slate-500">No gaps — well matched</p>
                                    }
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Role Fit */}
                    {roleComp && (
                        <div className="card">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                                <Target className="text-cyan-400" size={18} /> Role Fit
                            </h3>
                            <div className="grid md:grid-cols-3 gap-4">
                                {([
                                    { label: 'Meets Requirements',   items: roleComp.meets_requirements,   color: '#10b981', Icon: CheckCircle },
                                    { label: 'Below Requirements',   items: roleComp.below_requirements,   color: '#f59e0b', Icon: TrendingDown },
                                    { label: 'Exceeds Requirements', items: roleComp.exceeds_requirements, color: '#06b6d4', Icon: TrendingUp },
                                ] as { label: string; items: string[]; color: string; Icon: React.ComponentType<{ size: number }> }[]).map(({ label, items, color, Icon }) => (
                                    <div key={label}>
                                        <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color }}>
                                            <Icon size={13} /> {label}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {items.length > 0
                                                ? items.map((item, i) => (
                                                    <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                                                        style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
                                                        {item}
                                                    </span>
                                                ))
                                                : <span className="text-xs text-slate-500">None noted</span>
                                            }
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Strengths & Improvements */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="card" style={{ borderLeft: '3px solid #10b981' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle className="text-emerald-400" size={20} />
                                <h3 className="text-lg font-semibold text-white">Strengths</h3>
                            </div>
                            <ul className="space-y-2">
                                {(feedback?.strengths ?? []).length > 0
                                    ? (feedback?.strengths ?? []).map((s, i) => (
                                        <li key={i} className="flex gap-2 text-slate-300 text-sm">
                                            <ArrowRight size={14} className="text-emerald-400 shrink-0 mt-0.5" />{s}
                                        </li>
                                    ))
                                    : <li className="text-slate-500 text-sm">No specific strengths detected</li>
                                }
                            </ul>
                        </div>
                        <div className="card" style={{ borderLeft: '3px solid #f59e0b' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <Lightbulb className="text-amber-400" size={20} />
                                <h3 className="text-lg font-semibold text-white">Key Improvements</h3>
                            </div>
                            <ul className="space-y-2">
                                {(feedback?.critical_improvements ?? []).length > 0
                                    ? (feedback?.critical_improvements ?? []).map((r, i) => (
                                        <li key={i} className="flex gap-2 text-slate-300 text-sm">
                                            <ArrowRight size={14} className="text-amber-400 shrink-0 mt-0.5" />{r}
                                        </li>
                                    ))
                                    : <li className="text-slate-500 text-sm">No specific improvements noted</li>
                                }
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB 2: PER-QUESTION                                           */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'questions' && (
                <div className="space-y-4 animate-fade-in">
                    <h3 className="text-xl font-semibold flex items-center gap-2 text-white">
                        <BarChart3 className="text-emerald-400" size={22} /> Question-by-Question Breakdown
                    </h3>
                    {pqResults.length > 0
                        ? pqResults.map((pq, i) => <QuestionCard key={i} pq={pq} idx={i} />)
                        : session.questions.map((q, i) => (
                            <div key={q.id} className="card">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                                        style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>{i + 1}</div>
                                    <div className="flex-1">
                                        <p className="text-white font-medium text-sm mb-2">{q.content}</p>
                                        {q.transcript && (
                                            <div className="rounded-lg p-3 mt-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                                <div className="text-xs text-slate-500 mb-1">Your answer:</div>
                                                <p className="text-sm text-slate-300">{q.transcript}</p>
                                            </div>
                                        )}
                                        {q.score != null && (
                                            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                                                style={{ background: scoreBg(q.score), color: scoreColor(q.score) }}>
                                                Score: {q.score}/100
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    }
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB 3: MISTAKES                                               */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'mistakes' && (
                <div className="space-y-4 animate-fade-in">
                    <h3 className="text-xl font-semibold flex items-center gap-2 text-white">
                        <AlertTriangle className="text-red-400" size={22} /> Mistakes & Better Approaches
                    </h3>
                    {mistakes.length === 0 ? (
                        <div className="card text-center text-slate-400 py-10">
                            <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
                            No specific mistakes identified — great performance!
                        </div>
                    ) : (
                        mistakes.map((m, i) => (
                            <div key={i} className="card" style={{ borderLeft: '3px solid #ef4444' }}>
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 text-sm"
                                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{i + 1}</div>
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs px-2 py-0.5 rounded-full uppercase font-semibold"
                                                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                                                {m.type || 'Issue'}
                                            </span>
                                            {m.question_index >= 0 && (
                                                <span className="text-xs px-2 py-0.5 rounded-full"
                                                    style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                                                    Question {m.question_index + 1}
                                                </span>
                                            )}
                                        </div>
                                        {m.quote && (
                                            <div className="rounded-lg p-3"
                                                style={{ background: 'rgba(239,68,68,0.05)', borderLeft: '2px solid rgba(239,68,68,0.3)' }}>
                                                <div className="text-xs text-slate-500 mb-1">What you said:</div>
                                                <p className="text-slate-300 italic text-sm">"{m.quote}"</p>
                                            </div>
                                        )}
                                        <div>
                                            <div className="text-xs text-slate-500 mb-1">Problem:</div>
                                            <p className="text-slate-300 text-sm">{m.problem}</p>
                                        </div>
                                        {m.better_approach && (
                                            <div className="rounded-lg p-3"
                                                style={{ background: 'rgba(16,185,129,0.05)', borderLeft: '2px solid rgba(16,185,129,0.3)' }}>
                                                <div className="text-xs text-emerald-400 mb-1 flex items-center gap-1">
                                                    <ArrowRight size={11} /> Better Approach
                                                </div>
                                                <p className="text-emerald-100 text-sm">{m.better_approach}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB 4: TRAINING PLAN                                          */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'training' && (
                <div className="space-y-4 animate-fade-in">
                    <h3 className="text-xl font-semibold flex items-center gap-2 text-white">
                        <Calendar className="text-cyan-400" size={22} /> Your 7-Day Training Plan
                    </h3>
                    <div className="grid gap-4">
                        {Object.entries(trainingPlan).map(([day, plan], i) => (
                            <div key={day} className="card">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                                        style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                                        D{i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-semibold text-white">{plan?.focus ?? `Day ${i + 1}`}</h4>
                                            <span className="text-sm text-slate-500 flex items-center gap-1">
                                                <Clock size={14} /> {plan?.duration_minutes ?? 30} min
                                            </span>
                                        </div>
                                        <ul className="space-y-1.5">
                                            {(plan?.drills ?? []).map((drill, j) => (
                                                <li key={j} className="flex gap-2 text-slate-300 text-sm">
                                                    <span className="text-emerald-400 shrink-0">•</span>{drill}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {Object.keys(trainingPlan).length === 0 && (
                            <div className="card text-center text-slate-400 py-8">
                                Training plan will appear after evaluation completes.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB 5: SPEECH & BODY LANGUAGE                                 */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'speech' && (
                <div className="space-y-6 animate-fade-in">
                    <h3 className="text-xl font-semibold flex items-center gap-2 text-white">
                        <Mic className="text-emerald-400" size={22} /> Speech & Body Language
                    </h3>

                    {speechMetrics && (
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Speech card */}
                            <div className="card">
                                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                                    <MessageSquare className="text-emerald-400" size={18} /> Speech Analysis
                                </h4>
                                <div className="grid grid-cols-2 gap-4 mb-5">
                                    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                        <div className="text-2xl font-bold text-white">{speechMetrics.words_per_minute ?? 'N/A'}</div>
                                        <div className="text-xs text-slate-400">Words/Min</div>
                                        <div className={`text-xs mt-1.5 flex items-center gap-1 ${
                                            speechMetrics.pace_assessment === 'optimal' ? 'text-emerald-400' : 'text-amber-400'
                                        }`}>
                                            {speechMetrics.pace_assessment === 'optimal'
                                                ? <><CheckCircle size={11} /> Good pace</>
                                                : speechMetrics.pace_assessment === 'too_fast'
                                                    ? <><TrendingUp size={11} /> Too fast</>
                                                    : <><TrendingDown size={11} /> Too slow</>
                                            }
                                        </div>
                                    </div>
                                    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                        <div className="text-2xl font-bold text-white">{speechMetrics.filler_word_count ?? 0}</div>
                                        <div className="text-xs text-slate-400">Filler Words</div>
                                        <div className="text-xs text-amber-400 mt-1">
                                            {speechMetrics.filler_ratio_percent}% of speech
                                        </div>
                                    </div>
                                </div>

                                {/* Filler word breakdown bars */}
                                {(speechMetrics.filler_breakdown ?? []).length > 0 && (
                                    <div>
                                        <div className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Filler Breakdown</div>
                                        <div className="space-y-2">
                                            {speechMetrics.filler_breakdown.slice(0, 6).map(({ word, count }) => {
                                                const max = speechMetrics.filler_breakdown[0]?.count || 1;
                                                return (
                                                    <div key={word} className="flex items-center gap-3">
                                                        <span className="text-xs text-slate-400 w-16 text-right font-mono">"{word}"</span>
                                                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                                            <div className="h-full rounded-full" style={{ width: `${(count / max) * 100}%`, background: '#f59e0b' }} />
                                                        </div>
                                                        <span className="text-xs text-amber-400 w-6">{count}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Non-verbal card */}
                            {nonVerbal && (
                                <div className="card">
                                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                                        <Eye className="text-cyan-400" size={18} /> Non-Verbal Analysis
                                    </h4>
                                    <div className="space-y-4 mb-4">
                                        {([
                                            { label: 'Eye Contact',  value: nonVerbal.eye_contact_percent,  color: '#10b981' },
                                            { label: 'Good Posture', value: nonVerbal.good_posture_percent, color: '#06b6d4' },
                                            { label: 'Engagement',   value: nonVerbal.engagement_percent,   color: '#8b5cf6' },
                                        ] as { label: string; value: number; color: string }[]).map(({ label, value, color }) => (
                                            <div key={label} className="flex justify-between items-center">
                                                <span className="text-sm text-slate-300">{label}</span>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${value}%`, background: color }} />
                                                    </div>
                                                    <span className="text-sm text-white w-10 text-right">{value}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {nonVerbal.concerns?.length > 0 && (
                                        <div className="space-y-1.5 mb-3">
                                            {nonVerbal.concerns.map((c, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs text-slate-400 rounded-lg p-2"
                                                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                                                    <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" />{c}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {nonVerbal.timeline_notes && (
                                        <div className="rounded-lg p-3 text-xs text-slate-300"
                                            style={{ background: 'rgba(6,182,212,0.05)', borderLeft: '2px solid rgba(6,182,212,0.3)' }}>
                                            <div className="text-cyan-400 mb-1">Timeline Note</div>
                                            {nonVerbal.timeline_notes}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {!speechMetrics && !nonVerbal && (
                        <div className="card text-center text-slate-400 py-8">
                            Speech and body language data will appear after evaluation completes.
                        </div>
                    )}
                </div>
            )}

            {/* ── Actions ──────────────────────────────────────────────────── */}
            <div className="flex justify-center gap-4 pt-4">
                <button onClick={() => navigate('/history')} className="btn-secondary px-6">
                    <ChevronLeft size={18} /> Back to History
                </button>
                <button onClick={() => navigate('/new-interview')} className="btn-primary px-8">
                    <RefreshCw size={18} /> Practice Again
                </button>
            </div>
        </div>
    );
};
