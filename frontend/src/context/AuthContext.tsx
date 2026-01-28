import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface User {
    id: number;
    username: string;
    email: string;
    target_role?: string;
    github_url?: string;
    linkedin_url?: string;
    portfolio_url?: string;
    skills?: string;
    experience_years?: number;
    education?: string;
    bio?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, username: string, password: string, target_role: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

    useEffect(() => {
        if (token) {
            fetchUser();
        }
    }, [token]);

    const fetchUser = async () => {
        try {
            const res = await axios.get(`${API_URL}/users/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(res.data);
        } catch (e) {
            console.error("Failed to fetch user", e);
            logout();
        }
    };

    const refreshUser = async () => {
        await fetchUser();
    };

    const login = async (email: string, password: string) => {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const res = await axios.post(`${API_URL}/token`, formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = res.data.access_token;
        localStorage.setItem('token', accessToken);
        setToken(accessToken);
    };

    const signup = async (email: string, username: string, password: string, target_role: string) => {
        await axios.post(`${API_URL}/signup`, { email, username, password, target_role });
        await login(email, password);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, signup, logout, refreshUser, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
