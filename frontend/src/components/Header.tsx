import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, User, History, Sparkles, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

export const Header = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const NavItem = ({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ size: number }>; label: string }) => {
        const isActive = location.pathname === to;
        return (
            <Link
                to={to}
                className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 text-sm font-medium",
                    isActive
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
            >
                <Icon size={16} />
                <span>{label}</span>
            </Link>
        );
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="border-b border-white/5 sticky top-0 z-50" style={{ background: 'rgba(6, 6, 17, 0.8)', backdropFilter: 'blur(20px)' }}>
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-3 group">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center animate-pulse-glow"
                         style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                        <Sparkles className="text-white" size={18} />
                    </div>
                    <span className="text-xl font-bold text-gradient">
                        MockMate
                    </span>
                </Link>

                <nav className="flex items-center gap-1">
                    <NavItem to="/" icon={Home} label="Home" />
                    <NavItem to="/history" icon={History} label="History" />
                    <NavItem to="/profile" icon={User} label="Profile" />
                </nav>

                <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500 hidden md:block">{user?.email}</span>
                    <button
                        onClick={handleLogout}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300"
                        title="Logout"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </header>
    );
};
