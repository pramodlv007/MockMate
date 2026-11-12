import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

/** Google's own button (required by their branding rules), loaded from GIS. Hidden if no client ID is set. */
export const GoogleButton = ({ onError }: { onError: (msg: string) => void }) => {
    const ref = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { googleLogin } = useAuth();

    useEffect(() => {
        if (!CLIENT_ID) return;
        const init = () => {
            const g = (window as any).google?.accounts?.id;
            if (!g || !ref.current) return;
            g.initialize({
                client_id: CLIENT_ID,
                callback: async ({ credential }: { credential: string }) => {
                    try {
                        await googleLogin(credential);
                        navigate('/');
                    } catch (err: any) {
                        onError(err?.response?.data?.detail || 'Google sign-in failed. Please try again.');
                    }
                },
            });
            g.renderButton(ref.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 320 });
        };
        if ((window as any).google?.accounts?.id) return init();
        let s = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
        if (!s) {
            s = document.createElement('script');
            s.src = GSI_SRC;
            s.async = true;
            document.head.appendChild(s);
        }
        s.addEventListener('load', init);
        return () => s!.removeEventListener('load', init);
    }, [googleLogin, navigate, onError]);

    if (!CLIENT_ID) return null;
    return (
        <>
            <div className="my-2 flex items-center gap-3 text-sm text-muted">
                <span className="flex-1 border-t border-white/10" />or<span className="flex-1 border-t border-white/10" />
            </div>
            <div ref={ref} className="flex justify-center" />
        </>
    );
};
