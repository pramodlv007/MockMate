import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { PrivacyConsent } from './PrivacyConsent';

/** Shown instead of the app until the signed-in user has accepted the current privacy notice. */
export const ConsentGate = () => {
    const { acceptPrivacy, deleteAccount, logout } = useAuth();
    const [agreed, setAgreed] = useState(false);
    const [busy, setBusy] = useState<'' | 'accept' | 'delete'>('');
    const [error, setError] = useState('');

    const run = async (kind: 'accept' | 'delete', fn: () => Promise<void>) => {
        setBusy(kind);
        setError('');
        try { await fn(); } catch (e: any) {
            const d = e?.response?.data?.detail;
            setError(typeof d === 'string' ? d : 'That did not work. Please try again.');
            setBusy('');
        }
    };

    return (
        <div className="mx-auto max-w-lg px-4 py-16">
            <form className="surface space-y-6 p-8" onSubmit={e => { e.preventDefault(); run('accept', acceptPrivacy); }}>
                <Logo />
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">Before you continue</h1>
                    <p className="text-soft">Please read how MockMate handles your data and confirm you agree.</p>
                </div>
                <PrivacyConsent id="gate-privacy" checked={agreed} onChange={setAgreed} />
                {error && <p role="alert" className="rounded-btn border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
                <button type="submit" disabled={!agreed || !!busy} className="btn btn--primary btn--xl w-full">
                    {busy === 'accept' ? <><Loader2 size={18} className="animate-spin" /> Saving</> : 'Agree and continue'}
                </button>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <button type="button" className="link" onClick={logout}>Sign out</button>
                    <button type="button" disabled={!!busy} className="text-danger hover:underline"
                        onClick={() => window.confirm('Delete your account and everything in it? This cannot be undone.') && run('delete', deleteAccount)}>
                        {busy === 'delete' ? 'Deleting…' : "I don't agree: delete my account"}
                    </button>
                </div>
            </form>
        </div>
    );
};
