import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ShipLayout } from './components/layout/ShipLayout';
import { PlayerLayout } from './components/layout/PlayerLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RequireAuth } from './components/RequireAuth';
import { PanelView } from './pages/PanelView';
import { PanelIndex } from './pages/PanelIndex';
import { ShipSelector } from './pages/ShipSelector';
import { Login } from './pages/Login';
import { AuthProvider } from './contexts/AuthContext';
import { RoleProvider } from './contexts/RoleContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConsoleOffline } from './components/ui/ConsoleOffline';
import { D20Loader } from './components/ui/D20Loader';

// GM authoring screens load on demand so they stay out of the player bundle
const AdminLayout = lazy(() => import('./components/layout/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const GMDashboard = lazy(() => import('./pages/admin/GMDashboard').then((m) => ({ default: m.GMDashboard })));
const AdminPanels = lazy(() => import('./pages/admin/AdminPanels').then((m) => ({ default: m.AdminPanels })));
const AdminScenarios = lazy(() => import('./pages/admin/AdminScenarios').then((m) => ({ default: m.AdminScenarios })));
const AdminSystems = lazy(() => import('./pages/admin/AdminSystems').then((m) => ({ default: m.AdminSystems })));
const AdminAssets = lazy(() => import('./pages/admin/AdminAssets').then((m) => ({ default: m.AdminAssets })));
const AdminCargo = lazy(() => import('./pages/admin/AdminCargo').then((m) => ({ default: m.AdminCargo })));
const AdminContacts = lazy(() => import('./pages/admin/AdminContacts').then((m) => ({ default: m.AdminContacts })));
const AdminCrew = lazy(() => import('./pages/admin/AdminCrew').then((m) => ({ default: m.AdminCrew })));
const AdminHolomap = lazy(() => import('./pages/admin/AdminHolomap').then((m) => ({ default: m.AdminHolomap })));
const AdminRadar = lazy(() => import('./pages/admin/AdminRadar').then((m) => ({ default: m.AdminRadar })));
const AdminTransmissions = lazy(() => import('./pages/admin/AdminTransmissions').then((m) => ({ default: m.AdminTransmissions })));
const AdminAlertsAndTasks = lazy(() => import('./pages/admin/AdminAlertsAndTasks').then((m) => ({ default: m.AdminAlertsAndTasks })));
const AdminShips = lazy(() => import('./pages/admin/AdminShips').then((m) => ({ default: m.AdminShips })));
const AdminMedia = lazy(() => import('./pages/admin/AdminMedia').then((m) => ({ default: m.AdminMedia })));
const AdminSectorMap = lazy(() => import('./pages/admin/AdminSectorMap').then((m) => ({ default: m.AdminSectorMap })));
const AdminTimers = lazy(() => import('./pages/admin/AdminTimers').then((m) => ({ default: m.AdminTimers })));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings').then((m) => ({ default: m.AdminSettings })));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })));

function App() {
  return (
    <ErrorBoundary level="app">
      <AuthProvider>
        <RoleProvider>
          <Suspense
            fallback={
              <div className="loading-screen">
                <D20Loader size={80} speed={3.4} />
              </div>
            }
          >
          <Routes>
            {/* Login page */}
            <Route path="/login" element={<Login />} />

            {/* Ship selection - requires auth when enabled */}
            <Route path="/" element={<Navigate to="/ships" replace />} />
            <Route path="/ships" element={<RequireAuth><ShipSelector /></RequireAuth>} />

          {/* Ship-scoped routes - ShipLayout provides ship context from URL */}
          <Route path="/:shipId" element={<RequireAuth><ShipLayout /></RequireAuth>}>
            {/* Player routes */}
            <Route element={<PlayerLayout />}>
              <Route index element={<Navigate to="panels" replace />} />
              <Route path="panels" element={<PanelIndex />} />
              <Route path="panel/:panelSlug" element={<PanelView />} />
              <Route path="*" element={<ConsoleOffline />} />
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
              <Route path="users" element={<AdminUsers />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/ships" replace />} />
        </Routes>
          </Suspense>
        </RoleProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
