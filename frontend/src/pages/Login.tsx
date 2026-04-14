import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Video, Lock, Mail, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';

/** Extract a human-readable error message from an Axios error. */
function parseError(err: any): string {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((d: any) => d.msg).join(' · ');
    if (err?.response?.status === 429) return 'Too many login attempts. Please wait a moment.';
    return 'Invalid email or password. Please try again.';
}

export const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            setError(parseError(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated background orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full animate-pulse" style={{ background: 'rgba(16,185,129,0.08)' }} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full animate-pulse" style={{ background: 'rgba(6,182,212,0.08)' }} />

            <div className="card w-full max-w-md relative z-10">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-6 animate-float animate-pulse-glow"
                         style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                        <Video className="text-white" size={32} />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">
                        Welcome <span className="text-gradient">Back</span>
                    </h1>
                    <p className="text-slate-400 mt-3 text-lg font-medium">
                        Continue your path to excellence.
                    </p>
                </div>

                <form id="login-form" onSubmit={handleSubmit} className="space-y-6">
                    {/* Error Banner */}
                    {error && (
                        <div
                            id="login-error-banner"
                            className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm text-center font-medium animate-shake"
                        >
                            {error}
                        </div>
                    )}

                    {/* Email */}
                    <div className="space-y-2">
                        <label htmlFor="login-email" className="text-sm font-semibold text-slate-400 ml-1">
                            Email Address
                        </label>
                        <div className="relative group">
                            <Mail
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors"
                                size={20}
                            />
                            <input
                                id="login-email"
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="name@example.com"
                                className="input-field pl-12"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label htmlFor="login-password" className="text-sm font-semibold text-slate-400">
                                Password
                            </label>
                            <button
                                id="forgot-password-btn"
                                type="button"
                                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                            >
                                Forgot password?
                            </button>
                        </div>
                        <div className="relative group">
                            <Lock
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors"
                                size={20}
                            />
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className="input-field pl-12 pr-12"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                id="toggle-password-visibility"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Security notice */}
                    <div className="flex items-center gap-2 text-xs text-slate-600 px-1">
                        <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0" />
                        <span>Your session is secured with HttpOnly cookies &amp; encrypted tokens.</span>
                    </div>

                    {/* Submit */}
                    <button
                        id="login-submit-btn"
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary w-full py-4 text-lg mt-4 group"
                    >
                        {isLoading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Sign In
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                            </>
                        )}
                    </button>

                    {/* Footer link */}
                    <div className="pt-6 text-center">
                        <p className="text-slate-500 font-medium">
                            Don&apos;t have an account?{' '}
                            <button
                                id="go-to-signup-btn"
                                type="button"
                                onClick={() => navigate('/signup')}
                                className="text-emerald-400 hover:text-emerald-300 transition-all hover:underline underline-offset-4"
                            >
                                Create one for free
                            </button>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};
