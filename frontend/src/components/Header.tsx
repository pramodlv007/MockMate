import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';

const NAV = [
    { to: '/', label: 'Home' },
    { to: '/practice', label: 'Practice' },
    { to: '/history', label: 'History' },
    { to: '/profile', label: 'Profile' },
    { to: '/support', label: 'Help' },
];

export const Header = () => {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);

    useEffect(() => setOpen(false), [pathname]);
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    }, [open]);

    const signOut = () => { logout(); navigate('/login'); };
    const initial = (user?.full_name || user?.email || '?').trim().charAt(0).toUpperCase();

    return (
        <>
        <header className="sticky top-0 z-50 border-b border-white/10 bg-bg/85 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
                <Link to="/" aria-label="MockMate home" className="shrink-0"><Logo /></Link>

                <nav aria-label="Main" className="hidden items-center gap-3 md:flex">
                    {NAV.map(n => (
                        <Link key={n.to} to={n.to} className="nav-word" aria-current={pathname === n.to ? 'page' : undefined}>
                            {n.label}
                        </Link>
                    ))}
                </nav>

                <div className="ml-auto hidden items-center gap-3 md:flex">
                    <Link to="/new-interview" className="btn btn--primary"><Plus size={16} aria-hidden="true" />New interview</Link>
                    <span
                        className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-ink"
                        title={user?.email} aria-hidden="true"
                    >
                        {initial}
                    </span>
                    <button
                        onClick={signOut} aria-label="Sign out"
                        className="grid h-11 w-11 place-items-center rounded-btn text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink"
                    >
                        <LogOut size={18} />
                    </button>
                </div>

                <button
                    onClick={() => setOpen(o => !o)}
                    aria-expanded={open} aria-controls="mobile-menu"
                    aria-label={open ? 'Close menu' : 'Open menu'}
                    className="ml-auto grid h-11 w-11 place-items-center rounded-btn text-ink md:hidden"
                >
                    {open ? <X size={22} /> : <Menu size={22} />}
                </button>
            </div>
        </header>

            {/* phone: one full-screen sheet; fades in with a 6px drop (200ms), closes in 120ms.
                It sits outside <header>: the header's backdrop-filter would trap a fixed child in its own box. */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        id="mobile-menu"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] } }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        className="fixed inset-x-0 bottom-0 top-16 z-50 flex flex-col gap-2 overflow-y-auto bg-bg px-6 pb-8 pt-4 md:hidden"
                    >
                        <nav aria-label="Main" className="flex flex-col">
                            {NAV.map(n => (
                                <Link
                                    key={n.to} to={n.to} aria-current={pathname === n.to ? 'page' : undefined}
                                    className="flex min-h-[56px] items-center border-b border-white/10 text-2xl font-semibold text-soft aria-[current=page]:text-action"
                                >
                                    {n.label}
                                </Link>
                            ))}
                        </nav>
                        <Link to="/new-interview" className="btn btn--primary btn--xl mt-6 w-full"><Plus size={18} aria-hidden="true" />New interview</Link>
                        <button onClick={signOut} className="btn btn--secondary btn--xl w-full"><LogOut size={18} aria-hidden="true" />Sign out</button>
                        <p className="mt-auto pt-6 text-sm text-muted">Signed in as {user?.email}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
