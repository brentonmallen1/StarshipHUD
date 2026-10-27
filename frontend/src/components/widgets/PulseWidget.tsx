import { useRef, useEffect } from 'react';
import type { WidgetRendererProps } from '../../types';
import { getConfig, PULSE_DEFAULTS, type PulseConfig, type PulseOrigin } from '../../types';
import { resolveCssColor } from '../../utils/color';
import './PulseWidget.css';

const THICKNESS_PX = { thin: 1, normal: 2, thick: 3 } as const;
const GLOW_BLUR = { low: 4, medium: 10, high: 20 } as const;
const GLOW_ALPHA = { low: 0.15, medium: 0.25, high: 0.4 } as const;
const PING_LIFESPAN = 3; // seconds

/** Map origin name to (x, y) coordinates at the widget boundary */
function getOriginPoint(origin: PulseOrigin, w: number, h: number): [number, number] {
  switch (origin) {
    case 'top':          return [w / 2, 0];
    case 'bottom':       return [w / 2, h];
    case 'left':         return [0, h / 2];
    case 'right':        return [w, h / 2];
    case 'top-left':     return [0, 0];
    case 'top-right':    return [w, 0];
    case 'bottom-left':  return [0, h];
    case 'bottom-right': return [w, h];
  }
}

/** Max distance from origin to any corner of the widget */
function getMaxRadius(ox: number, oy: number, w: number, h: number): number {
  return Math.max(
    Math.hypot(ox, oy),
    Math.hypot(ox - w, oy),
    Math.hypot(ox, oy - h),
    Math.hypot(ox - w, oy - h),
  );
}

export function PulseWidget({ instance, isEditing }: WidgetRendererProps) {
  const config = getConfig<PulseConfig>(instance.config);
  const D = PULSE_DEFAULTS;
  const origin = config.origin ?? D.origin;
  const color = config.color ?? D.color;
  const pingFrequency = config.ping_frequency ?? D.ping_frequency;
  const glow = config.glow ?? D.glow;
  const thickness = config.thickness ?? D.thickness;
  const effect = config.effect ?? D.effect;
  const showGrid = config.show_grid ?? D.show_grid;
  const frequencyVariance = config.frequency_variance ?? D.frequency_variance;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const pingsRef = useRef<number[]>([]);
  const lastPingRef = useRef<number>(0);
  const nextIntervalRef = useRef<number>(pingFrequency);

  useEffect(() => {
    if (isEditing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resolvedColor = resolveCssColor(color);
    const lineWidth = THICKNESS_PX[thickness] ?? 2;
    const glowBlur = GLOW_BLUR[glow] ?? 10;
    const glowAlpha = GLOW_ALPHA[glow] ?? 0.25;

    startTimeRef.current = performance.now() / 1000;
    pingsRef.current = [];
    lastPingRef.current = 0;

    const draw = (timestamp: number) => {
      const now = timestamp / 1000;
      const elapsed = now - startTimeRef.current;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const [ox, oy] = getOriginPoint(origin, w, h);
      const maxRadius = getMaxRadius(ox, oy, w, h);

      ctx.clearRect(0, 0, w, h);

      // --- Effect modifiers ---
      let opacity = 1;
      switch (effect) {
        case 'flicker': {
          const p = (elapsed * 1.25) % 1;
          if (p < 0.15) opacity = 0.4;
          else if (p < 0.3) opacity = 0.9;
          else if (p < 0.45) opacity = 0.5;
          else if (p < 0.6) opacity = 1;
          else if (p < 0.75) opacity = 0.6;
          else if (p < 0.9) opacity = 0.85;
          break;
        }
        case 'jitter':
          // Slight radius wobble — handled per-ring below
          break;
        case 'pulse':
          opacity = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(elapsed * (2 * Math.PI / 1.5)));
          break;
        case 'strobe':
          opacity = ((elapsed / 0.3) % 1) < 0.5 ? 1 : 0;
          break;
      }

      // --- Grid: faint concentric arcs from origin ---
      if (showGrid) {
        ctx.strokeStyle = 'rgba(110, 118, 129, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        const gridSpacing = 40;
        const gridCount = Math.ceil(maxRadius / gridSpacing);
        for (let i = 1; i <= gridCount; i++) {
          ctx.beginPath();
          ctx.arc(ox, oy, i * gridSpacing, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }

      // --- Spawn new pings (with optional variance) ---
      if (elapsed - lastPingRef.current >= nextIntervalRef.current) {
        pingsRef.current.push(elapsed);
        lastPingRef.current = elapsed;
        // Calculate next interval with variance
        const varianceOffset = frequencyVariance * pingFrequency * (Math.random() - 0.5) * 2;
        nextIntervalRef.current = pingFrequency + varianceOffset;
      }

      // --- Draw pulse rings ---
      pingsRef.current = pingsRef.current.filter((birthTime) => {
        const age = elapsed - birthTime;
        if (age > PING_LIFESPAN) return false;

        const progress = age / PING_LIFESPAN;
        let pingRadius = progress * maxRadius;
        const alpha = (1 - progress) * 0.6 * opacity;

        // Jitter effect: slight radius wobble
        if (effect === 'jitter') {
          pingRadius += Math.sin(elapsed * (2 * Math.PI / 0.15)) * 2;
        }

        // Glow pass
        ctx.save();
        ctx.globalAlpha = alpha * glowAlpha * 2;
        ctx.strokeStyle = resolvedColor;
        ctx.lineWidth = lineWidth + 4;
        ctx.shadowColor = resolvedColor;
        ctx.shadowBlur = glowBlur;
        ctx.beginPath();
        ctx.arc(ox, oy, Math.max(0, pingRadius), 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();

        // Crisp pass
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = resolvedColor;
        ctx.lineWidth = lineWidth;
        ctx.shadowColor = resolvedColor;
        ctx.shadowBlur = glowBlur * 0.3;
        ctx.beginPath();
        ctx.arc(ox, oy, Math.max(0, pingRadius), 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();

        return true;
      });

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isEditing, origin, color, pingFrequency, glow, thickness, effect, showGrid, frequencyVariance]);

  if (isEditing) {
    return (
      <div className="pulse-widget pulse-widget--editing">
        <span className="pulse-widget__label">PULSE</span>
        <span className="pulse-widget__hint">Expanding rings from edge</span>
      </div>
    );
  }

  return (
    <div className="pulse-widget">
      <canvas ref={canvasRef} className="pulse-widget__canvas" />
    </div>
  );
}
