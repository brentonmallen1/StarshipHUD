/**
 * Shared placeholder deck plan SVG component.
 * Used by both player HolomapWidget and admin AdminHolomap editor.
 */

// Placeholder deck plan compartments for generated SVG
const DECK_COMPARTMENTS: Record<string, { x: number; y: number; width: number; height: number; label: string }[]> = {
  '1': [
    { x: 0.35, y: 0.05, width: 0.3, height: 0.2, label: 'Bridge' },
    { x: 0.15, y: 0.25, width: 0.25, height: 0.2, label: 'Sensor Bay' },
    { x: 0.6, y: 0.25, width: 0.25, height: 0.2, label: 'Comms' },
    { x: 0.3, y: 0.45, width: 0.4, height: 0.25, label: 'Crew Quarters' },
    { x: 0.2, y: 0.7, width: 0.6, height: 0.25, label: 'Life Support' },
  ],
  '2': [
    { x: 0.25, y: 0.05, width: 0.5, height: 0.25, label: 'Operations' },
    { x: 0.1, y: 0.35, width: 0.35, height: 0.3, label: 'Cargo Bay A' },
    { x: 0.55, y: 0.35, width: 0.35, height: 0.3, label: 'Cargo Bay B' },
    { x: 0.3, y: 0.7, width: 0.4, height: 0.25, label: 'Armory' },
  ],
  '3': [
    { x: 0.2, y: 0.05, width: 0.6, height: 0.35, label: 'Main Engineering' },
    { x: 0.1, y: 0.45, width: 0.35, height: 0.25, label: 'Reactor Core' },
    { x: 0.55, y: 0.45, width: 0.35, height: 0.25, label: 'Power Grid' },
    { x: 0.25, y: 0.75, width: 0.5, height: 0.2, label: 'Fuel Storage' },
  ],
  '4': [
    { x: 0.1, y: 0.1, width: 0.35, height: 0.35, label: 'Cargo Hold 1' },
    { x: 0.55, y: 0.1, width: 0.35, height: 0.35, label: 'Cargo Hold 2' },
    { x: 0.1, y: 0.55, width: 0.35, height: 0.35, label: 'Cargo Hold 3' },
    { x: 0.55, y: 0.55, width: 0.35, height: 0.35, label: 'Cargo Hold 4' },
  ],
};

// Default deck layout for unknown decks
const DEFAULT_COMPARTMENTS = [
  { x: 0.1, y: 0.1, width: 0.8, height: 0.35, label: 'Forward Section' },
  { x: 0.1, y: 0.55, width: 0.8, height: 0.35, label: 'Aft Section' },
];

interface PlaceholderDeckPlanProps {
  deckLevel?: string;
  className?: string;
}

export function PlaceholderDeckPlan({ deckLevel, className }: PlaceholderDeckPlanProps) {
  const compartments = DECK_COMPARTMENTS[deckLevel || ''] || DEFAULT_COMPARTMENTS;

  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      {/* Background grid */}
      <defs>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--color-border)" strokeWidth="0.2" opacity="0.3" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="var(--color-background-dark)" />
      <rect width="100" height="100" fill="url(#grid)" />

      {/* Ship outline */}
      <path
        d="M 50 2 L 85 25 L 90 75 L 75 95 L 25 95 L 10 75 L 15 25 Z"
        fill="none"
        stroke="var(--color-accent-cyan)"
        strokeWidth="0.5"
        opacity="0.5"
      />

      {/* Compartments */}
      {compartments.map((comp, i) => (
        <g key={i}>
          <rect
            x={comp.x * 100}
            y={comp.y * 100}
            width={comp.width * 100}
            height={comp.height * 100}
            fill="var(--color-background)"
            stroke="var(--color-border)"
            strokeWidth="0.3"
            rx="1"
          />
          <text
            x={(comp.x + comp.width / 2) * 100}
            y={(comp.y + comp.height / 2) * 100}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--color-text-dim)"
            fontSize="3"
            fontFamily="var(--font-mono)"
          >
            {comp.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
