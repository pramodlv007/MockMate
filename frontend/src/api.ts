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
    // NOTE: Do NOT set a default Content-Type here.
    // For JSON bodies, axios sets it automatically.
    // For FormData (file uploads), axios MUST set multipart/form-data with the boundary itself.
    // A hardcoded default would corrupt the boundary on retried multipart requests.
});

// Attach access token + set correct Content-Type on every outgoing request
api.interceptors.request.use(config => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    // Only set JSON content-type if the body is not FormData (file upload)
    if (config.data && !(config.data instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
    }
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
    evaluation?: string; // JSON string of per-question eval
}

export interface PerQuestionResult {
    question: string;
    answer_summary: string;
    scores: {
        technical_accuracy: number;
        depth: number;
        relevance: number;
        structure: number;
        resume_alignment: number;
    };
    overall: number;
    category: 'STRONG' | 'ADEQUATE' | 'WEAK';
    what_was_good: string;
    what_was_missing: string;
    ideal_answer_outline: string;
    resume_gap_flag: string | null;
}

export interface SpeechMetrics {
    words_per_minute: number;
    pace_assessment: string;
    filler_word_count: number;
    filler_ratio_percent: number;
    filler_breakdown: { word: string; count: number }[];
    word_count: number;
}

export interface NonVerbalDashboard {
    eye_contact_percent: number;
    good_posture_percent: number;
    engagement_percent: number;
    concerns: string[];
    timeline_notes?: string;
}

export interface Mistake {
    type: string;
    question_index: number;
    quote: string;
    problem: string;
    better_approach: string;
}

export interface EvaluationFeedback {
    overall_score: number;
    score_breakdown: {
        content: { score: number; weight: string; explanation: string };
        communication: { score: number; weight: string; penalties: string[] };
        presence: { score: number; weight: string; components: { eye_contact: number; posture: number; engagement: number } };
    };
    hire_recommendation: string;
    executive_summary: string;
    per_question_results: PerQuestionResult[];
    speech_metrics: SpeechMetrics;
    non_verbal_dashboard: NonVerbalDashboard;
    resume_alignment_summary: {
        verified_claims: string[];
        unverified_claims: string[];
        gaps_vs_jd: string[];
    };
    comparison_to_role: {
        meets_requirements: string[];
        below_requirements: string[];
        exceeds_requirements: string[];
    };
    strengths: string[];
    critical_improvements: string[];
    top_mistakes: Mistake[];
    training_plan_7_day: Record<string, { focus: string; duration_minutes: number; drills: string[] }>;
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
        // Don't set Content-Type — axios sets multipart/form-data + boundary automatically for FormData
        return api.post(`/interviews/${id}/upload`, form);
    },

    // Profile service
    analyzeGithub: (username: string) =>
        api.get(`/profile/github/${username}`),
    extractSkills: (text: string) =>
        api.post('/profile/skills/extract', { text }),
};

export default api;
