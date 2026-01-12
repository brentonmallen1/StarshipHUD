import { useRef, useEffect, useState, useCallback } from 'react';
import type { WidgetRendererProps, TransmissionData, ShipEvent } from '../../types';
import { useTransmissions } from '../../hooks/useShipData';
import { useUntransmitTransmission } from '../../hooks/useMutations';
import { DIFFICULTY_CONFIG } from '../minigames/config';
import { DecryptionModal } from '../minigames/DecryptionModal';
import './TransmissionConsoleWidget.css';

// Calculate remaining cooldown time
function getCooldownRemaining(cooldownUntil: string | undefined): number {
  if (!cooldownUntil) return 0;
  const remaining = new Date(cooldownUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
}

// Format seconds as MM:SS
function formatCooldown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Transmission channel types and their display properties
const CHANNEL_CONFIG: Record<string, { icon: string; label: string; className: string }> = {
  distress: { icon: '🔴', label: 'DISTRESS', className: 'channel-distress' },
  hail: { icon: '📡', label: 'HAIL', className: 'channel-hail' },
  internal: { icon: '🔊', label: 'INTERNAL', className: 'channel-internal' },
  broadcast: { icon: '📢', label: 'BROADCAST', className: 'channel-broadcast' },
  encrypted: { icon: '🔒', label: 'ENCRYPTED', className: 'channel-encrypted' },
  unknown: { icon: '❓', label: 'UNKNOWN', className: 'channel-unknown' },
};

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getChannelConfig(channel: string) {
  return CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.unknown;
}

/**
 * Transmission Console Widget
 *
 * Displays incoming transmissions from the events system.
 * Filters events by type='transmission_received'.
 *
 * Config options:
 * - max_messages: number - Max messages to show (default: 10)
 * - show_timestamps: boolean - Show time (default: true)
 * - channel_filter: string[] - Filter by channel types
 * - auto_scroll: boolean - Auto-scroll to new messages (default: true)
 */
export function TransmissionConsoleWidget({ instance }: WidgetRendererProps) {
  const maxMessages = (instance.config?.max_messages as number) ?? 10;
  const showTimestamps = (instance.config?.show_timestamps as boolean) ?? true;
  const channelFilter = instance.config?.channel_filter as string[] | undefined;
  const autoScroll = (instance.config?.auto_scroll as boolean) ?? true;

  const shipId = (instance.bindings?.ship_id as string) ?? 'constellation';
  const scrollRef = useRef<HTMLDivElement>(null);
  const [clearConfirmId, setClearConfirmId] = useState<string | null>(null);
  const [decryptingTransmission, setDecryptingTransmission] = useState<ShipEvent | null>(null);
  const [, setTick] = useState(0); // Force re-render for cooldown countdown

  const { data: transmissions, isLoading } = useTransmissions(shipId, maxMessages * 2);
  const untransmitTransmission = useUntransmitTransmission();

  // Refresh cooldown displays every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDecrypt = useCallback((event: ShipEvent) => {
    setDecryptingTransmission(event);
  }, []);

  const handleDecryptClose = useCallback(() => {
    setDecryptingTransmission(null);
  }, []);

  const handleClear = (id: string) => {
    untransmitTransmission.mutate(id, {
      onSuccess: () => setClearConfirmId(null),
    });
  };

  // Filter transmissions by channel if configured
  const filteredTransmissions = transmissions?.filter((event) => {
    if (!channelFilter || channelFilter.length === 0) return true;
    const data = event.data as unknown as TransmissionData | undefined;
    return data && channelFilter.includes(data.channel);
  }).slice(0, maxMessages) ?? [];

  // Auto-scroll to bottom when new transmissions arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredTransmissions.length, autoScroll]);

  if (isLoading) {
    return (
      <div className="transmission-console-widget">
        <div className="transmission-header">
          <span className="transmission-title">TRANSMISSION CONSOLE</span>
        </div>
        <div className="transmission-loading">
          <span className="loading-text">SCANNING FREQUENCIES...</span>
        </div>
      </div>
    );
  }

  if (filteredTransmissions.length === 0) {
    return (
      <div className="transmission-console-widget">
        <div className="transmission-header">
          <span className="transmission-title">TRANSMISSION CONSOLE</span>
        </div>
        <div className="transmission-empty">
          <div className="empty-icon">📡</div>
          <span className="empty-text">NO INCOMING TRANSMISSIONS</span>
          <span className="empty-hint">Monitoring all frequencies...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="transmission-console-widget">
      <div className="transmission-header">
        <span className="transmission-title">TRANSMISSION CONSOLE</span>
        <span className="transmission-count">{filteredTransmissions.length}</span>
      </div>
      <div className="transmission-list" ref={scrollRef}>
        {filteredTransmissions.map((event) => {
          const data = event.data as unknown as TransmissionData | undefined;
          if (!data) return null;

          const channelConfig = getChannelConfig(data.channel);
          const signalStrength = data.signal_strength ?? 100;
          const isWeak = signalStrength < 50;
          const isEncrypted = data.encrypted;

          return (
            <div
              key={event.id}
              className={`transmission-item ${channelConfig.className} ${isWeak ? 'weak-signal' : ''}`}
            >
              <div className="transmission-item-header">
                <span className="channel-badge">
                  <span className="channel-icon">{channelConfig.icon}</span>
                  <span className="channel-label">{channelConfig.label}</span>
                </span>
                <span className="sender-name">{data.sender_name}</span>
                {clearConfirmId === event.id ? (
                  <div className="clear-confirm">
                    <button
                      className="clear-btn clear-btn-confirm"
                      onClick={() => handleClear(event.id)}
                      disabled={untransmitTransmission.isPending}
                    >
                      Yes
                    </button>
                    <button
                      className="clear-btn clear-btn-cancel"
                      onClick={() => setClearConfirmId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className="clear-btn"
                    onClick={() => setClearConfirmId(event.id)}
                    title="Clear this transmission"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="transmission-meta">
                {showTimestamps && (
                  <span className="transmission-time">{formatTimestamp(event.created_at)}</span>
                )}
                <span className="signal-container">
                  <span className="signal-label">Signal:</span>
                  <span className="signal-bar-container">
                    <span
                      className="signal-bar-fill"
                      style={{ width: `${signalStrength}%` }}
                    />
                  </span>
                  <span className="signal-value">{signalStrength}%</span>
                </span>
              </div>
              <div className={`transmission-text ${isEncrypted && !data.decrypted ? 'encrypted' : ''}`}>
                {isEncrypted && !data.decrypted ? (
                  (() => {
                    const cooldownRemaining = getCooldownRemaining(data.decryption_cooldown_until);
                    const isLocked = data.decryption_locked;
                    const difficulty = data.difficulty ?? 'easy';
                    const config = DIFFICULTY_CONFIG[difficulty];
                    const attempts = data.decryption_attempts ?? 0;
                    const maxRetries = config.maxRetries;

                    if (isLocked) {
                      return (
                        <div className="encrypted-locked">
                          <span className="locked-icon">🔒</span>
                          <span className="locked-text">LOCKED - AWAITING AUTHORIZATION</span>
                          <span className="locked-hint">Max attempts exceeded. GM reset required.</span>
                        </div>
                      );
                    }

                    if (cooldownRemaining > 0) {
                      return (
                        <div className="encrypted-cooldown">
                          <span className="cooldown-icon">⏳</span>
                          <span className="cooldown-text">DECRYPTION COOLING DOWN</span>
                          <span className="cooldown-timer">{formatCooldown(cooldownRemaining)}</span>
                        </div>
                      );
                    }

                    return (
                      <div className="encrypted-pending">
                        <button
                          className="decrypt-btn"
                          onClick={() => handleDecrypt(event)}
                        >
                          <span className="decrypt-icon">🔓</span>
                          <span className="decrypt-text">DECRYPT</span>
                        </button>
                        {attempts > 0 && (
                          <span className="attempt-count">
                            {maxRetries - attempts} attempt{maxRetries - attempts !== 1 ? 's' : ''} remaining
                          </span>
                        )}
                        <span className={`difficulty-indicator difficulty-${difficulty}`}>
                          {difficulty.toUpperCase()}
                        </span>
                      </div>
                    );
                  })()
                ) : isEncrypted && data.decrypted ? (
                  <div className="decrypted-content">
                    <span className="decrypted-badge">DECRYPTED</span>
                    <span className="message-content">{data.text}</span>
                  </div>
                ) : (
                  <span className="message-content">{data.text}</span>
                )}
              </div>
              {data.frequency && (
                <div className="transmission-frequency">
                  <span className="frequency-label">FREQ:</span>
                  <span className="frequency-value">{data.frequency}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Decryption Modal */}
      {decryptingTransmission && (
        <DecryptionModal
          transmission={decryptingTransmission}
          onClose={handleDecryptClose}
          onSuccess={handleDecryptClose}
        />
      )}
    </div>
  );
}
