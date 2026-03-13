import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi } from '../services/api';
import type { UserPublic, Role } from '../types';

interface ImpersonationData {
  userId: string;
  username: string;
  displayName: string;
  role: Role;
}

interface AuthContextType {
  user: UserPublic | null;
  realUser: UserPublic | null; // The actual logged-in admin
  isLoading: boolean;
  isAuthenticated: boolean;
  authEnabled: boolean;
  impersonation: ImpersonationData | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  stopImpersonating: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [realUser, setRealUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [impersonation, setImpersonation] = useState<ImpersonationData | null>(null);

  // Load impersonation from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('impersonating');
    if (stored) {
      try {
        setImpersonation(JSON.parse(stored));
      } catch {
        sessionStorage.removeItem('impersonating');
      }
    }
  }, []);

  // Check auth status and get current user on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check if auth is enabled
        const status = await authApi.status();
        setAuthEnabled(status.auth_enabled);

        if (status.auth_enabled) {
          // Try to get current user from session
          try {
            const currentUser = await authApi.me();
            setRealUser(currentUser);
          } catch {
            // Not logged in or session expired
            setRealUser(null);
            // Clear impersonation if not logged in
            sessionStorage.removeItem('impersonating');
            setImpersonation(null);
          }
        } else {
          // Auth disabled - create mock admin user for backward compatibility
          setRealUser({
            id: 'system',
            username: 'system',
            display_name: 'System',
            role: 'admin',
            must_change_password: false,
          });
        }
      } catch (error) {
        console.error('Failed to check auth status:', error);
        // Assume auth is disabled if we can't reach the endpoint
        setAuthEnabled(false);
        setRealUser({
          id: 'system',
          username: 'system',
          display_name: 'System',
          role: 'admin',
          must_change_password: false,
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    setRealUser(response.user);
    // Clear any impersonation on login
    sessionStorage.removeItem('impersonating');
    setImpersonation(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setRealUser(null);
      sessionStorage.removeItem('impersonating');
      setImpersonation(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!authEnabled) return;
    try {
      const currentUser = await authApi.me();
      setRealUser(currentUser);
    } catch {
      setRealUser(null);
    }
  }, [authEnabled]);

  const stopImpersonating = useCallback(() => {
    sessionStorage.removeItem('impersonating');
    setImpersonation(null);
  }, []);

  // Compute effective user (impersonated or real)
  const user: UserPublic | null = impersonation
    ? {
        id: impersonation.userId,
        username: impersonation.username,
        display_name: impersonation.displayName,
        role: impersonation.role,
        must_change_password: false,
      }
    : realUser;

  const value: AuthContextType = {
    user,
    realUser,
    isLoading,
    isAuthenticated: realUser !== null,
    authEnabled,
    impersonation,
    login,
    logout,
    refreshUser,
    stopImpersonating,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to access auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook to get current user (throws if not authenticated)
export function useCurrentUser(): UserPublic {
  const { user, authEnabled } = useAuth();
  if (!user && authEnabled) {
    throw new Error('User is not authenticated');
  }
  // Return mock user if auth is disabled
  return user ?? {
    id: 'system',
    username: 'system',
    display_name: 'System',
    role: 'admin',
    must_change_password: false,
  };
}

// Hook to check if current user has a specific role or higher
export function useHasAuthRole(requiredRole: Role): boolean {
  const { user, authEnabled } = useAuth();

  // If auth is disabled, allow everything
  if (!authEnabled) return true;

  // If not logged in, deny
  if (!user) return false;

  // Role hierarchy: admin > gm > player
  const hierarchy: Record<Role, number> = { admin: 3, gm: 2, player: 1 };
  return hierarchy[user.role] >= hierarchy[requiredRole];
}

// Hook to check if user is admin
export function useIsAdmin(): boolean {
  const { user, authEnabled } = useAuth();
  if (!authEnabled) return true;
  return user?.role === 'admin';
}
