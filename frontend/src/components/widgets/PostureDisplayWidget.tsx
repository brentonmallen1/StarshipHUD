import { usePosture } from '../../hooks/useShipData';
import type { WidgetRendererProps } from '../../types';
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

export function PostureDisplayWidget({ isEditing }: WidgetRendererProps) {
  const { data: posture, isLoading, error } = usePosture();

  if (isEditing) {
    return (
      <div className="posture-display-widget editing">
        <div className="posture-header">
          <h3 className="posture-title">Posture & ROE</h3>
        </div>
        <div className="posture-preview">
          <div className="posture-badge posture-yellow">
            <span className="posture-level">YELLOW</span>
            <span className="posture-label">Condition Yellow</span>
          </div>
          <div className="roe-section">
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
        <div className="posture-header">
          <h3 className="posture-title">Posture & ROE</h3>
        </div>
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  if (error || !posture) {
    return (
      <div className="posture-display-widget error">
        <div className="posture-header">
          <h3 className="posture-title">Posture & ROE</h3>
        </div>
        <div className="error-state">Unable to load posture data</div>
      </div>
    );
  }

  const postureInfo = POSTURE_LEVELS[posture.posture] || POSTURE_LEVELS.green;

  // Format ROE object into readable string
  const formatROE = (roe: any): string => {
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
      <div className="posture-header">
        <h3 className="posture-title">Posture & ROE</h3>
      </div>

      <div className="posture-content">
        <div className={`posture-badge posture-${posture.posture}`}>
          <span className="posture-level">{postureInfo.level}</span>
          <span className="posture-label">{postureInfo.label}</span>
        </div>

        <p className="posture-description">{postureInfo.description}</p>

        {posture.roe && (
          <div className="roe-section">
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
