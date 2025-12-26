import { useAsset } from '../../hooks/useShipData';
import type { WidgetRendererProps, AssetType } from '../../types';
import './AssetDisplayWidget.css';

interface AssetConfig {
  title?: string;
  asset_type?: AssetType;
  ammo_current?: number;
  ammo_max?: number;
  ammo_type?: string;
  range?: number;
  range_unit?: string;
  damage?: number;
  accuracy?: number;
  charge_time?: number;
  cooldown?: number;
  fire_mode?: string;
  status?: string;
}

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  energy_weapon: 'Energy Weapon',
  torpedo: 'Torpedo',
  drone: 'Drone',
  probe: 'Probe',
  missile: 'Missile',
  railgun: 'Railgun',
  laser: 'Laser',
  particle_beam: 'Particle Beam',
};

const FIRE_MODE_LABELS: Record<string, string> = {
  single: 'Single',
  burst: 'Burst',
  sustained: 'Sustained',
  auto: 'Auto',
};

export function AssetDisplayWidget({ instance, isEditing }: WidgetRendererProps) {
  const assetId = instance.bindings.asset_id as string | undefined;
  const { data: boundAsset } = useAsset(assetId || '');
  const config = instance.config as AssetConfig;

  // Use bound asset data if available, otherwise fall back to config
  const asset = boundAsset || config;

  const title = boundAsset?.name || config.title || 'Asset';
  const assetType = asset.asset_type || 'energy_weapon';
  const assetTypeLabel = ASSET_TYPE_LABELS[assetType] || assetType;
  const status = asset.status || 'operational';

  const ammoCurrent = asset.ammo_current ?? 0;
  const ammoMax = asset.ammo_max ?? 0;
  const ammoType = asset.ammo_type ?? '';
  const hasAmmo = ammoMax > 0;

  const range = asset.range ?? 0;
  const rangeUnit = asset.range_unit ?? 'km';
  const hasRange = range > 0;

  const damage = asset.damage;
  const accuracy = asset.accuracy;
  const chargeTime = asset.charge_time;
  const cooldown = asset.cooldown;
  const fireMode = asset.fire_mode;
  const isArmed = boundAsset?.is_armed ?? false;
  const isReady = boundAsset?.is_ready ?? true;

  // Calculate ammo percentage for visual indicator
  const ammoPercentage = hasAmmo ? (ammoCurrent / ammoMax) * 100 : 0;

  if (isEditing) {
    return (
      <div className="asset-display-widget editing">
        <div className="asset-header">
          <h3 className="asset-title">{title}</h3>
          <span className={`asset-status status-${status}`}>{status}</span>
        </div>
        <div className="asset-type">{assetTypeLabel}</div>
        {assetId ? (
          <div className="asset-binding-info">
            Bound to: {assetId}
          </div>
        ) : (
          <div className="asset-binding-info">
            Static config (no binding)
          </div>
        )}
        <div className="asset-stats">
          <div className="asset-stat">
            <span className="asset-stat-label">Range</span>
            <span className="asset-stat-value">{range} {rangeUnit}</span>
          </div>
          {hasAmmo && (
            <div className="asset-stat">
              <span className="asset-stat-label">Ammo</span>
              <span className="asset-stat-value">{ammoCurrent}/{ammoMax} {ammoType}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`asset-display-widget status-${status}`}>
      <div className="asset-header">
        <h3 className="asset-title">{title}</h3>
        <div className="asset-status-row">
          <span className={`asset-status status-${status}`}>
            <span className="status-dot" />
            {status}
          </span>
          {isArmed && <span className="asset-armed-indicator">⚠ ARMED</span>}
          {!isReady && <span className="asset-ready-indicator">⏳ CHARGING</span>}
        </div>
      </div>

      <div className="asset-type">{assetTypeLabel}</div>

      <div className="asset-stats">
        {/* Ammo Display */}
        {hasAmmo && (
          <div className="asset-stat">
            <div className="asset-stat-header">
              <span className="asset-stat-label">Ammo</span>
              <span className="asset-stat-value">
                {ammoCurrent}/{ammoMax}
                {ammoType && ` ${ammoType}`}
              </span>
            </div>
            <div className="asset-ammo-bar">
              <div
                className={`asset-ammo-fill status-${status}`}
                style={{ width: `${ammoPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Combat Stats Grid */}
        <div className="asset-stat-grid">
          {hasRange && (
            <div className="asset-stat-compact">
              <span className="asset-stat-label">Range</span>
              <span className="asset-stat-value">
                {range} {rangeUnit}
              </span>
            </div>
          )}

          {damage !== undefined && (
            <div className="asset-stat-compact">
              <span className="asset-stat-label">Damage</span>
              <span className="asset-stat-value">{damage}</span>
            </div>
          )}

          {accuracy !== undefined && (
            <div className="asset-stat-compact">
              <span className="asset-stat-label">Accuracy</span>
              <span className="asset-stat-value">{accuracy}%</span>
            </div>
          )}

          {chargeTime !== undefined && (
            <div className="asset-stat-compact">
              <span className="asset-stat-label">Charge</span>
              <span className="asset-stat-value">{chargeTime}s</span>
            </div>
          )}

          {cooldown !== undefined && (
            <div className="asset-stat-compact">
              <span className="asset-stat-label">Cooldown</span>
              <span className="asset-stat-value">{cooldown}s</span>
            </div>
          )}

          {fireMode && (
            <div className="asset-stat-compact">
              <span className="asset-stat-label">Mode</span>
              <span className="asset-stat-value">{FIRE_MODE_LABELS[fireMode] || fireMode}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
