import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { authApi } from '@/features/auth/auth.api';
import { ApiError } from '@/lib/api';

describe('LoginPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  const renderLogin = (initialEntries = ['/login']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/books" element={<div>Author Books Portal</div>} />
            <Route path="/admin/tickets" element={<div>Admin Tickets Queue</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
  };

  it('renders form fields, labels, and sign-in button', () => {
    renderLogin();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('displays inline validation errors when submitting empty form', async () => {
    const user = userEvent.setup();
    renderLogin();

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('displays validation error on malformed email address', async () => {
    const user = userEvent.setup();
    renderLogin();

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'not-an-email');

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('displays API error alert when login fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, 'login').mockRejectedValueOnce(
      new ApiError('Invalid email or password', 'UNAUTHORIZED', 401),
    );

    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'priya@example.com');
    await user.type(screen.getByLabelText(/password/i), 'WrongPass@123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password');
    });
  });

  it('redirects an AUTHOR user to /books on successful login', async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, 'login').mockResolvedValueOnce({
      token: 'valid-author-token',
      user: {
        id: 'user-author-1',
        name: 'Priya Sharma',
        email: 'priya.sharma@example.com',
        role: 'AUTHOR',
        authorId: 'AUTH001',
      },
    });

    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'priya.sharma@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Test@1234');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Author Books Portal')).toBeInTheDocument();
    });
    expect(sessionStorage.getItem('bookleaf_token')).toBe('valid-author-token');
  });

  it('redirects an ADMIN user to /admin/tickets on successful login', async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, 'login').mockResolvedValueOnce({
      token: 'valid-admin-token',
      user: {
        id: 'user-admin-1',
        name: 'Admin User',
        email: 'admin@bookleaf.com',
        role: 'ADMIN',
        authorId: null,
      },
    });

    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'admin@bookleaf.com');
    await user.type(screen.getByLabelText(/password/i), 'Admin@1234');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Admin Tickets Queue')).toBeInTheDocument();
    });
    expect(sessionStorage.getItem('bookleaf_token')).toBe('valid-admin-token');
  });
});
