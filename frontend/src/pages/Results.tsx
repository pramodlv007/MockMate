import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { endpoints, type InterviewSession } from '../api';
import {
    CheckCircle, RefreshCw, ChevronLeft,
    Target, Eye, MessageSquare, Clock, AlertTriangle,
    Calendar, Lightbulb, FileText, Award, BarChart3
} from 'lucide-react';

// ── Circular Score Ring ────────────────────────────────────────────────────────
const ScoreRing = ({ score, size = 80, label, color }: { score: number; size?: number; label: string; color: string }) => {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    return (
        <div className="flex flex-col items-center gap-2">
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="4" fill="none" />
                <circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth="4" fill="none"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <div className="absolute flex items-center justify-center" style={{ width: size, height: size }}>
                <span className="text-xl font-bold text-white">{score}</span>
            </div>
            <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
        </div>
    );
};

export const Results = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [session, setSession] = useState<InterviewSession | null>(null);
    const [feedback, setFeedback] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'mistakes' | 'training'>('overview');

    useEffect(() => {
        if (!id) return;
        const fetchSession = async () => {
            try {
                const { data } = await endpoints.getInterview(id);
                setSession(data);
                if ((data.status === 'evaluated' || data.status === 'completed') && data.feedback_summary) {
                    try { setFeedback(JSON.parse(data.feedback_summary)); } catch { setFeedback({ summary: data.feedback_summary }); }
                }
            } catch (e) { console.error("Failed to fetch session:", e); }
        };
        fetchSession();
        const interval = setInterval(() => {
            if (!session || (session.status !== 'evaluated' && session.status !== 'completed')) fetchSession();
        }, 3000);
        return () => clearInterval(interval);
    }, [id, session?.status]);

    if (!session) return <div className="text-center pt-20 text-emerald-400 animate-pulse text-lg">Loading Results...</div>;

    if (session.status === 'evaluating' || session.status === 'generated' || session.status === 'created') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-in">
                <div className="w-20 h-20 rounded-full animate-spin" style={{ border: '3px solid rgba(16,185,129,0.2)', borderTopColor: '#10b981' }}></div>
                <div className="text-center space-y-3">
                    <h2 className="text-2xl font-bold text-white">Analyzing Your Performance</h2>
                    <p className="text-slate-400">AI is evaluating your video, speech, and body language...</p>
                    <div className="flex justify-center gap-6 mt-4 text-sm text-slate-500">
                        <span>🎤 Transcribing</span>
                        <span>📹 Analyzing body language</span>
                        <span>📊 Scoring answers</span>
                    </div>
                </div>
            </div>
        );
    }

    const sectionScores = feedback?.section_scores || {};
    const speechMetrics = feedback?.speech_metrics || {};
    const nonVerbal = feedback?.non_verbal_dashboard || {};
    const mistakes = feedback?.top_10_mistakes || [];
    const trainingPlan = feedback?.training_plan_7_day || {};
    const perQuestionScores = feedback?.per_question_scores || [];
    const hireRec = feedback?.hire_recommendation || 'N/A';
    const overallScore = feedback?.overall_score || session.overall_score || 0;

    const hireColor = hireRec.includes('Strong Yes') ? '#10b981' : hireRec === 'Yes' ? '#34d399' :
                      hireRec === 'Maybe' ? '#f59e0b' : hireRec === 'No' ? '#ef4444' : '#dc2626';

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-12">
            {/* ── Header with Score ──────────────────────────────────────────── */}
            <div className="card glow-emerald" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(6,182,212,0.05) 100%)' }}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-1 text-white">Interview Analysis Complete</h1>
                        <p className="text-slate-400">{session.company_name} — {session.target_role}</p>
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold"
                             style={{ background: `${hireColor}15`, color: hireColor, border: `1px solid ${hireColor}30` }}>
                            <Award size={14} /> {hireRec}
                        </div>
                    </div>
                    <div className="text-center relative">
                        <div className="text-6xl font-extrabold text-gradient">{overallScore}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Overall Score</div>
                    </div>
                </div>
            </div>

            {/* ── Tab Navigation ─────────────────────────────────────────────── */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                {[
                    { key: 'overview', label: 'Overview', icon: Target },
                    { key: 'questions', label: 'Per-Question', icon: FileText },
                    { key: 'mistakes', label: 'Mistakes', icon: AlertTriangle },
                    { key: 'training', label: '7-Day Plan', icon: Calendar },
                ].map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setActiveTab(key as any)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 text-sm font-medium ${
                            activeTab === key
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}>
                        <Icon size={16} /> {label}
                    </button>
                ))}
            </div>

            {/* ── Overview Tab ───────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { key: 'technical_depth', label: 'Technical', color: '#10b981' },
                            { key: 'communication_clarity', label: 'Communication', color: '#06b6d4' },
                            { key: 'structured_thinking', label: 'Structure', color: '#8b5cf6' },
                            { key: 'problem_solving', label: 'Problem Solving', color: '#f59e0b' },
                            { key: 'confidence_presence', label: 'Confidence', color: '#ec4899' },
                        ].map(({ key, label, color }) => (
                            <div key={key} className="card text-center relative flex flex-col items-center py-6">
                                <ScoreRing score={sectionScores[key] || 0} label={label} color={color} />
                            </div>
                        ))}
                    </div>

                    {/* Speech & Non-Verbal */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="card">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <MessageSquare className="text-emerald-400" size={18} /> Speech Analysis
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    <div className="text-2xl font-bold text-white">{speechMetrics.words_per_minute || 'N/A'}</div>
                                    <div className="text-xs text-slate-400">Words/Min</div>
                                    <div className={`text-xs mt-1 ${speechMetrics.pace_assessment === 'optimal' ? 'text-emerald-400' : speechMetrics.pace_assessment === 'too_fast' ? 'text-amber-400' : 'text-amber-400'}`}>
                                        {speechMetrics.pace_assessment === 'optimal' ? '✓ Good pace' : speechMetrics.pace_assessment === 'too_fast' ? '⚡ Too fast' : '⏳ Too slow'}
                                    </div>
                                </div>
                                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    <div className="text-2xl font-bold text-white">{speechMetrics.filler_word_count || 0}</div>
                                    <div className="text-xs text-slate-400">Filler Words</div>
                                    {speechMetrics.filler_breakdown?.slice(0, 3).map((f: any, i: number) => (
                                        <span key={i} className="text-xs text-amber-400 mr-2">"{f.word}" ({f.count})</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="card">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Eye className="text-cyan-400" size={18} /> Non-Verbal Analysis
                            </h3>
                            <div className="space-y-4">
                                {[
                                    { label: 'Eye Contact', value: nonVerbal.eye_contact_percent || 0, color: '#10b981' },
                                    { label: 'Good Posture', value: nonVerbal.good_posture_percent || 0, color: '#06b6d4' },
                                    { label: 'Engagement', value: nonVerbal.engagement_percent || 0, color: '#8b5cf6' },
                                ].map(({ label, value, color }) => (
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
                        </div>
                    </div>

                    {/* Strengths & Improvements */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="card" style={{ borderLeft: '3px solid #10b981' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle className="text-emerald-400" size={20} />
                                <h3 className="text-lg font-semibold text-white">Strengths</h3>
                            </div>
                            <ul className="space-y-2">
                                {feedback?.strengths?.map((s: string, i: number) => (
                                    <li key={i} className="flex gap-2 text-slate-300 text-sm"><span className="text-emerald-400">✓</span> {s}</li>
                                )) || <li className="text-slate-500">No specific strengths detected</li>}
                            </ul>
                        </div>
                        <div className="card" style={{ borderLeft: '3px solid #f59e0b' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <Lightbulb className="text-amber-400" size={20} />
                                <h3 className="text-lg font-semibold text-white">Key Improvements</h3>
                            </div>
                            <ul className="space-y-2">
                                {(feedback?.critical_improvements || feedback?.recommendations)?.map((r: string, i: number) => (
                                    <li key={i} className="flex gap-2 text-slate-300 text-sm"><span className="text-amber-400">→</span> {r}</li>
                                )) || <li className="text-slate-500">No recommendations</li>}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Per-Question Tab ───────────────────────────────────────────── */}
            {activeTab === 'questions' && (
                <div className="space-y-4 animate-fade-in">
                    <h3 className="text-xl font-semibold flex items-center gap-2 text-white">
                        <BarChart3 className="text-emerald-400" size={22} /> Question-by-Question Breakdown
                    </h3>
                    {perQuestionScores.length === 0 && session.questions.length > 0 ? (
                        <div className="space-y-4">
                            {session.questions.map((q, i) => (
                                <div key={q.id} className="card">
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                                             style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white font-medium mb-2">{q.content}</p>
                                            {q.transcript && (
                                                <div className="rounded-lg p-3 mt-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                                    <div className="text-xs text-slate-500 mb-1">Your answer:</div>
                                                    <p className="text-sm text-slate-300">{q.transcript}</p>
                                                </div>
                                            )}
                                            {q.score != null && (
                                                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                                                     style={{ background: q.score >= 70 ? 'rgba(16,185,129,0.15)' : q.score >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                                              color: q.score >= 70 ? '#10b981' : q.score >= 40 ? '#f59e0b' : '#ef4444' }}>
                                                    Score: {q.score}/100
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        perQuestionScores.map((pq: any, i: number) => {
                            const scoreColor = pq.score >= 70 ? '#10b981' : pq.score >= 40 ? '#f59e0b' : '#ef4444';
                            const catLabel = pq.category === 'STRONG' ? '🟢 Strong' : pq.category === 'ADEQUATE' ? '🟡 Adequate' : '🔴 Weak';
                            return (
                                <div key={i} className="card">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                                             style={{ background: `${scoreColor}15`, color: scoreColor }}>
                                            {pq.score}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-white font-medium">{pq.question}</p>
                                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${scoreColor}15`, color: scoreColor }}>
                                                    {catLabel}
                                                </span>
                                            </div>
                                            {pq.answer_summary && (
                                                <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                                    <div className="text-xs text-slate-500 mb-1">Your answer summary:</div>
                                                    <p className="text-sm text-slate-300">{pq.answer_summary}</p>
                                                </div>
                                            )}
                                            {pq.feedback && (
                                                <div className="rounded-lg p-3" style={{ background: 'rgba(16,185,129,0.05)', borderLeft: '2px solid rgba(16,185,129,0.3)' }}>
                                                    <div className="text-xs text-emerald-400 mb-1">AI Feedback:</div>
                                                    <p className="text-sm text-slate-300">{pq.feedback}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ── Mistakes Tab ──────────────────────────────────────────────── */}
            {activeTab === 'mistakes' && (
                <div className="space-y-4 animate-fade-in">
                    <h3 className="text-xl font-semibold flex items-center gap-2 text-white">
                        <AlertTriangle className="text-red-400" size={22} /> Top Mistakes & How to Fix Them
                    </h3>
                    {mistakes.length === 0 ? (
                        <div className="card text-center text-slate-400 py-8">No specific mistakes identified. Great job!</div>
                    ) : (
                        mistakes.map((m: any, i: number) => (
                            <div key={i} className="card" style={{ borderLeft: '3px solid #ef4444' }}>
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 font-bold shrink-0 text-sm"
                                         style={{ background: 'rgba(239,68,68,0.1)' }}>
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <span className="text-xs px-2 py-0.5 rounded-full uppercase font-semibold"
                                              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                                            {m.type || 'Issue'}
                                        </span>
                                        {m.quote && (
                                            <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.05)', borderLeft: '2px solid rgba(239,68,68,0.3)' }}>
                                                <div className="text-xs text-slate-500 mb-1">What you said:</div>
                                                <p className="text-slate-300 italic text-sm">"{m.quote}"</p>
                                            </div>
                                        )}
                                        <div>
                                            <div className="text-xs text-slate-500 mb-1">Problem:</div>
                                            <p className="text-slate-300 text-sm">{m.problem}</p>
                                        </div>
                                        {m.suggestion && (
                                            <div className="rounded-lg p-3" style={{ background: 'rgba(16,185,129,0.05)', borderLeft: '2px solid rgba(16,185,129,0.3)' }}>
                                                <div className="text-xs text-emerald-400 mb-1">Better approach:</div>
                                                <p className="text-emerald-100 text-sm">"{m.suggestion}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Training Plan Tab ─────────────────────────────────────────── */}
            {activeTab === 'training' && (
                <div className="space-y-4 animate-fade-in">
                    <h3 className="text-xl font-semibold flex items-center gap-2 text-white">
                        <Calendar className="text-cyan-400" size={22} /> Your 7-Day Training Plan
                    </h3>
                    <div className="grid gap-4">
                        {Object.entries(trainingPlan).map(([day, plan]: [string, any], i) => (
                            <div key={day} className="card">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                                         style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                                        D{i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-semibold text-white">{plan?.focus || `Day ${i + 1}`}</h4>
                                            <span className="text-sm text-slate-500 flex items-center gap-1">
                                                <Clock size={14} /> {plan?.duration_minutes || 30} min
                                            </span>
                                        </div>
                                        <ul className="space-y-1.5">
                                            {plan?.drills?.map((drill: string, j: number) => (
                                                <li key={j} className="flex gap-2 text-slate-300 text-sm">
                                                    <span className="text-emerald-400">•</span> {drill}
                                                </li>
                                            )) || <li className="text-slate-500 text-sm">No drills specified</li>}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Actions ───────────────────────────────────────────────────── */}
            <div className="flex justify-center gap-4 pt-8">
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
