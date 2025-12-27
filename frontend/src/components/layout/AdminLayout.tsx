import { Outlet, NavLink } from 'react-router-dom';
import './Layout.css';

export function AdminLayout() {
  return (
    <div className="app-container admin-layout">
      <header className="admin-header">
        <h1 className="admin-title">Starship HUD - Admin</h1>
        <nav className="admin-nav">
          <NavLink to="/admin" end className="admin-nav-link">
            Dashboard
          </NavLink>
          <NavLink to="/admin/panels" className="admin-nav-link">
            Panels
          </NavLink>
          <NavLink to="/admin/systems" className="admin-nav-link">
            Systems
          </NavLink>
          <NavLink to="/admin/assets" className="admin-nav-link">
            Weapons/Assets
          </NavLink>
          <NavLink to="/admin/cargo" className="admin-nav-link">
            Cargo
          </NavLink>
          <NavLink to="/admin/contacts" className="admin-nav-link">
            Contacts
          </NavLink>
          <NavLink to="/admin/scenarios" className="admin-nav-link">
            Scenarios
          </NavLink>
          <NavLink to="/admin/holomap" className="admin-nav-link">
            Holomap
          </NavLink>
          <NavLink to="/" className="admin-nav-link player-link">
            Player View
          </NavLink>
        </nav>
      </header>
      <main className="main-content admin-content">
        <Outlet />
      </main>
    </div>
  );
}
