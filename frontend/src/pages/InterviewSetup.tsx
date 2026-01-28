import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endpoints } from '../api';
import { Video, Loader2, UserCircle, ShieldAlert } from 'lucide-react';

export const InterviewSetup = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        company_name: '',
        job_description: '',
        questions_count: 5,
        duration_minutes: 15,
        interviewer_persona: 'neutral',
        strictness_level: 'standard'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await endpoints.createInterview(formData);
            navigate(`/interview/${data.id}`);
        } catch (err) {
            console.error(err);
            alert("Failed to start interview. Check backend connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-12">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">Mock Interview Setup</h2>
                <p className="text-slate-400">Personalize your session for the best practice experience</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="card space-y-6">
                    <h3 className="text-lg font-semibold border-b border-slate-700 pb-2 mb-4">Job Context</h3>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Target Company</label>
                            <input
                                type="text"
                                required
                                className="input-field"
                                placeholder="e.g. Google, Amazon, OpenAI"
                                value={formData.company_name}
                                onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Duration (Minutes)</label>
                            <input
                                type="number"
                                min={5}
                                max={60}
                                className="input-field"
                                value={formData.duration_minutes}
                                onChange={e => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Job Description</label>
                        <textarea
                            required
                            rows={4}
                            className="input-field resize-none"
                            placeholder="Paste the full job description here..."
                            value={formData.job_description}
                            onChange={e => setFormData({ ...formData, job_description: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Persona Selector */}
                    <div className="card space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <UserCircle className="text-indigo-400" size={20} />
                            Interviewer Persona
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { id: 'friendly', name: 'Friendly', desc: 'Encouraging and warm' },
                                { id: 'neutral', name: 'Professional', desc: 'Balanced and objective' },
                                { id: 'tough', name: 'Rigorous', desc: 'Demanding and analytical' }
                            ].map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, interviewer_persona: p.id })}
                                    className={`text-left p-3 rounded-lg border transition-all ${formData.interviewer_persona === p.id
                                            ? 'bg-indigo-500/10 border-indigo-500 text-white'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
                                        }`}
                                >
                                    <div className="font-medium">{p.name}</div>
                                    <div className="text-xs opacity-60">{p.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Strictness Selector */}
                    <div className="card space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <ShieldAlert className="text-orange-400" size={20} />
                            Evaluation Strictness
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { id: 'easy', name: 'Learning', desc: 'Focus on growth and tips' },
                                { id: 'standard', name: 'Realistic', desc: 'Standard industry bar' },
                                { id: 'strict', name: 'Elite', desc: 'Top 1% benchmark (FAANG style)' }
                            ].map(s => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, strictness_level: s.id })}
                                    className={`text-left p-3 rounded-lg border transition-all ${formData.strictness_level === s.id
                                            ? 'bg-orange-500/10 border-orange-500 text-white'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
                                        }`}
                                >
                                    <div className="font-medium">{s.name}</div>
                                    <div className="text-xs opacity-60">{s.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card">
                    <label className="block text-sm font-medium text-slate-300 mb-3">Number of Questions</label>
                    <div className="flex items-center gap-4">
                        <input
                            type="range"
                            min={3}
                            max={15}
                            step={1}
                            className="flex-1 accent-indigo-500"
                            value={formData.questions_count}
                            onChange={e => setFormData({ ...formData, questions_count: parseInt(e.target.value) })}
                        />
                        <span className="text-xl font-bold text-indigo-400 w-8">{formData.questions_count}</span>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-5 text-xl font-bold shadow-xl shadow-indigo-500/20"
                >
                    {loading ? (
                        <><Loader2 className="animate-spin" size={24} /> Orchestrating Session...</>
                    ) : (
                        <><Video size={24} /> Create Interview Session</>
                    )}
                </button>
            </form>
        </div>
    );
};
