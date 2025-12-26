import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentRole, setRole, type Role } from '../utils/role';
import './RoleSwitcher.css';

/**
 * Developer tool for switching between player and GM roles.
 * Only shown in development or when explicitly enabled.
 */
export function RoleSwitcher() {
  const [currentRole, setCurrentRole] = useState<Role>(getCurrentRole());
  const navigate = useNavigate();
  const location = useLocation();

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setCurrentRole(newRole);
    // Reload to apply role changes
    window.location.reload();
  };

  const handleAdminClick = () => {
    navigate('/admin');
  };

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  const isOnAdminPage = location.pathname.startsWith('/admin');

  return (
    <div className="role-switcher">
      <span className="role-switcher-label">Dev: Role</span>
      <button
        className={`role-switcher-btn ${currentRole === 'player' ? 'active' : ''}`}
        onClick={() => handleRoleChange('player')}
      >
        Player
      </button>
      <button
        className={`role-switcher-btn ${currentRole === 'gm' ? 'active' : ''}`}
        onClick={() => handleRoleChange('gm')}
      >
        GM
      </button>
      {currentRole === 'gm' && !isOnAdminPage && (
        <>
          <div className="role-switcher-divider" />
          <button
            className="role-switcher-admin-btn"
            onClick={handleAdminClick}
            title="Go to Admin Panel"
          >
            ⚡ Admin
          </button>
        </>
      )}
    </div>
  );
}
