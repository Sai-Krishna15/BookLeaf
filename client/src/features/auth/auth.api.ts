import { api } from '@/lib/api';
import type { LoginRequest, LoginResponse, MeResponse } from './types';

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

export const authApi = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('/auth/login', payload);
    return res.data;
  },

  async getMe(): Promise<MeResponse> {
    const res = await api.get<MeResponse>('/auth/me');
    return res.data;
  },
};
