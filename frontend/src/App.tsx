import { Routes, Route, Navigate } from 'react-router-dom';
import { PlayerLayout } from './components/layout/PlayerLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PanelView } from './pages/PanelView';
import { PanelIndex } from './pages/PanelIndex';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminPanels } from './pages/admin/AdminPanels';
import { AdminScenarios } from './pages/admin/AdminScenarios';
import { AdminSystems } from './pages/admin/AdminSystems';
import { AdminAssets } from './pages/admin/AdminAssets';
import { AdminCargo } from './pages/admin/AdminCargo';
import { AdminContacts } from './pages/admin/AdminContacts';
import { AdminHolomap } from './pages/admin/AdminHolomap';
import { AdminRadar } from './pages/admin/AdminRadar';
import { AdminTransmissions } from './pages/admin/AdminTransmissions';
import { RoleProvider } from './contexts/RoleContext';

function App() {
  return (
    <RoleProvider>
      <Routes>
        {/* Player routes */}
        <Route element={<PlayerLayout />}>
          <Route path="/" element={<Navigate to="/panels" replace />} />
          <Route path="/panels" element={<PanelIndex />} />
          <Route path="/panel/:panelId" element={<PanelView />} />
        </Route>

        {/* Admin routes (GM only) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="gm" redirectTo="/panels">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="panels" element={<AdminPanels />} />
          <Route path="panels/:panelId" element={<PanelView isEditing />} />
          <Route path="systems" element={<AdminSystems />} />
          <Route path="assets" element={<AdminAssets />} />
          <Route path="cargo" element={<AdminCargo />} />
          <Route path="contacts" element={<AdminContacts />} />
          <Route path="scenarios" element={<AdminScenarios />} />
          <Route path="transmissions" element={<AdminTransmissions />} />
          <Route path="holomap" element={<AdminHolomap />} />
          <Route path="radar" element={<AdminRadar />} />
        </Route>
      </Routes>
    </RoleProvider>
  );
}

export default App;
