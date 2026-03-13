import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useHasRole, type Role } from '../contexts/RoleContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Role;
  redirectTo?: string;
}

/**
 * Protects a route by requiring authentication and optionally a specific role.
 * - If auth is enabled and user is not authenticated, redirects to /login
 * - If requiredRole is specified and user doesn't have access, redirects to redirectTo
 */
export function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/'
}: ProtectedRouteProps) {
  const { isAuthenticated, authEnabled, isLoading } = useAuth();
  const location = useLocation();
  const hasRole = useHasRole(requiredRole ?? 'player');

  // Show nothing while loading auth state
  if (isLoading) {
    return null;
  }

  // If auth is enabled and user is not authenticated, redirect to login
  if (authEnabled && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // If a role is required and user doesn't have it, redirect
  if (requiredRole && !hasRole) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
