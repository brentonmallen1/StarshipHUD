import { useRef, useEffect } from 'react';
import type { WidgetRendererProps } from '../../types';
import './RadarPingWidget.css';

interface RadarPingConfig {
  mode?: 'sweep' | 'pulse' | 'both';
  speed?: number;
  color?: string;
  direction?: 'cw' | 'ccw';
  glow?: 'low' | 'medium' | 'high';
  thickness?: 'thin' | 'normal' | 'thick';
  effect?: 'none' | 'flicker' | 'jitter' | 'pulse' | 'strobe';
  show_grid?: boolean;
  ping_frequency?: number;
  hide_border?: boolean;
}

const THICKNESS_PX = { thin: 1, normal: 2, thick: 3 } as const;
const GLOW_BLUR = { low: 4, medium: 10, high: 20 } as const;
const GLOW_ALPHA = { low: 0.15, medium: 0.25, high: 0.4 } as const;
const TRAIL_ANGLE = Math.PI / 4; // 45-degree sweep trail
const PING_LIFESPAN = 3; // seconds a ping ring lives

/** Extract the fallback hex from a "var(--name, #hex)" string */
function resolveColor(cssColor: string): string {
  if (!cssColor.startsWith('var(')) return cssColor;
  const match = cssColor.match(/var\([^,]+,\s*([^)]+)\)/);
  return match ? match[1].trim() : '#00d4ff';
}

export function RadarPingWidget({ instance, isEditing }: WidgetRendererProps) {
  const config = instance.config as RadarPingConfig;
  const mode = config.mode ?? 'both';
  const speed = config.speed ?? 4;
  const color = config.color ?? 'var(--color-accent-cyan, #00d4ff)';
  const direction = config.direction ?? 'cw';
  const glow = config.glow ?? 'medium';
  const thickness = config.thickness ?? 'normal';
  const effect = config.effect ?? 'none';
  const showGrid = config.show_grid ?? true;
  const pingFrequency = config.ping_frequency ?? 2;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const pingsRef = useRef<number[]>([]);
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    if (isEditing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resolvedColor = resolveColor(color);
    const lineWidth = THICKNESS_PX[thickness] ?? 2;
    const glowBlur = GLOW_BLUR[glow] ?? 10;
    const glowAlpha = GLOW_ALPHA[glow] ?? 0.25;
    const radiansPerSec = (2 * Math.PI) / speed;
    const dirMul = direction === 'ccw' ? -1 : 1;
    const showSweep = mode === 'sweep' || mode === 'both';
    const showPulse = mode === 'pulse' || mode === 'both';

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

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(cx, cy) - 4;

      ctx.clearRect(0, 0, w, h);

      // --- Compute effect modifiers ---
      let sweepOpacity = 1;
      let angleOffset = 0;
      switch (effect) {
        case 'flicker': {
          const p = (elapsed * 1.25) % 1;
          if (p < 0.15) sweepOpacity = 0.4;
          else if (p < 0.3) sweepOpacity = 0.9;
          else if (p < 0.45) sweepOpacity = 0.5;
          else if (p < 0.6) sweepOpacity = 1;
          else if (p < 0.75) sweepOpacity = 0.6;
          else if (p < 0.9) sweepOpacity = 0.85;
          break;
        }
        case 'jitter': {
          const jAmt = 3 / Math.max(radius, 1);
          angleOffset = Math.sin(elapsed * (2 * Math.PI / 0.15)) * jAmt;
          break;
        }
        case 'pulse':
          sweepOpacity = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(elapsed * (2 * Math.PI / 1.5)));
          break;
        case 'strobe':
          sweepOpacity = ((elapsed / 0.3) % 1) < 0.5 ? 1 : 0;
          break;
      }

      // --- Grid ---
      if (showGrid) {
        ctx.strokeStyle = 'rgba(110, 118, 129, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        for (const frac of [0.25, 0.5, 0.75, 1]) {
          ctx.beginPath();
          ctx.arc(cx, cy, radius * frac, 0, 2 * Math.PI);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(cx - radius, cy);
        ctx.lineTo(cx + radius, cy);
        ctx.moveTo(cx, cy - radius);
        ctx.lineTo(cx, cy + radius);
        ctx.stroke();
      }

      // --- Sweep ---
      if (showSweep) {
        const angle = (elapsed * radiansPerSec * dirMul + angleOffset) % (2 * Math.PI);
        // Angle 0 = 12 o'clock; offset by -PI/2 so 0 rad points up
        const renderAngle = angle - Math.PI / 2;

        // Trail: multi-step filled arcs with decreasing alpha
        const trailSteps = 20;
        for (let i = 0; i < trailSteps; i++) {
          const frac = i / trailSteps;
          const nextFrac = (i + 1) / trailSteps;
          const a1 = renderAngle - TRAIL_ANGLE * frac * dirMul;
          const a2 = renderAngle - TRAIL_ANGLE * nextFrac * dirMul;
          const alpha = (1 - frac) * glowAlpha * sweepOpacity;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = resolvedColor;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, radius, a1, a2, direction === 'cw');
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        const endX = cx + Math.cos(renderAngle) * radius;
        const endY = cy + Math.sin(renderAngle) * radius;

        // Glow pass
        ctx.save();
        ctx.globalAlpha = glowAlpha * sweepOpacity;
        ctx.strokeStyle = resolvedColor;
        ctx.lineWidth = lineWidth + 4;
        ctx.shadowColor = resolvedColor;
        ctx.shadowBlur = glowBlur;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.restore();

        // Crisp pass
        ctx.save();
        ctx.globalAlpha = sweepOpacity;
        ctx.strokeStyle = resolvedColor;
        ctx.lineWidth = lineWidth;
        ctx.shadowColor = resolvedColor;
        ctx.shadowBlur = glowBlur * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.restore();
      }

      // --- Pulse rings ---
      if (showPulse) {
        if (elapsed - lastPingRef.current >= pingFrequency) {
          pingsRef.current.push(elapsed);
          lastPingRef.current = elapsed;
        }

        ctx.save();
        pingsRef.current = pingsRef.current.filter((birthTime) => {
          const age = elapsed - birthTime;
          if (age > PING_LIFESPAN) return false;

          const progress = age / PING_LIFESPAN;
          const pingRadius = progress * radius;
          const alpha = (1 - progress) * 0.6 * sweepOpacity;

          // Glow ring
          ctx.beginPath();
          ctx.arc(cx, cy, pingRadius, 0, 2 * Math.PI);
          ctx.strokeStyle = resolvedColor;
          ctx.lineWidth = lineWidth;
          ctx.globalAlpha = alpha;
          ctx.shadowColor = resolvedColor;
          ctx.shadowBlur = glowBlur * 0.5;
          ctx.stroke();

          return true;
        });
        ctx.restore();
      }

      // --- Center dot ---
      ctx.save();
      ctx.globalAlpha = sweepOpacity;
      ctx.fillStyle = resolvedColor;
      ctx.shadowColor = resolvedColor;
      ctx.shadowBlur = glowBlur * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 2 + lineWidth, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isEditing, mode, speed, color, direction, glow, thickness, effect, showGrid, pingFrequency]);

  if (isEditing) {
    return (
      <div className="radar-ping-widget radar-ping-widget--editing">
        <span className="radar-ping-widget__label">RADAR PING</span>
        <span className="radar-ping-widget__hint">Radial sweep animation</span>
      </div>
    );
  }

  return (
    <div className="radar-ping-widget">
      <canvas ref={canvasRef} className="radar-ping-widget__canvas" />
    </div>
  );
}
