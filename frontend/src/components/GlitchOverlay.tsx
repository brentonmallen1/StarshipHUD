import { usePosture } from '../hooks/useShipData';
import './GlitchOverlay.css';

/**
 * Glitch Aesthetics Overlay
 *
 * Applies visual effects based on ship posture and overall system health.
 * Creates atmospheric tension through subtle distortion, scan lines, and glitches.
 */
export function GlitchOverlay() {
  const { data: posture } = usePosture();

  if (!posture) return null;

  // Determine glitch intensity based on posture
  const getGlitchIntensity = () => {
    switch (posture.posture) {
      case 'green':
        return 'low';
      case 'yellow':
        return 'medium';
      case 'red':
      case 'general_quarters':
        return 'high';
      case 'silent_running':
        return 'low'; // Silent running is calm but tense
      default:
        return 'low';
    }
  };

  const intensity = getGlitchIntensity();

  return (
    <>
      {/* Scan lines overlay */}
      <div className={`scan-lines intensity-${intensity}`} />

      {/* CRT screen curvature effect */}
      <div className="crt-overlay" />

      {/* Vignette for depth */}
      <div className={`vignette intensity-${intensity}`} />

      {/* Glitch flicker (only on higher intensities) */}
      {(intensity === 'medium' || intensity === 'high') && (
        <div className={`glitch-flicker intensity-${intensity}`} />
      )}

      {/* Chromatic aberration on critical */}
      {intensity === 'high' && (
        <div className="chromatic-aberration" />
      )}
    </>
  );
}
