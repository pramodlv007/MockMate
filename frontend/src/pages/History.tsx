import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { endpoints, type InterviewSession } from '../api';
import { Calendar, ChevronRight, Trash2, Trophy, Activity } from 'lucide-react';

export const History = () => {
    const navigate = useNavigate();
    const [interviews, setInterviews] = useState<InterviewSession[]>([]);

    useEffect(() => {
        endpoints.getUserInterviews().then(res => {
            setInterviews(res.data);
        });
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this interview and its recording permanently? This cannot be undone.')) return;
        try {
            await endpoints.deleteInterview(id);
            setInterviews(list => list.filter(i => i.id !== id));
        } catch (err: any) {
            alert(err?.response?.data?.detail ?? 'Could not delete the interview. Please try again.');
        }
    };

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
                            className="surface"
                        >
                            <div className="flex items-center justify-between">
                                <div className="space-y-1 flex-1">
                                    <h3 className="font-semibold text-lg">
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
                                            <div className="flex items-center text-sm font-medium text-action bg-action/10 px-3 py-1 rounded-full whitespace-nowrap">
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
                                                            <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                                                                C:{bd.content?.score}
                                                            </span>
                                                            <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>
                                                                M:{bd.communication?.score}
                                                            </span>
                                                            <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8' }}>
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
                                <button
                                    onClick={() => navigate(`/results/${interview.id}`)}
                                    className="btn btn--primary"
                                >
                                    View Results <ChevronRight size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(interview.id)}
                                    className="btn btn--secondary ml-auto text-danger"
                                    aria-label={`Delete interview with ${interview.company_name}`}
                                >
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
