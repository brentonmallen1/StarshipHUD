import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Role = 'player' | 'gm';

const ROLE_STORAGE_KEY = 'starship-hud-role';

function resolveRole(value: string | null): Role {
  return value === 'gm' || value === 'player' ? value : 'player';
}

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
}

// Create context with default values
export const RoleContext = createContext<RoleContextType>({
  role: 'player',
  setRole: () => {},
});

// Provider component
export function RoleProvider({ children }: { children: ReactNode }) {
  // Initialize role: URL query param > localStorage > default 'player'
  const [role, setRoleState] = useState<Role>(() => {
    const params = new URLSearchParams(window.location.search);
    const queryRole = params.get('role');
    if (queryRole === 'gm' || queryRole === 'player') {
      localStorage.setItem(ROLE_STORAGE_KEY, queryRole);
      return queryRole;
    }
    return resolveRole(localStorage.getItem(ROLE_STORAGE_KEY));
  });

  // Persist role changes to localStorage
  useEffect(() => {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  }, [role]);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
  };

  return (
    <RoleContext.Provider value={{ role, setRole }}>
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

// Check if current role has access to required role (GM has access to everything)
export function useHasRole(requiredRole: Role): boolean {
  const { role } = useRole();
  if (role === 'gm') return true;
  return requiredRole === 'player';
}

// Helper to check if current role is GM
export function useIsGM() {
  const { role } = useRole();
  return role === 'gm';
}

// Helper to check if current role is Player
export function useIsPlayer() {
  const { role } = useRole();
  return role === 'player';
}
