import { useState } from 'react';
import { usePosture } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useUpdatePosture, useCreateAlert, useCreateTask } from '../../hooks/useMutations';
import { AlertFormModal } from './AlertFormModal';
import { TaskFormModal } from './TaskFormModal';
import type { EventSeverity, StationGroup } from '../../types';
import './GMToolbar.css';

export function GMToolbar() {
  const shipId = useCurrentShipId();
  const { data: posture } = usePosture();
  const updatePosture = useUpdatePosture();
  const createAlert = useCreateAlert();
  const createTask = useCreateTask();

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const handlePostureChange = (newPosture: string) => {
    if (!shipId) return;
    updatePosture.mutate({ shipId, posture: newPosture });
  };

  const handleCreateAlert = (data: {
    ship_id: string;
    type: string;
    severity: EventSeverity;
    message: string;
    data: { category?: string; location?: string; acknowledged: boolean };
  }) => {
    createAlert.mutate(
      {
        ship_id: data.ship_id,
        severity: data.severity,
        message: data.message,
        data: data.data,
      },
      {
        onSuccess: () => setIsAlertModalOpen(false),
      }
    );
  };

  const handleCreateTask = (data: {
    ship_id: string;
    title: string;
    station: StationGroup;
    description?: string;
    time_limit?: number;
  }) => {
    createTask.mutate(data, {
      onSuccess: () => setIsTaskModalOpen(false),
    });
  };

  return (
    <>
      <div className="gm-toolbar">
        <div className="gm-toolbar-section">
          <span className="gm-toolbar-label">Quick Actions</span>
          <button
            className="gm-toolbar-btn gm-toolbar-btn-alert"
            onClick={() => setIsAlertModalOpen(true)}
          >
            + Alert
          </button>
          <button
            className="gm-toolbar-btn gm-toolbar-btn-task"
            onClick={() => setIsTaskModalOpen(true)}
          >
            + Task
          </button>
        </div>

        <div className="gm-toolbar-divider" />

        <div className="gm-toolbar-section">
          <span className="gm-toolbar-label">Posture</span>
          <div className="gm-toolbar-posture-buttons">
            <button
              className={`gm-toolbar-posture gm-toolbar-posture-green ${posture?.posture === 'green' ? 'active' : ''}`}
              onClick={() => handlePostureChange('green')}
              disabled={updatePosture.isPending}
            >
              Green
            </button>
            <button
              className={`gm-toolbar-posture gm-toolbar-posture-yellow ${posture?.posture === 'yellow' ? 'active' : ''}`}
              onClick={() => handlePostureChange('yellow')}
              disabled={updatePosture.isPending}
            >
              Yellow
            </button>
            <button
              className={`gm-toolbar-posture gm-toolbar-posture-red ${posture?.posture === 'red' ? 'active' : ''}`}
              onClick={() => handlePostureChange('red')}
              disabled={updatePosture.isPending}
            >
              Red
            </button>
          </div>
        </div>
      </div>

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
    </>
  );
}
