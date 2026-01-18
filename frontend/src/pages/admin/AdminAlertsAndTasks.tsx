import { useState, useMemo } from 'react';
import { useEvents, useTasks } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useCreateAlert, useAcknowledgeAlert, useClearAlert, useCreateTask, useDeleteTask, useCompleteTask } from '../../hooks/useMutations';
import { AlertFormModal } from '../../components/admin/AlertFormModal';
import { TaskFormModal } from '../../components/admin/TaskFormModal';
import type { EventSeverity, StationGroup } from '../../types';
import './Admin.css';

interface AlertData {
  category?: string;
  location?: string;
  acknowledged?: boolean;
  acknowledged_at?: string;
  ship_wide?: boolean;
}

type AlertFilter = 'all' | 'active' | 'acknowledged';
type TaskFilter = 'all' | 'active' | 'completed';

const STATUS_DISPLAY: Record<string, string> = {
  pending: 'Open',
  active: 'Active',
  succeeded: 'Succeeded',
  failed: 'Failed',
  expired: 'Expired',
};

const STATION_DISPLAY: Record<string, string> = {
  command: 'Command',
  engineering: 'Engineering',
  sensors: 'Sensors',
  tactical: 'Tactical',
  life_support: 'Life Support',
  communications: 'Communications',
  operations: 'Operations',
};

export function AdminAlertsAndTasks() {
  const shipId = useCurrentShipId();

  // Alert state
  const { data: events, isLoading: alertsLoading } = useEvents(shipId ?? undefined, 100);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');
  const [alertDeleteConfirmId, setAlertDeleteConfirmId] = useState<string | null>(null);

  const createAlert = useCreateAlert();
  const acknowledgeAlert = useAcknowledgeAlert();
  const clearAlert = useClearAlert();

  // Task state
  const { data: tasks, isLoading: tasksLoading } = useTasks(shipId ?? undefined);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [taskDeleteConfirmId, setTaskDeleteConfirmId] = useState<string | null>(null);

  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const completeTask = useCompleteTask();

  // Alert memos
  const alerts = useMemo(() => {
    if (!events) return [];
    return events.filter(e => e.type === 'alert');
  }, [events]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const data = alert.data as AlertData;
      if (alertFilter === 'active') return !data.acknowledged;
      if (alertFilter === 'acknowledged') return data.acknowledged;
      return true;
    });
  }, [alerts, alertFilter]);

  const alertActiveCount = alerts.filter(a => !(a.data as AlertData).acknowledged).length;
  const alertAcknowledgedCount = alerts.filter(a => (a.data as AlertData).acknowledged).length;

  // Task memos
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(task => {
      if (taskFilter === 'active') return task.status === 'pending' || task.status === 'active';
      if (taskFilter === 'completed') return task.status === 'succeeded' || task.status === 'failed' || task.status === 'expired';
      return true;
    });
  }, [tasks, taskFilter]);

  const taskActiveCount = tasks?.filter(t => t.status === 'pending' || t.status === 'active').length ?? 0;
  const taskCompletedCount = tasks?.filter(t => t.status === 'succeeded' || t.status === 'failed' || t.status === 'expired').length ?? 0;

  // Alert handlers
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
      { onSuccess: () => setIsAlertModalOpen(false) }
    );
  };

  const handleAcknowledge = (id: string) => {
    acknowledgeAlert.mutate(id);
  };

  const handleAlertDelete = (id: string) => {
    clearAlert.mutate(id, {
      onSuccess: () => setAlertDeleteConfirmId(null),
    });
  };

  // Task handlers
  const handleCreateTask = (formData: {
    ship_id: string;
    title: string;
    station: StationGroup;
    description?: string;
    time_limit?: number;
  }) => {
    createTask.mutate(formData, {
      onSuccess: () => setIsTaskModalOpen(false),
    });
  };

  const handleTaskDelete = (id: string) => {
    deleteTask.mutate(id, {
      onSuccess: () => setTaskDeleteConfirmId(null),
    });
  };

  const handleComplete = (id: string, status: 'succeeded' | 'failed') => {
    completeTask.mutate({ taskId: id, status });
  };

  // Utilities
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatTimeLimit = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'active': return 'status-active';
      case 'succeeded': return 'status-succeeded';
      case 'failed': return 'status-failed';
      case 'expired': return 'status-expired';
      default: return '';
    }
  };

  return (
    <div className="admin-page admin-split-page">
      {/* Alerts Section */}
      <div className="admin-split-section">
        <div className="admin-header-row">
          <h2 className="admin-section-title">Alerts</h2>
          <button className="btn btn-primary btn-small" onClick={() => setIsAlertModalOpen(true)}>
            + Alert
          </button>
        </div>

        <div className="admin-filter-bar">
          <button
            className={`filter-tab ${alertFilter === 'all' ? 'active' : ''}`}
            onClick={() => setAlertFilter('all')}
          >
            All ({alerts.length})
          </button>
          <button
            className={`filter-tab ${alertFilter === 'active' ? 'active' : ''}`}
            onClick={() => setAlertFilter('active')}
          >
            Active ({alertActiveCount})
          </button>
          <button
            className={`filter-tab ${alertFilter === 'acknowledged' ? 'active' : ''}`}
            onClick={() => setAlertFilter('acknowledged')}
          >
            Ack'd ({alertAcknowledgedCount})
          </button>
        </div>

        {alertsLoading ? (
          <div className="admin-loading">Loading alerts...</div>
        ) : filteredAlerts.length === 0 ? (
          <div className="admin-empty-compact">
            <p>No alerts</p>
          </div>
        ) : (
          <div className="admin-table-container admin-table-scrollable">
            <table className="admin-table admin-table-compact">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Message</th>
                  <th>Category</th>
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
                      <td>
                        {data.ship_wide ? (
                          <span className="badge badge-accent">Yes</span>
                        ) : (
                          <span className="badge badge-muted">No</span>
                        )}
                      </td>
                      <td>
                        {isAcknowledged ? (
                          <span className="badge badge-muted">Ack'd</span>
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
                          {alertDeleteConfirmId === alert.id ? (
                            <>
                              <button
                                className="btn btn-small btn-danger"
                                onClick={() => handleAlertDelete(alert.id)}
                                disabled={clearAlert.isPending}
                              >
                                Confirm
                              </button>
                              <button
                                className="btn btn-small"
                                onClick={() => setAlertDeleteConfirmId(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => setAlertDeleteConfirmId(alert.id)}
                            >
                              Del
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
      </div>

      {/* Tasks Section */}
      <div className="admin-split-section">
        <div className="admin-header-row">
          <h2 className="admin-section-title">Tasks</h2>
          <button className="btn btn-primary btn-small" onClick={() => setIsTaskModalOpen(true)}>
            + Task
          </button>
        </div>

        <div className="admin-filter-bar">
          <button
            className={`filter-tab ${taskFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTaskFilter('all')}
          >
            All ({tasks?.length ?? 0})
          </button>
          <button
            className={`filter-tab ${taskFilter === 'active' ? 'active' : ''}`}
            onClick={() => setTaskFilter('active')}
          >
            Active ({taskActiveCount})
          </button>
          <button
            className={`filter-tab ${taskFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setTaskFilter('completed')}
          >
            Done ({taskCompletedCount})
          </button>
        </div>

        {tasksLoading ? (
          <div className="admin-loading">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="admin-empty-compact">
            <p>No tasks</p>
          </div>
        ) : (
          <div className="admin-table-container admin-table-scrollable">
            <table className="admin-table admin-table-compact">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Station</th>
                  <th>Status</th>
                  <th>Claimed By</th>
                  <th>Time Limit</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => (
                  <tr key={task.id} className={task.status !== 'pending' && task.status !== 'active' ? 'row-muted' : ''}>
                    <td className="task-title-cell">
                      <span className="task-title">{task.title}</span>
                      {task.description && (
                        <span className="task-description-preview">{task.description}</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-station">
                        {STATION_DISPLAY[task.station] ?? task.station}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusClass(task.status)}`}>
                        {STATUS_DISPLAY[task.status] ?? task.status}
                      </span>
                    </td>
                    <td>{task.claimed_by || '-'}</td>
                    <td>{formatTimeLimit(task.time_limit)}</td>
                    <td className="time-cell">{formatTime(task.created_at)}</td>
                    <td>
                      <div className="action-buttons">
                        {(task.status === 'pending' || task.status === 'active') && (
                          <>
                            <button
                              className="btn btn-small btn-success"
                              onClick={() => handleComplete(task.id, 'succeeded')}
                              disabled={completeTask.isPending}
                              title="Mark as Succeeded"
                            >
                              Pass
                            </button>
                            <button
                              className="btn btn-small btn-warning"
                              onClick={() => handleComplete(task.id, 'failed')}
                              disabled={completeTask.isPending}
                              title="Mark as Failed"
                            >
                              Fail
                            </button>
                          </>
                        )}
                        {taskDeleteConfirmId === task.id ? (
                          <>
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => handleTaskDelete(task.id)}
                              disabled={deleteTask.isPending}
                            >
                              Confirm
                            </button>
                            <button
                              className="btn btn-small"
                              onClick={() => setTaskDeleteConfirmId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => setTaskDeleteConfirmId(task.id)}
                          >
                            Del
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <AlertFormModal
        isOpen={isAlertModalOpen}
        shipId={shipId ?? ''}
        onClose={() => setIsAlertModalOpen(false)}
        onSubmit={handleCreateAlert}
        isSubmitting={createAlert.isPending}
      />

      <TaskFormModal
        isOpen={isTaskModalOpen}
        shipId={shipId ?? ''}
        onClose={() => setIsTaskModalOpen(false)}
        onSubmit={handleCreateTask}
        isSubmitting={createTask.isPending}
      />
    </div>
  );
}
