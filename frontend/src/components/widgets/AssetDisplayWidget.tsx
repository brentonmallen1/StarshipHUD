import { useState, useEffect, useRef } from 'react';
import { useAsset } from '../../hooks/useShipData';
import { useUpdateAsset, useFireAsset } from '../../hooks/useMutations';
import { useDataPermissions } from '../../hooks/usePermissions';
import { ToggleSwitch } from '../controls/InlineEditControls';
import { EditButton } from '../controls/EditButton';
import { PlayerEditModal } from '../modals/PlayerEditModal';
import type { WidgetRendererProps, AssetType, Asset } from '../../types';
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

export function AssetDisplayWidget({ instance, isEditing, canEditData }: WidgetRendererProps) {
  const assetId = instance.bindings.asset_id as string | undefined;
  const { data: boundAsset } = useAsset(assetId || '');
  const config = instance.config as AssetConfig;

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Firing animation state
  const [isFiring, setIsFiring] = useState(false);

  // Cooldown animation state - use absolute end time for robustness
  const [cooldownProgress, setCooldownProgress] = useState(0);
  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);

  // Mutation and permission hooks
  const updateAsset = useUpdateAsset();
  const fireAsset = useFireAsset();
  const assetPermissions = useDataPermissions('assets');

  // Check if we can edit this asset (must be bound to a real asset, not static config)
  const canEdit = canEditData && !!assetId && !!boundAsset;

  // Use bound asset data if available, otherwise fall back to config
  const asset = boundAsset || config;

  const title = boundAsset?.name || config.title || 'Asset';
  const assetType = asset.asset_type || 'energy_weapon';
  const assetTypeLabel = ASSET_TYPE_LABELS[assetType] || assetType;

  // Use effective_status for display if available
  const status = asset.status || 'operational';
  const effectiveStatus = boundAsset?.effective_status || status;
  const limitingParent = boundAsset?.limiting_parent;

  const ammoCurrent = asset.ammo_current ?? 0;
  const ammoMax = asset.ammo_max ?? 0;
  const hasAmmo = ammoMax > 0;

  const range = asset.range ?? 0;
  const rangeUnit = asset.range_unit ?? 'km';
  const hasRange = range > 0;

  const damage = asset.damage;
  const accuracy = asset.accuracy;
  const chargeTime = asset.charge_time;
  const cooldown = asset.cooldown;
  const fireMode = asset.fire_mode;

  // Check if weapon is inoperable (destroyed or offline)
  const isInoperable = effectiveStatus === 'destroyed' || effectiveStatus === 'offline';

  // Force toggles to off state when weapon is inoperable
  const isArmed = isInoperable ? false : (boundAsset?.is_armed ?? false);
  const isReady = isInoperable ? false : (boundAsset?.is_ready ?? true);

  // Calculate ammo percentage for visual indicator
  const ammoPercentage = hasAmmo ? (ammoCurrent / ammoMax) * 100 : 100;

  // Can fire: armed AND ready AND (no ammo requirement OR has ammo) AND not inoperable AND not in cooldown
  const isInCooldown = cooldownEndTime !== null;
  const canFire = isArmed && isReady && (!hasAmmo || ammoCurrent > 0) && !isInoperable && !isInCooldown;

  // Cooldown animation effect - uses absolute end time for robustness against re-renders
  useEffect(() => {
    if (!cooldownEndTime || !cooldown) {
      setCooldownProgress(0);
      return;
    }

    const duration = cooldown * 1000;

    const animate = () => {
      const now = Date.now();
      const remaining = cooldownEndTime - now;

      if (remaining <= 0) {
        // Cooldown complete
        setCooldownProgress(1);
        setCooldownEndTime(null);
        // Reset is_ready on server if we have ammo (or don't use ammo)
        if (assetId && (!hasAmmo || ammoCurrent > 0)) {
          updateAsset.mutate({ id: assetId, data: { is_ready: true } });
        }
        return;
      }

      // Calculate progress based on how much time has elapsed
      const elapsed = duration - remaining;
      const progress = elapsed / duration;
      setCooldownProgress(progress);

      cooldownTimerRef.current = requestAnimationFrame(animate);
    };

    cooldownTimerRef.current = requestAnimationFrame(animate);

    return () => {
      if (cooldownTimerRef.current) {
        cancelAnimationFrame(cooldownTimerRef.current);
      }
    };
  }, [cooldownEndTime, cooldown, assetId, hasAmmo, ammoCurrent, updateAsset]);

  // Fire handler
  const handleFire = () => {
    if (!canFire || !assetId || fireAsset.isPending) return;

    // Trigger firing animation
    setIsFiring(true);
    setTimeout(() => setIsFiring(false), 200); // Flash duration

    // Call fire mutation - start cooldown on success
    fireAsset.mutate(assetId, {
      onSuccess: () => {
        // Start cooldown timer locally using absolute end time
        if (cooldown && cooldown > 0) {
          setCooldownEndTime(Date.now() + cooldown * 1000);
        }
      },
    });
  };

  // Armed toggle handler
  const handleArmedChange = (newArmed: boolean) => {
    if (canEdit && assetId) {
      updateAsset.mutate({ id: assetId, data: { is_armed: newArmed } });
    }
  };

  // Check field-level permissions
  const canEditArmed = canEdit && assetPermissions.fields.is_armed === 'edit';

  // Modal handlers
  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  const handleModalSave = (data: Partial<Asset>) => {
    if (canEdit && assetId) {
      updateAsset.mutate(
        { id: assetId, data },
        { onSuccess: () => setIsModalOpen(false) }
      );
    }
  };

  // Determine fire button label
  const getFireButtonLabel = () => {
    if (fireAsset.isPending) return 'FIRING...';
    if (!isArmed) return 'SAFE';
    if (hasAmmo && ammoCurrent <= 0) return 'EMPTY';  // Check empty before cooldown
    if (isInCooldown) return 'COOLDOWN';
    return 'FIRE';
  };

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
              <span className="asset-stat-value">{ammoCurrent}/{ammoMax}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`asset-display-widget status-${effectiveStatus} ${isFiring ? 'firing' : ''}`}>
      {/* Edit button appears when data editing is enabled */}
      {canEdit && <EditButton onClick={handleOpenModal} title="Edit asset data" />}

      {/* Player Edit Modal */}
      {canEdit && (
        <PlayerEditModal
          isOpen={isModalOpen}
          dataType="assets"
          record={boundAsset}
          permissions={assetPermissions}
          onSave={handleModalSave}
          onCancel={handleCloseModal}
          title={`Edit ${title}`}
          isLoading={updateAsset.isPending}
          error={updateAsset.error?.message}
        />
      )}

      <div className="asset-header">
        <h3 className="asset-title">{title}</h3>
        <div className="asset-status-row">
          {/* Status: show effective status */}
          <span className={`asset-status status-${effectiveStatus}`}>
            <span className="status-dot" />
            {effectiveStatus}
          </span>

          {/* Armed toggle: editable toggle or static display */}
          {canEditArmed ? (
            <ToggleSwitch
              checked={isArmed}
              onChange={handleArmedChange}
              trueLabel="ARMED"
              falseLabel="SAFE"
              disabled={isInoperable}
            />
          ) : (
            isArmed && <span className="asset-armed-indicator">⚠ ARMED</span>
          )}

          {/* Ready state indicator */}
          {isArmed && (
            <span className={`asset-ready-indicator ${!isInCooldown && (!hasAmmo || ammoCurrent > 0) ? 'ready' : 'not-ready'}`}>
              {isInCooldown ? 'CYCLING' : (hasAmmo && ammoCurrent <= 0) ? 'EMPTY' : 'READY'}
            </span>
          )}
        </div>
      </div>

      {/* Limiting parent indicator */}
      {limitingParent && (
        <div className={`asset-limiting-parent status-${limitingParent.effective_status}`}>
          ← {limitingParent.name}
        </div>
      )}

      <div className="asset-type">{assetTypeLabel}</div>

      <div className={`asset-stats ${!hasAmmo ? 'no-ammo' : ''}`}>
        {/* Ammo Bar with count */}
        {hasAmmo && (
          <div className="asset-ammo-section">
            <div className="asset-ammo-count">
              {ammoCurrent}/{ammoMax}
            </div>
            <div className="asset-ammo-bar">
              <div
                className={`asset-ammo-fill status-${effectiveStatus}`}
                style={{ width: `${ammoPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* FIRE BUTTON */}
        <button
          className={`asset-fire-button ${canFire ? 'ready' : 'disabled'} ${isInCooldown ? 'cooling-down' : ''}`}
          onClick={handleFire}
          disabled={!canFire || fireAsset.isPending}
        >
          {/* Cooldown fill animation (behind text) */}
          {isInCooldown && (
            <div
              className="fire-button-cooldown-fill"
              style={{ width: `${cooldownProgress * 100}%` }}
            />
          )}
          <span className="fire-button-text">{getFireButtonLabel()}</span>
        </button>

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
