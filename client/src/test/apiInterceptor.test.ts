import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { api, ApiError, AUTH_TOKEN_KEY, setOnUnauthorizedCallback } from '@/lib/api';

describe('API Interceptor & ApiError', () => {
  const originalAdapter = api.defaults.adapter;

  beforeEach(() => {
    sessionStorage.clear();
    setOnUnauthorizedCallback(null);
    api.defaults.adapter = originalAdapter;
  });

  const mockAdapterError = (status: number, data: unknown, _url = '/test') => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.defaults.adapter = async (config: any) => {
      const error = new AxiosError(
        'Request failed with status ' + status,
        'ERR_BAD_RESPONSE',
        config,
        null,
        {
          status,
          statusText: status === 401 ? 'Unauthorized' : 'Bad Request',
          headers: {},
          config,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: data as any,
        },
      );
      throw error;
    };
  };

  it('transforms server error payload into typed ApiError class', async () => {
    mockAdapterError(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid payload input',
        details: { field: 'email' },
        requestId: 'req-12345',
      },
    });

    try {
      await api.get('/test');
      expect.fail('Should have thrown an ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('VALIDATION_ERROR');
      expect(apiErr.message).toBe('Invalid payload input');
      expect(apiErr.status).toBe(400);
      expect(apiErr.requestId).toBe('req-12345');
      expect(apiErr.details).toEqual({ field: 'email' });
    }
  });

  it('clears sessionStorage and calls unauthorized callback on 401 for non-login requests', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'stale-token');
    const unauthorizedSpy = vi.fn();
    setOnUnauthorizedCallback(unauthorizedSpy);

    mockAdapterError(
      401,
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        },
      },
      '/books',
    );

    try {
      await api.get('/books');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }

    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(unauthorizedSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT trigger unauthorized callback on 401 from /auth/login', async () => {
    const unauthorizedSpy = vi.fn();
    setOnUnauthorizedCallback(unauthorizedSpy);

    mockAdapterError(
      401,
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        },
      },
      '/auth/login',
    );

    try {
      await api.post('/auth/login', { email: 'bad@example.com', password: 'bad' });
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }

    expect(unauthorizedSpy).not.toHaveBeenCalled();
  });
});
