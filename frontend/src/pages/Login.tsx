import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Video } from 'lucide-react';

export const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            setError("Invalid credentials");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
            <div className="card w-full max-w-md space-y-8 animate-fade-in">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-lg bg-indigo-600 mx-auto flex items-center justify-center mb-4">
                        <Video className="text-white" size={24} />
                    </div>
                    <h2 className="text-3xl font-bold">Welcome Back</h2>
                    <p className="text-slate-400 mt-2">Sign in to continue your interviews</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && <div className="p-3 bg-red-500/10 text-red-500 rounded text-sm text-center">{error}</div>}

                    <div>
                        <label className="text-sm font-medium text-slate-300">Email Address</label>
                        <input
                            type="email"
                            required
                            className="input-field mt-1"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-300">Password</label>
                        <input
                            type="password"
                            required
                            className="input-field mt-1"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full py-3">
                        Sign In
                    </button>

                    <p className="text-center text-slate-400 text-sm">
                        Don't have an account?{' '}
                        <button type="button" onClick={() => navigate('/signup')} className="text-indigo-400 hover:text-indigo-300 font-medium">
                            Sign up
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
};
