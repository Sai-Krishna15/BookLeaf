import * as React from 'react';
import { AuthContext } from '@/app/providers/AuthProvider';

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    return {
      token: null,
      user: null,
      author: null,
      isAuthenticated: false,
      isLoading: false,
      setAuth: () => {},
      logout: () => {},
    };
  }
  return context;
}
