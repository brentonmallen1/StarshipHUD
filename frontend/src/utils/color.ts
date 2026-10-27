/**
 * Resolve a CSS colour that may be a `var(--token, fallback)` reference into a
 * concrete value, for canvas and other APIs that can't evaluate `var()`.
 * Reads the token from the document root so user theme overrides apply; uses
 * the inline fallback (or `defaultColor`) when the token isn't set.
 */
export function resolveCssColor(cssColor: string, defaultColor = '#00d4ff'): string {
  const match = cssColor.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (!match) return cssColor;
  if (typeof document !== 'undefined') {
    const live = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
    if (live) return live;
  }
  return match[2]?.trim() || defaultColor;
}
