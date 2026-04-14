import { useNavigate } from 'react-router-dom';
import { ArrowRight, Video, Brain, LineChart, Zap } from 'lucide-react';

export const Home = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] gap-16 text-center relative">
            {/* Ambient glow blobs */}
            <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
                 style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }} />
            <div className="absolute bottom-20 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
                 style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }} />

            <div className="space-y-8 max-w-3xl animate-slide-up relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
                     style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                    <Zap size={14} />
                    AI-Powered Interview Coach
                </div>

                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
                    <span className="text-gradient-hero">Master Your Next</span>
                    <br />
                    <span className="text-gradient">Tech Interview</span>
                </h1>

                <p className="text-lg text-slate-400 leading-relaxed max-w-xl mx-auto">
                    Practice with AI-generated questions tailored to your dream role.
                    Get real-time video analysis, per-question scoring, and a personalized 7-day improvement plan.
                </p>

                <div className="flex items-center justify-center gap-4 pt-4">
                    <button
                        onClick={() => navigate('/new-interview')}
                        className="btn-primary text-lg px-8 py-3.5"
                    >
                        Start Mock Interview <ArrowRight size={20} />
                    </button>
                    <button
                        onClick={() => navigate('/history')}
                        className="btn-secondary text-lg px-8 py-3.5"
                    >
                        View Past Sessions
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 w-full max-w-4xl animate-slide-up relative z-10" style={{ animationDelay: '0.2s' }}>
                {[
                    { icon: Brain, title: "Deep Technical Questions", desc: "Gemini AI analyzes your JD and tech stack to generate FAANG-level scenarios.", color: "#10b981" },
                    { icon: Video, title: "Video & Body Language", desc: "Vision AI evaluates eye contact, posture, and engagement in real-time.", color: "#06b6d4" },
                    { icon: LineChart, title: "Per-Question Scoring", desc: "Get individual scores, transcript analysis, and a 7-day training plan.", color: "#8b5cf6" }
                ].map((feature, idx) => (
                    <div key={idx} className="card group hover:-translate-y-1 transition-all duration-500 cursor-default">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300"
                             style={{ background: `${feature.color}15` }}>
                            <feature.icon style={{ color: feature.color }} size={22} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 text-white">{feature.title}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
