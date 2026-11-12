import { Link } from 'react-router-dom';

/** The one consent sentence, shared by sign-up and the accept-the-notice screen. */
export const PrivacyConsent = ({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-soft">
        <input id={id} type="checkbox" required checked={checked} onChange={e => onChange(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-shrink-0 accent-emerald-500" />
        <span>
            I'm 18 or older and I agree to the{' '}
            <Link to="/privacy" target="_blank" className="link">privacy notice</Link>: MockMate stores my account,
            profile and interview data, and sends my resume, answers and interview recordings to Google Gemini to
            create questions and feedback. I can delete my data at any time.
        </span>
    </label>
);
