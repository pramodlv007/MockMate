import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Brain, LineChart, Zap, Target, Globe, Shield,
  ChevronRight, Play, CheckCircle, Star, Users, Award, TrendingUp,
  Code2, Database, Cpu, GitBranch, Sparkles, Clock,
  type LucideIcon
} from 'lucide-react';

/* ── Animated counter ───────────────────────────────────────────────────────── */
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

/* ── Interview Room Illustration ────────────────────────────────────────────── */
const InterviewIllustration = () => (
  <svg viewBox="0 0 440 360" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <defs>
      <radialGradient id="roomGlow" cx="50%" cy="45%" r="50%">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#080f1e" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="screenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0d1a30" />
        <stop offset="100%" stopColor="#0a1628" />
      </linearGradient>
      <linearGradient id="goldLine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#c9a855" stopOpacity="0" />
        <stop offset="50%" stopColor="#c9a855" />
        <stop offset="100%" stopColor="#c9a855" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="blueLine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
        <stop offset="50%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
      </linearGradient>
      <filter id="softGlow">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="goldGlow">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>

    {/* Background ambient glow */}
    <ellipse cx="220" cy="170" rx="180" ry="140" fill="url(#roomGlow)" />

    {/* Blueprint grid */}
    {[...Array(8)].map((_, i) => (
      <line key={`v${i}`} x1={30 + i * 55} y1="20" x2={30 + i * 55} y2="340"
        stroke="rgba(59,130,246,0.04)" strokeWidth="1" />
    ))}
    {[...Array(7)].map((_, i) => (
      <line key={`h${i}`} x1="20" y1={30 + i * 50} x2="420" y2={30 + i * 50}
        stroke="rgba(59,130,246,0.04)" strokeWidth="1" />
    ))}

    {/* ── DESK SURFACE ── */}
    <rect x="70" y="248" width="300" height="10" rx="4"
      fill="#0d1a30" stroke="rgba(201,168,85,0.25)" strokeWidth="1" />
    {/* Desk highlight stripe */}
    <rect x="70" y="248" width="300" height="2" rx="1" fill="rgba(201,168,85,0.1)" />
    {/* Desk legs */}
    <rect x="82"  y="258" width="7" height="55" rx="2" fill="#0a1525" />
    <rect x="351" y="258" width="7" height="55" rx="2" fill="#0a1525" />

    {/* ── MONITOR ── */}
    {/* Monitor bezel */}
    <rect x="115" y="88" width="210" height="138" rx="10"
      fill="#0d1a30" stroke="rgba(59,130,246,0.35)" strokeWidth="1.5" />
    {/* Screen */}
    <rect x="122" y="95" width="196" height="122" rx="6" fill="url(#screenGrad)" />
    {/* Screen scan-line effect */}
    <rect x="122" y="95" width="196" height="3" rx="0"
      fill="rgba(59,130,246,0.06)" className="animate-scan" />

    {/* Monitor stand */}
    <rect x="207" y="226" width="26" height="22" rx="2" fill="#0a1525" stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
    <rect x="192" y="245" width="56" height="5" rx="2" fill="#0a1525" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />

    {/* ── SCREEN CONTENT — AI Interviewer ── */}
    {/* Interviewer avatar bg */}
    <circle cx="220" cy="145" r="32" fill="rgba(37,99,235,0.08)" stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
    {/* Head */}
    <circle cx="220" cy="136" r="13" fill="rgba(37,99,235,0.15)" stroke="rgba(59,130,246,0.4)" strokeWidth="1.2" />
    {/* Shoulders */}
    <path d="M198 170 Q220 160 242 170" stroke="rgba(59,130,246,0.4)" strokeWidth="2" strokeLinecap="round" fill="none" />

    {/* Live badge */}
    <rect x="128" y="101" width="34" height="12" rx="4" fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.3)" strokeWidth="0.5" />
    <circle cx="135" cy="107" r="2.5" fill="#f87171" filter="url(#softGlow)" />
    <text x="148" y="111" textAnchor="middle" fill="#f87171" fontSize="6.5" fontWeight="700">LIVE</text>

    {/* "AI Interviewer" label */}
    <text x="220" y="185" textAnchor="middle" fill="#60a5fa" fontSize="7.5" fontWeight="600">AI Interviewer</text>

    {/* Question text lines on screen */}
    <rect x="130" y="194" width="80" height="3" rx="1.5" fill="rgba(201,168,85,0.35)" />
    <rect x="130" y="200" width="140" height="2.5" rx="1" fill="rgba(255,255,255,0.08)" />
    <rect x="130" y="206" width="110" height="2.5" rx="1" fill="rgba(255,255,255,0.06)" />
    <rect x="130" y="212" width="125" height="2.5" rx="1" fill="rgba(255,255,255,0.05)" />

    {/* ── LAPTOP (candidate) ── */}
    {/* Laptop base */}
    <rect x="178" y="232" width="84" height="16" rx="3"
      fill="#0d1a30" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
    {/* Laptop screen open (lid) */}
    <rect x="180" y="214" width="80" height="20" rx="3"
      fill="#0a1525" stroke="rgba(59,130,246,0.2)" strokeWidth="0.8" />
    {/* Laptop screen glow */}
    <rect x="182" y="216" width="76" height="16" rx="2" fill="rgba(59,130,246,0.07)" />
    {/* Code lines on laptop */}
    <rect x="185" y="219" width="35" height="2" rx="1" fill="rgba(59,130,246,0.4)" />
    <rect x="185" y="223" width="50" height="2" rx="1" fill="rgba(201,168,85,0.3)" />
    <rect x="185" y="227" width="28" height="2" rx="1" fill="rgba(100,116,139,0.3)" />

    {/* Trackpad */}
    <rect x="208" y="241" width="24" height="5" rx="2" fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.15)" strokeWidth="0.5" />

    {/* ── DESK ITEMS ── */}
    {/* Coffee mug */}
    <rect x="330" y="228" width="22" height="20" rx="4"
      fill="#0d1a30" stroke="rgba(201,168,85,0.3)" strokeWidth="1" />
    <rect x="331" y="229" width="20" height="9" rx="2" fill="rgba(201,168,85,0.07)" />
    <path d="M352 234 Q358 234 358 239 Q358 244 352 244"
      stroke="rgba(201,168,85,0.3)" strokeWidth="1.5" fill="none" />
    {/* Steam */}
    <path d="M338 225 Q339.5 221 338 217" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeLinecap="round" />
    <path d="M343 224 Q344.5 220 343 216" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeLinecap="round" />

    {/* Notepad / resume */}
    <rect x="88" y="231" width="38" height="18" rx="3"
      fill="#0d1a30" stroke="rgba(201,168,85,0.2)" strokeWidth="1" />
    {/* Page lines */}
    <rect x="92" y="234" width="24" height="1.5" rx="0.5" fill="rgba(255,255,255,0.1)" />
    <rect x="92" y="237" width="28" height="1.5" rx="0.5" fill="rgba(255,255,255,0.07)" />
    <rect x="92" y="240" width="20" height="1.5" rx="0.5" fill="rgba(255,255,255,0.07)" />
    <rect x="92" y="243" width="25" height="1.5" rx="0.5" fill="rgba(255,255,255,0.05)" />
    {/* Resume label */}
    <text x="107" y="253" textAnchor="middle" fill="rgba(201,168,85,0.5)" fontSize="5.5" fontWeight="600">RESUME</text>

    {/* ── PERSON (candidate, side-view sketch) ── */}
    {/* Chair back */}
    <rect x="56" y="200" width="7" height="60" rx="3"
      fill="#0a1525" stroke="rgba(59,130,246,0.15)" strokeWidth="0.8" />
    {/* Chair seat */}
    <rect x="46" y="256" width="36" height="6" rx="3"
      fill="#0a1525" stroke="rgba(59,130,246,0.15)" strokeWidth="0.8" />
    {/* Chair leg */}
    <rect x="54" y="260" width="4" height="30" rx="2" fill="#0a1525" />
    {/* Torso */}
    <rect x="50" y="218" width="22" height="38" rx="6"
      fill="rgba(37,99,235,0.12)" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
    {/* Head */}
    <circle cx="62" cy="207" r="13"
      fill="rgba(37,99,235,0.1)" stroke="rgba(59,130,246,0.3)" strokeWidth="1" />
    {/* Arm reaching to laptop */}
    <path d="M70 232 Q105 236 178 237"
      stroke="rgba(59,130,246,0.25)" strokeWidth="4" strokeLinecap="round" fill="none" />
    {/* Neck */}
    <rect x="58" y="218" width="8" height="8" rx="2" fill="rgba(37,99,235,0.15)" />

    {/* ── FLOATING BADGES ── */}
    {/* Score badge — right */}
    <rect x="358" y="128" width="74" height="58" rx="10"
      fill="rgba(8,15,30,0.92)" stroke="rgba(201,168,85,0.35)" strokeWidth="1" filter="url(#goldGlow)" />
    <text x="395" y="147" textAnchor="middle" fill="#c9a855" fontSize="8" fontWeight="700" letterSpacing="1">SCORE</text>
    <text x="395" y="167" textAnchor="middle" fill="#f1f5f9" fontSize="22" fontWeight="800">8.4</text>
    <text x="395" y="180" textAnchor="middle" fill="#64748b" fontSize="7">out of 10</text>
    <line x1="358" y1="157" x2="322" y2="170" stroke="rgba(201,168,85,0.2)" strokeWidth="1" strokeDasharray="3 3" />

    {/* Question counter — left */}
    <rect x="8" y="130" width="70" height="50" rx="10"
      fill="rgba(8,15,30,0.92)" stroke="rgba(59,130,246,0.35)" strokeWidth="1" filter="url(#softGlow)" />
    <text x="43" y="150" textAnchor="middle" fill="#60a5fa" fontSize="7.5" fontWeight="700" letterSpacing="0.5">QUESTION</text>
    <text x="43" y="170" textAnchor="middle" fill="#f1f5f9" fontSize="20" fontWeight="800">3/8</text>
    <line x1="78" y1="155" x2="115" y2="155" stroke="rgba(59,130,246,0.2)" strokeWidth="1" strokeDasharray="3 3" />

    {/* Timer badge */}
    <rect x="8" y="195" width="70" height="32" rx="10"
      fill="rgba(220,38,38,0.08)" stroke="rgba(239,68,68,0.25)" strokeWidth="1" />
    <text x="43" y="215" textAnchor="middle" fill="#f87171" fontSize="13" fontWeight="700">⏱ 08:42</text>

    {/* Hire recommendation badge */}
    <rect x="358" y="196" width="74" height="32" rx="10"
      fill="rgba(34,197,94,0.08)" stroke="rgba(34,197,94,0.25)" strokeWidth="1" />
    <text x="395" y="211" textAnchor="middle" fill="#4ade80" fontSize="7" fontWeight="700">RECOMMENDATION</text>
    <text x="395" y="222" textAnchor="middle" fill="#4ade80" fontSize="8" fontWeight="800">Strong Hire ✓</text>

    {/* Decorative gold accent lines */}
    <line x1="70" y1="258" x2="370" y2="258" stroke="url(#goldLine)" strokeWidth="0.8" opacity="0.5" />
    <line x1="122" y1="95"  x2="318" y2="95"  stroke="url(#blueLine)" strokeWidth="0.8" opacity="0.6" />
  </svg>
);

/* ── Process step ───────────────────────────────────────────────────────────── */
const ProcessStep = ({ number, icon: Icon, title, desc, color }: {
  number: string; icon: LucideIcon;
  title: string; desc: string; color: string;
}) => (
  <div className="flex gap-5 group">
    <div className="flex flex-col items-center gap-2">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
        style={{ background: `${color}18`, border: `1.5px solid ${color}40` }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div className="w-px flex-1 min-h-[40px]"
        style={{ background: `linear-gradient(to bottom, ${color}40, transparent)` }} />
    </div>
    <div className="pb-8">
      <div className="text-xs font-bold mb-1 tracking-widest uppercase" style={{ color }}>Step {number}</div>
      <h4 className="text-white font-semibold text-lg mb-1">{title}</h4>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  </div>
);

/* ── Tech strip data ────────────────────────────────────────────────────────── */
const techStack = [
  { name: "Python",        color: "#3b82f6" },
  { name: "React",         color: "#60a5fa" },
  { name: "ML / AI",       color: "#c9a855" },
  { name: "Node.js",       color: "#4ade80" },
  { name: "System Design", color: "#818cf8" },
  { name: "AWS",           color: "#f59e0b" },
  { name: "Docker",        color: "#60a5fa" },
  { name: "SQL",           color: "#f97316" },
  { name: "Algorithms",    color: "#c9a855" },
  { name: "TypeScript",    color: "#3b82f6" },
];

/* ─────────────────────────────────────────────────────────────────────────── */
export const Home = () => {
  const navigate = useNavigate();
  const statsRef  = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  const q1 = useCounter(12400, 2000, statsVisible);
  const q2 = useCounter(320,   1800, statsVisible);
  const q3 = useCounter(94,    1600, statsVisible);
  const q4 = useCounter(7,     1200, statsVisible);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-0 overflow-x-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#f1f5f9' }}>

      {/* ════ HERO ═══════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Blue radial top-center */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-15 blur-3xl"
            style={{ background: 'radial-gradient(ellipse, #2563eb 0%, transparent 70%)' }} />
          {/* Gold accent bottom-right */}
          <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full opacity-8 blur-3xl"
            style={{ background: 'radial-gradient(circle, #c9a855 0%, transparent 70%)' }} />
          {/* Blueprint grid */}
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          {/* Diagonal accent lines */}
          <div className="absolute top-0 right-0 w-px h-[40%] opacity-20"
            style={{ background: 'linear-gradient(to bottom, transparent, #c9a855, transparent)', marginRight: '15%' }} />
          <div className="absolute top-0 right-0 w-px h-[60%] opacity-10"
            style={{ background: 'linear-gradient(to bottom, transparent, #3b82f6, transparent)', marginRight: '25%' }} />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center py-20">
          {/* Left — copy */}
          <div className="animate-slide-up space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(201,168,85,0.1)', border: '1px solid rgba(201,168,85,0.3)', color: '#c9a855' }}>
              <Sparkles size={14} />
              Powered by Gemini 2.5 Flash · Resume-Aware AI
            </div>

            <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.1]">
              <span className="text-gradient-hero">Ace Every</span>
              <br />
              <span className="text-gradient">Tech Interview</span>
              <br />
              <span className="text-white">with AI coaching</span>
            </h1>

            <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
              MockMate generates <strong className="text-white">personalised</strong> interview questions
              from your resume + job description. Practice on camera with an AI interviewer
              and get a detailed scorecard instantly.
            </p>

            {/* Feature bullets */}
            {[
              "Resume-aware — asks about your actual projects",
              "Company-specific question styles for 10+ top firms",
              "Per-question scoring with a 7-day improvement roadmap",
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle size={18} className="flex-shrink-0" style={{ color: '#c9a855' }} />
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

          {/* Right — Interview Room illustration */}
          <div className="hidden lg:block animate-float" style={{ animationDelay: '0.3s' }}>
            <div className="relative w-full max-w-[480px] mx-auto">
              {/* Outer ambient glow */}
              <div className="absolute inset-8 rounded-full blur-3xl opacity-20 animate-pulse"
                style={{ background: 'radial-gradient(circle, #3b82f6, #c9a855, #1e3a8a)' }} />
              <InterviewIllustration />

              {/* Floating info chips */}
              <div className="absolute -top-3 -right-6 glass-panel px-4 py-2.5 rounded-2xl animate-float"
                style={{ animationDelay: '1s', borderColor: 'rgba(201,168,85,0.25)' }}>
                <div className="text-xs text-slate-400 mb-0.5">Gemini 2.5</div>
                <div className="text-sm font-bold" style={{ color: '#c9a855' }}>✓ Live Analysis</div>
              </div>
              <div className="absolute -bottom-1 -left-6 glass-panel px-4 py-2.5 rounded-2xl animate-float"
                style={{ animationDelay: '1.8s', borderColor: 'rgba(59,130,246,0.25)' }}>
                <div className="text-xs text-slate-400 mb-0.5">Overall Score</div>
                <div className="text-sm font-bold" style={{ color: '#60a5fa' }}>⭐ 8.4 / 10</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ TECH STRIP ════════════════════════════════════════════════════ */}
      <div className="relative py-6 overflow-hidden"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(13,26,48,0.4)' }}>
        <p className="text-center text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: 'rgba(201,168,85,0.5)' }}>
          Covers all major tech stacks &amp; domains
        </p>
        <div className="flex gap-6 animate-shimmer" style={{ width: 'max-content' }}>
          {[...techStack, ...techStack].map((t, i) => (
            <span key={i} className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
              style={{ background: `${t.color}12`, color: t.color, border: `1px solid ${t.color}28` }}>
              {t.name}
            </span>
          ))}
        </div>
      </div>

      {/* ════ STATS ══════════════════════════════════════════════════════════ */}
      <section ref={statsRef} className="py-20 max-w-7xl mx-auto px-6 w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: q1, suffix: "+",      label: "Questions Generated",  color: "#3b82f6",  icon: Brain },
            { value: q2, suffix: "+",      label: "Companies Covered",    color: "#c9a855",  icon: Globe },
            { value: q3, suffix: "%",      label: "Accuracy Rate",        color: "#818cf8",  icon: Target },
            { value: q4, suffix: "-Day",   label: "Personalised roadmap", color: "#f59e0b",  icon: TrendingUp },
          ].map((s, i) => (
            <div key={i} className="card text-center group hover:-translate-y-2 transition-all duration-500">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ background: `${s.color}15`, border: `1px solid ${s.color}25` }}>
                <s.icon size={22} style={{ color: s.color }} />
              </div>
              <div className="text-4xl font-extrabold mb-1" style={{ color: s.color }}>
                {s.value.toLocaleString()}{s.suffix}
              </div>
              <div className="text-sm" style={{ color: '#64748b' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ SERVICES ═══════════════════════════════════════════════════════ */}
      <section className="py-20 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(37,99,235,0.03) 50%, transparent)' }} />
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 uppercase tracking-widest"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
              <Zap size={12} /> What We Offer
            </div>
            <h2 className="text-4xl font-extrabold text-white mb-4">Everything You Need to Land the Role</h2>
            <p className="max-w-xl mx-auto" style={{ color: '#64748b' }}>
              From smart question generation to detailed scoring — MockMate covers the full interview prep lifecycle.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Brain,     color: "#3b82f6", title: "AI Question Generation",
                desc: "Gemini 2.5 Flash generates domain-specific, resume-aware questions tailored to your target role, company, and tech stack — never generic.",
                tag: "Core Feature" },
              { icon: Globe,     color: "#c9a855", title: "Company-Specific Patterns",
                desc: "Tailored question styles for 10+ top firms — Google system design depth, Amazon leadership principles, Meta product sense, and more.",
                tag: "Unique" },
              { icon: LineChart, color: "#818cf8", title: "Per-Question Scoring",
                desc: "Each answer is scored individually on depth, clarity, and technical accuracy. See exactly where you shine and where to improve.",
                tag: "Evaluation" },
              { icon: Award,     color: "#f59e0b", title: "Personalised Roadmap",
                desc: "Get a 7-day study plan targeting your weakest skill domains, with curated resources and practice topics for each day.",
                tag: "Growth" },
              { icon: Shield,    color: "#60a5fa", title: "Resume Intelligence",
                desc: "Upload your PDF/DOCX resume — MockMate extracts your projects and skills so questions reference your actual work, not generic examples.",
                tag: "Personalisation" },
              { icon: Cpu,       color: "#c9a855", title: "Vision + Speech Analysis",
                desc: "Gemini Vision scores eye contact, posture, and engagement. Speech metrics track WPM, filler words, and pace across your answers.",
                tag: "Smart AI" },
            ].map((svc, i) => (
              <div key={i} className="card group hover:-translate-y-2 transition-all duration-500 relative overflow-hidden cursor-default">
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 transition-all duration-500"
                  style={{ background: `linear-gradient(90deg, transparent, ${svc.color}, transparent)`, opacity: 0.7 }} />
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
                <p className="text-sm leading-relaxed mt-3" style={{ color: '#64748b' }}>{svc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ HOW IT WORKS ══════════════════════════════════════════════════ */}
      <section className="py-20 max-w-7xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-20 items-start">
          {/* Left — steps */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 uppercase tracking-widest"
              style={{ background: 'rgba(201,168,85,0.1)', border: '1px solid rgba(201,168,85,0.2)', color: '#c9a855' }}>
              <ChevronRight size={12} /> How It Works
            </div>
            <h2 className="text-4xl font-extrabold text-white mb-4">From Setup to Offer in 4 Steps</h2>
            <p className="mb-12 leading-relaxed" style={{ color: '#64748b' }}>
              MockMate handles all the complexity — just bring your resume and the job description.
            </p>
            <div>
              <ProcessStep number="01" icon={Users}     color="#3b82f6" title="Create Your Profile"
                desc="Sign up and upload your resume (PDF or DOCX). MockMate extracts your skills, projects, and experience to personalise everything." />
              <ProcessStep number="02" icon={Code2}     color="#c9a855" title="Set Up Your Interview"
                desc="Enter the target company, role, and paste the job description. Choose your interviewer persona and difficulty level." />
              <ProcessStep number="03" icon={GitBranch} color="#818cf8" title="AI Generates Your Questions"
                desc="Gemini 2.5 Flash combines your resume, the JD, and company patterns to generate a personalised question set in seconds." />
              <ProcessStep number="04" icon={Star}      color="#f59e0b" title="Interview & Get Scored"
                desc="Answer questions on camera. Each answer is evaluated with detailed feedback, a score, and a personalised 7-day improvement plan." />
            </div>
          </div>

          {/* Right — mock interview card */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl blur-2xl opacity-15"
              style={{ background: 'linear-gradient(135deg, #2563eb, #c9a855)' }} />
            <div className="relative glass-panel p-6 rounded-3xl"
              style={{ borderColor: 'rgba(201,168,85,0.12)' }}>
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)' }}>
                  <Sparkles className="text-white" size={18} />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">MockMate AI Interviewer</div>
                  <div className="text-xs" style={{ color: '#c9a855' }}>● Live Session — Google ML Engineer</div>
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <Clock size={11} /> 08:42
                </div>
              </div>

              {/* Question bubble */}
              <div className="rounded-2xl p-4 mb-4"
                style={{ background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <p className="text-sm leading-relaxed" style={{ color: '#cbd5e1' }}>
                  <span className="font-semibold" style={{ color: '#60a5fa' }}>Q3 of 8 · ML Theory</span>
                  <br /><br />
                  "Walk me through how you'd fine-tune a pre-trained{' '}
                  <strong className="text-white">transformer model</strong> for a domain-specific NLP task
                  with <strong className="text-white">limited labelled data</strong>. What techniques from
                  your <strong className="text-white">PyTorch projects</strong> would you apply?"
                </p>
              </div>

              {/* Answer input mock */}
              <div className="rounded-2xl p-4 mb-4"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs mb-1" style={{ color: '#475569' }}>Your answer...</p>
                <div className="w-3/4 h-2 rounded mb-2" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <div className="w-1/2 h-2 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
              </div>

              {/* Score grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Depth",    score: 8.5, color: "#3b82f6" },
                  { label: "Clarity",  score: 9.0, color: "#c9a855" },
                  { label: "Accuracy", score: 7.8, color: "#818cf8" },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl p-3 text-center"
                    style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
                    <div className="text-xl font-bold" style={{ color: s.color }}>{s.score}</div>
                    <div className="text-xs" style={{ color: '#475569' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-4">
                {["Transformer fine-tuning", "LoRA / PEFT", "Data augmentation", "Few-shot learning"].map((tag, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(201,168,85,0.08)', color: 'rgba(201,168,85,0.8)', border: '1px solid rgba(201,168,85,0.15)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ ABOUT ══════════════════════════════════════════════════════════ */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.04) 0%, rgba(201,168,85,0.03) 100%)' }} />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 uppercase tracking-widest"
                style={{ background: 'rgba(201,168,85,0.1)', border: '1px solid rgba(201,168,85,0.2)', color: '#c9a855' }}>
                <Award size={12} /> About MockMate
              </div>
              <h2 className="text-4xl font-extrabold text-white mb-6">Built for Engineers, by an Engineer</h2>
              <div className="space-y-4 leading-relaxed" style={{ color: '#64748b' }}>
                <p>
                  MockMate was born from the frustration of practicing with outdated, generic interview questions
                  that never matched what top companies actually ask.
                </p>
                <p>
                  We built a <strong className="text-white">consolidated AI platform</strong> that goes beyond static question banks.
                  Every session is freshly generated by combining your resume, the job description, and
                  company-specific question intelligence — so you always practice with the most relevant, current questions.
                </p>
                <p>
                  Whether you're targeting a <strong className="text-white">FAANG ML role</strong>, a
                  {' '}<strong className="text-white">startup backend position</strong>,
                  or a <strong className="text-white">DevOps gig</strong>, MockMate adapts to you.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Database,   label: "FastAPI Backend",      sub: "Consolidated microservices",   color: "#3b82f6" },
                { icon: Brain,      label: "Gemini 2.5 Flash",     sub: "Google DeepMind AI",           color: "#c9a855" },
                { icon: Globe,      label: "Company Patterns",     sub: "10+ top-tier firms",           color: "#818cf8" },
                { icon: Shield,     label: "Resume Parsing",       sub: "PDF / DOCX support",           color: "#f59e0b" },
                { icon: TrendingUp, label: "7-Day Roadmaps",       sub: "Personalised growth plans",    color: "#60a5fa" },
                { icon: Cpu,        label: "Vision Analysis",      sub: "Eye contact · Posture · Pace", color: "#c9a855" },
              ].map((t, i) => (
                <div key={i} className="card group hover:-translate-y-1 transition-all duration-300 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${t.color}15`, border: `1px solid ${t.color}25` }}>
                    <t.icon size={18} style={{ color: t.color }} />
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">{t.label}</div>
                    <div className="text-xs" style={{ color: '#475569' }}>{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════ CTA ════════════════════════════════════════════════════════════ */}
      <section className="py-24 max-w-7xl mx-auto px-6 w-full">
        <div className="relative rounded-3xl overflow-hidden p-12 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(13,26,48,0.8) 50%, rgba(201,168,85,0.08) 100%)',
            border: '1px solid rgba(201,168,85,0.12)',
          }}>
          {/* Radial glow top */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.12) 0%, transparent 65%)' }} />
          {/* Horizontal accent line */}
          <div className="absolute top-0 left-1/4 right-1/4 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,85,0.5), transparent)' }} />

          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
              Ready to <span className="text-gradient">Land Your Dream Role?</span>
            </h2>
            <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: '#64748b' }}>
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
            <p className="text-xs mt-6" style={{ color: '#334155' }}>
              No credit card required · Free forever · Powered by Gemini 2.5 Flash
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};
