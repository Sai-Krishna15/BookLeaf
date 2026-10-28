import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { Role } from './types';

export function RequireRole({ role }: { role: Role }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    // Redirect to the user's role-specific home without flashing the other portal
    const target = user.role === 'ADMIN' ? '/admin/tickets' : '/books';
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
