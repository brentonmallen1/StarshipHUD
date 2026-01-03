import { useMemo } from 'react';
import type { WidgetRendererProps, Task } from '../../types';
import { useTasks } from '../../hooks/useShipData';
import { useClaimTask, useCompleteTask } from '../../hooks/useMutations';
import './TaskQueueWidget.css';

// Priority order for sorting (lower = higher priority)
const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Map backend status to display status
const STATUS_DISPLAY: Record<string, string> = {
  pending: 'OPEN',
  active: 'ACTIVE',
  succeeded: 'DONE',
  failed: 'FAILED',
  expired: 'EXPIRED',
};

export function TaskQueueWidget({ isEditing }: WidgetRendererProps) {
  // Fetch tasks from API
  const { data: tasks, isLoading, error } = useTasks('constellation');
  const claimTask = useClaimTask();
  const completeTask = useCompleteTask();

  // Filter and sort tasks
  const activeTasks = useMemo(() => {
    if (!tasks) return [];

    return tasks
      .filter(t => t.status === 'pending' || t.status === 'active')
      .sort((a, b) => {
        // Sort by priority (inferred from time_limit or default to medium)
        const aPriority = a.time_limit && a.time_limit < 300 ? 'critical' :
                         a.time_limit && a.time_limit < 600 ? 'high' : 'medium';
        const bPriority = b.time_limit && b.time_limit < 300 ? 'critical' :
                         b.time_limit && b.time_limit < 600 ? 'high' : 'medium';
        return (PRIORITY_ORDER[aPriority] ?? 2) - (PRIORITY_ORDER[bPriority] ?? 2);
      });
  }, [tasks]);

  const handleClaimTask = (taskId: string) => {
    if (isEditing) return;
    claimTask.mutate({ taskId, claimedBy: 'Player' });
  };

  const handleCompleteTask = (taskId: string) => {
    if (isEditing) return;
    completeTask.mutate({ taskId, status: 'succeeded' });
  };

  const getTimeRemaining = (expiresAt?: string): string => {
    if (!expiresAt) return '';

    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return 'EXPIRED';

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getPriorityClass = (task: Task): string => {
    // Infer priority from time_limit
    if (task.time_limit && task.time_limit < 300) return 'priority-critical';
    if (task.time_limit && task.time_limit < 600) return 'priority-high';
    if (task.time_limit) return 'priority-medium';
    return 'priority-low';
  };

  if (isLoading) {
    return (
      <div className="task-queue-widget">
        <div className="task-header">
          <h3 className="task-title">Task Queue</h3>
        </div>
        <div className="task-list">
          <div className="task-empty">
            <div className="empty-icon">...</div>
            <p className="empty-message">Loading tasks...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="task-queue-widget">
        <div className="task-header">
          <h3 className="task-title">Task Queue</h3>
        </div>
        <div className="task-list">
          <div className="task-empty">
            <div className="empty-icon">!</div>
            <p className="empty-message">Failed to load tasks</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="task-queue-widget">
      <div className="task-header">
        <h3 className="task-title">Task Queue</h3>
        <div className="task-count">
          {activeTasks.length} {activeTasks.length === 1 ? 'task' : 'tasks'}
        </div>
      </div>

      <div className="task-list">
        {activeTasks.length === 0 && (
          <div className="task-empty">
            <div className="empty-icon">OK</div>
            <p className="empty-message">No active tasks</p>
          </div>
        )}

        {activeTasks.map(task => (
          <div key={task.id} className={`task-item ${getPriorityClass(task)}`}>
            <div className="task-item-header">
              <div className="task-item-title-row">
                <span className="task-item-title">{task.title}</span>
                <span className={`task-status status-${task.status}`}>
                  {STATUS_DISPLAY[task.status] ?? task.status.toUpperCase()}
                </span>
              </div>
              {task.expires_at && (
                <div className="task-timer">
                  @ {getTimeRemaining(task.expires_at)}
                </div>
              )}
            </div>

            {task.description && (
              <p className="task-description">{task.description}</p>
            )}

            {task.station && (
              <div className="task-meta">
                <span className="task-location">@ {task.station}</span>
              </div>
            )}

            {task.claimed_by && (
              <div className="task-assigned">
                Assigned to: <span className="assigned-name">{task.claimed_by}</span>
              </div>
            )}

            {!isEditing && (
              <div className="task-actions">
                {task.status === 'pending' && (
                  <button
                    className="btn btn-small"
                    onClick={() => handleClaimTask(task.id)}
                    disabled={claimTask.isPending}
                  >
                    {claimTask.isPending ? 'Claiming...' : 'Claim Task'}
                  </button>
                )}
                {task.status === 'active' && (
                  <button
                    className="btn btn-small btn-primary"
                    onClick={() => handleCompleteTask(task.id)}
                    disabled={completeTask.isPending}
                  >
                    {completeTask.isPending ? 'Completing...' : 'Mark Complete'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
