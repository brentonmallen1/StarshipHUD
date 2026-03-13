import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * Wrapper that requires authentication when auth is enabled.
 * Redirects to /login if not authenticated, saving the current path.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, authEnabled, isLoading } = useAuth();
  const location = useLocation();

  // Show nothing while loading auth state
  if (isLoading) {
    return null;
  }

  // If auth is enabled and user is not authenticated, redirect to login
  if (authEnabled && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
