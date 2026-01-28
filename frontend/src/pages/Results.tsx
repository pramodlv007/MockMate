import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { endpoints, type InterviewSession } from '../api';
import {
    CheckCircle, XCircle, RefreshCw, ChevronLeft, ThumbsUp, ThumbsDown,
    Target, TrendingUp, Eye, Activity, MessageSquare, Clock, AlertTriangle,
    Calendar, Lightbulb
} from 'lucide-react';

export const Results = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [session, setSession] = useState<InterviewSession | null>(null);
    const [feedback, setFeedback] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'mistakes' | 'training'>('overview');

    useEffect(() => {
        if (!id) return;

        const fetchSession = async () => {
            try {
                const { data } = await endpoints.getInterview(parseInt(id));
                setSession(data);
                if (data.status === 'evaluated' && data.ai_feedback) {
                    setFeedback(JSON.parse(data.ai_feedback));
                }
            } catch (e) {
                console.error(e);
            }
        };

        fetchSession();
        const interval = setInterval(() => {
            if (!session || session.status !== 'evaluated') {
                fetchSession();
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [id, session?.status]);

    if (!session) return <div className="text-center pt-20">Loading Results...</div>;

    if (session.status !== 'evaluated') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">Analyzing Your Performance</h2>
                    <p className="text-slate-400">AI is evaluating your video, speech, and body language...</p>
                    <div className="flex justify-center gap-4 mt-4 text-sm text-slate-500">
                        <span>🎤 Transcribing audio</span>
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

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-slide-up pb-12">
            {/* Header with Score */}
            <div className="card bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Interview Analysis Complete</h1>
                        <p className="text-slate-400">{session.company_name}</p>
                    </div>
                    <div className="text-center">
                        <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-400">
                            {feedback?.overall_score || session.ai_score || 0}
                        </div>
                        <div className="text-sm text-slate-400 uppercase tracking-widest">Overall Score</div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-slate-700 pb-2">
                {[
                    { key: 'overview', label: 'Overview', icon: Target },
                    { key: 'mistakes', label: 'Mistakes & Fixes', icon: AlertTriangle },
                    { key: 'training', label: '7-Day Training Plan', icon: Calendar }
                ].map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all ${activeTab === key
                                ? 'bg-slate-800 text-white border-b-2 border-indigo-500'
                                : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <Icon size={18} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-8">
                    {/* Section Scores Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { key: 'verbal_content', label: 'Verbal', icon: MessageSquare, color: 'indigo' },
                            { key: 'communication', label: 'Communication', icon: Activity, color: 'purple' },
                            { key: 'non_verbal', label: 'Non-Verbal', icon: Eye, color: 'blue' },
                            { key: 'structure', label: 'Structure', icon: Target, color: 'green' },
                            { key: 'confidence', label: 'Confidence', icon: TrendingUp, color: 'orange' }
                        ].map(({ key, label, icon: Icon, color }) => (
                            <div key={key} className="card text-center">
                                <Icon size={24} className={`mx-auto text-${color}-400 mb-2`} />
                                <div className="text-3xl font-bold text-white">
                                    {sectionScores[key] || 'N/A'}
                                </div>
                                <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Speech & Non-Verbal Metrics */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Speech Metrics */}
                        <div className="card">
                            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <MessageSquare className="text-indigo-400" size={20} />
                                Speech Analysis
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-800/50 rounded-lg p-4">
                                    <div className="text-2xl font-bold text-white">{speechMetrics.words_per_minute || 'N/A'}</div>
                                    <div className="text-xs text-slate-400">Words/Minute</div>
                                    <div className={`text-xs mt-1 ${speechMetrics.pace_assessment === 'optimal' ? 'text-green-400' :
                                            speechMetrics.pace_assessment === 'too_fast' ? 'text-orange-400' : 'text-yellow-400'
                                        }`}>
                                        {speechMetrics.pace_assessment === 'optimal' ? '✓ Good pace' :
                                            speechMetrics.pace_assessment === 'too_fast' ? '⚡ Too fast' : '⏳ Too slow'}
                                    </div>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-4">
                                    <div className="text-2xl font-bold text-white">{speechMetrics.filler_word_count || 0}</div>
                                    <div className="text-xs text-slate-400">Filler Words</div>
                                    {speechMetrics.filler_breakdown?.slice(0, 3).map((f: any, i: number) => (
                                        <span key={i} className="text-xs text-orange-400 mr-2">"{f.word}" ({f.count})</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Non-Verbal Metrics */}
                        <div className="card">
                            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Eye className="text-purple-400" size={20} />
                                Non-Verbal Analysis
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-300">Eye Contact</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-green-500 rounded-full"
                                                style={{ width: `${nonVerbal.eye_contact_percent || 0}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-white w-12">{nonVerbal.eye_contact_percent || 0}%</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-300">Good Posture</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full"
                                                style={{ width: `${nonVerbal.good_posture_percent || 0}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-white w-12">{nonVerbal.good_posture_percent || 0}%</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-300">Engagement</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-purple-500 rounded-full"
                                                style={{ width: `${nonVerbal.engagement_percent || 0}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-white w-12">{nonVerbal.engagement_percent || 0}%</span>
                                    </div>
                                </div>
                            </div>
                            {nonVerbal.concerns?.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-700">
                                    <div className="text-sm text-orange-400">Concerns:</div>
                                    <ul className="text-sm text-slate-400 mt-1">
                                        {nonVerbal.concerns.slice(0, 3).map((c: string, i: number) => (
                                            <li key={i}>• {c}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Strengths & Weaknesses */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="card border-green-500/20 bg-green-500/5">
                            <div className="flex items-center gap-3 mb-4">
                                <CheckCircle className="text-green-400" size={24} />
                                <h3 className="text-xl font-semibold text-green-100">Strengths</h3>
                            </div>
                            <ul className="space-y-2">
                                {feedback?.strengths?.map((s: string, i: number) => (
                                    <li key={i} className="flex gap-2 text-green-50/80">
                                        <span className="text-green-400">✓</span> {s}
                                    </li>
                                )) || <li className="text-slate-400">No specific strengths detected</li>}
                            </ul>
                        </div>

                        <div className="card border-orange-500/20 bg-orange-500/5">
                            <div className="flex items-center gap-3 mb-4">
                                <Lightbulb className="text-orange-400" size={24} />
                                <h3 className="text-xl font-semibold text-orange-100">Recommendations</h3>
                            </div>
                            <ul className="space-y-2">
                                {feedback?.recommendations?.map((r: string, i: number) => (
                                    <li key={i} className="flex gap-2 text-orange-50/80">
                                        <span className="text-orange-400">→</span> {r}
                                    </li>
                                )) || <li className="text-slate-400">No recommendations</li>}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Mistakes Tab */}
            {activeTab === 'mistakes' && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <AlertTriangle className="text-red-400" size={24} />
                        Top Mistakes & How to Fix Them
                    </h3>

                    {mistakes.length === 0 ? (
                        <div className="card text-center text-slate-400 py-8">
                            No specific mistakes identified. Great job!
                        </div>
                    ) : (
                        mistakes.map((m: any, i: number) => (
                            <div key={i} className="card border-l-4 border-red-500">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 font-bold shrink-0">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div>
                                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded uppercase">
                                                {m.type || 'Issue'}
                                            </span>
                                        </div>

                                        {m.quote && (
                                            <div className="bg-slate-800/50 p-3 rounded border-l-2 border-red-500/50">
                                                <div className="text-xs text-slate-500 mb-1">What you said:</div>
                                                <p className="text-slate-300 italic">"{m.quote}"</p>
                                            </div>
                                        )}

                                        <div>
                                            <div className="text-xs text-slate-500 mb-1">Problem:</div>
                                            <p className="text-slate-300">{m.problem}</p>
                                        </div>

                                        {m.suggestion && (
                                            <div className="bg-green-500/10 p-3 rounded border-l-2 border-green-500/50">
                                                <div className="text-xs text-green-400 mb-1">Say this instead:</div>
                                                <p className="text-green-100">"{m.suggestion}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Training Plan Tab */}
            {activeTab === 'training' && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Calendar className="text-blue-400" size={24} />
                        Your 7-Day Training Plan
                    </h3>

                    <div className="grid gap-4">
                        {Object.entries(trainingPlan).map(([day, plan]: [string, any], i) => (
                            <div key={day} className="card">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                                        D{i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-semibold text-lg">{plan?.focus || `Day ${i + 1}`}</h4>
                                            <span className="text-sm text-slate-400 flex items-center gap-1">
                                                <Clock size={14} />
                                                {plan?.duration_minutes || 30} min
                                            </span>
                                        </div>
                                        <ul className="space-y-2">
                                            {plan?.drills?.map((drill: string, j: number) => (
                                                <li key={j} className="flex gap-2 text-slate-300">
                                                    <span className="text-indigo-400">•</span>
                                                    {drill}
                                                </li>
                                            )) || <li className="text-slate-400">No drills specified</li>}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-center gap-4 pt-8">
                <button onClick={() => navigate('/history')} className="btn-secondary px-6">
                    <ChevronLeft size={20} /> Back to History
                </button>
                <button onClick={() => navigate('/new-interview')} className="btn-primary px-8">
                    <RefreshCw size={20} /> Practice Again
                </button>
            </div>
        </div>
    );
};
