import { useState, useRef, useEffect } from 'react';
import type { SystemStatus } from '../../types';
import './InlineEditControls.css';

// ============================================================================
// STATUS DROPDOWN
// ============================================================================

interface StatusDropdownProps {
  value: SystemStatus;
  onChange: (newStatus: SystemStatus) => void;
  disabled?: boolean;
}

const STATUS_LABELS: Record<SystemStatus, string> = {
  fully_operational: 'Fully Operational',
  operational: 'Operational',
  degraded: 'Degraded',
  compromised: 'Compromised',
  critical: 'Critical',
  destroyed: 'Destroyed',
  offline: 'Offline',
};

export function StatusDropdown({ value, onChange, disabled = false }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Calculate menu position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

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

  const handleSelect = (newStatus: SystemStatus) => {
    onChange(newStatus);
    setIsOpen(false);
  };

  return (
    <div className="status-dropdown" ref={dropdownRef}>
      <button
        ref={triggerRef}
        className={`status-dropdown-trigger status-badge status-${value}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        type="button"
      >
        <span className="status-label">{STATUS_LABELS[value]}</span>
        {!disabled && <span className="status-caret">{isOpen ? '▲' : '▼'}</span>}
      </button>

      {isOpen && (
        <div
          className="status-dropdown-menu"
          style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
        >
          {Object.entries(STATUS_LABELS).map(([statusKey, label]) => (
            <button
              key={statusKey}
              className={`status-dropdown-option status-${statusKey} ${
                statusKey === value ? 'active' : ''
              }`}
              onClick={() => handleSelect(statusKey as SystemStatus)}
              type="button"
            >
              <span className="status-indicator" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NUMERIC SPINNER
// ============================================================================

interface NumericSpinnerProps {
  value: number;
  onChange: (newValue: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
}

export function NumericSpinner({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  disabled = false,
  suffix,
}: NumericSpinnerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const handleIncrement = () => {
    const newValue = Math.min(value + step, max);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(value - step, min);
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const numValue = Number(inputValue);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(min, Math.min(max, numValue));
      onChange(clampedValue);
    }
    setInputValue(String(value));
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    } else if (e.key === 'Escape') {
      setInputValue(String(value));
      setIsEditing(false);
    }
  };

  const handleValueClick = () => {
    if (!disabled) {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  };

  // Sync input value when prop value changes externally
  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(value));
    }
  }, [value, isEditing]);

  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <div className={`numeric-spinner ${disabled ? 'disabled' : ''}`}>
      <button
        className="spinner-btn spinner-decrement"
        onClick={handleDecrement}
        disabled={disabled || !canDecrement}
        type="button"
        title="Decrease"
      >
        −
      </button>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="spinner-input"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
        />
      ) : (
        <div className="spinner-value" onClick={handleValueClick}>
          {value}
          {suffix && <span className="spinner-suffix">{suffix}</span>}
        </div>
      )}

      <button
        className="spinner-btn spinner-increment"
        onClick={handleIncrement}
        disabled={disabled || !canIncrement}
        type="button"
        title="Increase"
      >
        +
      </button>
    </div>
  );
}

// ============================================================================
// TOGGLE SWITCH
// ============================================================================

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (newValue: boolean) => void;
  disabled?: boolean;
  label?: string;
  trueLabel?: string;
  falseLabel?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  trueLabel = 'ON',
  falseLabel = 'OFF',
}: ToggleSwitchProps) {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div className={`toggle-switch ${disabled ? 'disabled' : ''}`}>
      {label && <span className="toggle-label">{label}</span>}
      <button
        className={`toggle-button ${checked ? 'checked' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        type="button"
        role="switch"
        aria-checked={checked}
      >
        <span className="toggle-track">
          <span className="toggle-thumb" />
        </span>
        <span className="toggle-state-label">{checked ? trueLabel : falseLabel}</span>
      </button>
    </div>
  );
}
