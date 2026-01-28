import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Signup = () => {
    const navigate = useNavigate();
    const { signup } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [role, setRole] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signup(email, username, password, role);
            navigate('/');
        } catch (err) {
            setError("Failed to create account. Email may be taken.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
            <div className="card w-full max-w-md space-y-8 animate-fade-in">
                <div className="text-center">
                    <h2 className="text-3xl font-bold">Create Account</h2>
                    <p className="text-slate-400 mt-2">Start your interview journey</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <div className="p-3 bg-red-500/10 text-red-500 rounded text-sm text-center">{error}</div>}

                    <div>
                        <label className="text-sm font-medium text-slate-300">Full Name</label>
                        <input
                            type="text"
                            required
                            className="input-field mt-1"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-300">Email Address</label>
                        <input
                            type="email"
                            required
                            className="input-field mt-1"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-300">Target Role</label>
                        <input
                            type="text"
                            className="input-field mt-1"
                            placeholder="e.g. Software Engineer"
                            value={role}
                            onChange={e => setRole(e.target.value)}
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

                    <button type="submit" className="btn-primary w-full py-3 mt-4">
                        Sign Up
                    </button>

                    <p className="text-center text-slate-400 text-sm">
                        Already have an account?{' '}
                        <button type="button" onClick={() => navigate('/login')} className="text-indigo-400 hover:text-indigo-300 font-medium">
                            Log in
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
};
