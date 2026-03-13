import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShipContext } from '../contexts/ShipContext';
import { useIsGM } from '../contexts/RoleContext';
import './EditViewToggle.css';

interface EditViewToggleProps {
  panelSlug: string;
  isEditing: boolean;
  /** Called before switching from edit to view mode - should save and return true if successful */
  onBeforeSwitch?: () => Promise<boolean>;
}

export function EditViewToggle({ panelSlug, isEditing, onBeforeSwitch }: EditViewToggleProps) {
  const { shipId } = useShipContext();
  const isGM = useIsGM();
  const navigate = useNavigate();

  const handleToggle = useCallback(async () => {
    if (isEditing) {
      // Save before switching to view mode
      if (onBeforeSwitch) {
        const canSwitch = await onBeforeSwitch();
        if (!canSwitch) return;
      }
      // Exit edit mode - go to view
      navigate(`/${shipId}/panel/${panelSlug}`);
    } else {
      // Enter edit mode (preserve returnTo: 'view' so Done goes back to view)
      navigate(`/${shipId}/admin/panel/${panelSlug}`, { state: { returnTo: 'view' } });
    }
  }, [isEditing, shipId, panelSlug, navigate, onBeforeSwitch]);

  // Keyboard shortcut: Ctrl/Cmd+E
  useEffect(() => {
    if (!isGM) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        handleToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGM, handleToggle]);

  // Hide for non-GM users
  if (!isGM) return null;

  // In edit mode, render inline button (will be placed in toolbar by parent)
  // In view mode, render floating button
  if (isEditing) {
    return (
      <button
        className="btn edit-view-toggle--inline"
        onClick={handleToggle}
        title="Switch to view mode (Ctrl+E)"
      >
        View
      </button>
    );
  }

  return (
    <button
      className="edit-view-toggle edit-view-toggle--editing"
      onClick={handleToggle}
      title="Switch to edit mode (Ctrl+E)"
    >
      <span className="edit-view-toggle__icon">⚙</span>
      <span className="edit-view-toggle__label">EDIT</span>
    </button>
  );
}
