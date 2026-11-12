import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, LifeBuoy, Loader2, Star } from 'lucide-react';
import clsx from 'clsx';
import { endpoints } from '../api';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { PRIVACY_CONTACT } from '../lib/privacy';

const TOPICS = [
    { id: 'interview', label: 'A problem with an interview or practice' },
    { id: 'account', label: 'Account or sign-in' },
    { id: 'privacy', label: 'Privacy or my data' },
    { id: 'idea', label: 'An idea or feature request' },
    { id: 'other', label: 'Something else' },
] as const;
const STAR_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

type Tab = 'help' | 'review';

/** Public page: "Get help" and "Write a review". Both arrive in the team inbox; replies go to the sender's email. */
export const Support = () => {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const tab: Tab = params.get('tab') === 'review' ? 'review' : 'help';
    const from = params.get('from') || undefined;

    const [topic, setTopic] = useState<string>(params.get('topic') || 'interview');
    const [rating, setRating] = useState(Number(params.get('rating')) || 0);
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [sentTo, setSentTo] = useState('');

    const switchTab = (t: Tab) => {
        const next = new URLSearchParams(params);
        next.set('tab', t);
        setParams(next, { replace: true });
        setError('');
        setSentTo('');
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (tab === 'review' && !rating) { setError('Please choose a star rating.'); return; }
        setBusy(true);
        setError('');
        try {
            await endpoints.sendFeedback({
                kind: tab === 'review' ? 'review' : 'support',
                message,
                ...(tab === 'review' ? { rating } : { category: topic }),
                ...(user ? {} : { email }),
                page: from,
            });
            setSentTo(user?.email || email);
            setMessage('');
            if (tab === 'review') { try { localStorage.setItem('mm-review-asked', '1'); } catch { /* private mode */ } }
        } catch (err: any) {
            const d = err?.response?.data?.detail;
            setError(err?.response?.status === 429 ? 'You have sent several messages in the last hour. Please try again later, or email us.'
                : typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: any) => x.msg).join(' · ')
                : 'We could not send that. Please try again, or email us.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={clsx('mx-auto max-w-2xl space-y-8', !user && 'px-4 py-10 sm:px-6')}>
            {!user && <Link to="/" aria-label="MockMate home" className="inline-block"><Logo /></Link>}
            <header className="space-y-2">
                <h1 className="text-4xl font-extrabold">Help and reviews</h1>
                <p className="text-soft">Ask for help, report a problem or tell us how MockMate went for you. A person reads every message.</p>
            </header>

            <div role="tablist" aria-label="Message type" className="inline-flex rounded-btn border border-white/10 bg-white/5 p-1">
                {([['help', 'Get help'], ['review', 'Write a review']] as const).map(([t, label]) => (
                    <button key={t} role="tab" aria-selected={tab === t} onClick={() => switchTab(t)}
                        className={clsx('rounded-[10px] px-5 py-2.5 text-sm font-semibold transition-colors duration-150',
                            tab === t ? 'bg-ink text-bg' : 'text-soft hover:text-ink')}>
                        {label}
                    </button>
                ))}
            </div>

            {sentTo ? (
                <div role="status" className="surface flex items-start gap-4">
                    <CheckCircle2 size={28} className="mt-0.5 flex-shrink-0 text-action" aria-hidden="true" />
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold">{tab === 'review' ? 'Thank you for the review' : 'Message sent'}</h2>
                        <p className="text-soft">
                            {tab === 'review'
                                ? 'It goes straight to the people who build MockMate.'
                                : <>We'll reply by email to <strong className="text-ink">{sentTo}</strong>.</>}
                        </p>
                        <button className="link text-sm" onClick={() => setSentTo('')}>Send another</button>
                    </div>
                </div>
            ) : (
                <form onSubmit={submit} className="surface space-y-5" aria-busy={busy}>
                    {tab === 'help' ? (
                        <div className="space-y-2">
                            <label htmlFor="support-topic" className="text-sm font-medium text-soft">What is it about?</label>
                            <select id="support-topic" className="input-field" value={topic} onChange={e => setTopic(e.target.value)}>
                                {TOPICS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                        </div>
                    ) : (
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium text-soft">How would you rate MockMate?</legend>
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(n => (
                                    <label key={n} className="cursor-pointer p-1" title={STAR_WORDS[n]}>
                                        <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)}
                                            className="peer sr-only" aria-label={`${n} star${n > 1 ? 's' : ''}, ${STAR_WORDS[n]}`} />
                                        <Star size={34} aria-hidden="true"
                                            className={clsx('rounded transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent',
                                                n <= rating ? 'fill-accent text-accent' : 'text-white/25 hover:text-accent/70')} />
                                    </label>
                                ))}
                                <span className="ml-2 text-sm text-soft" aria-hidden="true">{STAR_WORDS[rating]}</span>
                            </div>
                        </fieldset>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="support-message" className="text-sm font-medium text-soft">
                            {tab === 'help' ? 'What happened, or what do you need?' : 'What worked well, and what should be better?'}
                        </label>
                        <textarea id="support-message" required minLength={10} maxLength={5000} rows={6}
                            className="input-field min-h-[150px] resize-y" value={message} onChange={e => setMessage(e.target.value)}
                            placeholder={tab === 'help' ? 'e.g. The interview stopped after question two and showed an error.' : 'e.g. The feedback on my STAR answers was specific and useful.'} />
                    </div>

                    {user ? (
                        <p className="text-sm text-muted">We'll reply to <span className="text-soft">{user.email}</span>.</p>
                    ) : (
                        <div className="space-y-2">
                            <label htmlFor="support-email" className="text-sm font-medium text-soft">Your email, so we can reply</label>
                            <input id="support-email" type="email" required autoComplete="email" className="input-field"
                                placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                    )}

                    {error && <p role="alert" className="rounded-btn border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

                    <button type="submit" disabled={busy} className="btn btn--primary btn--xl w-full">
                        {busy ? <><Loader2 size={18} className="animate-spin" /> Sending</> : tab === 'help' ? 'Send message' : 'Send review'}
                    </button>
                    <p className="text-xs text-muted">
                        We keep your message and email to answer you. See the <Link to="/privacy" className="link">privacy notice</Link>.
                    </p>
                </form>
            )}

            <p className="flex items-center gap-2 text-sm text-muted">
                <LifeBuoy size={16} aria-hidden="true" />
                Prefer email? Write to <a href={`mailto:${PRIVACY_CONTACT}`} className="link">{PRIVACY_CONTACT}</a>
            </p>
        </div>
    );
};
