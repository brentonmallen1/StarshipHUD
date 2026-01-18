import { Routes, Route, Navigate } from 'react-router-dom';
import { PlayerLayout } from './components/layout/PlayerLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RequireShip } from './components/RequireShip';
import { PanelView } from './pages/PanelView';
import { PanelIndex } from './pages/PanelIndex';
import { ShipSelector } from './pages/ShipSelector';
import { GMDashboard } from './pages/admin/GMDashboard';
import { AdminPanels } from './pages/admin/AdminPanels';
import { AdminScenarios } from './pages/admin/AdminScenarios';
import { AdminSystems } from './pages/admin/AdminSystems';
import { AdminAssets } from './pages/admin/AdminAssets';
import { AdminCargo } from './pages/admin/AdminCargo';
import { AdminContacts } from './pages/admin/AdminContacts';
import { AdminCrew } from './pages/admin/AdminCrew';
import { AdminHolomap } from './pages/admin/AdminHolomap';
import { AdminRadar } from './pages/admin/AdminRadar';
import { AdminTransmissions } from './pages/admin/AdminTransmissions';
import { AdminAlertsAndTasks } from './pages/admin/AdminAlertsAndTasks';
import { AdminShips } from './pages/admin/AdminShips';
import { RoleProvider } from './contexts/RoleContext';
import { ShipProvider } from './contexts/ShipContext';

function App() {
  return (
    <RoleProvider>
      <ShipProvider>
        <Routes>
          {/* Ship selection - accessible without ship context */}
          <Route path="/ships" element={<ShipSelector />} />

          {/* Player routes - require ship */}
          <Route
            element={
              <RequireShip>
                <PlayerLayout />
              </RequireShip>
            }
          >
            <Route path="/" element={<Navigate to="/panels" replace />} />
            <Route path="/panels" element={<PanelIndex />} />
            <Route path="/panel/:panelId" element={<PanelView />} />
          </Route>

          {/* Admin routes (GM only) - require ship */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="gm" redirectTo="/ships">
                <RequireShip>
                  <AdminLayout />
                </RequireShip>
              </ProtectedRoute>
            }
          >
            <Route index element={<GMDashboard />} />
            <Route path="panels" element={<AdminPanels />} />
            <Route path="panels/:panelId" element={<PanelView isEditing />} />
            <Route path="systems" element={<AdminSystems />} />
            <Route path="assets" element={<AdminAssets />} />
            <Route path="cargo" element={<AdminCargo />} />
            <Route path="contacts" element={<AdminContacts />} />
            <Route path="crew" element={<AdminCrew />} />
            <Route path="scenarios" element={<AdminScenarios />} />
            <Route path="transmissions" element={<AdminTransmissions />} />
            <Route path="alerts" element={<AdminAlertsAndTasks />} />
            <Route path="holomap" element={<AdminHolomap />} />
            <Route path="radar" element={<AdminRadar />} />
            <Route path="ships" element={<AdminShips />} />
          </Route>
        </Routes>
      </ShipProvider>
    </RoleProvider>
  );
}

export default App;
