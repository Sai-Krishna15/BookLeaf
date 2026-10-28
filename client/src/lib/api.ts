import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;
  public readonly requestId?: string;

  constructor(
    message: string,
    code = 'UNKNOWN_ERROR',
    status = 500,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

export const AUTH_TOKEN_KEY = 'bookleaf_token';

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorizedCallback(cb: (() => void) | null) {
  onUnauthorizedCallback = cb;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { code?: string; message?: string; details?: unknown; requestId?: string } }>) => {
    const status = error.response?.status ?? 500;
    const errorBody = error.response?.data?.error;
    const message = errorBody?.message || error.message || 'An unexpected error occurred';
    const code = errorBody?.code || (status === 404 ? 'NOT_FOUND' : 'API_ERROR');
    const details = errorBody?.details;
    const requestId = errorBody?.requestId;

    const isLoginCall = error.config?.url?.includes('/auth/login');

    if (status === 401 && !isLoginCall) {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      } else {
        toast.error('Session expired. Please log in again.');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(new ApiError(message, code, status, details, requestId));
  },
);
