import axios, { type AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ─── In-Memory Access Token ───────────────────────────────────────────────────
// Never stored in localStorage. Refresh token lives in HttpOnly cookie.
let accessToken: string | null = null;
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

export const setAccessToken = (token: string | null) => { accessToken = token; };
export const getAccessToken = () => accessToken;

function enqueueRefresh(cb: (token: string) => void) { refreshQueue.push(cb); }
function drainRefreshQueue(token: string) { refreshQueue.forEach(cb => cb(token)); refreshQueue = []; }

// ─── Axios Instance ───────────────────────────────────────────────────────────
const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,          // sends HttpOnly refresh cookie on every req
    headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every outgoing request
api.interceptors.request.use(config => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
});

// On 401: silent refresh → retry. On refresh failure: redirect to /login.
api.interceptors.response.use(
    res => res,
    async (error: AxiosError) => {
        const orig = error.config as any;
        const is401 = error.response?.status === 401;
        const isAuthUrl = orig?.url?.includes('/auth/login') || orig?.url?.includes('/auth/refresh');

        if (is401 && !orig._retry && !isAuthUrl) {
            if (isRefreshing) {
                return new Promise(resolve =>
                    enqueueRefresh(token => {
                        orig.headers.Authorization = `Bearer ${token}`;
                        resolve(api(orig));
                    })
                );
            }
            orig._retry = true;
            isRefreshing = true;
            try {
                const res = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
                const { access_token } = res.data;
                setAccessToken(access_token);
                drainRefreshQueue(access_token);
                isRefreshing = false;
                orig.headers.Authorization = `Bearer ${access_token}`;
                return api(orig);
            } catch {
                isRefreshing = false;
                refreshQueue = [];
                setAccessToken(null);
                window.location.href = '/login';
                return Promise.reject(error);
            }
        }
        return Promise.reject(error);
    }
);

// ─── Types ────────────────────────────────────────────────────────────────────
export interface User {
    id: string;
    email: string;
    full_name?: string;
    target_role?: string;
    experience_years?: number;
    education?: string;
    skills?: string;
    github_url?: string;
    linkedin_url?: string;
    portfolio_url?: string;
    bio?: string;
    is_verified: boolean;
    created_at: string;
    last_login_at?: string;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    user: User;
}

export interface ProfileUpdate {
    full_name?: string;
    target_role?: string;
    experience_years?: number;
    education?: string;
    skills?: string;
    github_url?: string;
    linkedin_url?: string;
    portfolio_url?: string;
    bio?: string;
}

export interface Question {
    id: string;
    content: string;
    category?: string;
    difficulty?: number;
    order_index?: number;
    transcript?: string;
    score?: number;
}

export interface InterviewSession {
    id: string;
    user_id: string;
    company_name: string;
    target_role?: string;
    job_description: string;
    questions_count: number;
    duration_minutes: number;
    interviewer_persona: string;
    strictness_level: string;
    status: string;
    overall_score?: number;
    feedback_summary?: string;
    video_storage_path?: string;
    transcript?: string;
    created_at: string;
    completed_at?: string;
    questions: Question[];
}

export interface CreateInterviewPayload {
    company_name: string;
    target_role?: string;
    job_description: string;
    questions_count?: number;
    duration_minutes?: number;
    interviewer_persona?: string;
    strictness_level?: string;
    skills?: string;
}

// ─── Endpoint Map ─────────────────────────────────────────────────────────────
export const endpoints = {
    // Auth
    signup: (data: Record<string, unknown>) =>
        api.post<AuthResponse>('/auth/signup', data),
    login: (formData: FormData) =>
        api.post<AuthResponse>('/auth/login', formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
    logout: () => api.post('/auth/logout'),
    refresh: () => axios.post<{ access_token: string; token_type: string }>(
        `${API_URL}/auth/refresh`, {}, { withCredentials: true }
    ),

    // User
    getMe: () => api.get<User>('/users/me'),
    updateProfile: (data: ProfileUpdate) => api.put<User>('/users/me/profile', data),

    // Interviews
    createInterview: (data: CreateInterviewPayload) =>
        api.post<InterviewSession>('/interviews', data),
    getInterview: (id: string | number) =>
        api.get<InterviewSession>(`/interviews/${id}`),
    getUserInterviews: () =>
        api.get<InterviewSession[]>(`/interviews/user/me`),
    uploadVideo: (id: string | number, file: Blob) => {
        const form = new FormData();
        form.append('file', file, 'recording.webm');
        return api.post(`/interviews/${id}/upload`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    // Profile service
    analyzeGithub: (username: string) =>
        api.get(`/profile/github/${username}`),
    extractSkills: (text: string) =>
        api.post('/profile/skills/extract', { text }),
};

export default api;
