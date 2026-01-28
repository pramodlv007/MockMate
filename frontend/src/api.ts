import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Types
export interface User {
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

export interface ProfileUpdate {
    target_role?: string;
    github_url?: string;
    linkedin_url?: string;
    portfolio_url?: string;
    skills?: string;
    experience_years?: number;
    education?: string;
    bio?: string;
}

export interface Question {
    id: number;
    content: string;
}

export interface InterviewSession {
    id: number;
    user_id: number;
    company_name: string;
    job_description: string;
    questions_count: number;
    duration_minutes: number;
    status: 'started' | 'completed' | 'evaluated';
    ai_score?: number;
    ai_feedback?: string;
    created_at: string;
    questions: Question[];
    video_storage_path?: string;
}

export const endpoints = {
    getMe: () => api.get<User>('/users/me'),

    updateProfile: (data: ProfileUpdate) =>
        api.put<User>('/users/me/profile', data),

    createInterview: (data: { company_name: string; job_description: string; questions_count: number; duration_minutes: number }) =>
        api.post<InterviewSession>('/interviews/', data),

    getInterview: (id: number) =>
        api.get<InterviewSession>(`/interviews/${id}`),

    uploadVideo: (id: number, file: Blob) => {
        const formData = new FormData();
        formData.append('file', file, 'recording.webm');
        return api.post(`/interviews/${id}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    getUserInterviews: () =>
        api.get<InterviewSession[]>('/users/me/interviews'),
};
