import { useNavigate, useLocation } from 'react-router-dom';
import { useRole, type Role } from '../contexts/RoleContext';
import './RoleSwitcher.css';

/**
 * Toggle for switching between player and GM roles.
 * Shown in development, or in production when VITE_SHOW_ROLE_SWITCHER is enabled.
 */
export function RoleSwitcher() {
  const { role, setRole } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  const handleRoleChange = (newRole: Role) => {
    // Check if we're on a panel page BEFORE changing anything
    const playerPanelMatch = location.pathname.match(/^\/panel\/([^/]+)$/);
    const adminPanelMatch = location.pathname.match(/^\/admin\/panels\/([^/]+)$/);

    // Update role in context (persists to localStorage via effect)
    setRole(newRole);

    if (newRole === 'gm' && playerPanelMatch) {
      // Switching to GM while on player panel view → go to admin panel edit
      const panelId = playerPanelMatch[1];
      window.location.href = `/admin/panels/${panelId}?role=${newRole}`;
      return;
    }

    if (newRole === 'player' && adminPanelMatch) {
      // Switching to Player while on admin panel edit → go to player panel view
      const panelId = adminPanelMatch[1];
      window.location.href = `/panel/${panelId}?role=${newRole}`;
      return;
    }

    // Default: reload to apply role changes cleanly
    window.location.reload();
  };

  const handleAdminClick = () => {
    navigate('/admin');
  };

  // Show in development, or in production if VITE_SHOW_ROLE_SWITCHER is enabled
  const showInProd = import.meta.env.VITE_SHOW_ROLE_SWITCHER === 'true';
  if (import.meta.env.PROD && !showInProd) {
    return null;
  }

  const isOnAdminPage = location.pathname.startsWith('/admin');

  return (
    <div className="role-switcher">
      <span className="role-switcher-label">Role</span>
      <button
        className={`role-switcher-btn ${role === 'player' ? 'active' : ''}`}
        onClick={() => handleRoleChange('player')}
      >
        Player
      </button>
      <button
        className={`role-switcher-btn ${role === 'gm' ? 'active' : ''}`}
        onClick={() => handleRoleChange('gm')}
      >
        GM
      </button>
      {role === 'gm' && !isOnAdminPage && (
        <>
          <div className="role-switcher-divider" />
          <button
            className="role-switcher-admin-btn"
            onClick={handleAdminClick}
            title="Go to Admin Panel"
          >
            Admin
          </button>
        </>
      )}
    </div>
  );
}
