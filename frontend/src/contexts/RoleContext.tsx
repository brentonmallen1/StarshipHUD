import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Role = 'player' | 'gm';

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
  // Initialize role from localStorage, default to 'player'
  const [role, setRoleState] = useState<Role>(() => {
    const stored = localStorage.getItem('starship-hud-role');
    return stored === 'gm' || stored === 'player' ? stored : 'player';
  });

  // Persist role changes to localStorage
  useEffect(() => {
    localStorage.setItem('starship-hud-role', role);
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
