import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { endpoints, type InterviewSession } from '../api';
import { Calendar, ChevronRight, Play, Trophy, Activity } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const History = () => {
    const navigate = useNavigate();
    const [interviews, setInterviews] = useState<InterviewSession[]>([]);

    useEffect(() => {
        endpoints.getUserInterviews().then(res => {
            setInterviews(res.data);
        });
    }, []);

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <h1 className="text-3xl font-bold">Interview History</h1>

            <div className="space-y-4">
                {interviews.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        No interviews found. Start your first session!
                    </div>
                ) : (
                    interviews.map(interview => (
                        <div
                            key={interview.id}
                            className="card group transition-all"
                        >
                            <div className="flex items-center justify-between">
                                <div className="space-y-1 flex-1">
                                    <h3 className="font-semibold text-lg group-hover:text-emerald-400 transition-colors">
                                        {interview.company_name}
                                    </h3>
                                    <p className="text-sm text-slate-400 flex items-center gap-2">
                                        <Calendar size={14} />
                                        {new Date(interview.created_at).toLocaleDateString()} at {new Date(interview.created_at).toLocaleTimeString()}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 flex-wrap">
                                    {interview.overall_score ? (
                                        <>
                                            <div className="flex items-center text-sm font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full whitespace-nowrap">
                                                <Trophy className="w-4 h-4 mr-1.5" />
                                                {interview.overall_score}/100
                                            </div>
                                            {/* Mini score breakdown */}
                                            {(() => {
                                                try {
                                                    const fb = JSON.parse(interview.feedback_summary || '{}');
                                                    const bd = fb.score_breakdown;
                                                    if (!bd) return null;
                                                    return (
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                                                                C:{bd.content?.score}
                                                            </span>
                                                            <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>
                                                                M:{bd.communication?.score}
                                                            </span>
                                                            <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                                                                P:{bd.presence?.score}
                                                            </span>
                                                        </div>
                                                    );
                                                } catch { return null; }
                                            })()}
                                        </>
                                    ) : (
                                        <div className="flex items-center text-sm font-medium text-gray-400 bg-gray-800/50 border border-gray-700/50 px-3 py-1 rounded-full whitespace-nowrap">
                                            <Activity className="w-4 h-4 mr-1.5" />
                                            Pending Evaluation
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-700/50">
                                {interview.video_storage_path && (
                                    <a
                                        href={`${API_URL}/${interview.video_storage_path}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-secondary text-sm py-2"
                                    >
                                        <Play size={16} /> Watch Recording
                                    </a>
                                )}
                                <button
                                    onClick={() => navigate(`/results/${interview.id}`)}
                                    className="btn-primary text-sm py-2"
                                >
                                    View Results <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
