import * as React from 'react';
import { AUTH_TOKEN_KEY, setOnUnauthorizedCallback } from '@/lib/api';
import { authApi } from '@/features/auth/auth.api';
import type { AuthorProfile, User } from '@/features/auth/types';
import { queryClient } from './QueryProvider';
import { clearUnreadTickets } from '@/features/tickets/hooks/useAuthorTicketRealtime';
import { clearUnreadAdminTickets } from '@/features/admin/hooks/useAdminTicketRealtime';

interface AuthContextValue {
  token: string | null;
  user: User | null;
  author: AuthorProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User, author?: AuthorProfile | null) => void;
  logout: () => void;
}

export const AuthContext = React.createContext<AuthContextValue | null>(null);

/**
 * Trade-off documentation (PROJECT_CONTEXT §6):
 * Storing the token in sessionStorage allows authentication to survive page refreshes within
 * the current browsing session, while automatically clearing credentials when the browser tab closes.
 * Note on XSS exposure: sessionStorage is accessible to client JavaScript running on the same origin.
 * We mitigate this via strict React output sanitization, strict CSP headers from the server,
 * and scoped access tokens with short lifetimes.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(() =>
    sessionStorage.getItem(AUTH_TOKEN_KEY),
  );
  const [user, setUser] = React.useState<User | null>(null);
  const [author, setAuthor] = React.useState<AuthorProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  const logout = React.useCallback(() => {
    // 1. Wipe all TanStack Query cache completely to prevent cross-user data leakage
    queryClient.clear();

    // 2. Clear realtime unread memory stores
    clearUnreadTickets();
    clearUnreadAdminTickets();

    // 3. Clear auth token and any draft composers from sessionStorage
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('bookleaf_draft_') || key.startsWith('bookleaf_note_'))) {
        sessionStorage.removeItem(key);
      }
    }

    // 4. Reset React state
    setToken(null);
    setUser(null);
    setAuthor(null);
  }, []);

  const setAuth = React.useCallback(
    (newToken: string, newUser: User, newAuthor: AuthorProfile | null = null) => {
      // Clear any previous session queries
      queryClient.clear();
      clearUnreadTickets();
      clearUnreadAdminTickets();

      sessionStorage.setItem(AUTH_TOKEN_KEY, newToken);
      setToken(newToken);
      setUser(newUser);
      setAuthor(newAuthor);
    },
    [],
  );

  React.useEffect(() => {
    setOnUnauthorizedCallback(logout);
    return () => setOnUnauthorizedCallback(null);
  }, [logout]);

  React.useEffect(() => {
    const existingToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (!existingToken) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function hydrate() {
      try {
        const { user: meUser, author: meAuthor } = await authApi.getMe();
        if (isMounted) {
          setUser(meUser);
          setAuthor(meAuthor);
          setToken(existingToken);
        }
      } catch {
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    hydrate();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  const value = React.useMemo(
    () => ({
      token,
      user,
      author,
      isLoading,
      isAuthenticated: !!token && !!user,
      setAuth,
      logout,
    }),
    [token, user, author, isLoading, setAuth, logout],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground space-y-4">
        <div className="relative flex h-10 w-10">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-10 w-10 bg-primary/20 border-2 border-primary" />
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading BookLeaf Portal...
        </p>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
