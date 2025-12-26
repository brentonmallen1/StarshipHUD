import { useState } from 'react';
import type { WidgetRendererProps } from '../../types';
import './TaskQueueWidget.css';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'claimed' | 'in_progress' | 'completed' | 'failed';
  assigned_to?: string;
  location?: string;
  time_limit?: number;
  expires_at?: string;
  created_at: string;
}

export function TaskQueueWidget({ isEditing }: WidgetRendererProps) {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Reactor Coolant Leak',
      description: 'Seal coolant leak in reactor compartment B',
      priority: 'critical',
      status: 'pending',
      location: 'Engineering - Reactor B',
      time_limit: 300,
      expires_at: new Date(Date.now() + 300000).toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Calibrate Sensor Array',
      description: 'Recalibrate long-range sensor array after anomaly',
      priority: 'medium',
      status: 'claimed',
      assigned_to: 'Ensign Chen',
      location: 'Sensors',
      created_at: new Date().toISOString(),
    },
    {
      id: '3',
      title: 'Replace Power Coupling',
      description: 'Swap damaged power coupling in port nacelle',
      priority: 'high',
      status: 'pending',
      location: 'Engineering - Port Nacelle',
      created_at: new Date().toISOString(),
    },
  ]);

  const handleClaimTask = (taskId: string) => {
    if (isEditing) return;

    setTasks(tasks.map(task =>
      task.id === taskId
        ? { ...task, status: 'claimed', assigned_to: 'You' }
        : task
    ));
    // TODO: API call to claim task
  };

  const handleCompleteTask = (taskId: string) => {
    if (isEditing) return;

    setTasks(tasks.map(task =>
      task.id === taskId
        ? { ...task, status: 'completed' }
        : task
    ));
    // TODO: API call to complete task
  };

  const getTimeRemaining = (expiresAt?: string): string => {
    if (!expiresAt) return '';

    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return 'EXPIRED';

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getPriorityClass = (priority: string): string => {
    switch (priority) {
      case 'critical': return 'priority-critical';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  };

  const getStatusBadge = (status: string): string => {
    switch (status) {
      case 'pending': return 'OPEN';
      case 'claimed': return 'CLAIMED';
      case 'in_progress': return 'IN PROGRESS';
      case 'completed': return 'DONE';
      case 'failed': return 'FAILED';
      default: return status.toUpperCase();
    }
  };

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'failed');

  // Show all tasks with scrolling, sorted by priority
  // Sort by priority: critical > high > medium > low
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const visibleTasks = [...activeTasks].sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  const showEmpty = activeTasks.length === 0;

  return (
    <div className="task-queue-widget">
      <div className="task-header">
        <h3 className="task-title">Task Queue</h3>
        <div className="task-count">
          {activeTasks.length} {activeTasks.length === 1 ? 'task' : 'tasks'}
        </div>
      </div>

      <div className="task-list">
        {showEmpty && (
          <div className="task-empty">
            <div className="empty-icon">✓</div>
            <p className="empty-message">No active tasks</p>
          </div>
        )}

        {visibleTasks.map(task => (
          <div key={task.id} className={`task-item ${getPriorityClass(task.priority)}`}>
            <div className="task-item-header">
              <div className="task-item-title-row">
                <span className="task-item-title">{task.title}</span>
                <span className={`task-status status-${task.status}`}>
                  {getStatusBadge(task.status)}
                </span>
              </div>
              {task.expires_at && (
                <div className="task-timer">
                  ⏱ {getTimeRemaining(task.expires_at)}
                </div>
              )}
            </div>

            <p className="task-description">{task.description}</p>

            {task.location && (
              <div className="task-meta">
                <span className="task-location">📍 {task.location}</span>
              </div>
            )}

            {task.assigned_to && (
              <div className="task-assigned">
                Assigned to: <span className="assigned-name">{task.assigned_to}</span>
              </div>
            )}

            {!isEditing && (
              <div className="task-actions">
                {task.status === 'pending' && (
                  <button
                    className="btn btn-small"
                    onClick={() => handleClaimTask(task.id)}
                  >
                    Claim Task
                  </button>
                )}
                {task.status === 'claimed' && task.assigned_to === 'You' && (
                  <button
                    className="btn btn-small btn-primary"
                    onClick={() => handleCompleteTask(task.id)}
                  >
                    Mark Complete
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
