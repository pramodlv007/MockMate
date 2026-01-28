import { useNavigate } from 'react-router-dom';
import { ArrowRight, Video, Brain, LineChart } from 'lucide-react';

export const Home = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-12 text-center">
            <div className="space-y-6 max-w-2xl animate-fade-in">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    AI-Powered Interview Coach
                </div>
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                    Master Your Next <br />
                    <span className="text-indigo-400">Tech Interview</span>
                </h1>
                <p className="text-lg text-slate-400 leading-relaxed">
                    Practice with realistic AI-generated questions, get real-time video analysis on your body language, and receive personalized feedback to land your dream job.
                </p>

                <div className="flex items-center justify-center gap-4 pt-4">
                    <button
                        onClick={() => navigate('/new-interview')}
                        className="btn-primary text-lg px-8 py-3 shadow-indigo-500/20"
                    >
                        Start Mock Interview <ArrowRight size={20} />
                    </button>
                    <button
                        onClick={() => navigate('/history')}
                        className="btn-secondary text-lg px-8 py-3 bg-slate-800 hover:bg-slate-700"
                    >
                        View Past Sessions
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 w-full max-w-4xl mt-12 animate-slide-up">
                {[
                    { icon: Brain, title: "Smart Questions", desc: "Tailored to your target company and job description." },
                    { icon: Video, title: "Video Analysis", desc: "VLM-powered feedback on soft skills and confidence." },
                    { icon: LineChart, title: "Detailed Insights", desc: "Comprehensive scorecards and actionable advice." }
                ].map((feature, idx) => (
                    <div key={idx} className="card group hover:-translate-y-1 transition-transform">
                        <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                            <feature.icon className="text-indigo-400" size={24} />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                        <p className="text-slate-400">{feature.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
