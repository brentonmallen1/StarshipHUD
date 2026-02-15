import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePanelsByStation, useShip } from '../hooks/useShipData';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import type { Panel, StationGroup } from '../types';
import './PanelIndex.css';

const STATION_ICONS: Record<StationGroup, string> = {
  command: '⬡',
  engineering: '⚙',
  sensors: '◎',
  tactical: '⚔',
  life_support: '♡',
  communications: '⌘',
  operations: '⊞',
  admin: '⚡',
};

const STATION_NAMES: Record<StationGroup, string> = {
  command: 'Command',
  engineering: 'Engineering',
  sensors: 'Sensors',
  tactical: 'Tactical',
  life_support: 'Life Support',
  communications: 'Communications',
  operations: 'Operations',
  admin: 'Admin',
};

function getPanelRingRadius() {
  if (window.innerWidth <= 900) return 150;
  if (window.innerWidth <= 1200) return 180;
  return 220;
}

export function PanelIndex() {
  const navigate = useNavigate();
  const { data: ship, isLoading: shipLoading } = useShip();
  const { data: panelsByStation, isLoading: panelsLoading } = usePanelsByStation();

  const [activeStation, setActiveStation] = useState<StationGroup | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'in' | 'out' | 'navigate' | null>(null);
  const hasInitiallyRendered = useRef(false);

  // Mark as rendered after first paint
  useEffect(() => {
    hasInitiallyRendered.current = true;
  }, []);

  const drillIntoStation = useCallback((station: StationGroup) => {
    if (transitioning) return;
    setTransitionDirection('in');
    setTransitioning(true);
    setTimeout(() => {
      setActiveStation(station);
      setTransitionDirection(null);
      setTransitioning(false);
    }, 250);
  }, [transitioning]);

  const drillOut = useCallback(() => {
    if (transitioning) return;
    setTransitionDirection('out');
    setTransitioning(true);
    setTimeout(() => {
      setActiveStation(null);
      setTransitionDirection(null);
      setTransitioning(false);
    }, 250);
  }, [transitioning]);

  const navigateToPanel = useCallback((panelId: string) => {
    if (transitioning) return;
    setTransitionDirection('navigate');
    setTransitioning(true);
    setTimeout(() => {
      navigate(`/panel/${panelId}`);
    }, 300);
  }, [transitioning, navigate]);

  // Escape key to drill out
  useEffect(() => {
    if (activeStation === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') drillOut();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeStation, drillOut]);

  if (shipLoading || panelsLoading) {
    return <LoadingSpinner message="Loading ship data" />;
  }

  if (!ship || !panelsByStation) {
    return <div className="error">Failed to load ship data</div>;
  }

  const stations = (Object.keys(panelsByStation) as StationGroup[]).filter(
    (s) => s !== 'admin'
  );

  // Determine CSS class for radial views
  const getViewClass = (view: 'overview' | 'detail') => {
    if (!hasInitiallyRendered.current) return `radial-view radial-view--${view}`;
    if (view === 'overview' && transitionDirection === 'in') return 'radial-view radial-view--overview radial-view--exiting';
    if (view === 'overview' && transitionDirection === 'navigate') return 'radial-view radial-view--overview radial-view--navigating';
    if (view === 'detail' && transitionDirection === 'out') return 'radial-view radial-view--detail radial-view--exiting';
    if (view === 'detail' && transitionDirection === 'navigate') return 'radial-view radial-view--detail radial-view--navigating';
    if (transitionDirection === null && !transitioning) return `radial-view radial-view--${view} radial-view--entering`;
    return `radial-view radial-view--${view}`;
  };

  return (
    <div
      className="panel-index"
      onClick={() => {
        if (activeStation !== null) {
          drillOut();
        }
      }}
    >
      {/* Mobile accordion view */}
      <div className="panel-list-mobile" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-ship-header">
          <h1 className="mobile-ship-name">{ship.name}</h1>
          {ship.ship_class && <p className="mobile-ship-class">{ship.ship_class}</p>}
          {ship.registry && <p className="mobile-ship-registry">{ship.registry}</p>}
        </div>

        <div className="station-accordion">
          {stations.map((station) => {
            const panels = panelsByStation[station] || [];
            const isExpanded = activeStation === station;
            const hasSinglePanel = panels.length === 1;

            // Single panel: direct link, no accordion
            if (hasSinglePanel) {
              return (
                <button
                  key={station}
                  className="accordion-section single-panel"
                  onClick={() => navigate(`/panel/${panels[0].id}`)}
                >
                  <span className="accordion-icon">{STATION_ICONS[station]}</span>
                  <span className="accordion-label">{STATION_NAMES[station]}</span>
                  <span className="single-panel-name">{panels[0].name}</span>
                  <span className="accordion-chevron">→</span>
                </button>
              );
            }

            // Multiple panels or empty: accordion behavior
            return (
              <div key={station} className="accordion-section">
                <button
                  className={`accordion-header ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => setActiveStation(isExpanded ? null : station)}
                >
                  <span className="accordion-icon">{STATION_ICONS[station]}</span>
                  <span className="accordion-label">{STATION_NAMES[station]}</span>
                  {panels.length > 0 && (
                    <span className="accordion-count">{panels.length}</span>
                  )}
                  <span className="accordion-chevron">{isExpanded ? '▼' : '▶'}</span>
                </button>

                {isExpanded && panels.length > 0 && (
                  <div className="accordion-content">
                    {panels.map((panel: Panel) => (
                      <button
                        key={panel.id}
                        className="mobile-panel-item"
                        onClick={() => navigate(`/panel/${panel.id}`)}
                      >
                        <span className="mobile-panel-name">{panel.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {isExpanded && panels.length === 0 && (
                  <div className="accordion-content">
                    <div className="no-panels">No panels</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop radial view */}
      <div
        className="radial-container"
        onClick={(e) => e.stopPropagation()}
      >
        {activeStation === null ? (
          /* ========== TOP-LEVEL: Ship Overview ========== */
          <div className={getViewClass('overview')}>
            {/* Center ship info */}
            <div className="ship-core">
              <div className="ship-core-inner">
                <h1 className="ship-name">{ship.name}</h1>
                <p className="ship-class">{ship.ship_class}</p>
                <p className="ship-registry">{ship.registry}</p>
              </div>
              <div className="core-ring"></div>
            </div>

            {/* Radial station selector */}
            <div className="station-ring">
              {stations.map((station, index) => {
                const angle = (index * 360) / stations.length - 90;
                const radius = 280;
                const x = Math.cos((angle * Math.PI) / 180) * radius;
                const y = Math.sin((angle * Math.PI) / 180) * radius;
                const panels = panelsByStation[station] || [];
                const panelCount = panels.length;

                return (
                  <div key={station} className="station-group">
                    <button
                      className="station-node"
                      style={{
                        transform: `translate(${x}px, ${y}px)`,
                      }}
                      onClick={() => {
                        if (panels.length === 1) {
                          navigateToPanel(panels[0].id);
                        } else if (panels.length > 1) {
                          drillIntoStation(station);
                        }
                      }}
                    >
                      <div className="station-node-inner">
                        <span className="station-icon">{STATION_ICONS[station]}</span>
                        <span className="station-label">{STATION_NAMES[station]}</span>
                        {panelCount > 0 && (
                          <span className="station-count">{panelCount}</span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ========== DETAIL LEVEL: Station Panels ========== */
          <div className={getViewClass('detail')}>
            {/* Center: Station identity */}
            <button
              className="station-core"
              onClick={drillOut}
              title="Back to ship overview"
            >
              <div className="station-core-inner">
                <span className="station-core-icon">
                  {STATION_ICONS[activeStation]}
                </span>
                <span className="station-core-label">
                  {STATION_NAMES[activeStation]}
                </span>
                <span className="station-core-back">◀ BACK</span>
              </div>
              <div className="core-ring"></div>
            </button>

            {/* Panel ring */}
            <div className="panel-ring">
              {(panelsByStation[activeStation] || []).map(
                (panel: Panel, index: number, arr: Panel[]) => {
                  const angle = (index * 360) / arr.length - 90;
                  const radius = getPanelRingRadius();
                  const x = Math.cos((angle * Math.PI) / 180) * radius;
                  const y = Math.sin((angle * Math.PI) / 180) * radius;

                  return (
                    <button
                      key={panel.id}
                      className="panel-ring-node"
                      style={{
                        transform: `translate(${x}px, ${y}px)`,
                        animationDelay: `${index * 0.04}s`,
                      }}
                      onClick={() => navigateToPanel(panel.id)}
                    >
                      <div className="panel-ring-node-inner">
                        <span className="panel-ring-node-name">
                          {panel.name}
                        </span>
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
