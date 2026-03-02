import { useState } from 'react';
import { useTheme, FONT_DISPLAY_OPTIONS, FONT_MONO_OPTIONS } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import './AdminSettings.css';

export function AdminSettings() {
  const { theme, updateTheme, resetTheme, isLoading } = useTheme();
  const { addToast } = useToast();

  // Local state for form
  const [fontDisplay, setFontDisplay] = useState(theme.font_display);
  const [fontMono, setFontMono] = useState(theme.font_mono);
  const [accentPrimary, setAccentPrimary] = useState(theme.accent_primary);
  const [accentSecondary, setAccentSecondary] = useState(theme.accent_secondary);
  const [isSaving, setIsSaving] = useState(false);

  // Check if there are unsaved changes
  const hasChanges =
    fontDisplay !== theme.font_display ||
    fontMono !== theme.font_mono ||
    accentPrimary !== theme.accent_primary ||
    accentSecondary !== theme.accent_secondary;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateTheme({
        font_display: fontDisplay,
        font_mono: fontMono,
        accent_primary: accentPrimary,
        accent_secondary: accentSecondary,
      });
      addToast({ message: 'Theme settings saved', type: 'success' });
    } catch {
      addToast({ message: 'Failed to save theme settings', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await resetTheme();
      // Update local state to match defaults
      setFontDisplay('Science Gothic');
      setFontMono('JetBrains Mono');
      setAccentPrimary('#58a6ff');
      setAccentSecondary('#00ffcc');
      addToast({ message: 'Theme reset to defaults', type: 'success' });
    } catch {
      addToast({ message: 'Failed to reset theme', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Live preview: update CSS as user changes values
  const handleFontDisplayChange = (value: string) => {
    setFontDisplay(value);
    document.documentElement.style.setProperty('--font-display', `'${value}', sans-serif`);
  };

  const handleFontMonoChange = (value: string) => {
    setFontMono(value);
    document.documentElement.style.setProperty('--font-mono', `'${value}', monospace`);
  };

  const handleAccentPrimaryChange = (value: string) => {
    setAccentPrimary(value);
    document.documentElement.style.setProperty('--color-accent-cyan', value);
    document.documentElement.style.setProperty('--theme-accent-primary', value);
  };

  const handleAccentSecondaryChange = (value: string) => {
    setAccentSecondary(value);
    document.documentElement.style.setProperty('--color-optimal', value);
    document.documentElement.style.setProperty('--theme-accent-secondary', value);
  };

  if (isLoading) {
    return (
      <div className="admin-page admin-settings">
        <div className="admin-loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="admin-page admin-settings">
      <div className="admin-header-row">
        <h2 className="admin-page-title">Settings</h2>
        <div className="settings-actions">
          <button
            className="btn btn-ghost"
            onClick={handleReset}
            disabled={isSaving}
          >
            Reset to Defaults
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="settings-content">
        {/* Typography Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">Typography</h3>
          <div className="settings-grid">
            <div className="settings-field">
              <label htmlFor="font-display">Display Font</label>
              <select
                id="font-display"
                value={fontDisplay}
                onChange={(e) => handleFontDisplayChange(e.target.value)}
              >
                {FONT_DISPLAY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="settings-hint">Used for titles and headings</span>
            </div>

            <div className="settings-field">
              <label htmlFor="font-mono">Monospace Font</label>
              <select
                id="font-mono"
                value={fontMono}
                onChange={(e) => handleFontMonoChange(e.target.value)}
              >
                {FONT_MONO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="settings-hint">Used for data, labels, and UI elements</span>
            </div>
          </div>

          {/* Font Preview */}
          <div className="font-preview">
            <div className="font-preview-item">
              <span className="font-preview-label">Display:</span>
              <span className="font-preview-display" style={{ fontFamily: `'${fontDisplay}', sans-serif` }}>
                STARSHIP HUD
              </span>
            </div>
            <div className="font-preview-item">
              <span className="font-preview-label">Mono:</span>
              <span className="font-preview-mono" style={{ fontFamily: `'${fontMono}', monospace` }}>
                SYSTEM STATUS: OPERATIONAL
              </span>
            </div>
          </div>
        </section>

        {/* Colors Section */}
        <section className="settings-section">
          <h3 className="settings-section-title">Colors</h3>
          <div className="settings-grid">
            <div className="settings-field">
              <label htmlFor="accent-primary">Primary Accent</label>
              <div className="color-input-row">
                <input
                  type="color"
                  id="accent-primary"
                  value={accentPrimary}
                  onChange={(e) => handleAccentPrimaryChange(e.target.value)}
                />
                <input
                  type="text"
                  value={accentPrimary}
                  onChange={(e) => handleAccentPrimaryChange(e.target.value)}
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <span className="settings-hint">Buttons, links, and active states</span>
            </div>

            <div className="settings-field">
              <label htmlFor="accent-secondary">Secondary Accent</label>
              <div className="color-input-row">
                <input
                  type="color"
                  id="accent-secondary"
                  value={accentSecondary}
                  onChange={(e) => handleAccentSecondaryChange(e.target.value)}
                />
                <input
                  type="text"
                  value={accentSecondary}
                  onChange={(e) => handleAccentSecondaryChange(e.target.value)}
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <span className="settings-hint">Optimal status and highlights</span>
            </div>
          </div>

          {/* Color Preview */}
          <div className="color-preview">
            <div
              className="color-preview-swatch"
              style={{ backgroundColor: accentPrimary }}
            >
              <span>Primary</span>
            </div>
            <div
              className="color-preview-swatch"
              style={{ backgroundColor: accentSecondary }}
            >
              <span>Secondary</span>
            </div>
            <div className="color-preview-button">
              <button
                className="btn btn-primary"
                style={{
                  borderColor: accentPrimary,
                }}
              >
                Sample Button
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
