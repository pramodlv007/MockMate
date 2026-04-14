import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    User,
    Mail,
    Briefcase,
    Lock,
    Sparkles,
    ArrowRight,
    Eye,
    EyeOff,
    CheckCircle2,
    XCircle,
} from 'lucide-react';

/** Extract a human-readable error message from an Axios error. */
function parseError(err: any): string {
    // 1. Connection/Network Errors
    if (err?.code === 'ERR_NETWORK' || !err?.response) {
        return 'Cannot connect to server. Please check your internet or try again later.';
    }

    // 2. Structured Backend Errors
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((d: any) => d.msg).join(' · ');

    // 3. Fallback for specific status codes
    if (err?.response?.status === 429) return 'Too many signup attempts. Please wait a moment.';
    if (err?.response?.status >= 500) return 'Server error occurred while creating account. Please try again.';

    return 'Failed to create account. Please check your details and try again.';
}

// ─── Password Strength Rules ─────────────────────────────────────────────────
interface PasswordRule {
    id: string;
    label: string;
    test: (pw: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
    { id: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
    { id: 'upper', label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
    { id: 'lower', label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
    { id: 'digit', label: 'One number', test: (pw) => /\d/.test(pw) },
    {
        id: 'special',
        label: 'One special character',
        test: (pw) => /[!@#$%^&*(),.?":{}|<>\-_=+\[\];'/\\`~]/.test(pw),
    },
];

function getStrengthMeta(passedCount: number): { label: string; color: string; width: string } {
    if (passedCount <= 1) return { label: 'Very Weak', color: 'bg-red-500', width: 'w-1/5' };
    if (passedCount === 2) return { label: 'Weak', color: 'bg-orange-500', width: 'w-2/5' };
    if (passedCount === 3) return { label: 'Fair', color: 'bg-yellow-500', width: 'w-3/5' };
    if (passedCount === 4) return { label: 'Strong', color: 'bg-emerald-400', width: 'w-4/5' };
    return { label: 'Very Strong', color: 'bg-emerald-500', width: 'w-full' };
}

export const Signup = () => {
    const navigate = useNavigate();
    const { signup } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [focusedPassword, setFocusedPassword] = useState(false);

    // Password strength computation
    const ruleResults = useMemo(
        () => PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(password) })),
        [password]
    );
    const passedCount = ruleResults.filter((r) => r.passed).length;
    const strengthMeta = useMemo(() => getStrengthMeta(passedCount), [passedCount]);
    const allRulesPassed = passedCount === PASSWORD_RULES.length;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (!allRulesPassed) {
            setError('Please meet all password requirements before continuing.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await signup({ email, password, full_name: fullName, target_role: role });
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
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[120px] rounded-full animate-pulse delay-700" />

            <div className="card w-full max-w-lg relative z-10">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-cyan-600 mx-auto flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20 animate-float">
                        <Sparkles className="text-white" size={32} />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">
                        Join <span className="text-gradient">MockMate</span>
                    </h1>
                    <p className="text-slate-400 mt-3 text-lg font-medium">
                        Elevate your interview game starting today.
                    </p>
                </div>

                <form id="signup-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Error Banner */}
                    {error && (
                        <div
                            id="signup-error-banner"
                            className="md:col-span-2 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm text-center font-medium animate-shake"
                        >
                            {error}
                        </div>
                    )}

                    {/* Full Name */}
                    <div className="space-y-2">
                        <label htmlFor="signup-username" className="text-sm font-semibold text-slate-400 ml-1">
                            Full Name
                        </label>
                        <div className="relative group">
                            <User
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors"
                                size={20}
                            />
                            <input
                                id="signup-username"
                                type="text"
                                required
                                autoComplete="name"
                                placeholder="John Doe"
                                className="input-field pl-12"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <label htmlFor="signup-email" className="text-sm font-semibold text-slate-400 ml-1">
                            Email Address
                        </label>
                        <div className="relative group">
                            <Mail
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors"
                                size={20}
                            />
                            <input
                                id="signup-email"
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="john@example.com"
                                className="input-field pl-12"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Target Role */}
                    <div className="space-y-2 md:col-span-2">
                        <label htmlFor="signup-role" className="text-sm font-semibold text-slate-400 ml-1">
                            Target Role
                        </label>
                        <div className="relative group">
                            <Briefcase
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors"
                                size={20}
                            />
                            <input
                                id="signup-role"
                                type="text"
                                required
                                placeholder="e.g. Software Engineer, Product Manager"
                                className="input-field pl-12"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2 md:col-span-2">
                        <label htmlFor="signup-password" className="text-sm font-semibold text-slate-400 ml-1">
                            Password
                        </label>
                        <div className="relative group">
                            <Lock
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors"
                                size={20}
                            />
                            <input
                                id="signup-password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                autoComplete="new-password"
                                placeholder="Create a strong password"
                                className="input-field pl-12 pr-12"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onFocus={() => setFocusedPassword(true)}
                            />
                            <button
                                type="button"
                                id="toggle-signup-password"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        {/* Password Strength Meter */}
                        {(focusedPassword || password.length > 0) && (
                            <div className="mt-3 space-y-3">
                                {/* Strength bar */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-xs font-medium text-slate-500">Password Strength</span>
                                        <span
                                            className={`text-xs font-semibold ${
                                                passedCount < 3
                                                    ? 'text-red-400'
                                                    : passedCount < 5
                                                    ? 'text-yellow-400'
                                                    : 'text-emerald-400'
                                            }`}
                                        >
                                            {password.length > 0 ? strengthMeta.label : ''}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${strengthMeta.color} ${strengthMeta.width}`}
                                        />
                                    </div>
                                </div>

                                {/* Rules checklist */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 px-1">
                                    {ruleResults.map((rule) => (
                                        <div
                                            key={rule.id}
                                            className={`flex items-center gap-2 text-xs transition-colors ${
                                                rule.passed ? 'text-emerald-400' : 'text-slate-500'
                                            }`}
                                        >
                                            {rule.passed ? (
                                                <CheckCircle2 size={13} className="flex-shrink-0" />
                                            ) : (
                                                <XCircle size={13} className="flex-shrink-0" />
                                            )}
                                            {rule.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2 md:col-span-2">
                        <label htmlFor="signup-confirm-password" className="text-sm font-semibold text-slate-400 ml-1">
                            Confirm Password
                        </label>
                        <div className="relative group">
                            <Lock
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors"
                                size={20}
                            />
                            <input
                                id="signup-confirm-password"
                                type={showConfirm ? 'text' : 'password'}
                                required
                                autoComplete="new-password"
                                placeholder="Repeat your password"
                                className={`input-field pl-12 pr-12 ${
                                    confirmPassword.length > 0 && confirmPassword !== password
                                        ? 'border-red-500/50 focus:border-red-500'
                                        : ''
                                }`}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                id="toggle-confirm-password"
                                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                                onClick={() => setShowConfirm((v) => !v)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition-colors"
                            >
                                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {confirmPassword.length > 0 && confirmPassword !== password && (
                            <p className="text-xs text-red-400 pl-1 mt-1">Passwords do not match.</p>
                        )}
                    </div>

                    {/* Submit */}
                    <button
                        id="signup-submit-btn"
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary w-full py-4 text-lg md:col-span-2 mt-2 group"
                    >
                        {isLoading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Create Account
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                            </>
                        )}
                    </button>

                    {/* Footer */}
                    <div className="md:col-span-2 pt-4 text-center">
                        <p className="text-slate-500 font-medium">
                            Already part of the community?{' '}
                            <button
                                id="go-to-login-btn"
                                type="button"
                                onClick={() => navigate('/login')}
                                className="text-emerald-400 hover:text-emerald-300 transition-all hover:underline underline-offset-4"
                            >
                                Sign in instead
                            </button>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};
