import { Link, useNavigate } from 'react-router-dom';
import { GoogleButton } from '../components/GoogleButton';
import { AuthShell } from '../components/AuthShell';
import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Check, Circle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

/** Extract a human-readable error message from an Axios error. */
function parseError(err: any): string {
    if (err?.code === 'ERR_NETWORK' || !err?.response) {
        return 'Cannot connect to server. Please check your internet or try again later.';
    }
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((d: any) => d.msg).join(' · ');
    if (err?.response?.status === 429) return 'Too many signup attempts. Please wait a moment.';
    if (err?.response?.status >= 500) return 'Server error occurred while creating account. Please try again.';
    return 'Failed to create account. Please check your details and try again.';
}

// ─── Password rules ───────────────────────────────────────────────────────────
const PASSWORD_RULES: { id: string; label: string; test: (pw: string) => boolean }[] = [
    { id: 'length', label: '8 characters', test: (pw) => pw.length >= 8 },
    { id: 'upper', label: 'An uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
    { id: 'lower', label: 'A lowercase letter', test: (pw) => /[a-z]/.test(pw) },
    { id: 'digit', label: 'A number', test: (pw) => /\d/.test(pw) },
    { id: 'special', label: 'A symbol', test: (pw) => /[!@#$%^&*(),.?":{}|<>\-_=+\[\];'/\\`~]/.test(pw) },
];

const Field = ({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: React.ReactNode }) => (
    <div className="space-y-2">
        <label htmlFor={id} className="text-sm font-medium text-soft">{label}</label>
        {children}
        {hint}
    </div>
);

const RevealButton = ({ shown, onClick, id }: { shown: boolean; onClick: () => void; id: string }) => (
    <button
        type="button" id={id} onClick={onClick}
        aria-label={shown ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors duration-150 hover:text-ink"
    >
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
);

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

    const rules = useMemo(() => PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(password) })), [password]);
    const passed = rules.filter((r) => r.passed).length;
    const mismatch = confirmPassword.length > 0 && confirmPassword !== password;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
        if (passed < PASSWORD_RULES.length) { setError('Please meet all password requirements before continuing.'); return; }
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
        <AuthShell>
            <h2 className="text-3xl font-bold">Create your account</h2>
            <p className="mt-2 text-soft">
                Already have one? <Link to="/login" id="go-to-login-btn" className="link">Sign in</Link>
            </p>

            <form id="signup-form" onSubmit={handleSubmit} className="mt-8 space-y-5" aria-busy={isLoading}>
                <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="signup-username" label="Full name">
                        <input id="signup-username" type="text" required autoComplete="name" className="input-field"
                            value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </Field>
                    <Field id="signup-email" label="Email">
                        <input id="signup-email" type="email" required autoComplete="email" placeholder="name@example.com"
                            className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </Field>
                </div>

                <Field id="signup-role" label="Role you are preparing for">
                    <input id="signup-role" type="text" required placeholder="e.g. Backend engineer"
                        className="input-field" value={role} onChange={(e) => setRole(e.target.value)} />
                </Field>

                <Field
                    id="signup-password" label="Password"
                    hint={
                        <div className="space-y-2 pt-1" aria-live="polite">
                            {/* five segments, one per rule met: the bar and the list say the same thing */}
                            <div className="flex gap-1" aria-hidden="true">
                                {rules.map((r, i) => (
                                    <span key={r.id} className={clsx('h-1 flex-1 rounded-full transition-colors duration-200',
                                        i < passed ? (passed === rules.length ? 'bg-action' : passed >= 3 ? 'bg-accent' : 'bg-danger') : 'bg-white/10')} />
                                ))}
                            </div>
                            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3">
                                {rules.map((r) => (
                                    <li key={r.id} className={clsx('flex items-center gap-1.5 transition-colors duration-150', r.passed ? 'text-action' : 'text-muted')}>
                                        {r.passed ? <Check size={13} aria-label="met" /> : <Circle size={11} aria-label="not met" />}
                                        {r.label}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    }
                >
                    <div className="relative">
                        <input id="signup-password" type={showPassword ? 'text' : 'password'} required autoComplete="new-password"
                            className="input-field pr-12" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <RevealButton id="toggle-signup-password" shown={showPassword} onClick={() => setShowPassword((v) => !v)} />
                    </div>
                </Field>

                <Field
                    id="signup-confirm-password" label="Confirm password"
                    hint={mismatch && <p className="text-xs text-danger">Passwords do not match.</p>}
                >
                    <div className="relative">
                        <input id="signup-confirm-password" type={showConfirm ? 'text' : 'password'} required autoComplete="new-password"
                            aria-invalid={mismatch}
                            className={clsx('input-field pr-12', mismatch && 'border-danger/60')}
                            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                        <RevealButton id="toggle-confirm-password" shown={showConfirm} onClick={() => setShowConfirm((v) => !v)} />
                    </div>
                </Field>

                {error && (
                    <p id="signup-error-banner" role="alert" className="rounded-btn border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                        {error}
                    </p>
                )}

                <button id="signup-submit-btn" type="submit" disabled={isLoading} className="btn btn--primary btn--xl w-full">
                    {isLoading ? <><Loader2 size={18} className="animate-spin" /> Creating account</> : 'Create account'}
                </button>

                <GoogleButton onError={setError} />
            </form>
        </AuthShell>
    );
};
