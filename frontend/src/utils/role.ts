// Role management utilities

export type Role = 'player' | 'gm';

const ROLE_STORAGE_KEY = 'starship-hud-role';

/**
 * Get the current user's role.
 * For MVP, this checks query params then localStorage.
 * In production, this would validate a JWT token.
 */
export function getCurrentRole(): Role {
  // Check URL query param first (for easy testing)
  const params = new URLSearchParams(window.location.search);
  const queryRole = params.get('role');
  if (queryRole === 'gm' || queryRole === 'player') {
    // Store it for future use
    localStorage.setItem(ROLE_STORAGE_KEY, queryRole);
    return queryRole;
  }

  // Check localStorage
  const storedRole = localStorage.getItem(ROLE_STORAGE_KEY);
  if (storedRole === 'gm' || storedRole === 'player') {
    return storedRole;
  }

  // Default to player
  return 'player';
}

/**
 * Set the current user's role.
 */
export function setRole(role: Role): void {
  localStorage.setItem(ROLE_STORAGE_KEY, role);

  // Update URL without triggering navigation
  const url = new URL(window.location.href);
  url.searchParams.set('role', role);
  window.history.replaceState({}, '', url.toString());
}

/**
 * Check if the current user has access to a given role.
 */
export function hasRole(requiredRole: Role): boolean {
  const currentRole = getCurrentRole();

  // GM has access to everything
  if (currentRole === 'gm') {
    return true;
  }

  // Players only have access to player content
  return requiredRole === 'player';
}

/**
 * Check if the current user is a GM.
 */
export function isGM(): boolean {
  return getCurrentRole() === 'gm';
}

/**
 * Check if the current user is a player.
 */
export function isPlayer(): boolean {
  return getCurrentRole() === 'player';
}
