import { useState, useEffect } from 'react';
import type { ShipEvent, TransmissionChannel, TransmissionData, DecryptionDifficulty } from '../../types';
import { generateSeed } from '../minigames/useMinigameSeed';
import './TransmissionFormModal.css';

interface TransmissionFormModalProps {
  transmission?: ShipEvent;
  shipId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TransmissionFormData) => void;
  isSaving?: boolean;
}

export interface TransmissionFormData {
  sender_name: string;
  channel: TransmissionChannel;
  encrypted: boolean;
  signal_strength: number;
  frequency: string;
  text: string;
  // Minigame fields
  difficulty?: DecryptionDifficulty;
  minigame_seed?: number;
}

const DIFFICULTY_OPTIONS: { value: DecryptionDifficulty; label: string; hint: string }[] = [
  { value: 'easy', label: 'Easy', hint: 'Packet Reassembly - drag packets into order (45-90s)' },
  { value: 'medium', label: 'Medium', hint: 'Frequency Hopper - track signal across channels (60-120s)' },
  { value: 'hard', label: 'Hard', hint: 'Constellation Calibrator - align signal parameters (90-180s)' },
];

const CHANNEL_OPTIONS: { value: TransmissionChannel; label: string }[] = [
  { value: 'hail', label: 'Hail' },
  { value: 'broadcast', label: 'Broadcast' },
  { value: 'distress', label: 'Distress' },
  { value: 'internal', label: 'Internal' },
  { value: 'encrypted', label: 'Encrypted' },
  { value: 'unknown', label: 'Unknown' },
];

export function TransmissionFormModal({
  transmission,
  isOpen,
  onClose,
  onSave,
  isSaving,
}: TransmissionFormModalProps) {
  const isEditing = !!transmission;

  const [senderName, setSenderName] = useState('');
  const [channel, setChannel] = useState<TransmissionChannel>('hail');
  const [encrypted, setEncrypted] = useState(false);
  const [signalStrength, setSignalStrength] = useState(100);
  const [frequency, setFrequency] = useState('');
  const [text, setText] = useState('');
  const [difficulty, setDifficulty] = useState<DecryptionDifficulty>('easy');
  const [minigameSeed, setMinigameSeed] = useState<number | undefined>();

  useEffect(() => {
    if (isOpen) {
      const data = transmission?.data as unknown as TransmissionData | undefined;
      setSenderName(data?.sender_name ?? '');
      setChannel(data?.channel ?? 'hail');
      setEncrypted(data?.encrypted ?? false);
      setSignalStrength(data?.signal_strength ?? 100);
      setFrequency(data?.frequency ?? '');
      setText(data?.text ?? '');
      setDifficulty(data?.difficulty ?? 'easy');
      setMinigameSeed(data?.minigame_seed);
    }
  }, [transmission, isOpen]);

  // Auto-generate seed when encrypting for the first time
  useEffect(() => {
    if (encrypted && !minigameSeed) {
      setMinigameSeed(generateSeed());
    }
  }, [encrypted, minigameSeed]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      sender_name: senderName,
      channel,
      encrypted,
      signal_strength: signalStrength,
      frequency,
      text,
      // Only include minigame fields if encrypted
      difficulty: encrypted ? difficulty : undefined,
      minigame_seed: encrypted ? minigameSeed : undefined,
    });
  };

  const isValid = senderName.trim().length > 0 && text.trim().length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content transmission-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Transmission' : 'Create Transmission'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-section">
              <h3>Transmission Details</h3>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="sender-name">Sender Name *</label>
                  <input
                    id="sender-name"
                    type="text"
                    value={senderName}
                    onChange={e => setSenderName(e.target.value)}
                    placeholder="e.g., Station Alpha"
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="channel">Channel</label>
                  <select
                    id="channel"
                    value={channel}
                    onChange={e => setChannel(e.target.value as TransmissionChannel)}
                  >
                    {CHANNEL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="signal-strength">Signal Strength (%)</label>
                  <input
                    id="signal-strength"
                    type="number"
                    min={0}
                    max={100}
                    value={signalStrength}
                    onChange={e => setSignalStrength(Number(e.target.value))}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="frequency">Frequency</label>
                  <input
                    id="frequency"
                    type="text"
                    value={frequency}
                    onChange={e => setFrequency(e.target.value)}
                    placeholder="e.g., 127.3 MHz"
                  />
                </div>
                <div className="form-field form-field-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={encrypted}
                      onChange={e => setEncrypted(e.target.checked)}
                    />
                    Encrypted
                  </label>
                  <span className="form-hint">
                    Encrypted messages require players to complete a minigame to decrypt
                  </span>
                </div>
              </div>

              {encrypted && (
                <div className="encryption-settings">
                  <h4>Decryption Minigame</h4>
                  <div className="form-field">
                    <label htmlFor="difficulty">Difficulty</label>
                    <select
                      id="difficulty"
                      value={difficulty}
                      onChange={e => setDifficulty(e.target.value as DecryptionDifficulty)}
                    >
                      {DIFFICULTY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <span className="form-hint difficulty-hint">
                      {DIFFICULTY_OPTIONS.find(o => o.value === difficulty)?.hint}
                    </span>
                  </div>
                  {minigameSeed && (
                    <div className="seed-display">
                      <span className="seed-label">Puzzle Seed:</span>
                      <code className="seed-value">{minigameSeed}</code>
                      <button
                        type="button"
                        className="btn btn-small btn-ghost"
                        onClick={() => setMinigameSeed(generateSeed())}
                        title="Generate new puzzle"
                      >
                        Regenerate
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="form-field" style={{ marginTop: '16px' }}>
                <label htmlFor="text">Message Text *</label>
                <textarea
                  id="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={4}
                  placeholder="Enter the transmission message..."
                  required
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isValid || isSaving}
            >
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
