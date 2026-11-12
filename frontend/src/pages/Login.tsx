import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GoogleButton } from '../components/GoogleButton';
import { AuthShell } from '../components/AuthShell';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

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
        <AuthShell>
            <h2 className="text-3xl font-bold">Sign in</h2>
            <p className="mt-2 text-soft">
                New to MockMate? <Link to="/signup" id="go-to-signup-btn" className="link">Create an account</Link>
            </p>

            <form id="login-form" onSubmit={handleSubmit} className="mt-8 space-y-5" aria-busy={isLoading}>
                <div className="space-y-2">
                    <label htmlFor="login-email" className="text-sm font-medium text-soft">Email</label>
                    <input
                        id="login-email" type="email" required autoComplete="email"
                        placeholder="name@example.com" className="input-field"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="login-password" className="text-sm font-medium text-soft">Password</label>
                    <div className="relative">
                        <input
                            id="login-password" type={showPassword ? 'text' : 'password'} required
                            autoComplete="current-password" className="input-field pr-12"
                            value={password} onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                            type="button" id="toggle-password-visibility"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors duration-150 hover:text-ink"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                {error && (
                    <p id="login-error-banner" role="alert" className="rounded-btn border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                        {error}
                    </p>
                )}

                <button id="login-submit-btn" type="submit" disabled={isLoading} className="btn btn--primary btn--xl w-full">
                    {isLoading ? <><Loader2 size={18} className="animate-spin" /> Signing in</> : 'Sign in'}
                </button>

                <GoogleButton onError={setError} />
            </form>
        </AuthShell>
    );
};
