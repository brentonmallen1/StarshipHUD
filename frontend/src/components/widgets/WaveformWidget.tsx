import { useRef, useEffect, useCallback } from 'react';
import type { WidgetRendererProps } from '../../types';
import './WaveformWidget.css';

type WaveType = 'sine' | 'sawtooth' | 'square' | 'pulse' | 'heartbeat';

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

// Heartbeat parameters by status - maps to cardiac rhythm behavior
const HEARTBEAT_PARAMS: Record<
  string,
  { bpm: number; strength: number; irregularity: number }
> = {
  optimal: { bpm: 72, strength: 1.0, irregularity: 0 },
  operational: { bpm: 75, strength: 0.95, irregularity: 0.02 },
  degraded: { bpm: 90, strength: 0.8, irregularity: 0.1 },
  compromised: { bpm: 110, strength: 0.6, irregularity: 0.2 },
  critical: { bpm: 140, strength: 0.4, irregularity: 0.4 },
  destroyed: { bpm: 0, strength: 0, irregularity: 0 },
  offline: { bpm: 0, strength: 0, irregularity: 0 },
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

/** Heartbeat wave shape - ECG-style LUB-dub pattern */
function heartbeatShape(phase: number, strength: number, irregularity: number): number {
  // Normalize phase to 0-1 range for one heartbeat cycle
  const p = ((phase % (Math.PI * 2)) / (Math.PI * 2));

  // Add irregularity to timing
  const irregularOffset = irregularity * (Math.sin(phase * 0.1) * 0.1);
  const adjustedP = (p + irregularOffset + 1) % 1;

  // ECG waveform components:
  // P wave (small atrial contraction) - 0-10%
  // Q dip - 10-12%
  // R spike (main ventricular beat - LUB) - 12-18%
  // S dip - 18-22%
  // T wave (ventricular recovery - dub) - 30-45%
  // Rest - 45-100%

  if (adjustedP < 0.10) {
    // P wave - small preparatory bump
    const t = adjustedP / 0.10;
    return strength * Math.sin(t * Math.PI) * 0.25;
  } else if (adjustedP < 0.12) {
    // Q dip
    return strength * -0.15;
  } else if (adjustedP < 0.18) {
    // R spike (main beat)
    const t = (adjustedP - 0.12) / 0.06;
    return strength * Math.sin(t * Math.PI) * 1.0;
  } else if (adjustedP < 0.22) {
    // S dip
    const t = (adjustedP - 0.18) / 0.04;
    return strength * (-0.25 + t * 0.25);
  } else if (adjustedP < 0.30) {
    // Return to baseline
    return 0;
  } else if (adjustedP < 0.45) {
    // T wave (secondary bump)
    const t = (adjustedP - 0.30) / 0.15;
    return strength * Math.sin(t * Math.PI) * 0.35;
  } else {
    // Resting period with slight noise
    return irregularity * (Math.random() - 0.5) * 0.05;
  }
}

/** Base wave shape functions (normalized -1 to 1 output) */
function waveShape(waveType: WaveType, phase: number, hbStrength = 1, hbIrregularity = 0): number {
  switch (waveType) {
    case 'heartbeat':
      return heartbeatShape(phase, hbStrength, hbIrregularity);
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
    const hbParams =
      HEARTBEAT_PARAMS[status as keyof typeof HEARTBEAT_PARAMS] ||
      HEARTBEAT_PARAMS.offline;
    const color = getColor(status);
    const isDead = status === 'destroyed' || status === 'offline';
    const isHeartbeat = waveType === 'heartbeat';

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
      // Heartbeat uses BPM-based frequency, others use health-based
      const frequency = isHeartbeat
        ? (hbParams.bpm / 60) * (Math.PI * 2) / 60  // Convert BPM to phase increment per pixel
        : 0.02 + healthPct * 0.01;

      // Helper to compute Y at a given x
      const computeY = (x: number) => {
        const noiseVal = isHeartbeat
          ? 0  // Heartbeat handles its own irregularity
          : params.noise * (Math.sin(x * 0.7 + timeRef.current * 3) * 0.5 + (Math.random() - 0.5) * 0.5) * h * 0.3;
        const jitterVal = isHeartbeat
          ? 0
          : params.jitter * Math.sin(x * 0.3 + timeRef.current * 5) * h * 0.15;
        const phase = x * frequency + timeRef.current;
        const baseWave =
          isDead
            ? Math.sin(x * 0.005 + timeRef.current * 0.2) * 0.5
            : waveShape(waveType, phase, hbParams.strength, hbParams.irregularity) * amplitude;
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
