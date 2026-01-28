import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, User, History, Video, LogOut } from 'lucide-react';
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
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                    isActive
                        ? "bg-indigo-600/20 text-indigo-400 font-medium"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
            >
                <Icon size={18} />
                <span>{label}</span>
            </Link>
        );
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Video className="text-white" size={20} />
                    </div>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        MockMate
                    </span>
                </Link>

                <nav className="flex items-center gap-2">
                    <NavItem to="/" icon={Home} label="Home" />
                    <NavItem to="/history" icon={History} label="History" />
                    <NavItem to="/profile" icon={User} label="Profile" />
                </nav>

                <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-400">{user?.email}</span>
                    <button
                        onClick={handleLogout}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </header>
    );
};
