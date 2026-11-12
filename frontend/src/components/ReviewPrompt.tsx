import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, X } from 'lucide-react';

const KEY = 'mm-review-asked';
const asked = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };

/** Asked once, right after a scored interview: the moment someone has just seen what MockMate does.
 *  Every star goes to the same review form (no routing of low scores elsewhere), and it never asks again
 *  once dismissed or sent. */
export const ReviewPrompt = ({ from }: { from: string }) => {
    const [hidden, setHidden] = useState(asked);
    if (hidden) return null;
    const dismiss = () => { try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ } setHidden(true); };

    return (
        <aside aria-labelledby="review-prompt-h" className="surface flex flex-wrap items-center gap-x-6 gap-y-3">
            <h2 id="review-prompt-h" className="font-semibold">How was this interview?</h2>
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                    <Link key={n} to={`/support?tab=review&rating=${n}&from=${encodeURIComponent(from)}`}
                        aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`} className="group p-1">
                        <Star size={26} aria-hidden="true" className="text-white/30 transition-colors duration-150 group-hover:fill-accent group-hover:text-accent" />
                    </Link>
                ))}
            </div>
            <button onClick={dismiss} aria-label="Don't ask again" className="ml-auto grid h-10 w-10 place-items-center rounded-btn text-muted hover:bg-white/5 hover:text-ink">
                <X size={18} />
            </button>
        </aside>
    );
};
