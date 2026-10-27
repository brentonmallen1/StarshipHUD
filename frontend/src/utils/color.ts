/**
 * Resolve a CSS colour that may be a `var(--token, fallback)` reference into a
 * concrete value, for canvas and other APIs that can't evaluate `var()`.
 * Reads the token from the document root so user theme overrides apply; uses
 * the inline fallback (or `defaultColor`, else the theme accent) when the token isn't set.
 */
export function resolveCssColor(cssColor: string, defaultColor?: string): string {
  const match = cssColor.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (!match) return cssColor;
  if (typeof document !== 'undefined') {
    const live = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
    if (live) return live;
  }
  return match[2]?.trim() || defaultColor || tokenColor('--color-accent-cyan');
}

const tokenCache = new Map<string, string>();
let probe: HTMLElement | null = null;

/**
 * Concrete colour of a design token, optionally faded, for canvas and SVG
 * attributes (neither can evaluate `var()`). Follows the active ship theme.
 */
export function tokenColor(token: string, alpha = 1): string {
  if (typeof document === 'undefined') return 'transparent';
  const root = document.documentElement;
  // Ship theme, user overrides and posture all change what a token resolves to
  const key = `${token}|${alpha}|${root.dataset.theme ?? ''}|${root.getAttribute('style') ?? ''}|${document.body.className}`;
  const cached = tokenCache.get(key);
  if (cached) return cached;
  if (!getComputedStyle(root).getPropertyValue(token).trim()) return 'transparent'; // styles not loaded yet; don't cache
  if (!probe) {
    probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.appendChild(probe);
  }
  probe.style.color = alpha >= 1 ? `var(${token})` : `color-mix(in srgb, var(${token}) ${alpha * 100}%, transparent)`;
  const value = getComputedStyle(probe).color;
  tokenCache.set(key, value);
  return value;
}
