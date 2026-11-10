import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { endpoints, type InterviewSession } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, VideoOff, Mic, MicOff, Clock, ChevronRight, RotateCcw, LogOut } from 'lucide-react';

const INTERVIEWER = 'Maya';
const TRANSITIONS = ['Thanks for that.', 'Got it, thank you.', 'Okay, great.', 'Interesting, thanks.'];

const pickVoice = () =>
    window.speechSynthesis?.getVoices().find(v => v.lang.startsWith('en') && /female|samantha|zira|aria|jenny|google us/i.test(v.name))
    ?? window.speechSynthesis?.getVoices().find(v => v.lang.startsWith('en'));

export const InterviewRoom = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [session, setSession] = useState<InterviewSession | null>(null);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [questionTranscripts, setQuestionTranscripts] = useState<Record<number, string>>({});
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [aiSpeaking, setAiSpeaking] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<any>(null);
    const currentQuestionIdxRef = useRef(0);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    // Recording-relative seconds each question was on screen; lets evaluation cut the transcript per question.
    const recordStartRef = useRef(0);
    const timingsRef = useRef<{ start: number; end: number }[]>([]);
    const elapsed = () => Math.round((performance.now() - recordStartRef.current) / 100) / 10;
    const closeQuestionWindow = (idx: number) => {
        const start = idx === 0 ? 0 : timingsRef.current[idx - 1]?.end ?? 0;
        timingsRef.current[idx] = { start, end: elapsed() };
    };

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
        recognition.interimResults = true; // live caption while the candidate talks
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

    // Stop the interviewer talking if the user leaves mid-sentence.
    useEffect(() => () => { utteranceRef.current = null; window.speechSynthesis?.cancel(); }, []);

    useEffect(() => {
        const initCamera = async () => {
            // getUserMedia requires a secure context (HTTPS or localhost)
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                const isHTTP = window.location.protocol === 'http:' && window.location.hostname !== 'localhost';
                setCameraError(isHTTP ? 'Camera needs HTTPS — answers are still captured.' : 'Camera not available in this browser.');
                setCameraReady(true);
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                    audio: true,
                });
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
                setCameraReady(true);
            } catch (err: any) {
                if (err.name === 'NotAllowedError') setCameraError('Camera access denied.');
                else if (err.name === 'NotFoundError') setCameraError('No camera found.');
                else setCameraError(`Camera error: ${err.message}`);
                setCameraReady(true);
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
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording, timeLeft]);

    // Interviewer speaks, then hands the floor to the candidate. Recognition is paused while
    // speaking so the interviewer's own voice doesn't end up in the candidate's transcript.
    const ask = (text: string) => {
        try { recognitionRef.current?.stop(); } catch (_) {}
        const synth = window.speechSynthesis;
        const u = synth ? new SpeechSynthesisUtterance(text) : null;
        utteranceRef.current = u;
        const listen = () => {
            if (utteranceRef.current !== u) return; // stale utterance (cancelled / replaced)
            setAiSpeaking(false);
            setTimeout(() => { try { recognitionRef.current?.start(); } catch (_) {} }, 200);
        };
        if (!synth || !u) { listen(); return; }
        synth.cancel();
        u.voice = pickVoice() ?? null;
        u.rate = 1;
        u.pitch = 1.05;
        u.onend = listen;
        u.onerror = listen;
        setAiSpeaking(true);
        synth.speak(u);
    };

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
        if (!session) return;
        chunksRef.current = [];
        // Only set up MediaRecorder if we have a camera stream
        if (streamRef.current) {
            const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
            const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
            const recorder = new MediaRecorder(streamRef.current, { mimeType });
            recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.start(1000);
            mediaRecorderRef.current = recorder;
        }
        recordStartRef.current = performance.now();
        timingsRef.current = [];
        setIsRecording(true);
        const role = session.target_role ? ` for the ${session.target_role} role` : '';
        ask(`Hi, I'm ${INTERVIEWER}, and I'll be interviewing you today${role}. Let's get started. ${session.questions[0].content}`);
    };

    const finishInterview = () => {
        if (!isRecording) return;
        closeQuestionWindow(currentQuestionIdxRef.current);
        utteranceRef.current = null;
        window.speechSynthesis?.cancel();
        setAiSpeaking(false);
        try { recognitionRef.current?.stop(); } catch (_) {}
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            mediaRecorderRef.current.onstop = uploadVideo;
        } else {
            // No recording (HTTP mode) — go straight to results
            setIsRecording(false);
            uploadVideo();
        }
    };

    const uploadVideo = async () => {
        setIsUploading(true);
        if (chunksRef.current.length === 0) { navigate(`/results/${id}`); return; }
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        if (blob.size < 1000) { navigate(`/results/${id}`); return; }
        try {
            if (id) {
                // Before the upload: the upload starts evaluation, which reads these transcripts.
                if (Object.keys(questionTranscripts).length > 0) {
                    try { await endpoints.saveTranscripts(id, questionTranscripts); } catch { /* evaluation falls back to the video transcript */ }
                }
                await endpoints.uploadVideo(id, blob, Array.from(timingsRef.current)); // holes → null, so indices stay aligned
            }
            navigate(`/results/${id}`);
        } catch (err: any) {
            alert(`Upload failed: ${err?.response?.data?.detail ?? err?.response?.data?.error ?? err?.message}\n\nYou can still view results.`);
            navigate(`/results/${id}`);
        } finally { setIsUploading(false); }
    };

    const nextQuestion = () => {
        if (!session) return;
        if (currentQuestionIdx < session.questions.length - 1) {
            const next = currentQuestionIdx + 1;
            closeQuestionWindow(currentQuestionIdx);
            setCurrentQuestionIdx(next);
            currentQuestionIdxRef.current = next;
            ask(`${TRANSITIONS[next % TRANSITIONS.length]} ${session.questions[next].content}`);
        } else { finishInterview(); }
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    if (!session) return (
        <div className="flex items-center justify-center h-screen">
            <p className="text-xl animate-pulse text-gold-300">Setting up your interview room...</p>
        </div>
    );

    if (!session.questions?.length) return (
        <div className="flex items-center justify-center h-screen">
            <p className="text-xl animate-pulse text-gold-300">Generating questions from your profile...</p>
        </div>
    );

    const currentQuestion = session.questions[currentQuestionIdx];
    const isLastQuestion = currentQuestionIdx === session.questions.length - 1;
    const listening = isRecording && !aiSpeaking;
    const answer = questionTranscripts[currentQuestionIdx];
    const bubbleText = isRecording
        ? currentQuestion.content
        : `Hi! I'm ${INTERVIEWER}. I'll ask you ${session.questions.length} questions — just talk to me like a real interview. Ready when you are.`;

    return (
        <div className="flex flex-col h-screen overflow-hidden">

            {/* ── Top bar: role, progress, timer ───────────────────────────── */}
            <header className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 flex-shrink-0 border-b-2 border-dashed border-[rgba(243,236,216,0.3)]">
                <div className="min-w-0">
                    <div className="text-lg font-bold truncate">{session.company_name || 'MockMate'} interview</div>
                    <div className="text-sm text-slate-400 truncate">{session.target_role || 'Technical Interview'}</div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5" aria-label={`Question ${currentQuestionIdx + 1} of ${session.questions.length}`}>
                    {session.questions.map((_, i) => (
                        <span key={i} className="w-3 h-3 rounded-full border-2 border-[var(--ink)] transition-colors"
                            style={{ background: i < currentQuestionIdx ? 'var(--ink)' : i === currentQuestionIdx && isRecording ? '#fcd34d' : 'transparent' }} />
                    ))}
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full border-2 border-[var(--ink)] font-mono">
                    <Clock size={16} />
                    {formatTime(timeLeft)}
                    {isRecording && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Recording" />}
                </div>
            </header>

            {/* ── Conversation stage ───────────────────────────────────────── */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-4 py-6 pb-32 flex flex-col items-center gap-5">

                    {/* Interviewer */}
                    <div className="relative flex flex-col items-center">
                        <AnimatePresence>
                            {aiSpeaking && (
                                <motion.div className="absolute top-4 w-36 h-36 md:w-48 md:h-48 rounded-full bg-gold-300/20"
                                    initial={{ opacity: 0 }} animate={{ scale: [1, 1.15, 1], opacity: 1 }} exit={{ opacity: 0 }}
                                    transition={{ duration: 1.2, repeat: Infinity }} />
                            )}
                        </AnimatePresence>
                        <Interviewer speaking={aiSpeaking} listening={listening} />
                        <div className="mt-1 text-xl font-bold">{INTERVIEWER}</div>
                        <div className="text-sm text-slate-400 h-5" aria-live="polite">
                            {aiSpeaking ? 'speaking…' : listening ? 'listening to you…' : 'your interviewer'}
                        </div>
                    </div>

                    {/* Interviewer's speech bubble */}
                    <AnimatePresence mode="wait">
                        <motion.div key={isRecording ? currentQuestionIdx : 'intro'}
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                            className="surface relative w-full !p-5 text-xl leading-relaxed">
                            {/* bubble tail pointing up at the interviewer */}
                            <span className="absolute -top-[11px] left-1/2 -translate-x-1/2 w-5 h-5 rotate-45 bg-[var(--paper-2)] border-l-2 border-t-2 border-[var(--ink)]" />
                            {isRecording && (
                                <div className="text-sm text-gold-300 mb-1">Question {currentQuestionIdx + 1} of {session.questions.length}</div>
                            )}
                            {bubbleText}
                        </motion.div>
                    </AnimatePresence>

                    {/* Candidate's reply bubble */}
                    {isRecording && (
                        <div className="glass-panel self-end w-full md:w-4/5 p-4 text-lg">
                            <div className="text-sm text-slate-400 mb-1">You</div>
                            {answer
                                ? <p className="leading-relaxed">{answer}</p>
                                : <p className="text-slate-500 italic">{listening ? 'Go ahead, I’m listening — your words will appear here.' : 'Wait for the question…'}</p>}
                        </div>
                    )}

                    {!isRecording && !isUploading && (
                        <button onClick={startInterview} disabled={!cameraReady} className="btn btn--primary text-xl !px-10 !py-4 disabled:opacity-50">
                            {cameraReady ? 'Start the interview' : 'Waiting for camera...'}
                        </button>
                    )}
                </div>
            </main>

            {/* ── Self view: kept small, this is a conversation not a video call ── */}
            <div className="fixed bottom-20 right-4 w-28 md:w-44 aspect-video rounded-xl overflow-hidden border-2 border-dashed border-[var(--ink)] bg-black z-10">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)', opacity: isCameraOff || cameraError ? 0 : 1 }} />
                {(isCameraOff || cameraError) && (
                    <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-slate-400 bg-[var(--paper-2)]">
                        {cameraError ?? 'Camera off'}
                    </div>
                )}
            </div>

            {/* ── Controls ─────────────────────────────────────────────────── */}
            <footer className="flex items-center justify-center gap-2 md:gap-3 px-4 py-3 flex-shrink-0 border-t-2 border-dashed border-[rgba(243,236,216,0.3)]">
                <IconBtn onClick={toggleMic} label={isMicMuted ? 'Unmute' : 'Mute'} danger={isMicMuted}>
                    {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </IconBtn>
                <IconBtn onClick={toggleCamera} label={isCameraOff ? 'Camera on' : 'Camera off'} danger={isCameraOff}>
                    {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                </IconBtn>
                <IconBtn onClick={() => ask(currentQuestion.content)} label="Repeat question" disabled={!isRecording || aiSpeaking}>
                    <RotateCcw size={20} />
                </IconBtn>
                <button onClick={nextQuestion} disabled={!isRecording} className="btn btn--primary disabled:opacity-40">
                    {isLastQuestion ? 'Finish' : 'Next question'} <ChevronRight size={18} />
                </button>
                <IconBtn onClick={finishInterview} label="End interview" danger disabled={!isRecording}>
                    <LogOut size={20} />
                </IconBtn>
            </footer>

            {isUploading && (
                <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[rgba(29,34,48,0.92)]">
                    <p className="text-2xl text-gold-300 animate-pulse">Thanks for your time!</p>
                    <p className="text-slate-400">{INTERVIEWER} is reviewing your answers...</p>
                </div>
            )}
        </div>
    );
};

/* ── Hand-drawn interviewer: blinks, lip-syncs while speaking, tilts head while listening ── */
function Interviewer({ speaking, listening }: { speaking: boolean; listening: boolean }) {
    return (
        <motion.svg viewBox="0 0 200 200" className="relative w-44 h-44 md:w-56 md:h-56" aria-hidden
            fill="none" stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
            animate={{ rotate: listening ? [0, -4, -4, 0] : 0, y: speaking ? [0, -2, 0] : 0 }}
            transition={{ duration: listening ? 5 : 0.8, repeat: Infinity, ease: 'easeInOut' }}>
            {/* shoulders, collar, neck */}
            <path d="M28 200 C 38 160, 70 150, 100 150 C 130 150, 162 160, 172 200" fill="#2563eb" fillOpacity={0.4} />
            <path d="M86 151 L100 170 L114 151" />
            <path d="M89 128 L89 150 M111 128 L111 150" />
            {/* face */}
            <path d="M60 86 C 58 44, 142 44, 140 86 C 142 120, 120 138, 100 138 C 80 138, 58 120, 60 86 Z" fill="var(--paper-2)" />
            {/* hair */}
            <path d="M55 92 C 46 40, 92 20, 120 32 C 142 40, 154 62, 145 96 C 140 72, 122 58, 96 58 C 78 60, 64 70, 55 92 Z"
                fill="#fcd34d" fillOpacity={0.6} />
            {/* brows lift while listening */}
            <motion.path d="M73 76 Q 81 71 89 75" animate={{ y: listening ? -3 : 0 }} />
            <motion.path d="M111 75 Q 119 71 127 76" animate={{ y: listening ? -3 : 0 }} />
            {/* eyes: periodic blink */}
            <motion.g style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 4, times: [0, 0.93, 0.96, 1], repeat: Infinity }}>
                <circle cx="82" cy="88" r="4" fill="var(--ink)" />
                <circle cx="118" cy="88" r="4" fill="var(--ink)" />
            </motion.g>
            <path d="M100 93 Q 95 104 102 106" strokeWidth={2} />
            {/* mouth: smile when quiet, moves when talking */}
            {speaking ? (
                <motion.ellipse cx="100" cy="119" rx="9" fill="#1d2230" initial={{ ry: 3 }}
                    animate={{ ry: [3, 7, 2, 8, 4, 3] }} transition={{ duration: 0.7, repeat: Infinity }} />
            ) : (
                <path d="M88 116 Q 100 126 112 116" />
            )}
        </motion.svg>
    );
}

function IconBtn({ onClick, label, danger = false, disabled = false, children }: {
    onClick: () => void; label: string; danger?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
    return (
        <button onClick={onClick} title={label} aria-label={label} disabled={disabled}
            className={`w-11 h-11 flex items-center justify-center rounded-full border-2 transition-all active:scale-95 disabled:opacity-40 ${danger ? 'border-red-400 text-red-400 bg-red-500/10' : 'border-[var(--ink)] hover:bg-white/10'}`}>
            {children}
        </button>
    );
}
