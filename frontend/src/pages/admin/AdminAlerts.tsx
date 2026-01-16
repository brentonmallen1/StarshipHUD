import { useState, useMemo } from 'react';
import { useEvents } from '../../hooks/useShipData';
import { useCreateAlert, useAcknowledgeAlert, useClearAlert } from '../../hooks/useMutations';
import { AlertFormModal } from '../../components/admin/AlertFormModal';
import type { EventSeverity } from '../../types';
import './Admin.css';

const DEFAULT_SHIP_ID = 'constellation';

interface AlertData {
  category?: string;
  location?: string;
  acknowledged?: boolean;
  acknowledged_at?: string;
  ship_wide?: boolean;
}

export function AdminAlerts() {
  const { data: events, isLoading } = useEvents(DEFAULT_SHIP_ID, 100);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const createAlert = useCreateAlert();
  const acknowledgeAlert = useAcknowledgeAlert();
  const clearAlert = useClearAlert();

  // Filter events to only show alerts
  const alerts = useMemo(() => {
    if (!events) return [];
    return events.filter(e => e.type === 'alert');
  }, [events]);

  // Apply filter
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const data = alert.data as AlertData;
      if (filter === 'active') return !data.acknowledged;
      if (filter === 'acknowledged') return data.acknowledged;
      return true;
    });
  }, [alerts, filter]);

  const handleCreateAlert = (formData: {
    ship_id: string;
    type: string;
    severity: EventSeverity;
    message: string;
    data: { category?: string; location?: string; acknowledged: boolean; ship_wide?: boolean };
  }) => {
    createAlert.mutate(
      {
        ship_id: formData.ship_id,
        severity: formData.severity,
        message: formData.message,
        data: formData.data,
      },
      { onSuccess: () => setIsFormModalOpen(false) }
    );
  };

  const handleAcknowledge = (id: string) => {
    acknowledgeAlert.mutate(id);
  };

  const handleDelete = (id: string) => {
    clearAlert.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const activeCount = alerts.filter(a => !(a.data as AlertData).acknowledged).length;
  const acknowledgedCount = alerts.filter(a => (a.data as AlertData).acknowledged).length;

  return (
    <div className="admin-page">
      <div className="admin-header-row">
        <h2 className="admin-page-title">Alerts</h2>
        <button className="btn btn-primary" onClick={() => setIsFormModalOpen(true)}>
          + New Alert
        </button>
      </div>

      <div className="admin-filter-bar">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({alerts.length})
        </button>
        <button
          className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active ({activeCount})
        </button>
        <button
          className={`filter-tab ${filter === 'acknowledged' ? 'active' : ''}`}
          onClick={() => setFilter('acknowledged')}
        >
          Acknowledged ({acknowledgedCount})
        </button>
      </div>

      {isLoading ? (
        <div className="admin-loading">Loading alerts...</div>
      ) : filteredAlerts.length === 0 ? (
        <div className="admin-empty">
          <p>No alerts found</p>
          <button className="btn" onClick={() => setIsFormModalOpen(true)}>
            Create First Alert
          </button>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Message</th>
                <th>Category</th>
                <th>Location</th>
                <th>Ship-wide</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map(alert => {
                const data = alert.data as AlertData;
                const isAcknowledged = data.acknowledged ?? false;

                return (
                  <tr key={alert.id} className={isAcknowledged ? 'row-muted' : ''}>
                    <td>
                      <span className={`severity-badge severity-${alert.severity}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="message-cell">{alert.message}</td>
                    <td>{data.category || '-'}</td>
                    <td>{data.location || '-'}</td>
                    <td>
                      {data.ship_wide ? (
                        <span className="badge badge-accent">Yes</span>
                      ) : (
                        <span className="badge badge-muted">No</span>
                      )}
                    </td>
                    <td>
                      {isAcknowledged ? (
                        <span className="badge badge-muted">Acknowledged</span>
                      ) : (
                        <span className="badge badge-warning">Active</span>
                      )}
                    </td>
                    <td className="time-cell">{formatTime(alert.created_at)}</td>
                    <td>
                      <div className="action-buttons">
                        {!isAcknowledged && (
                          <button
                            className="btn btn-small"
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={acknowledgeAlert.isPending}
                          >
                            Ack
                          </button>
                        )}
                        {deleteConfirmId === alert.id ? (
                          <>
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => handleDelete(alert.id)}
                              disabled={clearAlert.isPending}
                            >
                              Confirm
                            </button>
                            <button
                              className="btn btn-small"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => setDeleteConfirmId(alert.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertFormModal
        isOpen={isFormModalOpen}
        shipId={DEFAULT_SHIP_ID}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleCreateAlert}
        isSubmitting={createAlert.isPending}
      />
    </div>
  );
}
