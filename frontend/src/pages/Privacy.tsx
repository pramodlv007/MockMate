import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { PRIVACY_CONTACT, PRIVACY_UPDATED } from '../lib/privacy';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="space-y-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="space-y-3 text-soft leading-relaxed">{children}</div>
    </section>
);

const updated = new Date(PRIVACY_UPDATED + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const mail = <a href={`mailto:${PRIVACY_CONTACT}`} className="link">{PRIVACY_CONTACT}</a>;

/** Public page: linked from sign-up, the accept screen, the interview consent box and Profile. */
export const Privacy = () => (
    <article className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
        <header className="space-y-4">
            <Link to="/" aria-label="MockMate home"><Logo /></Link>
            <h1 className="text-4xl font-extrabold">Privacy notice</h1>
            <p className="text-muted">Last updated {updated}</p>
            <p className="text-soft leading-relaxed">
                MockMate is a mock-interview practice app. This page says what we keep about you, why, who else
                handles it, how long we keep it and how to delete it. Questions or requests: {mail} or the <Link to="/support" className="link">help form</Link>.
            </p>
        </header>

        <Section title="What we keep">
            <ul className="list-disc space-y-2 pl-5">
                <li><strong className="text-ink">Account:</strong> your email, name and password. The password is stored only as a one-way hash, so nobody can read it. If you sign in with Google, we get your name and email from Google.</li>
                <li><strong className="text-ink">Profile (optional):</strong> target role, experience, education, skills, GitHub, LinkedIn and portfolio links, and the text of your resume. The resume file itself is discarded once its text is read.</li>
                <li><strong className="text-ink">Interviews:</strong> the company, role and job description you enter, the questions, your camera and microphone recording, transcripts of your answers, scores and feedback.</li>
                <li><strong className="text-ink">Practice answers:</strong> graded and shown to you, but not saved. A spoken answer is turned into text on our server and the audio is deleted straight away.</li>
                <li><strong className="text-ink">Help requests and reviews:</strong> your message, star rating and email address, so we can reply.</li>
                <li><strong className="text-ink">Server logs:</strong> the pages and actions requested and your IP address, kept for a limited time for security and fixing bugs.</li>
            </ul>
        </Section>

        <Section title="Why">
            <p>
                Only to run MockMate for you: to keep your account, write interview questions that fit your role and
                resume, transcribe and score your answers, and show your history. No advertising, no selling or
                sharing your data for marketing, and no tracking or analytics.
            </p>
        </Section>

        <Section title="Who else handles it">
            <ul className="list-disc space-y-2 pl-5">
                <li><strong className="text-ink">Google Gemini</strong> writes the questions, transcribes interview recordings and scores answers. It receives your resume text, the job description, your answers and your interview recordings.</li>
                <li><strong className="text-ink">Supabase</strong> hosts our database: your account, profile and interview text.</li>
                <li><strong className="text-ink">Amazon Web Services</strong> runs our server and stores interview recordings, in Ohio, United States.</li>
                <li><strong className="text-ink">Gmail</strong> (Google) is where help requests and reviews arrive, so we can answer them.</li>
                <li><strong className="text-ink">Google Sign-In</strong> (only if you use it) and <strong className="text-ink">Google Fonts</strong> load from Google on some pages.</li>
            </ul>
            <p>Each handles the data under its own terms, only to provide its service to us.</p>
        </Section>

        <Section title="How long we keep it">
            <ul className="list-disc space-y-2 pl-5">
                <li>Interview recordings: deleted automatically after 30 days, or sooner when you delete the interview.</li>
                <li>Everything else: until you delete it or your account.</li>
            </ul>
        </Section>

        <Section title="Your choices">
            <ul className="list-disc space-y-2 pl-5">
                <li>Delete any interview, with its recording, transcript and scores, from <Link to="/history" className="link">History</Link>.</li>
                <li>Remove your resume, or delete your whole account (including your help requests and reviews), from <Link to="/profile" className="link">Profile</Link>.</li>
                <li>For a copy of your data, a correction, or any question or complaint, email {mail}.</li>
            </ul>
        </Section>

        <Section title="Cookies">
            <p>One cookie, which keeps you signed in. No advertising or tracking cookies.</p>
        </Section>

        <Section title="Age">
            <p>MockMate is for people aged 18 or older.</p>
        </Section>

        <Section title="Changes">
            <p>If this notice changes in a way that matters, we'll show it to you and ask you to accept it again before you continue.</p>
        </Section>
    </article>
);
