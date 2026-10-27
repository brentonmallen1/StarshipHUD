import type { CargoCategory } from '../../../types';

/** Short tile label: initials for multi-word names, else the first letters. */
export function abbreviateName(name: string, maxLen = 3): string {
  const words = name.split(/[\s\-_]+/);
  if (words.length > 1) {
    return words.map((w) => w[0]).join('').toUpperCase().slice(0, maxLen);
  }
  return name.slice(0, maxLen).toUpperCase();
}

/** Cargo colour: item colour → category colour → muted default. */
export function getCargoColor(
  cargo: { color?: string; category_color?: string; category_id?: string },
  categoryMap?: Map<string, CargoCategory>
): string {
  if (cargo.color) return cargo.color;
  if (cargo.category_color) return cargo.category_color;
  if (cargo.category_id && categoryMap) {
    const cat = categoryMap.get(cargo.category_id);
    if (cat) return cat.color;
  }
  return 'var(--color-text-muted)';
}
