import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { endpoints, type InterviewSession } from '../api';
import { Video, Mic, StopCircle, Clock, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';

export const InterviewRoom = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [session, setSession] = useState<InterviewSession | null>(null);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0); // session duration
    const [questionTimer, setQuestionTimer] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if (!id) return;
        endpoints.getInterview(parseInt(id)).then(res => {
            setSession(res.data);
            setTimeLeft(res.data.duration_minutes * 60);
        });
    }, [id]);

    useEffect(() => {
        // Start Camera
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            })
            .catch(err => console.error("Camera access denied:", err));

        return () => {
            // Cleanup
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        // Timers
        let interval: any;
        if (isRecording && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        finishInterview();
                        return 0;
                    }
                    return prev - 1;
                });
                setQuestionTimer(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording, timeLeft]);

    const startInterview = () => {
        if (!streamRef.current) return;

        chunksRef.current = [];
        const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
    };

    const finishInterview = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            mediaRecorderRef.current.onstop = uploadVideo;
        }
    };

    const uploadVideo = async () => {
        setIsUploading(true);
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        try {
            if (id) await endpoints.uploadVideo(parseInt(id), blob);
            navigate(`/results/${id}`);
        } catch (err) {
            console.error("Upload failed", err);
            alert("Failed to upload video.");
            setIsUploading(false);
        }
    };

    const nextQuestion = () => {
        if (!session) return;
        if (currentQuestionIdx < session.questions.length - 1) {
            setCurrentQuestionIdx(prev => prev + 1);
            setQuestionTimer(0);
        } else {
            finishInterview();
        }
    };

    if (!session) return <div className="text-center pt-20">Loading Session...</div>;

    const currentQuestion = session.questions[currentQuestionIdx];

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
            {/* Left: Video Area */}
            <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-700 shadow-2xl aspect-video group">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
                    />

                    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-white border border-white/10">
                        {isRecording ? (
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-400" />
                        )}
                        <span className="text-sm font-medium">{isRecording ? "Recording" : "camera ready"}</span>
                    </div>

                    {!isRecording && !isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                            <button
                                onClick={startInterview}
                                className="btn-primary text-xl px-8 py-4 rounded-full shadow-indigo-500/50 hover:scale-105 transition-transform"
                            >
                                Start Interview
                            </button>
                        </div>
                    )}

                    {isUploading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-4">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-lg font-medium animate-pulse">Uploading & Analyzing...</p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="card flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-slate-700/50">
                            <Mic className="text-slate-300" size={20} />
                        </div>
                        <div className="p-3 rounded-lg bg-slate-700/50">
                            <Video className="text-slate-300" size={20} />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-lg font-mono text-slate-300">
                        <Clock size={20} className="text-indigo-400" />
                        <span>{formatTime(timeLeft)}</span>
                    </div>

                    <button
                        onClick={finishInterview}
                        disabled={!isRecording}
                        className="btn-secondary bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                    >
                        <StopCircle size={20} /> End Session
                    </button>
                </div>
            </div>

            {/* Right: Questions & Context */}
            <div className="space-y-6">
                <div className="card h-full flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">Current Question</h3>
                        <div className="text-2xl font-semibold leading-snug min-h-[100px]">
                            {currentQuestion?.content || "Completing session..."}
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-8 p-4 bg-slate-700/30 rounded-lg border border-slate-700">
                        <span className="text-slate-400">Question Time</span>
                        <span className="text-xl font-mono text-indigo-300">{formatTime(questionTimer)}</span>
                    </div>

                    <div className="flex-1">
                        <div className="flex justify-between text-sm text-slate-500 mb-2">
                            <span>Progress</span>
                            <span>{currentQuestionIdx + 1} / {session.questions.length}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2 mb-8">
                            <div
                                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${((currentQuestionIdx + 1) / session.questions.length) * 100}%` }}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="p-3 rounded bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-300 flex gap-2">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <span>Maintain eye contact with the camera.</span>
                            </div>
                            <div className="p-3 rounded bg-green-500/10 border border-green-500/20 text-sm text-green-300 flex gap-2">
                                <CheckCircle size={16} className="shrink-0 mt-0.5" />
                                <span>Speak clearly and at a moderate pace.</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={nextQuestion}
                        disabled={!isRecording}
                        className="mt-auto btn-primary w-full py-3"
                    >
                        {currentQuestionIdx === session.questions.length - 1 ? 'Finish Interview' : 'Next Question'}
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
