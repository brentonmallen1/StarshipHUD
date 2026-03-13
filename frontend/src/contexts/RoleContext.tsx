import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Role } from '../types';

// Re-export Role type for backward compatibility
export type { Role };

const ROLE_STORAGE_KEY = 'starship-hud-role';

// Role hierarchy for access checks
const ROLE_HIERARCHY: Record<Role, number> = { admin: 3, gm: 2, player: 1 };

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  effectiveRole: Role; // The actual role (from auth or override)
}

// Create context with default values
export const RoleContext = createContext<RoleContextType>({
  role: 'player',
  setRole: () => {},
  effectiveRole: 'player',
});

// Provider component
export function RoleProvider({ children }: { children: ReactNode }) {
  const { user, authEnabled, isLoading } = useAuth();

  // Local role override (used when auth is disabled or for dev testing)
  const [localRole, setLocalRole] = useState<Role>(() => {
    const params = new URLSearchParams(window.location.search);
    const queryRole = params.get('role');
    if (queryRole === 'admin' || queryRole === 'gm' || queryRole === 'player') {
      localStorage.setItem(ROLE_STORAGE_KEY, queryRole);
      return queryRole;
    }
    const stored = localStorage.getItem(ROLE_STORAGE_KEY);
    if (stored === 'admin' || stored === 'gm' || stored === 'player') {
      return stored;
    }
    return 'player';
  });

  // Persist local role changes to localStorage
  useEffect(() => {
    localStorage.setItem(ROLE_STORAGE_KEY, localRole);
  }, [localRole]);

  // Calculate effective role
  const effectiveRole = useMemo((): Role => {
    if (isLoading) return 'player';

    // If auth is enabled, use the user's role from the server
    if (authEnabled && user) {
      return user.role;
    }

    // If auth is disabled, use the local role (for backward compatibility / dev mode)
    return localRole;
  }, [authEnabled, user, localRole, isLoading]);

  // Role setter - only works when auth is disabled
  const setRole = (newRole: Role) => {
    if (!authEnabled) {
      setLocalRole(newRole);
    }
  };

  // For backward compatibility, expose 'role' as gm if admin (since old code checks for 'gm')
  const compatRole: Role = effectiveRole === 'admin' ? 'gm' : effectiveRole;

  return (
    <RoleContext.Provider value={{ role: compatRole, setRole, effectiveRole }}>
      {children}
    </RoleContext.Provider>
  );
}

// Hook to access role context
export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}

// Check if current role has access to required role
// Admin > GM > Player (admin has access to everything, GM has access to GM and player)
export function useHasRole(requiredRole: Role): boolean {
  const { effectiveRole } = useRole();
  return ROLE_HIERARCHY[effectiveRole] >= ROLE_HIERARCHY[requiredRole];
}

// Helper to check if current role is GM or higher
export function useIsGM(): boolean {
  const { effectiveRole } = useRole();
  return ROLE_HIERARCHY[effectiveRole] >= ROLE_HIERARCHY['gm'];
}

// Helper to check if current role is Player (not GM or admin)
export function useIsPlayer(): boolean {
  const { effectiveRole } = useRole();
  return effectiveRole === 'player';
}

// Helper to check if current role is Admin
export function useIsAdmin(): boolean {
  const { effectiveRole } = useRole();
  return effectiveRole === 'admin';
}
