import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { endpoints, type InterviewSession } from '../api';
import { Calendar, ChevronRight, Play } from 'lucide-react';

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
                                    <h3 className="font-semibold text-lg group-hover:text-indigo-400 transition-colors">
                                        {interview.company_name}
                                    </h3>
                                    <p className="text-sm text-slate-400 flex items-center gap-2">
                                        <Calendar size={14} />
                                        {new Date(interview.created_at).toLocaleDateString()} at {new Date(interview.created_at).toLocaleTimeString()}
                                    </p>
                                </div>

                                <div className="flex items-center gap-6">
                                    {interview.ai_score ? (
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500 uppercase">Score</div>
                                            <div className="text-xl font-bold text-indigo-400">{interview.ai_score}</div>
                                        </div>
                                    ) : (
                                        <span className="text-xs px-2 py-1 rounded bg-yellow-500/10 text-yellow-500">Processing</span>
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
