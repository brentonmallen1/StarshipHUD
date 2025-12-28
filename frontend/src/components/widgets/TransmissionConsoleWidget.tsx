import { useRef, useEffect, useState } from 'react';
import type { WidgetRendererProps } from '../../types';
import { useTransmissions } from '../../hooks/useShipData';
import { useUntransmitTransmission } from '../../hooks/useMutations';
import './TransmissionConsoleWidget.css';

// Transmission channel types and their display properties
const CHANNEL_CONFIG: Record<string, { icon: string; label: string; className: string }> = {
  distress: { icon: '🔴', label: 'DISTRESS', className: 'channel-distress' },
  hail: { icon: '📡', label: 'HAIL', className: 'channel-hail' },
  internal: { icon: '🔊', label: 'INTERNAL', className: 'channel-internal' },
  broadcast: { icon: '📢', label: 'BROADCAST', className: 'channel-broadcast' },
  encrypted: { icon: '🔒', label: 'ENCRYPTED', className: 'channel-encrypted' },
  unknown: { icon: '❓', label: 'UNKNOWN', className: 'channel-unknown' },
};

interface TransmissionData {
  sender_id?: string;
  sender_name: string;
  channel: string;
  encrypted: boolean;
  signal_strength: number;
  frequency?: string;
  text: string;
}

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

  const { data: transmissions, isLoading } = useTransmissions(shipId, maxMessages * 2);
  const untransmitTransmission = useUntransmitTransmission();

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
              <div className={`transmission-text ${isEncrypted ? 'encrypted' : ''}`}>
                {isEncrypted ? (
                  <span className="encrypted-message">
                    [ENCRYPTED - DECRYPTION REQUIRED]
                  </span>
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
              <div className="transmission-actions">
                {clearConfirmId === event.id ? (
                  <div className="clear-confirm">
                    <span className="clear-confirm-text">Clear this transmission?</span>
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
                    ✕ Clear
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
