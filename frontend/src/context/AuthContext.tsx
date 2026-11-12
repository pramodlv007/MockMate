import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from 'react';
import { setAccessToken, endpoints, type User } from '../api';

interface SignupData {
    email: string;
    password: string;
    full_name: string;
    target_role?: string;
    experience_years?: number;
    education?: string;
    skills?: string;
    github_url?: string;
    linkedin_url?: string;
    portfolio_url?: string;
    accept_privacy: boolean;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (data: SignupData) => Promise<void>;
    googleLogin: (credential: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    acceptPrivacy: () => Promise<void>;
    deleteAccount: () => Promise<void>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // ── Fetch current user via /users/me ─────────────────────────────────────
    const fetchUser = useCallback(async () => {
        try {
            const res = await endpoints.getMe();
            setUser(res.data);
        } catch {
            setAccessToken(null);
            setUser(null);
        }
    }, []);

    // ── Silent refresh on app mount ───────────────────────────────────────────
    // Uses the HttpOnly refresh cookie to silently restore session.
    useEffect(() => {
        const initAuth = async () => {
            try {
                const res = await endpoints.refresh();
                setAccessToken(res.data.access_token);
                await fetchUser();
            } catch {
                console.info('[Auth] No active session.');
            } finally {
                setLoading(false);
            }
        };
        initAuth();
    }, [fetchUser]);

    // ── Login ─────────────────────────────────────────────────────────────────
    const login = async (email: string, password: string) => {
        const form = new FormData();
        form.append('username', email); // OAuth2PasswordRequestForm field name
        form.append('password', password);

        const res = await endpoints.login(form);
        // New auth service returns { access_token, user } — use user directly
        setAccessToken(res.data.access_token);
        if (res.data.user) {
            setUser(res.data.user);
        } else {
            await fetchUser();
        }
    };

    const googleLogin = async (credential: string) => {
        const res = await endpoints.googleLogin(credential);
        setAccessToken(res.data.access_token);
        setUser(res.data.user);
    };

    // ── Signup ────────────────────────────────────────────────────────────────
    const signup = async (data: SignupData) => {
        const res = await endpoints.signup(data as unknown as Record<string, unknown>);
        setAccessToken(res.data.access_token);
        if (res.data.user) {
            setUser(res.data.user);
        } else {
            await fetchUser();
        }
    };

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = async () => {
        try {
            await endpoints.logout();
        } catch {
            console.warn('[Auth] Logout call failed — clearing client state.');
        } finally {
            setAccessToken(null);
            setUser(null);
        }
    };

    // ── Refresh user (call after profile updates) ──────────────────────────────
    const refreshUser = async () => { await fetchUser(); };

    const acceptPrivacy = async () => {
        const res = await endpoints.acceptPrivacy();
        setUser(res.data);
    };

    // Interviews first: each delete also removes its recording, and the server refuses to drop an
    // account that still has any, so a failure part-way leaves the account in place to retry.
    const deleteAccount = async () => {
        const { data: sessions } = await endpoints.getUserInterviews();
        for (const s of sessions) await endpoints.deleteInterview(s.id);
        await endpoints.deleteAccount();
        setAccessToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user, loading, login, signup, googleLogin, logout, refreshUser, acceptPrivacy, deleteAccount,
            isAuthenticated: !!user,
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
