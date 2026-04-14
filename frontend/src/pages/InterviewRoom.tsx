import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { endpoints, type InterviewSession } from '../api';
import { Video, Mic, StopCircle, Clock, ChevronRight, AlertCircle, CheckCircle, VideoOff } from 'lucide-react';

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

    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if (!id) return;
        endpoints.getInterview(id).then(res => {
            setSession(res.data);
            setTimeLeft(res.data.duration_minutes * 60);
        }).catch(err => {
            console.error("Failed to load interview:", err);
        });
    }, [id]);


    useEffect(() => {
        // Start Camera with better error handling
        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user'
                    },
                    audio: true
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setCameraReady(true);
                setCameraError(null);
            } catch (err: any) {
                console.error("Camera access error:", err);
                if (err.name === 'NotAllowedError') {
                    setCameraError("Camera access denied. Please enable camera permissions in your browser settings.");
                } else if (err.name === 'NotFoundError') {
                    setCameraError("No camera found. Please connect a webcam.");
                } else {
                    setCameraError(`Camera error: ${err.message}`);
                }
            }
        };

        initCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
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
        if (!streamRef.current) {
            alert("Camera not ready. Please allow camera access.");
            return;
        }

        chunksRef.current = [];

        // Try different mimeTypes for browser compatibility
        const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
        let selectedMimeType = 'video/webm';

        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                selectedMimeType = mimeType;
                break;
            }
        }

        const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: selectedMimeType });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };

        mediaRecorder.start(1000); // Collect data every second
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

        // Check if we have any recorded data
        if (chunksRef.current.length === 0) {
            console.warn("No video data recorded, skipping upload");
            navigate(`/results/${id}`);
            return;
        }

        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        console.log(`[Upload] Video size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

        // Skip upload if blob is too small (likely empty/corrupted)
        if (blob.size < 1000) {
            console.warn("Video too small, skipping upload");
            navigate(`/results/${id}`);
            return;
        }

        try {
            if (id) {
                console.log(`[Upload] Uploading video for interview: ${id}`);
                await endpoints.uploadVideo(id, blob);
                console.log("[Upload] Upload successful!");
            }
            navigate(`/results/${id}`);
        } catch (err: any) {
            console.error("Upload failed:", err);
            // Show more detailed error
            const errorMsg = err?.response?.data?.detail || err?.message || "Unknown error";
            alert(`Failed to upload video: ${errorMsg}\n\nYou can still view your results.`);
            // Navigate to results anyway - video upload is optional
            navigate(`/results/${id}`);
        } finally {
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

    if (!session) return <div className="text-center pt-20 text-emerald-400 animate-pulse text-xl">Creating unique interview session from your profile...</div>;

    // Safety check for questions array
    if (!session.questions || session.questions.length === 0) {
        return <div className="text-center pt-20 text-emerald-400 animate-pulse text-xl">Generating customized questions based on your skills...</div>;
    }

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
                    {cameraError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-4 p-8">
                            <VideoOff size={64} className="text-red-400" />
                            <p className="text-red-400 text-center">{cameraError}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="btn-secondary"
                            >
                                Retry Camera Access
                            </button>
                        </div>
                    ) : (
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover transform scale-x-[-1]"
                        />
                    )}

                    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-white border border-white/10">
                        {isRecording ? (
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-400" />
                        )}
                        <span className="text-sm font-medium">{isRecording ? "Recording" : cameraReady ? "Camera Ready" : "Initializing..."}</span>
                    </div>

                    {!isRecording && !isUploading && !cameraError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                            <button
                                onClick={startInterview}
                                disabled={!cameraReady}
                                className="btn-primary text-xl px-8 py-4 rounded-full hover:scale-105 transition-transform disabled:opacity-50"
                            >
                                {cameraReady ? "Start Interview" : "Waiting for Camera..."}
                            </button>
                        </div>
                    )}

                    {isUploading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-4">
                            <div className="w-12 h-12 rounded-full animate-spin" style={{ border: '3px solid rgba(16,185,129,0.2)', borderTopColor: '#10b981' }}></div>
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
                        <Clock size={20} className="text-emerald-400" />
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
                        <span className="text-xl font-mono text-emerald-300">{formatTime(questionTimer)}</span>
                    </div>

                    <div className="flex-1">
                        <div className="flex justify-between text-sm text-slate-500 mb-2">
                            <span>Progress</span>
                            <span>{currentQuestionIdx + 1} / {session.questions.length}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2 mb-8">
                            <div
                                className="h-2 rounded-full transition-all duration-300"
                                style={{ width: `${((currentQuestionIdx + 1) / session.questions.length) * 100}%`, background: 'linear-gradient(90deg, #10b981, #06b6d4)' }}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="p-3 rounded-xl text-sm flex gap-2" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#6ee7b7' }}>
                                <AlertCircle size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                                <span>Maintain eye contact with the camera.</span>
                            </div>
                            <div className="p-3 rounded-xl text-sm flex gap-2" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)', color: '#67e8f9' }}>
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
