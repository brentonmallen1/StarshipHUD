import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { themeApi, ThemeSettings } from '../services/api';

// Font options available for selection
export const FONT_DISPLAY_OPTIONS = [
  { value: 'Science Gothic', label: 'Science Gothic' },
  { value: 'Orbitron', label: 'Orbitron' },
  { value: 'Space Grotesk', label: 'Space Grotesk' },
] as const;

export const FONT_MONO_OPTIONS = [
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Fira Code', label: 'Fira Code' },
] as const;

// Default theme settings
const DEFAULT_THEME: ThemeSettings = {
  font_display: 'Science Gothic',
  font_mono: 'JetBrains Mono',
  accent_primary: '#58a6ff',
  accent_secondary: '#C48F4A',
};

interface ThemeContextType {
  theme: ThemeSettings;
  isLoading: boolean;
  updateTheme: (settings: Partial<ThemeSettings>) => Promise<void>;
  resetTheme: () => Promise<void>;
}

// Create context with default values
export const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  isLoading: true,
  updateTheme: async () => {},
  resetTheme: async () => {},
});

// Apply theme settings to CSS variables
function applyThemeToDOM(settings: ThemeSettings) {
  const root = document.documentElement;

  // Font family
  root.style.setProperty('--font-display', `'${settings.font_display}', sans-serif`);
  root.style.setProperty('--font-mono', `'${settings.font_mono}', monospace`);

  // Accent colors
  root.style.setProperty('--color-accent-cyan', settings.accent_primary);
  root.style.setProperty('--theme-accent-primary', settings.accent_primary);
  root.style.setProperty('--theme-accent-secondary', settings.accent_secondary);
  root.style.setProperty('--color-optimal', settings.accent_secondary);

  // Update glow effects based on accent color
  const accentRgb = hexToRgb(settings.accent_primary);
  if (accentRgb) {
    root.style.setProperty(
      '--glow-accent',
      `0 0 10px rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.3)`
    );
  }
}

// Helper to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Provider component
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from backend on mount
  useEffect(() => {
    themeApi
      .get()
      .then((settings) => {
        setTheme(settings);
        applyThemeToDOM(settings);
      })
      .catch((err) => {
        console.warn('Failed to load theme settings, using defaults:', err);
        applyThemeToDOM(DEFAULT_THEME);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Update theme settings
  const updateTheme = useCallback(async (newSettings: Partial<ThemeSettings>) => {
    const merged = { ...theme, ...newSettings };

    // Optimistically apply to DOM
    applyThemeToDOM(merged);
    setTheme(merged);

    // Persist to backend
    try {
      await themeApi.set(merged);
    } catch (err) {
      console.error('Failed to save theme settings:', err);
      // Revert on error
      applyThemeToDOM(theme);
      setTheme(theme);
      throw err;
    }
  }, [theme]);

  // Reset theme to defaults
  const resetTheme = useCallback(async () => {
    try {
      const defaults = await themeApi.reset();
      setTheme(defaults);
      applyThemeToDOM(defaults);
    } catch (err) {
      console.error('Failed to reset theme settings:', err);
      throw err;
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isLoading, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to access theme context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
