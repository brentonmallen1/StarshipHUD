import { useRef, useEffect, useCallback } from 'react';
import './D20Loader.css';

interface D20LoaderProps {
  size?: number | string;
  speed?: number;
  className?: string;
  /** undefined = auto-loop, true = animate forward, false = animate reverse */
  animate?: boolean;
}

// --- Coordinate data extracted from blah.xml ---
// Each tuple: [mx, my, lx, ly] representing "M mx,my L lx,ly"

type Coords = [number, number, number, number];

const PERIMETER_START: Coords[] = [
  [100, 30, 130.3, 47.5],
  [160.6, 65, 130.3, 47.5],
  [160.6, 65, 160.6, 100],
  [160.6, 135, 160.6, 100],
  [160.6, 135, 130.3, 152.5],
  [100, 170, 130.3, 152.5],
  [100, 170, 69.7, 152.5],
  [39.4, 135, 69.7, 152.5],
  [39.4, 135, 39.4, 100],
  [39.4, 65, 39.4, 100],
  [39.4, 65, 69.7, 47.5],
  [100, 30, 69.7, 47.5],
];

// End coords normalized by 0.82 around center (100,100) to match hexagon size
const PERIMETER_END: Coords[] = [
  [100, 31.1, 130.3, 52.4],
  [160.7, 73.8, 130.3, 52.4],
  [160.7, 73.8, 155.8, 109.8],
  [150.8, 145.9, 155.8, 109.8],
  [150.8, 145.9, 125.4, 159.0],
  [100, 172.2, 125.4, 159.0],
  [100, 172.2, 74.6, 159.0],
  [49.2, 145.9, 74.6, 159.0],
  [49.2, 145.9, 44.2, 109.8],
  [39.3, 73.8, 44.2, 109.8],
  [39.3, 73.8, 69.7, 52.4],
  [100, 31.1, 69.7, 52.4],
];

// Internal lines: [x1, y1, x2, y2]
// Primary group (7 lines) — draw starts at 28.3% of morph, lasts 45.2%
const PRIMARY_START: Coords[] = [
  [100, 30, 100, 55],
  [39.4, 65, 65, 130],
  [160.6, 65, 135, 130],
  [39.4, 135, 65, 130],
  [160.6, 135, 135, 130],
  [100, 170, 65, 130],
  [100, 170, 135, 130],
];

const PRIMARY_END: Coords[] = [
  [100, 31.1, 100, 69.4],
  [39.3, 73.8, 67.2, 126.2],
  [160.7, 73.8, 132.8, 126.2],
  [49.2, 145.9, 67.2, 126.2],
  [150.8, 145.9, 132.8, 126.2],
  [100, 172.2, 67.2, 126.2],
  [100, 172.2, 132.8, 126.2],
];

// Secondary group (5 lines) — draw starts at 35.6% of morph, lasts 37.9%
const SECONDARY_START: Coords[] = [
  [100, 55, 39.4, 65],
  [100, 55, 160.6, 65],
  [100, 55, 65, 130],
  [100, 55, 135, 130],
  [65, 130, 135, 130],
];

const SECONDARY_END: Coords[] = [
  [100, 69.4, 39.3, 73.8],
  [100, 69.4, 160.7, 73.8],
  [100, 69.4, 67.2, 126.2],
  [100, 69.4, 132.8, 126.2],
  [67.2, 126.2, 132.8, 126.2],
];

// Timing ratios within the morph phase (from XML analysis)
const PRIMARY_DRAW_START = 0.283;   // (1.535 - 0.8) / 2.6
const PRIMARY_DRAW_DUR = 0.452;     // 1.175 / 2.6
const SECONDARY_DRAW_START = 0.356; // (1.725 - 0.8) / 2.6
const SECONDARY_DRAW_DUR = 0.379;   // 0.985 / 2.6

// Base durations in seconds (before speed multiplier)
const HOLD_DURATION = 0.8;
const MORPH_DURATION = 2.6;
const TOTAL_DURATION = HOLD_DURATION + MORPH_DURATION; // 3.4s

const DASH_MAX = 4000;

// --- Cubic bezier easing matching ".4 0 .2 1" ---
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const EPSILON = 1e-6;

  return function ease(x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const bx = bezierPoint(mid, x1, x2);
      if (Math.abs(bx - x) < EPSILON) {
        return bezierPoint(mid, y1, y2);
      }
      if (bx < x) lo = mid;
      else hi = mid;
    }
    return bezierPoint((lo + hi) / 2, y1, y2);
  };
}

// Evaluate a 1D cubic bezier at parametric t
// Control points: 0, cp1, cp2, 1
function bezierPoint(t: number, cp1: number, cp2: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  return 3 * mt2 * t * cp1 + 3 * mt * t2 * cp2 + t3;
}

const ease = cubicBezier(0.4, 0, 0.2, 1);

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpCoords(start: Coords, end: Coords, t: number): Coords {
  return [
    lerp(start[0], end[0], t),
    lerp(start[1], end[1], t),
    lerp(start[2], end[2], t),
    lerp(start[3], end[3], t),
  ];
}

function toPathD(c: Coords): string {
  return `M${c[0]} ${c[1]} L${c[2]} ${c[3]}`;
}

// Compute internal line draw-in progress from morph progress (0→1)
function primaryDrawProgress(morphProgress: number): number {
  if (morphProgress <= PRIMARY_DRAW_START) return 0;
  const raw = Math.min((morphProgress - PRIMARY_DRAW_START) / PRIMARY_DRAW_DUR, 1);
  return ease(raw);
}

function secondaryDrawProgress(morphProgress: number): number {
  if (morphProgress <= SECONDARY_DRAW_START) return 0;
  const raw = Math.min((morphProgress - SECONDARY_DRAW_START) / SECONDARY_DRAW_DUR, 1);
  return ease(raw);
}

export function D20Loader({ size = 48, speed = 1, className, animate }: D20LoaderProps) {
  const perimeterRefs = useRef<(SVGPathElement | null)[]>([]);
  const primaryRefs = useRef<(SVGLineElement | null)[]>([]);
  const secondaryRefs = useRef<(SVGLineElement | null)[]>([]);
  const transformRef = useRef<SVGGElement | null>(null);
  const frameRef = useRef<number>(0);
  // Persistent progress for hover-driven mode (0 = hexagon, 1 = D20)
  const progressRef = useRef<number>(0);

  const applyFrame = useCallback((morphProgress: number) => {
    // Perimeter paths
    for (let i = 0; i < PERIMETER_START.length; i++) {
      const el = perimeterRefs.current[i];
      if (el) {
        const coords = lerpCoords(PERIMETER_START[i], PERIMETER_END[i], morphProgress);
        el.setAttribute('d', toPathD(coords));
      }
    }

    // Primary internal lines
    const priDraw = primaryDrawProgress(morphProgress);
    for (let i = 0; i < PRIMARY_START.length; i++) {
      const el = primaryRefs.current[i];
      if (el) {
        const coords = lerpCoords(PRIMARY_START[i], PRIMARY_END[i], morphProgress);
        el.setAttribute('x1', String(coords[0]));
        el.setAttribute('y1', String(coords[1]));
        el.setAttribute('x2', String(coords[2]));
        el.setAttribute('y2', String(coords[3]));
        el.setAttribute('stroke-dashoffset', String(DASH_MAX * (1 - priDraw)));
      }
    }

    // Secondary internal lines
    const secDraw = secondaryDrawProgress(morphProgress);
    for (let i = 0; i < SECONDARY_START.length; i++) {
      const el = secondaryRefs.current[i];
      if (el) {
        const coords = lerpCoords(SECONDARY_START[i], SECONDARY_END[i], morphProgress);
        el.setAttribute('x1', String(coords[0]));
        el.setAttribute('y1', String(coords[1]));
        el.setAttribute('x2', String(coords[2]));
        el.setAttribute('y2', String(coords[3]));
        el.setAttribute('stroke-dashoffset', String(DASH_MAX * (1 - secDraw)));
      }
    }

    // Rotate transform
    if (transformRef.current) {
      const rotate = lerp(-30, 0, morphProgress);
      transformRef.current.setAttribute('transform', `rotate(${rotate})`);
    }
  }, []);

  // Auto-loop mode (when animate is undefined)
  useEffect(() => {
    if (animate !== undefined) return;

    const actualSpeed = Math.max(0.01, speed);
    const totalDur = TOTAL_DURATION / actualSpeed;
    const holdDur = HOLD_DURATION / actualSpeed;
    const morphDur = MORPH_DURATION / actualSpeed;
    const cycleDur = totalDur * 2;

    const startTime = performance.now() / 1000;

    function tick(now: number) {
      const elapsed = now / 1000 - startTime;
      const cyclePos = elapsed % cycleDur;
      const linearTime = cyclePos <= totalDur ? cyclePos : cycleDur - cyclePos;

      let morphProgress = 0;
      if (linearTime > holdDur) {
        const rawProgress = Math.min((linearTime - holdDur) / morphDur, 1);
        morphProgress = ease(rawProgress);
      }

      applyFrame(morphProgress);
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [speed, animate, applyFrame]);

  // Hover-driven mode (when animate is a boolean)
  useEffect(() => {
    if (animate === undefined) return;

    const actualSpeed = Math.max(0.01, speed);
    const morphDur = MORPH_DURATION / actualSpeed;
    const target = animate ? 1 : 0;
    let lastTime = performance.now() / 1000;

    function tick(now: number) {
      const nowSec = now / 1000;
      const dt = nowSec - lastTime;
      lastTime = nowSec;

      // Move progress toward target at a rate of 1/morphDur per second
      const step = dt / morphDur;
      if (animate) {
        progressRef.current = Math.min(progressRef.current + step, 1);
      } else {
        progressRef.current = Math.max(progressRef.current - step, 0);
      }

      applyFrame(progressRef.current);

      // Stop when we've reached the target
      if (progressRef.current !== target) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [animate, speed, applyFrame]);

  return (
    <svg
      className={`d20-loader${className ? ` ${className}` : ''}`}
      viewBox="0 0 200 200"
      width={size}
      height={size}
    >
      <g transform="translate(100 100)">
        <g ref={transformRef} transform="rotate(-30)">
          <g transform="translate(-100 -100)">
            {PERIMETER_START.map((coords, i) => (
              <path
                key={`p${i}`}
                ref={(el) => { perimeterRefs.current[i] = el; }}
                className="d20-loader__stroke"
                d={toPathD(coords)}
              />
            ))}
            {PRIMARY_START.map((coords, i) => (
              <line
                key={`pri${i}`}
                ref={(el) => { primaryRefs.current[i] = el; }}
                className="d20-loader__internal"
                x1={coords[0]}
                y1={coords[1]}
                x2={coords[2]}
                y2={coords[3]}
                strokeDashoffset={DASH_MAX}
              />
            ))}
            {SECONDARY_START.map((coords, i) => (
              <line
                key={`sec${i}`}
                ref={(el) => { secondaryRefs.current[i] = el; }}
                className="d20-loader__internal"
                x1={coords[0]}
                y1={coords[1]}
                x2={coords[2]}
                y2={coords[3]}
                strokeDashoffset={DASH_MAX}
              />
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
}
