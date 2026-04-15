import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Brain, LineChart, Zap, Target, Globe, Shield,
  ChevronRight, Play, CheckCircle, Star, Users, Award, TrendingUp,
  Code2, Database, Cpu, GitBranch, Sparkles, Clock
} from 'lucide-react';

/* ── Animated counter hook ───── */
function useCounter(end: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, start]);
  return count;
}

/* ── AI Brain SVG illustration ─── */
const BrainIllustration = () => (
  <svg viewBox="0 0 400 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <defs>
      <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#060611" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="50%" stopColor="#06b6d4" />
        <stop offset="100%" stopColor="#8b5cf6" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    {/* Background glow */}
    <circle cx="200" cy="160" r="150" fill="url(#bgGlow)" />

    {/* Circuit board lines */}
    {[...Array(8)].map((_, i) => (
      <line key={i} x1={50 + i * 40} y1="40" x2={50 + i * 40} y2="280"
        stroke="rgba(16,185,129,0.08)" strokeWidth="1" />
    ))}
    {[...Array(6)].map((_, i) => (
      <line key={i} x1="40" y1={60 + i * 40} x2="360" y2={60 + i * 40}
        stroke="rgba(6,182,212,0.08)" strokeWidth="1" />
    ))}

    {/* Brain outline */}
    <path d="M200 80 C160 80 130 100 120 130 C110 155 115 175 125 190 C115 200 110 215 120 230
             C130 245 150 250 165 248 C170 260 185 268 200 268
             C215 268 230 260 235 248 C250 250 270 245 280 230
             C290 215 285 200 275 190 C285 175 290 155 280 130 C270 100 240 80 200 80Z"
      fill="none" stroke="url(#brainGrad)" strokeWidth="2.5" filter="url(#glow)" />

    {/* Inner brain details */}
    <path d="M200 100 C185 108 170 120 165 140 C160 155 162 168 168 178"
      stroke="rgba(16,185,129,0.5)" strokeWidth="1.5" fill="none" />
    <path d="M200 100 C215 108 230 120 235 140 C240 155 238 168 232 178"
      stroke="rgba(6,182,212,0.5)" strokeWidth="1.5" fill="none" />
    <line x1="200" y1="100" x2="200" y2="268" stroke="rgba(139,92,246,0.3)" strokeWidth="1" strokeDasharray="4 4" />

    {/* Floating data nodes */}
    {[
      { cx: 120, cy: 130, r: 5, color: "#10b981", delay: "0s" },
      { cx: 280, cy: 130, r: 5, color: "#06b6d4", delay: "0.5s" },
      { cx: 115, cy: 200, r: 4, color: "#8b5cf6", delay: "1s" },
      { cx: 285, cy: 200, r: 4, color: "#10b981", delay: "1.5s" },
      { cx: 200, cy: 80, r: 6, color: "#06b6d4", delay: "0.3s" },
    ].map((n, i) => (
      <circle key={i} cx={n.cx} cy={n.cy} r={n.r} fill={n.color} filter="url(#glow)"
        style={{ animation: `pulse 2s ${n.delay} ease-in-out infinite` }} />
    ))}

    {/* Connection lines from brain to floating labels */}
    <line x1="120" y1="160" x2="55" y2="130" stroke="rgba(16,185,129,0.4)" strokeWidth="1" strokeDasharray="3 3" />
    <line x1="280" y1="160" x2="345" y2="130" stroke="rgba(6,182,212,0.4)" strokeWidth="1" strokeDasharray="3 3" />
    <line x1="165" y1="248" x2="90" y2="268" stroke="rgba(139,92,246,0.4)" strokeWidth="1" strokeDasharray="3 3" />
    <line x1="235" y1="248" x2="310" y2="268" stroke="rgba(16,185,129,0.4)" strokeWidth="1" strokeDasharray="3 3" />

    {/* Floating label boxes */}
    <rect x="10" y="115" width="45" height="28" rx="6" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.3)" strokeWidth="1" />
    <text x="32" y="134" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="600">Gemini</text>

    <rect x="345" y="115" width="45" height="28" rx="6" fill="rgba(6,182,212,0.1)" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
    <text x="367" y="134" textAnchor="middle" fill="#06b6d4" fontSize="9" fontWeight="600">Tavily</text>

    <rect x="45" y="254" width="48" height="28" rx="6" fill="rgba(139,92,246,0.1)" stroke="rgba(139,92,246,0.3)" strokeWidth="1" />
    <text x="69" y="273" textAnchor="middle" fill="#8b5cf6" fontSize="9" fontWeight="600">Resume</text>

    <rect x="307" y="254" width="52" height="28" rx="6" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.3)" strokeWidth="1" />
    <text x="333" y="273" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="600">Score AI</text>

    {/* Center spark */}
    <circle cx="200" cy="174" r="12" fill="none" stroke="url(#brainGrad)" strokeWidth="2" filter="url(#glow)" />
    <path d="M200 166 L198 172 L193 172 L197 176 L195 182 L200 178 L205 182 L203 176 L207 172 L202 172 Z"
      fill="url(#brainGrad)" />
  </svg>
);

/* ── Interview process SVG ─── */
const ProcessStep = ({ number, icon: Icon, title, desc, color }: {
  number: string; icon: React.ComponentType<{ size: number; className?: string }>;
  title: string; desc: string; color: string;
}) => (
  <div className="flex gap-5 group">
    <div className="flex flex-col items-center gap-2">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
        style={{ background: `${color}20`, border: `1.5px solid ${color}40` }}>
        <Icon size={22} className="transition-all duration-300" style={{ color }} />
      </div>
      <div className="w-px flex-1 min-h-[40px]" style={{ background: `linear-gradient(to bottom, ${color}40, transparent)` }} />
    </div>
    <div className="pb-8">
      <div className="text-xs font-bold mb-1 tracking-widest uppercase" style={{ color }}>Step {number}</div>
      <h4 className="text-white font-semibold text-lg mb-1">{title}</h4>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  </div>
);

/* ── Tech logo strip ─── */
const techStack = [
  { name: "Python", color: "#3b82f6" },
  { name: "React", color: "#06b6d4" },
  { name: "ML / AI", color: "#10b981" },
  { name: "Node.js", color: "#22c55e" },
  { name: "System Design", color: "#8b5cf6" },
  { name: "AWS", color: "#f59e0b" },
  { name: "Docker", color: "#06b6d4" },
  { name: "SQL", color: "#f97316" },
  { name: "Algorithms", color: "#ec4899" },
  { name: "TypeScript", color: "#3b82f6" },
];

export const Home = () => {
  const navigate = useNavigate();
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  const q1 = useCounter(12400, 2000, statsVisible);
  const q2 = useCounter(320, 1800, statsVisible);
  const q3 = useCounter(94, 1600, statsVisible);
  const q4 = useCounter(7, 1200, statsVisible);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-0 text-slate-50 overflow-x-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ════ HERO ════════════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(ellipse, #10b981 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl"
            style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center py-20">
          {/* Left — copy */}
          <div className="animate-slide-up space-y-8">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
              <Sparkles size={14} />
              Powered by Gemini AI + Live Web Search
            </div>

            <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.1]">
              <span className="text-gradient-hero">Ace Every</span>
              <br />
              <span className="text-gradient">Tech Interview</span>
              <br />
              <span className="text-white">with AI coaching</span>
            </h1>

            <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
              MockMate generates <strong className="text-white">personalised, web-researched</strong> interview questions
              from your resume + JD. Practice with a live AI interviewer
              and get detailed per-question feedback.
            </p>

            {/* Feature bullets */}
            {[
              "Questions pulled live from Glassdoor, LeetCode & Blind",
              "Resume-aware — asks about your actual projects",
              "Per-question scoring & 7-day improvement roadmap",
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle size={18} className="flex-shrink-0" style={{ color: '#10b981' }} />
                <span className="text-slate-300 text-sm">{f}</span>
              </div>
            ))}

            <div className="flex flex-wrap gap-4 pt-2">
              <button onClick={() => navigate('/new-interview')}
                className="btn-primary text-base px-7 py-3.5 animate-pulse-glow">
                Start Free Interview <ArrowRight size={18} />
              </button>
              <button onClick={() => navigate('/history')}
                className="btn-secondary text-base px-7 py-3.5">
                <Play size={16} /> View Past Sessions
              </button>
            </div>
          </div>

          {/* Right — illustration */}
          <div className="hidden lg:block animate-float" style={{ animationDelay: '0.3s' }}>
            <div className="relative w-full max-w-md mx-auto">
              {/* Outer glow ring */}
              <div className="absolute inset-4 rounded-full blur-2xl opacity-30 animate-pulse"
                style={{ background: 'radial-gradient(circle, #10b981, #06b6d4, #8b5cf6)' }} />
              <BrainIllustration />

              {/* Floating cards */}
              <div className="absolute -top-4 -right-4 glass-panel px-4 py-3 rounded-2xl animate-float"
                style={{ animationDelay: '1s', borderColor: 'rgba(16,185,129,0.2)' }}>
                <div className="text-xs text-slate-400 mb-1">Gemini 2.0</div>
                <div className="text-sm font-bold" style={{ color: '#10b981' }}>✓ Live Questions</div>
              </div>
              <div className="absolute -bottom-2 -left-4 glass-panel px-4 py-3 rounded-2xl animate-float"
                style={{ animationDelay: '1.5s', borderColor: 'rgba(139,92,246,0.2)' }}>
                <div className="text-xs text-slate-400 mb-1">AI Score</div>
                <div className="text-sm font-bold" style={{ color: '#8b5cf6' }}>⭐ 8.4 / 10</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ TECH STRIP ════════════════════════════════════ */}
      <div className="relative py-6 overflow-hidden" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-600 mb-4">
          Covers all major tech stacks & domains
        </p>
        <div className="flex gap-6 animate-shimmer" style={{ width: 'max-content' }}>
          {[...techStack, ...techStack].map((t, i) => (
            <span key={i} className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
              style={{ background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}30` }}>
              {t.name}
            </span>
          ))}
        </div>
      </div>

      {/* ════ STATS ════════════════════════════════════════ */}
      <section ref={statsRef} className="py-20 max-w-7xl mx-auto px-6 w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: q1, suffix: "+", label: "Questions Generated", color: "#10b981", icon: Brain },
            { value: q2, suffix: "+", label: "Companies Covered", color: "#06b6d4", icon: Globe },
            { value: q3, suffix: "%", label: "Accuracy Rate", color: "#8b5cf6", icon: Target },
            { value: q4, suffix: "-Day Plan", label: "Personalised roadmap", color: "#f59e0b", icon: TrendingUp },
          ].map((s, i) => (
            <div key={i} className="card text-center group hover:-translate-y-2 transition-all duration-500">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ background: `${s.color}15` }}>
                <s.icon size={22} style={{ color: s.color }} />
              </div>
              <div className="text-4xl font-extrabold mb-1" style={{ color: s.color }}>
                {s.value.toLocaleString()}{s.suffix}
              </div>
              <div className="text-slate-400 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ SERVICES ═══════════════════════════════════════ */}
      <section className="py-20 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(16,185,129,0.03) 50%, transparent)' }} />
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 uppercase tracking-widest"
              style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: '#06b6d4' }}>
              <Zap size={12} /> What We Offer
            </div>
            <h2 className="text-4xl font-extrabold text-white mb-4">Everything You Need to Land the Role</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              From smart question generation to detailed scoring — MockMate covers the full interview prep lifecycle.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain, color: "#10b981", title: "AI Question Generation",
                desc: "Gemini 2.0 generates domain-specific, resume-aware questions tailored to your target role, company, and tech stack — never generic.",
                tag: "Core Feature",
              },
              {
                icon: Globe, color: "#06b6d4", title: "Live Web Research",
                desc: "Tavily searches Glassdoor, LeetCode Discuss, Blind and Levels.fyi in real-time so your questions reflect what companies actually ask in 2025.",
                tag: "Unique",
              },
              {
                icon: LineChart, color: "#8b5cf6", title: "Per-Question Scoring",
                desc: "Each answer is scored individually on depth, clarity, and technical accuracy. See exactly where you shine and where to improve.",
                tag: "Evaluation",
              },
              {
                icon: Award, color: "#f59e0b", title: "Personalised Roadmap",
                desc: "Get a 7-day study plan targeting your weakest skill domains, with curated resources and practice topics for each day.",
                tag: "Growth",
              },
              {
                icon: Shield, color: "#ec4899", title: "Resume Intelligence",
                desc: "Upload your PDF/DOCX resume — MockMate extracts your projects and skills so questions reference your actual work, not generic examples.",
                tag: "Personalisation",
              },
              {
                icon: Cpu, color: "#10b981", title: "Domain Detection",
                desc: "ML/AI, Backend, Frontend, DevOps — the engine classifies your skill domain and adjusts question categories accordingly.",
                tag: "Smart AI",
              },
            ].map((svc, i) => (
              <div key={i} className="card group hover:-translate-y-2 transition-all duration-500 relative overflow-hidden cursor-default"
                style={{ animationDelay: `${i * 0.1}s` }}>
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 transition-all duration-500"
                  style={{ background: `linear-gradient(90deg, transparent, ${svc.color}, transparent)`, opacity: 0.6 }} />
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
                    style={{ background: `${svc.color}15`, border: `1px solid ${svc.color}30` }}>
                    <svc.icon size={22} style={{ color: svc.color }} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: svc.color }}>
                      {svc.tag}
                    </span>
                    <h3 className="text-white font-semibold text-base mb-2">{svc.title}</h3>
                  </div>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed mt-3">{svc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ HOW IT WORKS ══════════════════════════════════ */}
      <section className="py-20 max-w-7xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-20 items-start">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 uppercase tracking-widest"
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6' }}>
              <ChevronRight size={12} /> How It Works
            </div>
            <h2 className="text-4xl font-extrabold text-white mb-4">From Setup to Offer in 4 Steps</h2>
            <p className="text-slate-400 mb-12 leading-relaxed">
              MockMate handles all the complexity — just bring your resume and the job description.
            </p>
            <div>
              <ProcessStep number="01" icon={Users} color="#10b981" title="Create Your Profile"
                desc="Sign up and upload your resume (PDF or DOCX). MockMate extracts your skills, projects, and experience to personalise everything." />
              <ProcessStep number="02" icon={Code2} color="#06b6d4" title="Set Up Your Interview"
                desc="Enter the target company, role, and paste the job description. Choose your interviewer persona and difficulty level." />
              <ProcessStep number="03" icon={GitBranch} color="#8b5cf6" title="AI Researches & Generates"
                desc="Gemini + Tavily search the web for current questions, combine with your resume and JD, and generate a personalised question set in seconds." />
              <ProcessStep number="04" icon={Star} color="#f59e0b" title="Interview & Get Scored"
                desc="Answer questions in the live session. Each answer is evaluated with detailed feedback, a score, and a 7-day improvement plan." />
            </div>
          </div>

          {/* Right — mock interview card */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl blur-2xl opacity-20"
              style={{ background: 'linear-gradient(135deg, #10b981, #8b5cf6)' }} />
            <div className="relative glass-panel p-6 rounded-3xl" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {/* Mock header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                  <Sparkles className="text-white" size={18} />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">MockMate AI Interviewer</div>
                  <div className="text-xs" style={{ color: '#10b981' }}>● Live Session — Google ML Engineer</div>
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <Clock size={11} /> 08:42
                </div>
              </div>

              {/* Question bubble */}
              <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <p className="text-sm text-slate-300 leading-relaxed">
                  <span className="font-semibold" style={{ color: '#10b981' }}>Q3 of 8 · ML Theory</span>
                  <br /><br />
                  "Walk me through how you'd fine-tune a pre-trained <strong className="text-white">transformer model</strong> for a domain-specific NLP task with <strong className="text-white">limited labelled data</strong>. What techniques from your <strong className="text-white">PyTorch projects</strong> would you apply?"
                </p>
              </div>

              {/* Answer input mock */}
              <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs text-slate-500 mb-1">Your answer...</p>
                <div className="w-3/4 h-2 rounded mb-2" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <div className="w-1/2 h-2 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
              </div>

              {/* Score preview */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Depth", score: 8.5, color: "#10b981" },
                  { label: "Clarity", score: 9.0, color: "#06b6d4" },
                  { label: "Accuracy", score: 7.8, color: "#8b5cf6" },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl p-3 text-center" style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
                    <div className="text-xl font-bold" style={{ color: s.color }}>{s.score}</div>
                    <div className="text-xs text-slate-500">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Bottom tags */}
              <div className="flex flex-wrap gap-2 mt-4">
                {["Transformer fine-tuning", "LoRA / PEFT", "Data augmentation", "Few-shot learning"].map((tag, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.08)', color: 'rgba(16,185,129,0.8)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ ABOUT ════════════════════════════════════════ */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(139,92,246,0.04) 100%)' }} />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — about text */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 uppercase tracking-widest"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>
                <Award size={12} /> About MockMate
              </div>
              <h2 className="text-4xl font-extrabold text-white mb-6">Built for Engineers, by an Engineer</h2>
              <div className="space-y-4 text-slate-400 leading-relaxed">
                <p>
                  MockMate was born from the frustration of practicing with outdated, generic interview questions
                  that never matched what top companies actually ask.
                </p>
                <p>
                  We built a <strong className="text-white">microservices-based AI platform</strong> that goes beyond static question banks.
                  Every session is freshly generated by combining your resume, the job description, and real-time
                  web research — so you always practice with the most relevant, current questions.
                </p>
                <p>
                  Whether you're targeting a <strong className="text-white">FAANG ML role</strong>, a
                  <strong className="text-white"> startup backend position</strong>,
                  or a <strong className="text-white">DevOps gig</strong>, MockMate adapts to you.
                </p>
              </div>
            </div>

            {/* Right — tech stack cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Database, label: "FastAPI Microservices", sub: "6 independent services", color: "#10b981" },
                { icon: Brain, label: "Gemini 2.0 Flash", sub: "Google DeepMind AI", color: "#06b6d4" },
                { icon: Globe, label: "Tavily Web Search", sub: "Live question sourcing", color: "#8b5cf6" },
                { icon: Shield, label: "Resume Parsing", sub: "PDF / DOCX support", color: "#f59e0b" },
                { icon: TrendingUp, label: "7-Day Roadmaps", sub: "Personalised growth plans", color: "#ec4899" },
                { icon: Cpu, label: "Domain Detection", sub: "ML / Backend / DevOps", color: "#10b981" },
              ].map((t, i) => (
                <div key={i} className="card group hover:-translate-y-1 transition-all duration-300 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${t.color}15` }}>
                    <t.icon size={18} style={{ color: t.color }} />
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">{t.label}</div>
                    <div className="text-slate-500 text-xs">{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════ CTA ══════════════════════════════════════════ */}
      <section className="py-24 max-w-7xl mx-auto px-6 w-full">
        <div className="relative rounded-3xl overflow-hidden p-12 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(6,182,212,0.08) 50%, rgba(139,92,246,0.1) 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.1) 0%, transparent 70%)' }} />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
              Ready to <span className="text-gradient">Land Your Dream Role?</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10">
              Your next interview is closer than you think. Start practising with AI-generated,
              resume-aware questions right now — completely free.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button onClick={() => navigate('/new-interview')}
                className="btn-primary text-lg px-10 py-4 animate-pulse-glow">
                Start Your First Interview <ArrowRight size={20} />
              </button>
              <button onClick={() => navigate('/profile')}
                className="btn-secondary text-lg px-10 py-4">
                Upload Resume First
              </button>
            </div>
            <p className="text-slate-600 text-xs mt-6">
              No credit card required · Free forever · Powered by Gemini + Tavily
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};
