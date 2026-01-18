import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePanelsByStation, useShip } from '../hooks/useShipData';
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

export function PanelIndex() {
  const navigate = useNavigate();
  const { data: ship, isLoading: shipLoading } = useShip();
  const { data: panelsByStation, isLoading: panelsLoading } = usePanelsByStation();
  const [selectedStation, setSelectedStation] = useState<StationGroup | null>(null);

  if (shipLoading || panelsLoading) {
    return <div className="loading">Loading ship data...</div>;
  }

  if (!ship || !panelsByStation) {
    return <div className="error">Failed to load ship data</div>;
  }

  const stations = (Object.keys(panelsByStation) as StationGroup[]).filter(
    (s) => s !== 'admin'
  );

  return (
    <div
      className="panel-index"
      onClick={() => setSelectedStation(null)}
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
            const isExpanded = selectedStation === station;
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
                  onClick={() => setSelectedStation(isExpanded ? null : station)}
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
            const angle = (index * 360) / stations.length - 90; // -90 to start at top
            const radius = 280; // Distance from center
            const x = Math.cos((angle * Math.PI) / 180) * radius;
            const y = Math.sin((angle * Math.PI) / 180) * radius;

            const isSelected = selectedStation === station;
            const panelCount = panelsByStation[station]?.length || 0;
            const panels = panelsByStation[station] || [];

            return (
              <div key={station} className="station-group">
                <button
                  className={`station-node ${isSelected ? 'active' : ''}`}
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                  }}
                  onClick={() => setSelectedStation(isSelected ? null : station)}
                >
                  <div className="station-node-inner">
                    <span className="station-icon">{STATION_ICONS[station]}</span>
                    <span className="station-label">{STATION_NAMES[station]}</span>
                    {panelCount > 0 && (
                      <span className="station-count">{panelCount}</span>
                    )}
                  </div>
                </button>

                {/* Radial panel expansion */}
                {isSelected && panels.length > 0 && (
                  <div
                    className="panel-orbit"
                    style={{
                      transform: `translate(${x}px, ${y}px)`,
                    }}
                  >
                    {panels.map((panel: Panel, panelIndex: number) => {
                      // Distribute panels in an arc centered on the station's radial angle
                      const arcSpread = panels.length === 1 ? 0 : Math.min(60, panels.length * 20); // Arc width in degrees
                      const angleOffset = panels.length === 1
                        ? 0
                        : (panelIndex - (panels.length - 1) / 2) * (arcSpread / (panels.length - 1));
                      const panelAngle = angle + angleOffset;
                      const panelRadius = 180; // Distance from station node
                      const panelX = Math.cos((panelAngle * Math.PI) / 180) * panelRadius;
                      const panelY = Math.sin((panelAngle * Math.PI) / 180) * panelRadius;

                      return (
                        <button
                          key={panel.id}
                          className="panel-node"
                          style={{
                            '--tx': `${panelX}px`,
                            '--ty': `${panelY}px`,
                            '--rotation': `${panelAngle + 180}deg`,
                            animationDelay: `${panelIndex * 0.05}s`,
                          } as React.CSSProperties}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/panel/${panel.id}`);
                          }}
                        >
                          <div className="panel-node-inner">
                            <div className="panel-node-name">{panel.name}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
