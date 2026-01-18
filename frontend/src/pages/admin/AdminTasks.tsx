import { useState, useMemo } from 'react';
import { useTasks } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useCreateTask, useDeleteTask, useCompleteTask } from '../../hooks/useMutations';
import { TaskFormModal } from '../../components/admin/TaskFormModal';
import type { StationGroup } from '../../types';
import './Admin.css';

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

export function AdminTasks() {
  const shipId = useCurrentShipId();
  const { data: tasks, isLoading } = useTasks(shipId ?? undefined);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const completeTask = useCompleteTask();

  // Filter tasks
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(task => {
      if (filter === 'active') return task.status === 'pending' || task.status === 'active';
      if (filter === 'completed') return task.status === 'succeeded' || task.status === 'failed' || task.status === 'expired';
      return true;
    });
  }, [tasks, filter]);

  const activeCount = useMemo(() => {
    return tasks?.filter(t => t.status === 'pending' || t.status === 'active').length ?? 0;
  }, [tasks]);

  const completedCount = useMemo(() => {
    return tasks?.filter(t => t.status === 'succeeded' || t.status === 'failed' || t.status === 'expired').length ?? 0;
  }, [tasks]);

  const handleCreateTask = (formData: {
    ship_id: string;
    title: string;
    station: StationGroup;
    description?: string;
    time_limit?: number;
  }) => {
    createTask.mutate(formData, {
      onSuccess: () => setIsFormModalOpen(false),
    });
  };

  const handleDelete = (id: string) => {
    deleteTask.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const handleComplete = (id: string, status: 'succeeded' | 'failed') => {
    completeTask.mutate({ taskId: id, status });
  };

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
    <div className="admin-page">
      <div className="admin-header-row">
        <h2 className="admin-page-title">Tasks</h2>
        <button className="btn btn-primary" onClick={() => setIsFormModalOpen(true)}>
          + New Task
        </button>
      </div>

      <div className="admin-filter-bar">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({tasks?.length ?? 0})
        </button>
        <button
          className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active ({activeCount})
        </button>
        <button
          className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed ({completedCount})
        </button>
      </div>

      {isLoading ? (
        <div className="admin-loading">Loading tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="admin-empty">
          <p>No tasks found</p>
          <button className="btn" onClick={() => setIsFormModalOpen(true)}>
            Create First Task
          </button>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
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
                      {deleteConfirmId === task.id ? (
                        <>
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => handleDelete(task.id)}
                            disabled={deleteTask.isPending}
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
                          onClick={() => setDeleteConfirmId(task.id)}
                        >
                          Delete
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

      <TaskFormModal
        isOpen={isFormModalOpen}
        shipId={shipId ?? ''}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleCreateTask}
        isSubmitting={createTask.isPending}
      />
    </div>
  );
}
