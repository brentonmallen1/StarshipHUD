import { Navigate } from 'react-router-dom';
import { hasRole, type Role } from '../utils/role';

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
  if (!hasRole(requiredRole)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
