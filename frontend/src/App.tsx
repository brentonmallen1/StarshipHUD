import { Routes, Route, Navigate } from 'react-router-dom';
import { ShipLayout } from './components/layout/ShipLayout';
import { PlayerLayout } from './components/layout/PlayerLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
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
import { AdminMedia } from './pages/admin/AdminMedia';
import { AdminSectorMap } from './pages/admin/AdminSectorMap';
import { AdminTimers } from './pages/admin/AdminTimers';
import { AdminSettings } from './pages/admin/AdminSettings';
import { RoleProvider } from './contexts/RoleContext';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary level="app">
      <RoleProvider>
        <Routes>
          {/* Ship selection - no ship context needed */}
          <Route path="/" element={<Navigate to="/ships" replace />} />
          <Route path="/ships" element={<ShipSelector />} />

          {/* Ship-scoped routes - ShipLayout provides ship context from URL */}
          <Route path="/:shipId" element={<ShipLayout />}>
            {/* Player routes */}
            <Route element={<PlayerLayout />}>
              <Route index element={<Navigate to="panels" replace />} />
              <Route path="panels" element={<PanelIndex />} />
              <Route path="panel/:panelSlug" element={<PanelView />} />
            </Route>

            {/* Admin routes (GM only) */}
            <Route
              path="admin"
              element={
                <ProtectedRoute requiredRole="gm" redirectTo="/ships">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<GMDashboard />} />
              <Route path="panels" element={<AdminPanels />} />
              <Route path="panel/:panelSlug" element={<PanelView isEditing />} />
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
              <Route path="media" element={<AdminMedia />} />
              <Route path="sector-map" element={<AdminSectorMap />} />
              <Route path="timers" element={<AdminTimers />} />
              <Route path="ships" element={<AdminShips />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>
        </Routes>
      </RoleProvider>
    </ErrorBoundary>
  );
}

export default App;
