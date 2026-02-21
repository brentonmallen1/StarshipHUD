import { useState, useMemo } from 'react';
import { useEvents, useTasks } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import {
  useCreateAlert, useAcknowledgeAlert, useClearAlert,
  useTransmitAlert, useUntransmitAlert,
  useCreateLogEntry, useTransmitLogEntry, useUntransmitLogEntry, useDeleteLogEntry,
} from '../../hooks/mutations/useEventMutations';
import {
  useCreateTask, useDeleteTask, useCompleteTask, useToggleTaskVisibility,
} from '../../hooks/mutations/useTaskMutations';
import { AlertFormModal } from '../../components/admin/AlertFormModal';
import { TaskFormModal } from '../../components/admin/TaskFormModal';
import { LogEntryFormModal } from '../../components/admin/LogEntryFormModal';
import type { EventSeverity, StationGroup } from '../../types';
import './Admin.css';

interface AlertData {
  category?: string;
  location?: string;
  acknowledged?: boolean;
  acknowledged_at?: string;
  ship_wide?: boolean;
}

type AlertFilter = 'all' | 'active' | 'acknowledged' | 'draft';
type TaskFilter = 'all' | 'active' | 'completed' | 'draft';
type LogFilter = 'all' | 'visible' | 'draft';

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

  // Section collapse state (collapsed by default)
  const [alertsCollapsed, setAlertsCollapsed] = useState(true);
  const [tasksCollapsed, setTasksCollapsed] = useState(true);
  const [logsCollapsed, setLogsCollapsed] = useState(true);

  // Alert state
  const { data: events, isLoading: alertsLoading } = useEvents(shipId ?? undefined, 200);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');
  const [alertDeleteConfirmId, setAlertDeleteConfirmId] = useState<string | null>(null);

  const createAlert = useCreateAlert();
  const acknowledgeAlert = useAcknowledgeAlert();
  const clearAlert = useClearAlert();
  const transmitAlert = useTransmitAlert();
  const untransmitAlert = useUntransmitAlert();

  // Task state
  const { data: tasks, isLoading: tasksLoading } = useTasks(shipId ?? undefined);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [taskDeleteConfirmId, setTaskDeleteConfirmId] = useState<string | null>(null);

  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const completeTask = useCompleteTask();
  const toggleTaskVisibility = useToggleTaskVisibility();

  // Log entry state
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [logDeleteConfirmId, setLogDeleteConfirmId] = useState<string | null>(null);

  const createLogEntry = useCreateLogEntry();
  const transmitLogEntry = useTransmitLogEntry();
  const untransmitLogEntry = useUntransmitLogEntry();
  const deleteLogEntry = useDeleteLogEntry();

  // Alert memos
  const alerts = useMemo(() => {
    if (!events) return [];
    return events.filter(e => e.type === 'alert');
  }, [events]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const data = alert.data as AlertData;
      if (alertFilter === 'active') return alert.transmitted && !data.acknowledged;
      if (alertFilter === 'acknowledged') return data.acknowledged;
      if (alertFilter === 'draft') return !alert.transmitted;
      return true;
    });
  }, [alerts, alertFilter]);

  const alertActiveCount = alerts.filter(a => a.transmitted && !(a.data as AlertData).acknowledged).length;
  const alertDraftCount = alerts.filter(a => !a.transmitted).length;

  // Task memos
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(task => {
      if (taskFilter === 'active') return task.visible && (task.status === 'pending' || task.status === 'active');
      if (taskFilter === 'completed') return task.status === 'succeeded' || task.status === 'failed' || task.status === 'expired';
      if (taskFilter === 'draft') return !task.visible;
      return true;
    });
  }, [tasks, taskFilter]);

  const taskActiveCount = tasks?.filter(t => t.visible && (t.status === 'pending' || t.status === 'active')).length ?? 0;
  const taskDraftCount = tasks?.filter(t => !t.visible).length ?? 0;

  // Log entry memos
  const logEntries = useMemo(() => {
    if (!events) return [];
    return events.filter(e => e.type === 'log_entry' && e.source === 'gm');
  }, [events]);

  const filteredLogs = useMemo(() => {
    return logEntries.filter(log => {
      if (logFilter === 'visible') return log.transmitted;
      if (logFilter === 'draft') return !log.transmitted;
      return true;
    });
  }, [logEntries, logFilter]);

  const logVisibleCount = logEntries.filter(l => l.transmitted).length;
  const logDraftCount = logEntries.filter(l => !l.transmitted).length;

  // Alert handlers
  const handleCreateAlert = (formData: {
    ship_id: string;
    type: string;
    severity: EventSeverity;
    message: string;
    transmitted: boolean;
    data: { category?: string; location?: string; acknowledged: boolean; ship_wide?: boolean };
  }) => {
    createAlert.mutate(
      {
        ship_id: formData.ship_id,
        severity: formData.severity,
        message: formData.message,
        transmitted: formData.transmitted,
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
    visible?: boolean;
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

  // Log entry handlers
  const handleCreateLogEntry = (formData: {
    ship_id: string;
    severity: EventSeverity;
    message: string;
    transmitted: boolean;
  }) => {
    createLogEntry.mutate(formData, {
      onSuccess: () => setIsLogModalOpen(false),
    });
  };

  const handleLogDelete = (id: string) => {
    deleteLogEntry.mutate(id, {
      onSuccess: () => setLogDeleteConfirmId(null),
    });
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
      <div className={`admin-split-section ${alertsCollapsed ? 'collapsed' : ''}`}>
        <div className="admin-header-row">
          <button className="section-collapse-toggle" onClick={() => setAlertsCollapsed(!alertsCollapsed)}>
            <span className={`collapse-chevron ${alertsCollapsed ? '' : 'expanded'}`}>&#9654;</span>
            <h2 className="admin-section-title">Alerts</h2>
            <span className="section-count">({alerts.length})</span>
          </button>
          <button className="btn btn-primary btn-small" onClick={() => setIsAlertModalOpen(true)}>
            + Alert
          </button>
        </div>

        {!alertsCollapsed && <div className="admin-filter-bar">
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
            className={`filter-tab ${alertFilter === 'draft' ? 'active' : ''}`}
            onClick={() => setAlertFilter('draft')}
          >
            Drafts ({alertDraftCount})
          </button>
          <button
            className={`filter-tab ${alertFilter === 'acknowledged' ? 'active' : ''}`}
            onClick={() => setAlertFilter('acknowledged')}
          >
            Ack'd
          </button>
        </div>}

        {!alertsCollapsed && (alertsLoading ? (
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
                  <th>Visibility</th>
                  <th>Severity</th>
                  <th>Message</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map(alert => {
                  const data = alert.data as AlertData;
                  const isAcknowledged = data.acknowledged ?? false;
                  const isDraft = !alert.transmitted;

                  return (
                    <tr key={alert.id} className={isDraft ? 'row-draft' : isAcknowledged ? 'row-muted' : ''}>
                      <td>
                        <span className={`status-badge ${isDraft ? 'status-draft' : 'status-transmitted'}`}>
                          {isDraft ? 'DRAFT' : 'LIVE'}
                        </span>
                      </td>
                      <td>
                        <span className={`severity-badge severity-${alert.severity}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="message-cell">{alert.message}</td>
                      <td>{data.category || '-'}</td>
                      <td>
                        {isDraft ? (
                          <span className="badge badge-muted">Draft</span>
                        ) : isAcknowledged ? (
                          <span className="badge badge-muted">Ack'd</span>
                        ) : (
                          <span className="badge badge-warning">Active</span>
                        )}
                      </td>
                      <td className="time-cell">{formatTime(alert.created_at)}</td>
                      <td>
                        <div className="action-buttons">
                          {isDraft ? (
                            <button
                              className="btn btn-small btn-success"
                              onClick={() => transmitAlert.mutate(alert.id)}
                              disabled={transmitAlert.isPending}
                              title="Make visible to players"
                            >
                              Show
                            </button>
                          ) : (
                            <>
                              {!isAcknowledged && (
                                <button
                                  className="btn btn-small"
                                  onClick={() => handleAcknowledge(alert.id)}
                                  disabled={acknowledgeAlert.isPending}
                                >
                                  Ack
                                </button>
                              )}
                              <button
                                className="btn btn-small btn-warning"
                                onClick={() => untransmitAlert.mutate(alert.id)}
                                disabled={untransmitAlert.isPending}
                                title="Hide from players"
                              >
                                Hide
                              </button>
                            </>
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
        ))}
      </div>

      {/* Tasks Section */}
      <div className={`admin-split-section ${tasksCollapsed ? 'collapsed' : ''}`}>
        <div className="admin-header-row">
          <button className="section-collapse-toggle" onClick={() => setTasksCollapsed(!tasksCollapsed)}>
            <span className={`collapse-chevron ${tasksCollapsed ? '' : 'expanded'}`}>&#9654;</span>
            <h2 className="admin-section-title">Tasks</h2>
            <span className="section-count">({tasks?.length ?? 0})</span>
          </button>
          <button className="btn btn-primary btn-small" onClick={() => setIsTaskModalOpen(true)}>
            + Task
          </button>
        </div>

        {!tasksCollapsed && <div className="admin-filter-bar">
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
            className={`filter-tab ${taskFilter === 'draft' ? 'active' : ''}`}
            onClick={() => setTaskFilter('draft')}
          >
            Drafts ({taskDraftCount})
          </button>
          <button
            className={`filter-tab ${taskFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setTaskFilter('completed')}
          >
            Done
          </button>
        </div>}

        {!tasksCollapsed && (tasksLoading ? (
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
                  <th>Visibility</th>
                  <th>Title</th>
                  <th>Station</th>
                  <th>Status</th>
                  <th>Time Limit</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => {
                  const isDraft = !task.visible;
                  const isFinished = task.status !== 'pending' && task.status !== 'active';

                  return (
                    <tr key={task.id} className={isDraft ? 'row-draft' : isFinished ? 'row-muted' : ''}>
                      <td>
                        <span className={`status-badge ${isDraft ? 'status-draft' : 'status-transmitted'}`}>
                          {isDraft ? 'DRAFT' : 'LIVE'}
                        </span>
                      </td>
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
                      <td>{formatTimeLimit(task.time_limit)}</td>
                      <td className="time-cell">{formatTime(task.created_at)}</td>
                      <td>
                        <div className="action-buttons">
                          {isDraft ? (
                            <button
                              className="btn btn-small btn-success"
                              onClick={() => toggleTaskVisibility.mutate({ id: task.id, visible: true })}
                              disabled={toggleTaskVisibility.isPending}
                              title="Make visible to players"
                            >
                              Show
                            </button>
                          ) : (
                            <>
                              {!isFinished && (
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
                              <button
                                className="btn btn-small btn-warning"
                                onClick={() => toggleTaskVisibility.mutate({ id: task.id, visible: false })}
                                disabled={toggleTaskVisibility.isPending}
                                title="Hide from players"
                              >
                                Hide
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
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Log Entries Section */}
      <div className={`admin-split-section ${logsCollapsed ? 'collapsed' : ''}`}>
        <div className="admin-header-row">
          <button className="section-collapse-toggle" onClick={() => setLogsCollapsed(!logsCollapsed)}>
            <span className={`collapse-chevron ${logsCollapsed ? '' : 'expanded'}`}>&#9654;</span>
            <h2 className="admin-section-title">Log Entries</h2>
            <span className="section-count">({logEntries.length})</span>
          </button>
          <button className="btn btn-primary btn-small" onClick={() => setIsLogModalOpen(true)}>
            + Log Entry
          </button>
        </div>

        {!logsCollapsed && <div className="admin-filter-bar">
          <button
            className={`filter-tab ${logFilter === 'all' ? 'active' : ''}`}
            onClick={() => setLogFilter('all')}
          >
            All ({logEntries.length})
          </button>
          <button
            className={`filter-tab ${logFilter === 'visible' ? 'active' : ''}`}
            onClick={() => setLogFilter('visible')}
          >
            Visible ({logVisibleCount})
          </button>
          <button
            className={`filter-tab ${logFilter === 'draft' ? 'active' : ''}`}
            onClick={() => setLogFilter('draft')}
          >
            Drafts ({logDraftCount})
          </button>
        </div>}

        {!logsCollapsed && (alertsLoading ? (
          <div className="admin-loading">Loading log entries...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="admin-empty-compact">
            <p>No log entries</p>
          </div>
        ) : (
          <div className="admin-table-container admin-table-scrollable">
            <table className="admin-table admin-table-compact">
              <thead>
                <tr>
                  <th>Visibility</th>
                  <th>Severity</th>
                  <th>Message</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                  const isDraft = !log.transmitted;

                  return (
                    <tr key={log.id} className={isDraft ? 'row-draft' : ''}>
                      <td>
                        <span className={`status-badge ${isDraft ? 'status-draft' : 'status-transmitted'}`}>
                          {isDraft ? 'DRAFT' : 'VISIBLE'}
                        </span>
                      </td>
                      <td>
                        <span className={`severity-badge severity-${log.severity}`}>
                          {log.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="message-cell">{log.message}</td>
                      <td className="time-cell">{formatTime(log.created_at)}</td>
                      <td>
                        <div className="action-buttons">
                          {isDraft ? (
                            <button
                              className="btn btn-small btn-success"
                              onClick={() => transmitLogEntry.mutate(log.id)}
                              disabled={transmitLogEntry.isPending}
                              title="Make visible to players"
                            >
                              Show
                            </button>
                          ) : (
                            <button
                              className="btn btn-small btn-warning"
                              onClick={() => untransmitLogEntry.mutate(log.id)}
                              disabled={untransmitLogEntry.isPending}
                              title="Hide from players"
                            >
                              Hide
                            </button>
                          )}
                          {logDeleteConfirmId === log.id ? (
                            <>
                              <button
                                className="btn btn-small btn-danger"
                                onClick={() => handleLogDelete(log.id)}
                                disabled={deleteLogEntry.isPending}
                              >
                                Confirm
                              </button>
                              <button
                                className="btn btn-small"
                                onClick={() => setLogDeleteConfirmId(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => setLogDeleteConfirmId(log.id)}
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
        ))}
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

      <LogEntryFormModal
        isOpen={isLogModalOpen}
        shipId={shipId ?? ''}
        onClose={() => setIsLogModalOpen(false)}
        onSubmit={handleCreateLogEntry}
        isSubmitting={createLogEntry.isPending}
      />
    </div>
  );
}
