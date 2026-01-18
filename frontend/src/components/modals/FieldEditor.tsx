import { useState } from 'react';
import './FieldEditor.css';

type FieldType = 'text' | 'number' | 'textarea' | 'enum' | 'tags' | 'boolean' | 'datetime';
type FieldPermission = 'read' | 'edit';

interface FieldEditorProps {
  label: string;
  fieldName: string;
  value: unknown;
  fieldType: FieldType;
  permission: FieldPermission;
  onChange: (value: unknown) => void;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

/**
 * FieldEditor - Dynamic field renderer for PlayerEditModal
 *
 * Renders appropriate input based on field type and respects permissions.
 */
export function FieldEditor({
  label,
  fieldName: _fieldName,
  value,
  fieldType,
  permission,
  onChange,
  options = [],
  placeholder,
  min,
  max,
  step,
  required = false,
  error,
  disabled = false,
}: FieldEditorProps) {
  const [tagInput, setTagInput] = useState('');
  const isReadOnly = permission === 'read' || disabled;

  // Convert value to appropriate type
  const stringValue = value !== null && value !== undefined ? String(value) : '';
  const numberValue = typeof value === 'number' ? value : 0;
  const booleanValue = Boolean(value);
  const arrayValue = Array.isArray(value) ? value : [];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (fieldType === 'number') {
      const numValue = e.target.value === '' ? 0 : Number(e.target.value);
      onChange(numValue);
    } else {
      onChange(e.target.value);
    }
  };

  const handleBooleanChange = (checked: boolean) => {
    onChange(checked);
  };

  const handleTagAdd = () => {
    if (tagInput.trim() && !arrayValue.includes(tagInput.trim())) {
      onChange([...arrayValue, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleTagRemove = (tagToRemove: string) => {
    onChange(arrayValue.filter((tag) => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTagAdd();
    }
  };

  return (
    <div className={`field-editor ${error ? 'has-error' : ''}`}>
      <label className="field-label">
        {label}
        {required && <span className="field-required">*</span>}
        {isReadOnly && <span className="field-readonly-badge">READ ONLY</span>}
      </label>

      <div className="field-input-wrapper">
        {/* Text Input */}
        {fieldType === 'text' && (
          <input
            type="text"
            className="field-input"
            value={stringValue}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={isReadOnly}
            required={required}
          />
        )}

        {/* Number Input */}
        {fieldType === 'number' && (
          <input
            type="number"
            className="field-input field-input-number"
            value={numberValue}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={isReadOnly}
            required={required}
            min={min}
            max={max}
            step={step}
          />
        )}

        {/* Textarea */}
        {fieldType === 'textarea' && (
          <textarea
            className="field-input field-textarea"
            value={stringValue}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={isReadOnly}
            required={required}
            rows={4}
          />
        )}

        {/* Enum Dropdown */}
        {fieldType === 'enum' && (
          <select
            className="field-input field-select"
            value={stringValue}
            onChange={handleChange}
            disabled={isReadOnly}
            required={required}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {/* Boolean Toggle */}
        {fieldType === 'boolean' && (
          <button
            type="button"
            className={`field-boolean-toggle ${booleanValue ? 'active' : ''}`}
            onClick={() => !isReadOnly && handleBooleanChange(!booleanValue)}
            disabled={isReadOnly}
          >
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-label">{booleanValue ? 'YES' : 'NO'}</span>
          </button>
        )}

        {/* Tags Input */}
        {fieldType === 'tags' && (
          <div className="field-tags">
            <div className="tags-list">
              {arrayValue.map((tag: string) => (
                <span key={tag} className="tag">
                  {tag}
                  {!isReadOnly && (
                    <button
                      type="button"
                      className="tag-remove"
                      onClick={() => handleTagRemove(tag)}
                      aria-label={`Remove ${tag}`}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!isReadOnly && (
              <div className="tags-input-row">
                <input
                  type="text"
                  className="field-input tags-input"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder="Add tag..."
                />
                <button
                  type="button"
                  className="tags-add-btn"
                  onClick={handleTagAdd}
                  disabled={!tagInput.trim()}
                >
                  + Add
                </button>
              </div>
            )}
          </div>
        )}

        {/* Datetime Input */}
        {fieldType === 'datetime' && (
          <input
            type="datetime-local"
            className="field-input"
            value={stringValue}
            onChange={handleChange}
            disabled={isReadOnly}
            required={required}
          />
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="field-error">
          <span className="error-icon">⚠</span>
          {error}
        </div>
      )}
    </div>
  );
}

// Predefined options for common field types
export const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'optimal', label: 'Optimal' },
  { value: 'operational', label: 'Operational' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'compromised', label: 'Compromised' },
  { value: 'critical', label: 'Critical' },
  { value: 'destroyed', label: 'Destroyed' },
  { value: 'offline', label: 'Offline' },
];

export const ASSET_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'energy_weapon', label: 'Energy Weapon' },
  { value: 'torpedo', label: 'Torpedo' },
  { value: 'missile', label: 'Missile' },
  { value: 'railgun', label: 'Railgun' },
  { value: 'laser', label: 'Laser' },
  { value: 'particle_beam', label: 'Particle Beam' },
  { value: 'drone', label: 'Drone' },
  { value: 'probe', label: 'Probe' },
];

export const FIRE_MODE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'single', label: 'Single' },
  { value: 'burst', label: 'Burst' },
  { value: 'sustained', label: 'Sustained' },
  { value: 'auto', label: 'Auto' },
];

export const MOUNT_LOCATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'port', label: 'Port' },
  { value: 'starboard', label: 'Starboard' },
  { value: 'dorsal', label: 'Dorsal' },
  { value: 'ventral', label: 'Ventral' },
  { value: 'fore', label: 'Fore' },
  { value: 'aft', label: 'Aft' },
];

export const THREAT_LEVEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'suspicious', label: 'Suspicious' },
  { value: 'hostile', label: 'Hostile' },
  { value: 'critical_threat', label: 'Critical Threat' },
];
