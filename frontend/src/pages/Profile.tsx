import { useState, useEffect, useRef } from 'react';
import api, { endpoints, type ProfileUpdate } from '../api';
import { useAuth } from '../context/AuthContext';
import {
    User as UserIcon, Pencil, Save, X, Github, Linkedin, Globe,
    Briefcase, GraduationCap, FileText, Upload, CheckCircle, Loader,
    Zap, Mail, Star, BadgeCheck, ExternalLink
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const skillTagColors = [
    'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    'bg-violet-500/20 text-violet-300 border-violet-500/30',
];

function SkillTag({ skill, index }: { skill: string; index: number }) {
    const color = skillTagColors[index % skillTagColors.length];
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${color}`}>
            {skill.trim()}
        </span>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | number }) {
    if (!value && value !== 0) return null;
    return (
        <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
                <p className="text-slate-200 text-sm mt-0.5 break-words">{value}</p>
            </div>
        </div>
    );
}

function LinkRow({ icon, label, url }: { icon: React.ReactNode; label: string; url?: string }) {
    if (!url) return null;
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-indigo-500/40 hover:bg-slate-800 transition-all group"
        >
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm text-indigo-400 truncate group-hover:text-indigo-300 transition-colors">{url}</p>
            </div>
            <ExternalLink size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
        </a>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const Profile = () => {
    const { user: authUser, refreshUser } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState('');

    const [profile, setProfile] = useState<ProfileUpdate>({
        target_role: '',
        github_url: '',
        linkedin_url: '',
        portfolio_url: '',
        skills: '',
        experience_years: undefined,
        education: '',
        bio: '',
    });

    // Resume upload state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [resumeUploading, setResumeUploading] = useState(false);
    const [resumeUploaded, setResumeUploaded] = useState(false);
    const [resumeError, setResumeError] = useState('');
    const [resumePreview, setResumePreview] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [existingResume, setExistingResume] = useState(false);

    // Sync form state from authUser
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
                bio: authUser.bio || '',
            });
            if ((authUser as any).resume_text) setExistingResume(true);
        }
    }, [authUser]);

    const handleSave = async () => {
        setLoading(true);
        setSaveError('');
        setSaveSuccess(false);
        try {
            await endpoints.updateProfile(profile);
            await refreshUser(); // Refresh authUser so view mode shows latest data
            setSaveSuccess(true);
            setIsEditing(false);
            setTimeout(() => setSaveSuccess(false), 4000);
        } catch (e: any) {
            const detail = e?.response?.data?.detail;
            setSaveError(typeof detail === 'string' ? detail : 'Failed to save profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        // Reset form to current authUser values
        if (authUser) {
            setProfile({
                target_role: authUser.target_role || '',
                github_url: authUser.github_url || '',
                linkedin_url: authUser.linkedin_url || '',
                portfolio_url: authUser.portfolio_url || '',
                skills: authUser.skills || '',
                experience_years: authUser.experience_years || undefined,
                education: authUser.education || '',
                bio: authUser.bio || '',
            });
        }
        setSaveError('');
        setIsEditing(false);
    };

    const handleResumeUpload = async (file: File) => {
        setResumeError('');
        setResumeUploaded(false);
        setResumePreview('');
        setResumeUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post(`${API_URL}/profile/resume/upload`, formData);
            const data = response?.data || {};
            setResumeUploaded(true);
            setExistingResume(true);
            setResumePreview(typeof data.preview === 'string' ? data.preview : '');
            await refreshUser();
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            setResumeError(typeof detail === 'string' ? detail : err?.message || 'Upload failed. Please try again.');
            setResumeUploaded(false);
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

    if (!authUser) return (
        <div className="flex items-center justify-center pt-32">
            <div className="flex flex-col items-center gap-4 text-slate-400">
                <Loader size={36} className="animate-spin text-indigo-400" />
                <p className="text-sm">Loading your profile...</p>
            </div>
        </div>
    );

    const skills = authUser.skills ? authUser.skills.split(',').filter(Boolean) : [];
    const displayName = authUser.full_name || authUser.email.split('@')[0];
    const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
    const profileComplete = !!(authUser.target_role && authUser.skills && authUser.education);

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

            {/* ── Success / Error Banners ──────────────────────────────────── */}
            {saveSuccess && (
                <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-xl">
                    <CheckCircle size={18} className="flex-shrink-0" />
                    <span className="text-sm font-medium">Profile saved successfully!</span>
                </div>
            )}
            {saveError && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl">
                    <X size={18} className="flex-shrink-0" />
                    <span className="text-sm">{saveError}</span>
                </div>
            )}

            {/* ── Profile Header Card ──────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/5 via-purple-600/5 to-transparent pointer-events-none" />
                <div className="relative p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                            <span className="text-2xl font-bold text-white">{initials}</span>
                        </div>
                        {profileComplete && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                                <BadgeCheck size={12} className="text-white" />
                            </div>
                        )}
                    </div>

                    {/* Name + Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h1 className="text-xl font-bold text-white">{displayName}</h1>
                            {profileComplete && (
                                <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
                                    Profile Complete
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 text-sm mb-2">
                            <Mail size={13} />
                            <span>{authUser.email}</span>
                        </div>
                        {authUser.target_role && (
                            <div className="flex items-center gap-1.5 text-indigo-400 text-sm">
                                <Star size={13} />
                                <span>{authUser.target_role}</span>
                                {authUser.experience_years !== undefined && (
                                    <span className="text-slate-500">·  {authUser.experience_years} yrs exp</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Edit Button */}
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 hover:border-indigo-400/60 transition-all text-sm font-medium flex-shrink-0"
                        >
                            <Pencil size={14} />
                            Edit Profile
                        </button>
                    )}
                    {isEditing && (
                        <div className="flex gap-2 flex-shrink-0">
                            <button
                                onClick={handleCancel}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/50 border border-slate-600/50 text-slate-300 hover:bg-slate-700 transition-all text-sm font-medium"
                            >
                                <X size={14} />
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 transition-all text-sm font-semibold shadow-lg shadow-indigo-500/25 disabled:opacity-60"
                            >
                                {loading ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── VIEW MODE ─────────────────────────────────────────────────── */}
            {!isEditing && (
                <div className="grid md:grid-cols-2 gap-5">

                    {/* Left column */}
                    <div className="space-y-5">

                        {/* Resume Status */}
                        <div className="card space-y-4">
                            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <FileText size={14} className="text-indigo-400" />
                                Resume
                            </h2>
                            {existingResume ? (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                                    <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                                    <div>
                                        <p className="text-green-400 text-sm font-medium">Resume on file</p>
                                        <p className="text-slate-500 text-xs mt-0.5">AI interview questions use your resume</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <Upload size={18} className="text-amber-400 flex-shrink-0" />
                                    <div>
                                        <p className="text-amber-400 text-sm font-medium">No resume uploaded</p>
                                        <p className="text-slate-500 text-xs mt-0.5">Click Edit Profile to upload one</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Career Info */}
                        <div className="card space-y-4">
                            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Briefcase size={14} className="text-indigo-400" />
                                Career
                            </h2>
                            <div className="space-y-4">
                                <InfoRow
                                    icon={<Star size={14} className="text-indigo-400" />}
                                    label="Target Role"
                                    value={authUser.target_role}
                                />
                                <InfoRow
                                    icon={<Zap size={14} className="text-indigo-400" />}
                                    label="Experience"
                                    value={authUser.experience_years !== undefined ? `${authUser.experience_years} years` : undefined}
                                />
                                <InfoRow
                                    icon={<GraduationCap size={14} className="text-indigo-400" />}
                                    label="Education"
                                    value={authUser.education}
                                />
                            </div>
                            {!authUser.target_role && !authUser.education && (
                                <p className="text-slate-600 text-sm italic">No career info yet — click Edit Profile</p>
                            )}
                        </div>

                        {/* Bio */}
                        {authUser.bio && (
                            <div className="card space-y-3">
                                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <UserIcon size={14} className="text-indigo-400" />
                                    About
                                </h2>
                                <p className="text-slate-300 text-sm leading-relaxed">{authUser.bio}</p>
                            </div>
                        )}
                    </div>

                    {/* Right column */}
                    <div className="space-y-5">

                        {/* Skills */}
                        <div className="card space-y-4">
                            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Zap size={14} className="text-indigo-400" />
                                Technical Skills
                                {skills.length > 0 && (
                                    <span className="ml-auto text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full normal-case tracking-normal">
                                        {skills.length} skills
                                    </span>
                                )}
                            </h2>
                            {skills.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {skills.map((skill, i) => (
                                        <SkillTag key={i} skill={skill} index={i} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-600 text-sm italic">No skills listed yet — click Edit Profile</p>
                            )}
                        </div>

                        {/* Links */}
                        <div className="card space-y-3">
                            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Globe size={14} className="text-indigo-400" />
                                Links
                            </h2>
                            <div className="space-y-2">
                                <LinkRow
                                    icon={<Github size={14} className="text-slate-300" />}
                                    label="GitHub"
                                    url={authUser.github_url}
                                />
                                <LinkRow
                                    icon={<Linkedin size={14} className="text-blue-400" />}
                                    label="LinkedIn"
                                    url={authUser.linkedin_url}
                                />
                                <LinkRow
                                    icon={<Globe size={14} className="text-indigo-400" />}
                                    label="Portfolio"
                                    url={authUser.portfolio_url}
                                />
                            </div>
                            {!authUser.github_url && !authUser.linkedin_url && !authUser.portfolio_url && (
                                <p className="text-slate-600 text-sm italic">No links added yet — click Edit Profile</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── EDIT MODE ─────────────────────────────────────────────────── */}
            {isEditing && (
                <div className="space-y-5">

                    {/* Resume Upload */}
                    <div className="card space-y-4 border border-indigo-500/30 bg-indigo-950/20">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <FileText size={18} className="text-indigo-400" />
                            Resume
                            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full ml-1">
                                Powers AI questions
                            </span>
                        </h2>

                        <div
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                                dragOver ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-white/5'
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
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f); }}
                            />
                            {resumeUploading ? (
                                <div className="flex flex-col items-center gap-2 text-indigo-400">
                                    <Loader size={28} className="animate-spin" />
                                    <p className="text-sm font-medium">Extracting resume text...</p>
                                </div>
                            ) : resumeUploaded ? (
                                <div className="flex flex-col items-center gap-2 text-green-400">
                                    <CheckCircle size={28} />
                                    <p className="text-sm font-medium">Resume uploaded!</p>
                                    <p className="text-xs text-slate-400">Click to replace</p>
                                </div>
                            ) : existingResume ? (
                                <div className="flex flex-col items-center gap-2 text-green-400">
                                    <CheckCircle size={28} />
                                    <p className="text-sm font-medium">Resume on file ✓</p>
                                    <p className="text-xs text-slate-400">Click to replace with a new resume</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                    <Upload size={28} />
                                    <p className="text-sm font-medium text-slate-300">Drop resume here or click to browse</p>
                                    <p className="text-xs">PDF, DOCX, TXT · Max 10MB</p>
                                </div>
                            )}
                        </div>

                        {resumeError && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
                                ⚠ {resumeError}
                            </div>
                        )}
                        {resumePreview && (
                            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                                <p className="text-xs text-slate-500 mb-1">Preview:</p>
                                <p className="text-xs text-slate-400 font-mono leading-relaxed line-clamp-3">{resumePreview}</p>
                            </div>
                        )}
                    </div>

                    {/* Career Info */}
                    <div className="card space-y-5">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Briefcase size={18} className="text-indigo-400" />
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
                                    min={0} max={50}
                                    className="input-field"
                                    placeholder="e.g. 5"
                                    value={profile.experience_years || ''}
                                    onChange={e => setProfile({ ...profile, experience_years: parseInt(e.target.value) || undefined })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                <GraduationCap size={14} className="inline mr-1" />
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
                            <label className="block text-sm font-medium text-slate-300 mb-2">Bio / Summary</label>
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
                    <div className="card space-y-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Zap size={18} className="text-indigo-400" />
                            Technical Skills
                        </h2>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Skills (comma-separated)</label>
                            <textarea
                                rows={3}
                                className="input-field resize-none"
                                placeholder="e.g. Python, React, AWS, Docker, PostgreSQL, FastAPI..."
                                value={profile.skills}
                                onChange={e => setProfile({ ...profile, skills: e.target.value })}
                            />
                            {profile.skills && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {profile.skills.split(',').filter(Boolean).map((s, i) => (
                                        <SkillTag key={i} skill={s} index={i} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Links */}
                    <div className="card space-y-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Globe size={18} className="text-indigo-400" />
                            Professional Links
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    <Github size={14} className="inline mr-1" /> GitHub Profile
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
                                    <Linkedin size={14} className="inline mr-1" /> LinkedIn
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
                                    <Globe size={14} className="inline mr-1" /> Portfolio / Website
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

                    {/* Save / Cancel buttons (sticky bottom) */}
                    <div className="flex gap-3 pt-2 pb-8">
                        <button
                            onClick={handleCancel}
                            className="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 transition-all font-semibold shadow-lg shadow-indigo-500/25 disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                            {loading ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
