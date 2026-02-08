import { useRef, useEffect, useCallback } from 'react';
import type { WidgetRendererProps } from '../../types';
import './WaveformWidget.css';

type WaveType = 'sine' | 'sawtooth' | 'square' | 'pulse';

const STATUS_WAVE_PARAMS: Record<
  string,
  { noise: number; jitter: number; speed: number }
> = {
  optimal: { noise: 0, jitter: 0, speed: 1 },
  operational: { noise: 0, jitter: 0, speed: 1 },
  degraded: { noise: 0.15, jitter: 0.05, speed: 1.2 },
  compromised: { noise: 0.3, jitter: 0.1, speed: 1.5 },
  critical: { noise: 0.5, jitter: 0.2, speed: 2 },
  destroyed: { noise: 0, jitter: 0, speed: 0 },
  offline: { noise: 0, jitter: 0, speed: 0 },
};

const STATUS_COLORS: Record<string, string> = {
  optimal: '#00ffcc',
  operational: '#3fb950',
  degraded: '#d4a72c',
  compromised: '#db6d28',
  critical: '#f85149',
  destroyed: '#8b0000',
  offline: '#6e7681',
};

/** Base wave shape functions (normalized -1 to 1 output) */
function waveShape(waveType: WaveType, phase: number): number {
  switch (waveType) {
    case 'sawtooth': {
      // Sawtooth: linear ramp -1 to 1
      const p = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      return (p / Math.PI) - 1;
    }
    case 'square':
      return Math.sin(phase) >= 0 ? 1 : -1;
    case 'pulse': {
      // Narrow pulse — positive spike for 20% of the cycle
      const p = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      return p < Math.PI * 0.4 ? 1 : -0.2;
    }
    case 'sine':
    default:
      return Math.sin(phase);
  }
}

interface WaveformConfig {
  wave_type?: WaveType;
  show_name?: boolean;
}

export function WaveformWidget({
  instance,
  systemStates,
  isEditing,
}: WidgetRendererProps) {
  const config = instance.config as WaveformConfig;
  const waveType: WaveType = config.wave_type ?? 'sine';
  const showName = config.show_name ?? true;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);

  const systemId = instance.bindings?.system_state_id as string | undefined;
  const system = systemId ? systemStates.get(systemId) : null;

  const status = system?.effective_status ?? system?.status ?? 'offline';
  const systemName = system?.name;
  const healthPct = system
    ? system.max_value > 0
      ? system.value / system.max_value
      : 0
    : 0;

  const getColor = useCallback(
    (s: string) => STATUS_COLORS[s] || STATUS_COLORS.offline,
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const params =
      STATUS_WAVE_PARAMS[status as keyof typeof STATUS_WAVE_PARAMS] ||
      STATUS_WAVE_PARAMS.offline;
    const color = getColor(status);
    const isDead = status === 'destroyed' || status === 'offline';

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const midY = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Draw center reference line (faint)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(110, 118, 129, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw waveform
      const amplitude = isDead ? 0.5 : healthPct * h * 0.35;
      const frequency = 0.02 + healthPct * 0.01;

      // Helper to compute Y at a given x
      const computeY = (x: number) => {
        const noiseVal =
          params.noise * (Math.sin(x * 0.7 + timeRef.current * 3) * 0.5 + (Math.random() - 0.5) * 0.5) * h * 0.3;
        const jitterVal =
          params.jitter *
          Math.sin(x * 0.3 + timeRef.current * 5) *
          h *
          0.15;
        const phase = x * frequency + timeRef.current;
        const baseWave =
          isDead
            ? Math.sin(x * 0.005 + timeRef.current * 0.2) * 0.5
            : waveShape(waveType, phase) * amplitude;
        return midY + baseWave + noiseVal + jitterVal;
      };

      // Glow trail (wider, fainter)
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 6;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;

      for (let x = 0; x < w; x++) {
        const y = computeY(x);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Main line (crisp)
      ctx.beginPath();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;

      for (let x = 0; x < w; x++) {
        const y = computeY(x);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.shadowBlur = 0;

      timeRef.current += 0.03 * params.speed;
      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [status, healthPct, getColor, waveType]);

  if (isEditing) {
    return (
      <div className="waveform-widget waveform-widget--editing">
        <span className="waveform-widget__label">WAVEFORM</span>
        <span className="waveform-widget__hint">
          {systemId ? 'System bound' : 'No system bound — static wave'}
        </span>
      </div>
    );
  }

  return (
    <div className="waveform-widget">
      <canvas ref={canvasRef} className="waveform-widget__canvas" />
      {showName && systemName && (
        <div className="waveform-widget__name">
          {systemName.toUpperCase()}
        </div>
      )}
    </div>
  );
}
