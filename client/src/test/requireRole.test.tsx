import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '@/app/providers/AuthProvider';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequireRole } from '@/features/auth/RequireRole';
import type { User } from '@/features/auth/types';

describe('Route Guards: RequireAuth and RequireRole', () => {
  const authorUser: User = {
    id: 'user-1',
    name: 'Author User',
    email: 'author@example.com',
    role: 'AUTHOR',
    authorId: 'AUTH001',
  };

  const adminUser: User = {
    id: 'user-2',
    name: 'Admin User',
    email: 'admin@bookleaf.com',
    role: 'ADMIN',
    authorId: null,
  };

  const renderWithAuth = (
    user: User | null,
    token: string | null,
    initialEntries: string[],
  ) => {
    return render(
      <AuthContext.Provider
        value={{
          token,
          user,
          author: null,
          isLoading: false,
          isAuthenticated: !!token && !!user,
          setAuth: () => {},
          logout: () => {},
        }}
      >
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/login" element={<div>Login Page Screen</div>} />
            <Route path="/books" element={<div>Author Books Landing</div>} />
            <Route path="/admin/tickets" element={<div>Admin Tickets Landing</div>} />

            {/* Protected Author Routes */}
            <Route element={<RequireAuth />}>
              <Route element={<RequireRole role="AUTHOR" />}>
                <Route path="/tickets/new" element={<div>Author Protected Query Form</div>} />
              </Route>
            </Route>

            {/* Protected Admin Routes */}
            <Route element={<RequireAuth />}>
              <Route element={<RequireRole role="ADMIN" />}>
                <Route path="/admin/secret" element={<div>Admin Protected Settings</div>} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
  };

  it('redirects unauthenticated users to /login', () => {
    renderWithAuth(null, null, ['/tickets/new']);
    expect(screen.getByText('Login Page Screen')).toBeInTheDocument();
  });

  it('blocks AUTHOR users from accessing ADMIN routes and redirects to /books', () => {
    renderWithAuth(authorUser, 'token-123', ['/admin/secret']);
    expect(screen.getByText('Author Books Landing')).toBeInTheDocument();
    expect(screen.queryByText('Admin Protected Settings')).not.toBeInTheDocument();
  });

  it('blocks ADMIN users from accessing AUTHOR routes and redirects to /admin/tickets', () => {
    renderWithAuth(adminUser, 'token-456', ['/tickets/new']);
    expect(screen.getByText('Admin Tickets Landing')).toBeInTheDocument();
    expect(screen.queryByText('Author Protected Query Form')).not.toBeInTheDocument();
  });

  it('allows AUTHOR users to access AUTHOR routes', () => {
    renderWithAuth(authorUser, 'token-123', ['/tickets/new']);
    expect(screen.getByText('Author Protected Query Form')).toBeInTheDocument();
  });

  it('allows ADMIN users to access ADMIN routes', () => {
    renderWithAuth(adminUser, 'token-456', ['/admin/secret']);
    expect(screen.getByText('Admin Protected Settings')).toBeInTheDocument();
  });
});
