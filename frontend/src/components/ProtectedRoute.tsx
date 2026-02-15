import { Navigate } from 'react-router-dom';
import { useHasRole, type Role } from '../contexts/RoleContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole: Role;
  redirectTo?: string;
}

/**
 * Protects a route by requiring a specific role.
 * Redirects to a fallback route if the user doesn't have access.
 */
export function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/'
}: ProtectedRouteProps) {
  if (!useHasRole(requiredRole)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
