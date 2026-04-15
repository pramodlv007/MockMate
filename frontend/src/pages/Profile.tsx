import { useState, useEffect, useRef } from 'react';
import api, { endpoints, type ProfileUpdate } from '../api';
import { useAuth } from '../context/AuthContext';
import { User as UserIcon, Save, Github, Linkedin, Globe, Briefcase, GraduationCap, FileText, Upload, CheckCircle, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const Profile = () => {
    const { user: authUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [profile, setProfile] = useState<ProfileUpdate>({
        target_role: '',
        github_url: '',
        linkedin_url: '',
        portfolio_url: '',
        skills: '',
        experience_years: undefined,
        education: '',
        bio: ''
    });

    // Resume upload state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [resumeUploading, setResumeUploading] = useState(false);
    const [resumeUploaded, setResumeUploaded] = useState(false);
    const [resumeError, setResumeError] = useState('');
    const [resumePreview, setResumePreview] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [existingResume, setExistingResume] = useState(false);

    useEffect(() => {
        if (authUser) {
            setProfile({
                target_role: authUser.target_role || '',
                github_url: authUser.github_url || '',
                linkedin_url: authUser.linkedin_url || '',
                portfolio_url: authUser.portfolio_url || '',
                skills: authUser.skills || '',
                experience_years: authUser.experience_years || undefined,
                education: authUser.education || '',
                bio: authUser.bio || ''
            });
            // Check if user already has a resume
            if ((authUser as any).resume_text) {
                setExistingResume(true);
            }
        }
    }, [authUser]);

    const handleUpdate = async () => {
        setLoading(true);
        setSaved(false);
        try {
            await endpoints.updateProfile(profile);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            console.error(e);
            alert("Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    const handleResumeUpload = async (file: File) => {
        setResumeFile(file);
        setResumeError('');
        setResumeUploaded(false);
        setResumePreview('');
        setResumeUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post(`${API_URL}/profile/resume/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResumeUploaded(true);
            setExistingResume(true);
            setResumePreview(response.data.preview || '');
        } catch (err: any) {
            const msg = err?.response?.data?.detail || err?.message || 'Upload failed';
            setResumeError(msg);
            setResumeFile(null);
        } finally {
            setResumeUploading(false);
        }
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleResumeUpload(file);
    };

    if (!authUser) return <div className="text-center pt-20">Loading...</div>;

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <UserIcon size={40} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">{authUser.full_name || authUser.email.split('@')[0]}</h1>
                    <p className="text-slate-400">{authUser.email}</p>
                </div>
            </div>

            {saved && (
                <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-lg text-center">
                    ✓ Profile saved successfully!
                </div>
            )}

            {/* Resume Upload - Most Important Section */}
            <div className="card space-y-4 border border-indigo-500/30 bg-indigo-950/20">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <FileText size={20} className="text-indigo-400" />
                    Resume Upload
                    <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full ml-2">
                        Powers AI question generation
                    </span>
                </h2>
                <p className="text-sm text-slate-400">
                    Upload your resume (PDF, DOCX, or TXT) and MockMate will generate interview questions
                    directly based on your projects, experiences, and skills — not generic questions.
                </p>

                {/* Drop Zone */}
                <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                        dragOver
                            ? 'border-indigo-400 bg-indigo-500/10'
                            : 'border-slate-600 hover:border-slate-500 hover:bg-white/5'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.doc,.txt"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleResumeUpload(file);
                        }}
                    />

                    {resumeUploading ? (
                        <div className="flex flex-col items-center gap-3 text-indigo-400">
                            <Loader size={32} className="animate-spin" />
                            <p className="font-medium">Extracting resume text...</p>
                            <p className="text-xs text-slate-500">This may take a few seconds</p>
                        </div>
                    ) : resumeUploaded ? (
                        <div className="flex flex-col items-center gap-3 text-green-400">
                            <CheckCircle size={32} />
                            <p className="font-medium">Resume uploaded successfully!</p>
                            <p className="text-xs text-slate-400">{resumeFile?.name}</p>
                            <p className="text-xs text-indigo-400 mt-1">Click to upload a different resume</p>
                        </div>
                    ) : existingResume ? (
                        <div className="flex flex-col items-center gap-3 text-green-400">
                            <CheckCircle size={32} />
                            <p className="font-medium">Resume on file ✓</p>
                            <p className="text-xs text-slate-400">Click to replace with a new resume</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                            <Upload size={32} />
                            <div>
                                <p className="font-medium text-slate-300">Drop your resume here or click to browse</p>
                                <p className="text-xs mt-1">Supports PDF, DOCX, DOC, TXT · Max 10MB</p>
                            </div>
                        </div>
                    )}
                </div>

                {resumeError && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
                        ⚠ {resumeError}
                    </div>
                )}

                {resumePreview && (
                    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                        <p className="text-xs text-slate-500 mb-2">Resume text preview:</p>
                        <p className="text-xs text-slate-400 font-mono leading-relaxed whitespace-pre-wrap line-clamp-4">
                            {resumePreview}
                        </p>
                    </div>
                )}
            </div>

            {/* Basic Info */}
            <div className="card space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Briefcase size={20} className="text-indigo-400" />
                    Career Information
                </h2>

                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Target Role</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Senior Frontend Engineer"
                            value={profile.target_role}
                            onChange={e => setProfile({ ...profile, target_role: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Years of Experience</label>
                        <input
                            type="number"
                            min={0}
                            max={50}
                            className="input-field"
                            placeholder="e.g. 5"
                            value={profile.experience_years || ''}
                            onChange={e => setProfile({ ...profile, experience_years: parseInt(e.target.value) || undefined })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        <GraduationCap size={16} className="inline mr-1" />
                        Education
                    </label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. BS Computer Science, Stanford University"
                        value={profile.education}
                        onChange={e => setProfile({ ...profile, education: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        <FileText size={16} className="inline mr-1" />
                        Bio / Summary
                    </label>
                    <textarea
                        rows={3}
                        className="input-field resize-none"
                        placeholder="Brief summary of your background and goals..."
                        value={profile.bio}
                        onChange={e => setProfile({ ...profile, bio: e.target.value })}
                    />
                </div>
            </div>

            {/* Skills */}
            <div className="card space-y-6">
                <h2 className="text-xl font-semibold">Technical Skills</h2>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Skills (comma-separated)</label>
                    <textarea
                        rows={3}
                        className="input-field resize-none"
                        placeholder="e.g. Python, PyTorch, Machine Learning, NLP, MLOps, Kubernetes, AWS..."
                        value={profile.skills}
                        onChange={e => setProfile({ ...profile, skills: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 mt-2">
                        💡 Combined with your uploaded resume, these skills shape every interview question you get.
                    </p>
                </div>
            </div>

            {/* Social Links */}
            <div className="card space-y-6">
                <h2 className="text-xl font-semibold">Professional Links</h2>
                <p className="text-sm text-slate-400">
                    Adding these links helps the AI understand your projects and experience better.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            <Github size={16} className="inline mr-2" />
                            GitHub Profile URL
                        </label>
                        <input
                            type="url"
                            className="input-field"
                            placeholder="https://github.com/yourusername"
                            value={profile.github_url}
                            onChange={e => setProfile({ ...profile, github_url: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            <Linkedin size={16} className="inline mr-2" />
                            LinkedIn Profile URL
                        </label>
                        <input
                            type="url"
                            className="input-field"
                            placeholder="https://linkedin.com/in/yourusername"
                            value={profile.linkedin_url}
                            onChange={e => setProfile({ ...profile, linkedin_url: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            <Globe size={16} className="inline mr-2" />
                            Portfolio / Personal Website
                        </label>
                        <input
                            type="url"
                            className="input-field"
                            placeholder="https://yourportfolio.com"
                            value={profile.portfolio_url}
                            onChange={e => setProfile({ ...profile, portfolio_url: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <button
                onClick={handleUpdate}
                disabled={loading}
                className="btn-primary w-full py-4 text-lg"
            >
                <Save size={20} /> {loading ? "Saving..." : "Save Profile"}
            </button>
        </div>
    );
};
