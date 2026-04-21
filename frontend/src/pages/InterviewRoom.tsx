import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { endpoints, type InterviewSession } from '../api';
import axios from 'axios';
import {
    Video, VideoOff, Mic, MicOff, PhoneOff, Clock,
    ChevronRight, AlertCircle, CheckCircle, MessageSquare,
    Users, Bot, Sparkles
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type ThemeKey = 'mockmate' | 'zoom' | 'meet' | 'skype';

const THEMES: Record<ThemeKey, {
    name: string; icon: string;
    bg: string; headerBg: string; controlsBg: string; controlsBorder: string;
    panelBg: string; panelBorder: string;
    accent: string; accentRgb: string;
    endCall: string; tileBg: string;
    text: string; subtext: string;
    btnBg: string; btnHover: string;
}> = {
    mockmate: {
        name: 'MockMate', icon: '🎯',
        bg: '#060611', headerBg: 'rgba(6,6,17,0.85)', controlsBg: 'rgba(15,15,30,0.95)',
        controlsBorder: 'rgba(16,185,129,0.2)',
        panelBg: 'rgba(255,255,255,0.03)', panelBorder: 'rgba(255,255,255,0.07)',
        accent: '#10b981', accentRgb: '16,185,129',
        endCall: '#ef4444', tileBg: 'rgba(16,185,129,0.08)',
        text: '#f1f5f9', subtext: '#94a3b8',
        btnBg: 'rgba(255,255,255,0.07)', btnHover: 'rgba(255,255,255,0.12)',
    },
    zoom: {
        name: 'Zoom', icon: 'Z',
        bg: '#1C1C1C', headerBg: 'rgba(0,0,0,0.9)', controlsBg: '#2D2D2D',
        controlsBorder: '#444',
        panelBg: '#262626', panelBorder: '#3D3D3D',
        accent: '#2D8CFF', accentRgb: '45,140,255',
        endCall: '#E34850', tileBg: 'rgba(45,140,255,0.1)',
        text: '#FFFFFF', subtext: '#B0B0B0',
        btnBg: '#3D3D3D', btnHover: '#4D4D4D',
    },
    meet: {
        name: 'Google Meet', icon: 'M',
        bg: '#202124', headerBg: 'rgba(32,33,36,0.95)', controlsBg: '#1E1F22',
        controlsBorder: '#3C4043',
        panelBg: '#292A2D', panelBorder: '#3C4043',
        accent: '#1A73E8', accentRgb: '26,115,232',
        endCall: '#EA4335', tileBg: 'rgba(26,115,232,0.1)',
        text: '#E8EAED', subtext: '#9AA0A6',
        btnBg: '#3C4043', btnHover: '#4A4D50',
    },
    skype: {
        name: 'Skype', icon: 'S',
        bg: '#1A1A2E', headerBg: 'rgba(0,175,240,0.08)', controlsBg: '#0F0F23',
        controlsBorder: 'rgba(0,175,240,0.3)',
        panelBg: '#16213E', panelBorder: 'rgba(0,175,240,0.2)',
        accent: '#00AFF0', accentRgb: '0,175,240',
        endCall: '#DC143C', tileBg: 'rgba(0,175,240,0.08)',
        text: '#FFFFFF', subtext: '#A0B4C8',
        btnBg: 'rgba(0,175,240,0.12)', btnHover: 'rgba(0,175,240,0.22)',
    },
};

const THEME_ORDER: ThemeKey[] = ['mockmate', 'zoom', 'meet', 'skype'];

export const InterviewRoom = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [session, setSession] = useState<InterviewSession | null>(null);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [questionTimer, setQuestionTimer] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [questionTranscripts, setQuestionTranscripts] = useState<Record<number, string>>({});
    const [theme, setTheme] = useState<ThemeKey>('mockmate');
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [showPanel, setShowPanel] = useState(true);
    const [aiSpeaking, setAiSpeaking] = useState(false);

    const t = THEMES[theme];

    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<any>(null);
    const currentQuestionIdxRef = useRef(0);

    // Simulate AI "speaking" periodically when interview starts
    useEffect(() => {
        if (!isRecording) return;
        const interval = setInterval(() => {
            setAiSpeaking(true);
            setTimeout(() => setAiSpeaking(false), 1200 + Math.random() * 1800);
        }, 6000 + Math.random() * 4000);
        return () => clearInterval(interval);
    }, [isRecording]);

    useEffect(() => {
        if (!id) return;
        endpoints.getInterview(id).then(res => {
            setSession(res.data);
            setTimeLeft(res.data.duration_minutes * 60);
        }).catch(err => console.error('Failed to load interview:', err));
    }, [id]);

    useEffect(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript + ' ';
            const idx = currentQuestionIdxRef.current;
            setQuestionTranscripts(prev => ({ ...prev, [idx]: transcript.trim() }));
        };
        recognition.onerror = (event: any) => console.warn('[SR] Error:', event.error);
        recognitionRef.current = recognition;
    }, []);

    useEffect(() => { currentQuestionIdxRef.current = currentQuestionIdx; }, [currentQuestionIdx]);

    useEffect(() => {
        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                    audio: true,
                });
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
                setCameraReady(true);
            } catch (err: any) {
                if (err.name === 'NotAllowedError') setCameraError('Camera access denied. Please enable permissions.');
                else if (err.name === 'NotFoundError') setCameraError('No camera found. Please connect a webcam.');
                else setCameraError(`Camera error: ${err.message}`);
            }
        };
        initCamera();
        return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
    }, []);

    useEffect(() => {
        let interval: any;
        if (isRecording && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => { if (prev <= 1) { finishInterview(); return 0; } return prev - 1; });
                setQuestionTimer(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording, timeLeft]);

    const toggleMic = () => {
        if (!streamRef.current) return;
        streamRef.current.getAudioTracks().forEach(t => { t.enabled = isMicMuted; });
        setIsMicMuted(!isMicMuted);
    };

    const toggleCamera = () => {
        if (!streamRef.current) return;
        streamRef.current.getVideoTracks().forEach(t => { t.enabled = isCameraOff; });
        setIsCameraOff(!isCameraOff);
    };

    const startInterview = () => {
        if (!streamRef.current) { alert('Camera not ready.'); return; }
        chunksRef.current = [];
        const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
        const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
        const recorder = new MediaRecorder(streamRef.current, { mimeType });
        recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        try { recognitionRef.current?.start(); } catch (_) {}
        setAiSpeaking(true);
        setTimeout(() => setAiSpeaking(false), 2500);
    };

    const finishInterview = () => {
        if (!mediaRecorderRef.current || !isRecording) return;
        try { recognitionRef.current?.stop(); } catch (_) {}
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        mediaRecorderRef.current.onstop = uploadVideo;
    };

    const uploadVideo = async () => {
        setIsUploading(true);
        if (chunksRef.current.length === 0) { navigate(`/results/${id}`); return; }
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        if (blob.size < 1000) { navigate(`/results/${id}`); return; }
        try {
            if (id) {
                await endpoints.uploadVideo(id, blob);
                const token = localStorage.getItem('token');
                if (Object.keys(questionTranscripts).length > 0) {
                    try {
                        await axios.post(`${API_URL}/interviews/${id}/transcripts`,
                            { transcripts: questionTranscripts },
                            { headers: { Authorization: `Bearer ${token}` } });
                    } catch (_) {}
                }
            }
            navigate(`/results/${id}`);
        } catch (err: any) {
            alert(`Upload failed: ${err?.response?.data?.detail ?? err?.message}\n\nYou can still view results.`);
            navigate(`/results/${id}`);
        } finally { setIsUploading(false); }
    };

    const nextQuestion = () => {
        if (!session) return;
        try { recognitionRef.current?.stop(); } catch (_) {}
        setTimeout(() => { try { recognitionRef.current?.start(); } catch (_) {} }, 200);
        if (currentQuestionIdx < session.questions.length - 1) {
            setCurrentQuestionIdx(prev => prev + 1);
            setQuestionTimer(0);
        } else { finishInterview(); }
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const isLastQuestion = session && currentQuestionIdx === session.questions.length - 1;

    if (!session) return (
        <div className="flex items-center justify-center h-screen" style={{ background: t.bg }}>
            <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full mx-auto animate-spin"
                    style={{ border: `3px solid rgba(${t.accentRgb},0.2)`, borderTopColor: t.accent }} />
                <p className="text-lg animate-pulse" style={{ color: t.accent }}>Creating your interview session...</p>
            </div>
        </div>
    );

    if (!session.questions?.length) return (
        <div className="flex items-center justify-center h-screen" style={{ background: t.bg }}>
            <p className="text-lg animate-pulse" style={{ color: t.accent }}>Generating questions from your profile...</p>
        </div>
    );

    const currentQuestion = session.questions[currentQuestionIdx];

    return (
        <div className="flex flex-col overflow-hidden" style={{ background: t.bg, height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* ── Header Bar ───────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-3 z-20 flex-shrink-0"
                style={{ background: t.headerBg, borderBottom: `1px solid rgba(${t.accentRgb},0.12)`, backdropFilter: 'blur(20px)' }}>

                {/* Left: Branding */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ background: t.accent, color: '#fff' }}>
                        {t.icon === '🎯' ? '🎯' : t.icon}
                    </div>
                    <div>
                        <div className="text-sm font-semibold" style={{ color: t.text }}>{t.name} Interview</div>
                        <div className="text-xs" style={{ color: t.subtext }}>
                            {session.target_role || 'Technical Interview'}
                        </div>
                    </div>
                </div>

                {/* Center: Timer */}
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full"
                    style={{ background: isRecording ? `rgba(${t.accentRgb},0.12)` : 'rgba(255,255,255,0.06)', border: `1px solid rgba(${t.accentRgb},0.25)` }}>
                    <Clock size={14} style={{ color: t.accent }} />
                    <span className="text-sm font-mono font-semibold" style={{ color: t.text }}>{formatTime(timeLeft)}</span>
                    {isRecording && <div className="w-2 h-2 rounded-full animate-pulse ml-1" style={{ background: '#ef4444' }} />}
                </div>

                {/* Right: Theme Switcher + Status */}
                <div className="flex items-center gap-3">
                    {/* Theme Switcher */}
                    <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {THEME_ORDER.map(k => (
                            <button key={k} onClick={() => setTheme(k)}
                                title={THEMES[k].name}
                                className="w-7 h-7 rounded-md text-xs font-bold transition-all"
                                style={{
                                    background: theme === k ? THEMES[k].accent : 'transparent',
                                    color: theme === k ? '#fff' : THEMES[k].subtext,
                                    transform: theme === k ? 'scale(1.1)' : 'scale(1)',
                                }}>
                                {THEMES[k].icon}
                            </button>
                        ))}
                    </div>

                    {/* Participants pill */}
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <Users size={13} style={{ color: t.subtext }} />
                        <span className="text-xs" style={{ color: t.subtext }}>2</span>
                    </div>
                </div>
            </div>

            {/* ── Main Content ─────────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">

                {/* Video Area */}
                <div className="flex-1 relative p-3">

                    {/* Main Video Tile */}
                    <div className="relative rounded-2xl overflow-hidden h-full group"
                        style={{ background: '#000', boxShadow: isRecording ? `0 0 0 2px ${t.accent}, 0 8px 40px rgba(${t.accentRgb},0.2)` : '0 4px 24px rgba(0,0,0,0.4)' }}>

                        {cameraError ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                                style={{ background: '#111' }}>
                                <VideoOff size={56} className="text-red-400" />
                                <p className="text-red-400 text-center max-w-xs">{cameraError}</p>
                                <button onClick={() => window.location.reload()}
                                    className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
                                    style={{ background: t.accent }}>
                                    Retry Camera
                                </button>
                            </div>
                        ) : (
                            <>
                                <video ref={videoRef} autoPlay muted playsInline
                                    className="w-full h-full object-cover"
                                    style={{ transform: 'scaleX(-1)', opacity: isCameraOff ? 0 : 1 }} />
                                {isCameraOff && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                                        style={{ background: '#1a1a1a' }}>
                                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
                                            style={{ background: t.accent }}>
                                            You
                                        </div>
                                        <span className="text-sm" style={{ color: t.subtext }}>Camera off</span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Name tag */}
                        <div className="absolute bottom-4 left-4 flex items-center gap-2">
                            <div className="px-3 py-1 rounded-md text-sm font-medium"
                                style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                                You {isMicMuted && <span className="ml-1 text-red-400">🔇</span>}
                            </div>
                        </div>

                        {/* Start overlay */}
                        {!isRecording && !isUploading && !cameraError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10"
                                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>

                                {/* Theme label */}
                                <div className="text-center mb-2">
                                    <div className="text-xs mb-3 font-medium tracking-widest uppercase"
                                        style={{ color: t.subtext }}>Select theme above, then start</div>
                                    <div className="flex items-center gap-2 justify-center">
                                        <Sparkles size={18} style={{ color: t.accent }} />
                                        <span className="text-lg font-semibold" style={{ color: t.text }}>
                                            {t.name} Theme Active
                                        </span>
                                    </div>
                                </div>

                                <button onClick={startInterview} disabled={!cameraReady}
                                    className="flex items-center gap-3 px-10 py-4 rounded-2xl text-lg font-bold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                    style={{ background: `linear-gradient(135deg, ${t.accent}, rgba(${t.accentRgb},0.7))`, boxShadow: `0 8px 32px rgba(${t.accentRgb},0.4)` }}>
                                    <Video size={22} />
                                    {cameraReady ? 'Join Interview' : 'Waiting for Camera...'}
                                </button>
                            </div>
                        )}

                        {/* Uploading overlay */}
                        {isUploading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-20"
                                style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
                                <div className="w-14 h-14 rounded-full animate-spin"
                                    style={{ border: `3px solid rgba(${t.accentRgb},0.2)`, borderTopColor: t.accent }} />
                                <p className="text-lg font-semibold animate-pulse" style={{ color: t.accent }}>
                                    Analyzing your performance...
                                </p>
                                <p className="text-sm" style={{ color: t.subtext }}>Please wait while we process your interview</p>
                            </div>
                        )}
                    </div>

                    {/* AI Interviewer PiP */}
                    <div className="absolute top-7 right-7 w-52 rounded-xl overflow-hidden shadow-2xl"
                        style={{
                            background: '#111',
                            border: aiSpeaking ? `2px solid ${t.accent}` : '2px solid rgba(255,255,255,0.1)',
                            boxShadow: aiSpeaking ? `0 0 20px rgba(${t.accentRgb},0.4)` : 'none',
                            transition: 'border-color 0.3s, box-shadow 0.3s',
                        }}>
                        <div className="aspect-video flex flex-col items-center justify-center gap-2"
                            style={{ background: t.tileBg }}>
                            <div className="relative">
                                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                                    style={{ background: `rgba(${t.accentRgb},0.2)`, border: `2px solid ${t.accent}` }}>
                                    <Bot size={28} style={{ color: t.accent }} />
                                </div>
                                {aiSpeaking && (
                                    <div className="absolute inset-0 rounded-full animate-ping"
                                        style={{ background: `rgba(${t.accentRgb},0.3)` }} />
                                )}
                            </div>
                            <span className="text-xs font-medium" style={{ color: t.subtext }}>
                                {aiSpeaking ? '● Speaking...' : 'AI Interviewer'}
                            </span>
                        </div>
                        <div className="px-3 py-1.5 flex items-center gap-1.5"
                            style={{ background: 'rgba(0,0,0,0.6)' }}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.accent }} />
                            <span className="text-xs" style={{ color: '#fff' }}>AI Interviewer</span>
                        </div>
                    </div>
                </div>

                {/* ── Right Question Panel ──────────────────────────────────── */}
                {showPanel && (
                    <div className="w-80 flex-shrink-0 flex flex-col m-3 ml-0 rounded-2xl overflow-hidden"
                        style={{ background: t.panelBg, border: `1px solid ${t.panelBorder}`, backdropFilter: 'blur(20px)' }}>

                        {/* Panel Header */}
                        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
                            style={{ borderBottom: `1px solid ${t.panelBorder}` }}>
                            <div className="flex items-center gap-2">
                                <MessageSquare size={15} style={{ color: t.accent }} />
                                <span className="text-sm font-semibold" style={{ color: t.text }}>Interview Questions</span>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                                style={{ background: `rgba(${t.accentRgb},0.15)`, color: t.accent, border: `1px solid rgba(${t.accentRgb},0.3)` }}>
                                {currentQuestionIdx + 1}/{session.questions.length}
                            </span>
                        </div>

                        {/* Question Content */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            {/* Current Question */}
                            <div className="rounded-xl p-4" style={{ background: `rgba(${t.accentRgb},0.08)`, border: `1px solid rgba(${t.accentRgb},0.2)` }}>
                                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: t.accent }}>
                                    Current Question
                                </div>
                                <p className="text-sm leading-relaxed font-medium" style={{ color: t.text }}>
                                    {currentQuestion?.content || 'Completing session...'}
                                </p>
                            </div>

                            {/* Question Timer */}
                            <div className="flex items-center justify-between rounded-lg px-4 py-3"
                                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.panelBorder}` }}>
                                <span className="text-xs" style={{ color: t.subtext }}>Time on question</span>
                                <span className="text-base font-mono font-semibold" style={{ color: t.accent }}>{formatTime(questionTimer)}</span>
                            </div>

                            {/* Progress */}
                            <div>
                                <div className="flex justify-between text-xs mb-2" style={{ color: t.subtext }}>
                                    <span>Progress</span>
                                    <span>{Math.round(((currentQuestionIdx + 1) / session.questions.length) * 100)}%</span>
                                </div>
                                <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                    <div className="h-1.5 rounded-full transition-all duration-500"
                                        style={{ width: `${((currentQuestionIdx + 1) / session.questions.length) * 100}%`, background: `linear-gradient(90deg, ${t.accent}, rgba(${t.accentRgb},0.6))` }} />
                                </div>
                            </div>

                            {/* Questions List */}
                            <div className="space-y-1.5">
                                {session.questions.map((q, i) => (
                                    <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg text-xs"
                                        style={{
                                            background: i === currentQuestionIdx ? `rgba(${t.accentRgb},0.12)` : 'transparent',
                                            border: `1px solid ${i === currentQuestionIdx ? `rgba(${t.accentRgb},0.25)` : 'transparent'}`,
                                            color: i < currentQuestionIdx ? t.subtext : i === currentQuestionIdx ? t.text : t.subtext,
                                            opacity: i > currentQuestionIdx ? 0.5 : 1,
                                        }}>
                                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                                            style={{ background: i <= currentQuestionIdx ? t.accent : 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '10px' }}>
                                            {i < currentQuestionIdx ? '✓' : i + 1}
                                        </span>
                                        <span className="leading-relaxed line-clamp-2">{q.content}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Tips */}
                            <div className="space-y-2 pt-2">
                                <div className="flex items-start gap-2 p-3 rounded-lg text-xs"
                                    style={{ background: `rgba(${t.accentRgb},0.06)`, border: `1px solid rgba(${t.accentRgb},0.15)`, color: t.subtext }}>
                                    <AlertCircle size={13} style={{ color: t.accent }} className="shrink-0 mt-0.5" />
                                    Maintain eye contact with the camera.
                                </div>
                                <div className="flex items-start gap-2 p-3 rounded-lg text-xs"
                                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.panelBorder}`, color: t.subtext }}>
                                    <CheckCircle size={13} style={{ color: t.accent }} className="shrink-0 mt-0.5" />
                                    Speak clearly and at a moderate pace.
                                </div>
                            </div>
                        </div>

                        {/* Next Button */}
                        <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${t.panelBorder}` }}>
                            <button onClick={nextQuestion} disabled={!isRecording}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40"
                                style={{ background: isRecording ? `linear-gradient(135deg, ${t.accent}, rgba(${t.accentRgb},0.75))` : 'rgba(255,255,255,0.08)', boxShadow: isRecording ? `0 4px 20px rgba(${t.accentRgb},0.35)` : 'none' }}>
                                {isLastQuestion ? 'Finish Interview' : 'Next Question'}
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bottom Controls Bar ───────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-3 flex-shrink-0 z-20"
                style={{ background: t.controlsBg, borderTop: `1px solid ${t.controlsBorder}`, backdropFilter: 'blur(20px)' }}>

                {/* Left info */}
                <div className="flex items-center gap-3 w-40">
                    <div className="text-xs" style={{ color: t.subtext }}>
                        {isRecording ? (
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full animate-pulse inline-block" style={{ background: '#ef4444' }} />
                                Recording
                            </span>
                        ) : cameraReady ? (
                            <span style={{ color: t.accent }}>Ready</span>
                        ) : 'Initializing...'}
                    </div>
                </div>

                {/* Center Controls */}
                <div className="flex items-center gap-3">
                    {/* Mic */}
                    <ControlBtn
                        active={!isMicMuted} onClick={toggleMic} theme={t}
                        icon={isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
                        label={isMicMuted ? 'Unmute' : 'Mute'}
                        danger={isMicMuted}
                    />

                    {/* Camera */}
                    <ControlBtn
                        active={!isCameraOff} onClick={toggleCamera} theme={t}
                        icon={isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
                        label={isCameraOff ? 'Start Video' : 'Stop Video'}
                        danger={isCameraOff}
                    />

                    {/* End Call — center, larger */}
                    <button onClick={finishInterview} disabled={!isRecording}
                        title="End Interview"
                        className="w-14 h-12 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                        style={{ background: t.endCall, boxShadow: isRecording ? `0 4px 20px rgba(239,68,68,0.4)` : 'none' }}>
                        <PhoneOff size={20} color="#fff" />
                    </button>

                    {/* Participants / Panel toggle */}
                    <ControlBtn
                        active={showPanel} onClick={() => setShowPanel(p => !p)} theme={t}
                        icon={<MessageSquare size={18} />}
                        label="Questions"
                    />

                    {/* Participants count */}
                    <ControlBtn
                        active={false} onClick={() => {}} theme={t}
                        icon={<Users size={18} />}
                        label="2 People"
                    />
                </div>

                {/* Right: Question number */}
                <div className="flex justify-end w-40">
                    <div className="text-xs text-right" style={{ color: t.subtext }}>
                        <div style={{ color: t.text }} className="font-medium">Q {currentQuestionIdx + 1}</div>
                        <div>of {session.questions.length}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ── Reusable control button ───────────────────────────────────────────────── */
function ControlBtn({ active, onClick, theme: t, icon, label, danger = false }: {
    active: boolean; onClick: () => void;
    theme: typeof THEMES['mockmate'];
    icon: React.ReactNode; label: string; danger?: boolean;
}) {
    return (
        <button onClick={onClick} title={label}
            className="flex flex-col items-center gap-1 group"
            style={{ minWidth: 52 }}>
            <div className="w-12 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                style={{
                    background: danger ? 'rgba(239,68,68,0.15)' : active ? t.btnHover : t.btnBg,
                    border: `1px solid ${danger ? 'rgba(239,68,68,0.3)' : active ? `rgba(${t.accentRgb},0.3)` : 'rgba(255,255,255,0.08)'}`,
                    color: danger ? '#f87171' : active ? t.accent : t.subtext,
                }}>
                {icon}
            </div>
            <span className="text-xs" style={{ color: t.subtext, fontSize: '10px' }}>{label}</span>
        </button>
    );
}
