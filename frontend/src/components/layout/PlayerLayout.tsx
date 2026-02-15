import { Outlet } from 'react-router-dom';
import { usePosture } from '../../hooks/useShipData';
import { Navigator } from '../Navigator';
import { AlertTicker } from '../AlertTicker';
import { GlitchOverlay } from '../GlitchOverlay';
import { ErrorBoundary } from '../ErrorBoundary';
import './Layout.css';

export function PlayerLayout() {
  const { data: posture } = usePosture();

  // Apply posture class to body
  const postureClass = posture ? `posture-${posture.posture}` : '';

  return (
    <div className={`app-container player-layout ${postureClass}`}>
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <AlertTicker />
      <main id="main-content" className="main-content">
        <ErrorBoundary level="layout">
          <Outlet />
        </ErrorBoundary>
      </main>
      <Navigator />
      <GlitchOverlay />
    </div>
  );
}
