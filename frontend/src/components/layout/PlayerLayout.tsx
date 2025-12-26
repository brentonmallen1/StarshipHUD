import { Outlet } from 'react-router-dom';
import { usePosture } from '../../hooks/useShipData';
import { Navigator } from '../Navigator';
import { AlertTicker } from '../AlertTicker';
import { GlitchOverlay } from '../GlitchOverlay';
import './Layout.css';

export function PlayerLayout() {
  const { data: posture } = usePosture();

  // Apply posture class to body
  const postureClass = posture ? `posture-${posture.posture}` : '';

  return (
    <div className={`app-container player-layout ${postureClass}`}>
      <AlertTicker />
      <main className="main-content">
        <Outlet />
      </main>
      <Navigator />
      <GlitchOverlay />
    </div>
  );
}
