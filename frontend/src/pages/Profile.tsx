import { useState, useEffect } from 'react';
import { endpoints, type ProfileUpdate } from '../api';
import { useAuth } from '../context/AuthContext';
import { User as UserIcon, Save, Github, Linkedin, Globe, Briefcase, GraduationCap, FileText } from 'lucide-react';

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

    if (!authUser) return <div className="text-center pt-20">Loading...</div>;

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <UserIcon size={40} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">{authUser.username}</h1>
                    <p className="text-slate-400">{authUser.email}</p>
                </div>
            </div>

            {saved && (
                <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-lg text-center">
                    ✓ Profile saved successfully!
                </div>
            )}

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
                        placeholder="e.g. Python, JavaScript, React, Node.js, AWS, Docker, Kubernetes, System Design, Machine Learning..."
                        value={profile.skills}
                        onChange={e => setProfile({ ...profile, skills: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 mt-2">
                        💡 These skills will be used to generate personalized interview questions based on your experience.
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
