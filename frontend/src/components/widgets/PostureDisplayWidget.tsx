import { useState, useRef, useEffect } from 'react';
import { usePosture } from '../../hooks/useShipData';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useUpdatePosture } from '../../hooks/useMutations';
import type { WidgetRendererProps, Posture, RulesOfEngagement } from '../../types';
import { WidgetState } from './WidgetState';
import './PostureDisplayWidget.css';

interface PostureLevel {
  level: string;
  label: string;
  description: string;
  color: string;
}

const POSTURE_LEVELS: Record<string, PostureLevel> = {
  green: {
    level: 'GREEN',
    label: 'Condition Green',
    description: 'Normal operations, no immediate threats',
    color: 'operational',
  },
  yellow: {
    level: 'YELLOW',
    label: 'Condition Yellow',
    description: 'Elevated awareness, potential threats detected',
    color: 'degraded',
  },
  red: {
    level: 'RED',
    label: 'Condition Red',
    description: 'Combat imminent, weapons hot',
    color: 'critical',
  },
  general_quarters: {
    level: 'GQ',
    label: 'General Quarters',
    description: 'All hands to battle stations',
    color: 'critical',
  },
  silent_running: {
    level: 'SILENT',
    label: 'Silent Running',
    description: 'Minimize emissions, stealth operations',
    color: 'compromised',
  },
};

const POSTURE_ORDER: Posture[] = ['green', 'yellow', 'red', 'general_quarters', 'silent_running'];

export function PostureDisplayWidget({ isEditing, canEditData }: WidgetRendererProps) {
  const shipId = useCurrentShipId();
  const { data: posture, isLoading, error } = usePosture();
  const updatePosture = useUpdatePosture();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handlePostureChange = (newPosture: Posture) => {
    if (posture && newPosture !== posture.posture && shipId) {
      updatePosture.mutate({
        shipId,
        posture: newPosture,
      });
    }
    setIsOpen(false);
  };

  if (isEditing) {
    return (
      <div className="posture-display-widget editing">
        <div className="hud-header posture-header">
          <h3 className="hud-title posture-title">Posture & ROE</h3>
        </div>
        <div className="posture-preview">
          <div className="hud-tile hud-tile--outlined posture-badge posture-yellow">
            <span className="posture-level">YELLOW</span>
            <span className="posture-label">Condition Yellow</span>
          </div>
          <div className="hud-row roe-section">
            <div className="roe-label">Rules of Engagement</div>
            <div className="roe-value">Defensive Only</div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="posture-display-widget loading">
        <div className="hud-header posture-header">
          <h3 className="hud-title posture-title">Posture & ROE</h3>
        </div>
        <WidgetState kind="loading" message="Loading posture" />
      </div>
    );
  }

  if (error || !posture) {
    return (
      <div className="posture-display-widget error">
        <div className="hud-header posture-header">
          <h3 className="hud-title posture-title">Posture & ROE</h3>
        </div>
        <WidgetState kind="error" message="Unable to load posture data" />
      </div>
    );
  }

  const postureInfo = POSTURE_LEVELS[posture.posture] || POSTURE_LEVELS.green;
  const canInteract = canEditData;

  // Format ROE object into readable string
  const formatROE = (roe: Partial<RulesOfEngagement> | string | null | undefined): string => {
    if (typeof roe === 'string') return roe;
    if (!roe || typeof roe !== 'object') return 'Standard';

    const parts: string[] = [];
    if (roe.weapons_safeties) parts.push(`Weapons: ${roe.weapons_safeties}`);
    if (roe.comms_broadcast) parts.push(`Comms: ${roe.comms_broadcast}`);
    if (roe.transponder) parts.push(`Transponder: ${roe.transponder}`);
    if (roe.sensor_emissions) parts.push(`Sensors: ${roe.sensor_emissions}`);

    return parts.length > 0 ? parts.join(' • ') : 'Standard';
  };

  return (
    <div className="posture-display-widget">
      <div className="hud-header posture-header">
        <h3 className="hud-title posture-title">Posture & ROE</h3>
      </div>

      <div className="posture-content">
        <div className="posture-selector-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className={`hud-tile hud-tile--outlined posture-badge posture-${posture.posture}${canInteract ? ' interactive' : ''}`}
            onClick={() => canInteract && setIsOpen(!isOpen)}
            disabled={!canInteract || updatePosture.isPending}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span className="posture-level">{postureInfo.level}</span>
            <span className="posture-label">{postureInfo.label}</span>
            {canInteract && (
              <span className="posture-change-hint">
                {updatePosture.isPending ? 'Updating...' : 'Click to change'}
              </span>
            )}
          </button>

          {isOpen && (
            <div className="posture-dropdown" role="listbox">
              {POSTURE_ORDER.map((p) => {
                const info = POSTURE_LEVELS[p];
                const isActive = p === posture.posture;
                return (
                  <button
                    key={p}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`posture-option posture-${p}${isActive ? ' active' : ''}`}
                    onClick={() => handlePostureChange(p)}
                  >
                    <span className="posture-option-level">{info.level}</span>
                    <span className="posture-option-label">{info.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p className="posture-description">{postureInfo.description}</p>

        {posture.roe && (
          <div className="hud-row roe-section">
            <div className="roe-label">Rules of Engagement</div>
            <div className="roe-value">{formatROE(posture.roe)}</div>
          </div>
        )}

        {posture.notes && (
          <div className="posture-notes">
            <div className="notes-label">Notes</div>
            <p className="notes-text">{posture.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
