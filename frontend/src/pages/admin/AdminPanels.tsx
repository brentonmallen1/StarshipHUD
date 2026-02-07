import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePanels } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { PanelCreationModal } from '../../components/PanelCreationModal';
import { PanelEditModal } from '../../components/PanelEditModal';
import { panelsApi } from '../../services/api';
import type { Panel, Role, StationGroup } from '../../types';
import './Admin.css';

export function AdminPanels() {
  const shipId = useCurrentShipId();
  const navigate = useNavigate();
  const { data: panels, isLoading, refetch } = usePanels();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPanel, setEditingPanel] = useState<Panel | null>(null);

  const handleCreatePanel = async (data: {
    name: string;
    station_group: StationGroup;
    description?: string;
    grid_columns: number;
    grid_rows: number;
    role_visibility: Role[];
  }) => {
    await panelsApi.create({ ...data, ship_id: shipId ?? '' });
    await refetch();
    setShowCreateModal(false);
  };

  const handleUpdatePanel = async (data: {
    name: string;
    station_group: StationGroup;
    description?: string;
    role_visibility: Role[];
  }) => {
    if (!editingPanel) return;
    await panelsApi.update(editingPanel.id, data);
    await refetch();
    setEditingPanel(null);
  };

  const handleDeletePanel = async (panel: Panel) => {
    if (window.confirm(`Delete panel "${panel.name}"? This cannot be undone and will delete all widgets on this panel.`)) {
      await panelsApi.delete(panel.id);
      await refetch();
    }
  };

  if (isLoading) {
    return <div className="loading">Loading panels...</div>;
  }

  return (
    <div className="admin-panels">
      <div className="admin-header-row">
        <h2 className="admin-page-title">Panels</h2>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + New Panel
        </button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Station</th>
            <th>Widgets</th>
            <th>Visibility</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {panels?.map((panel) => (
            <tr key={panel.id}>
              <td>
                <strong>{panel.name}</strong>
                {panel.description && (
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    {panel.description}
                  </div>
                )}
              </td>
              <td>
                <span className="badge">{panel.station_group}</span>
              </td>
              <td>-</td>
              <td>
                {panel.role_visibility.map((r) => (
                  <span key={r} className="badge badge-small">
                    {r}
                  </span>
                ))}
              </td>
              <td>
                <button
                  className="btn btn-small"
                  onClick={() => setEditingPanel(panel)}
                  title="Edit panel details"
                >
                  Edit Details
                </button>
                <button
                  className="btn btn-small"
                  onClick={() => navigate(`/admin/panels/${panel.id}`)}
                  title="Edit widgets"
                >
                  Edit Widgets
                </button>
                <button
                  className="btn btn-small"
                  onClick={() => navigate(`/panel/${panel.id}`)}
                  title="View panel"
                >
                  View
                </button>
                <button
                  className="btn btn-small btn-danger"
                  onClick={() => handleDeletePanel(panel)}
                  title="Delete panel"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showCreateModal && (
        <PanelCreationModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePanel}
        />
      )}

      {editingPanel && (
        <PanelEditModal
          panel={editingPanel}
          onClose={() => setEditingPanel(null)}
          onUpdate={handleUpdatePanel}
        />
      )}
    </div>
  );
}
