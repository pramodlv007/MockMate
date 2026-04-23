import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, User, History, Sparkles, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

export const Header = () => {
    const location = useLocation();
    const navigate  = useNavigate();
    const { user, logout } = useAuth();

    const NavItem = ({ to, icon: Icon, label }: {
        to: string; icon: React.ComponentType<{ size: number }>; label: string;
    }) => {
        const isActive = location.pathname === to;
        return (
            <Link
                to={to}
                className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 text-sm font-medium",
                    isActive
                        ? "text-white"
                        : "hover:text-white hover:bg-white/5"
                )}
                style={isActive ? {
                    background: 'rgba(201,168,85,0.1)',
                    border:     '1px solid rgba(201,168,85,0.25)',
                    color:      '#c9a855',
                } : { color: '#64748b' }}
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
        <header
            className="border-b sticky top-0 z-50"
            style={{
                background:   'rgba(8,15,30,0.85)',
                backdropFilter: 'blur(20px)',
                borderColor:  'rgba(255,255,255,0.05)',
            }}
        >
            {/* Gold accent line at top */}
            <div className="h-px w-full"
                style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(201,168,85,0.4) 30%, rgba(59,130,246,0.4) 70%, transparent 100%)' }} />

            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-3 group">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center animate-pulse-gold"
                        style={{ background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)' }}
                    >
                        <Sparkles className="text-white" size={18} />
                    </div>
                    <span className="text-xl font-bold text-gradient">MockMate</span>
                </Link>

                {/* Nav */}
                <nav className="flex items-center gap-1">
                    <NavItem to="/"        icon={Home}    label="Home"    />
                    <NavItem to="/history" icon={History} label="History" />
                    <NavItem to="/profile" icon={User}    label="Profile" />
                </nav>

                {/* User + logout */}
                <div className="flex items-center gap-4">
                    <span className="text-sm hidden md:block" style={{ color: '#475569' }}>
                        {user?.email}
                    </span>
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-xl transition-all duration-300"
                        style={{ color: '#475569' }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.color = '#475569';
                            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                        }}
                        title="Logout"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </header>
    );
};
