import * as React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequireRole } from '@/features/auth/RequireRole';
import { AuthorLayout } from '@/app/layouts/AuthorLayout';
import { AdminLayout } from '@/app/layouts/AdminLayout';
import { RouteErrorBoundary } from '@/components/common/ErrorBoundary';
import { useAuth } from '@/features/auth/useAuth';

// Lazy-loaded route components
const LoginPage = React.lazy(() => import('@/features/auth/LoginPage'));
const BooksPage = React.lazy(() => import('@/features/books/BooksPage'));
const TicketsPage = React.lazy(() => import('@/features/tickets/TicketsPage'));
const NewTicketPage = React.lazy(() => import('@/features/tickets/NewTicketPage'));
const TicketDetailPage = React.lazy(() => import('@/features/tickets/TicketDetailPage'));
const AdminTicketsPage = React.lazy(() => import('@/features/admin/AdminTicketsPage'));
const AdminTicketDetailPage = React.lazy(() => import('@/features/admin/AdminTicketDetailPage'));
const NotFoundPage = React.lazy(() => import('@/components/common/NotFoundPage'));

function SuspenseFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={user.role === 'ADMIN' ? '/admin/tickets' : '/books'} replace />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <RootRedirect />,
      },
      {
        path: 'login',
        element: (
          <React.Suspense fallback={<SuspenseFallback />}>
            <LoginPage />
          </React.Suspense>
        ),
      },

      /* Author Portal */
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireRole role="AUTHOR" />,
            children: [
              {
                element: <AuthorLayout />,
                children: [
                  {
                    path: 'books',
                    element: (
                      <React.Suspense fallback={<SuspenseFallback />}>
                        <BooksPage />
                      </React.Suspense>
                    ),
                  },
                  {
                    path: 'tickets',
                    element: (
                      <React.Suspense fallback={<SuspenseFallback />}>
                        <TicketsPage />
                      </React.Suspense>
                    ),
                  },
                  {
                    path: 'tickets/new',
                    element: (
                      <React.Suspense fallback={<SuspenseFallback />}>
                        <NewTicketPage />
                      </React.Suspense>
                    ),
                  },
                  {
                    path: 'tickets/:id',
                    element: (
                      <React.Suspense fallback={<SuspenseFallback />}>
                        <TicketDetailPage />
                      </React.Suspense>
                    ),
                  },
                ],
              },
            ],
          },
        ],
      },

      /* Admin Portal */
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireRole role="ADMIN" />,
            children: [
              {
                element: <AdminLayout />,
                children: [
                  {
                    path: 'admin/tickets',
                    element: (
                      <React.Suspense fallback={<SuspenseFallback />}>
                        <AdminTicketsPage />
                      </React.Suspense>
                    ),
                  },
                  {
                    path: 'admin/tickets/:id',
                    element: (
                      <React.Suspense fallback={<SuspenseFallback />}>
                        <AdminTicketDetailPage />
                      </React.Suspense>
                    ),
                  },
                ],
              },
            ],
          },
        ],
      },

      /* 404 Catch-All */
      {
        path: '*',
        element: (
          <React.Suspense fallback={<SuspenseFallback />}>
            <NotFoundPage />
          </React.Suspense>
        ),
      },
    ],
  },
]);
