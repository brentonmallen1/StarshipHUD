import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useShipContext } from '../../contexts/ShipContext';
import type { WidgetInstance } from '../../types';
import type { ShieldSegment } from '../../types';
import { systemStatesApi, assetsApi, contactsApi, cargoBaysApi, holomapApi } from '../../services/api';
import { getWidgetType } from './widgetRegistry';
import { MediaPickerModal } from '../admin/MediaPickerModal';
import './WidgetCreationModal.css'; // Reuse creation modal styles

interface Props {
  widget: WidgetInstance;
  onClose: () => void;
  onSave: (updates: Partial<WidgetInstance>) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function WidgetConfigModal({ widget, onClose, onSave, onDelete }: Props) {
  const modalRef = useModalA11y(onClose);
  const widgetType = getWidgetType(widget.widget_type);
  const { shipId } = useShipContext();
  // Use modal-scoped query keys so live widget polling (same keys, different observers)
  // never triggers a re-render here and snaps focus away from dropdowns/inputs.
  const { data: systemStates } = useQuery({
    queryKey: ['modal-system-states', shipId],
    queryFn: () => systemStatesApi.list(shipId!),
    enabled: !!shipId,
    refetchInterval: false,
    staleTime: Infinity,
  });
  const { data: assets } = useQuery({
    queryKey: ['modal-assets', shipId],
    queryFn: () => assetsApi.list(shipId!),
    enabled: !!shipId,
    refetchInterval: false,
    staleTime: Infinity,
  });
  const { data: contacts } = useQuery({
    queryKey: ['modal-contacts', shipId],
    queryFn: () => contactsApi.list(shipId!),
    enabled: !!shipId,
    refetchInterval: false,
    staleTime: Infinity,
  });
  const { data: cargoBays } = useQuery({
    queryKey: ['modal-cargo-bays', shipId],
    queryFn: () => cargoBaysApi.list(shipId!),
    enabled: !!shipId && widget.widget_type === 'cargo_bay',
    refetchInterval: false,
    staleTime: Infinity,
  });
  const { data: holomapLayers } = useQuery({
    queryKey: ['modal-holomap-layers', shipId],
    queryFn: () => holomapApi.listLayers(shipId!),
    enabled: !!shipId && widget.widget_type === 'holomap',
    refetchInterval: false,
    staleTime: Infinity,
  });

  const [label, setLabel] = useState(widget.label || '');
  const [systemStateId, setSystemStateId] = useState<string>(
    (widget.bindings.system_state_id as string) || ''
  );
  const [assetId, setAssetId] = useState<string>(
    (widget.bindings.asset_id as string) || ''
  );
  const [contactId, setContactId] = useState<string>(
    (widget.config.contact_id as string) || ''
  );
  const [dataSource, setDataSource] = useState<string>(
    (widget.config.dataSource as string) || 'cargo'
  );
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    (widget.config.columns as string[]) || []
  );
  const [titleText, setTitleText] = useState<string>(
    (widget.config.text as string) || ''
  );
  const [orientation, setOrientation] = useState<string>(
    (widget.config.orientation as string) || 'horizontal'
  );
  const [showLabel, setShowLabel] = useState<boolean>(
    (widget.config.showLabel as boolean) ?? false
  );

  // Arc Gauge config
  const [arcSweep, setArcSweep] = useState<number>(
    (widget.config.sweep as number) ?? 270
  );
  const [arcShowTicks, setArcShowTicks] = useState<boolean>(
    (widget.config.show_ticks as boolean) ?? true
  );

  // Scan Line / Radar Ping shared config
  const [scanSpeed, setScanSpeed] = useState<number>(
    (widget.config.speed as number) ?? 4
  );
  const [scanDirection, setScanDirection] = useState<string>(
    (widget.config.direction as string) ??
      (widget.widget_type === 'radar_ping' ? 'cw' : 'down')
  );
  const [scanColor, setScanColor] = useState<string>(
    (widget.config.color as string) ?? 'var(--color-accent-cyan, #00d4ff)'
  );
  const [scanGlow, setScanGlow] = useState<string>(
    (widget.config.glow as string) ?? 'medium'
  );
  const [scanThickness, setScanThickness] = useState<string>(
    (widget.config.thickness as string) ?? 'normal'
  );
  const [scanEffect, setScanEffect] = useState<string>(
    (widget.config.effect as string) ?? 'none'
  );
  const [scanShowGrid, setScanShowGrid] = useState<boolean>(
    (widget.config.show_grid as boolean) ?? true
  );

  // Radar Ping config
  const [radarMode, setRadarMode] = useState<string>(
    (widget.config.mode as string) ?? 'both'
  );
  const [pingFrequency, setPingFrequency] = useState<number>(
    (widget.config.ping_frequency as number) ?? 2
  );

  // Pulse config
  const [pulseOrigin, setPulseOrigin] = useState<string>(
    (widget.config.origin as string) ?? 'bottom-left'
  );

  // Waveform config
  const [waveType, setWaveType] = useState<string>(
    (widget.config.wave_type as string) ?? 'sine'
  );
  const [waveShowName, setWaveShowName] = useState<boolean>(
    (widget.config.show_name as boolean) ?? true
  );

  // GIF Display config
  const [gifObjectFit, setGifObjectFit] = useState<string>(
    (widget.config.object_fit as string) ?? 'contain'
  );
  const [gifStatusDim, setGifStatusDim] = useState<boolean>(
    (widget.config.status_dim as boolean) ?? false
  );

  // Number Display config
  const [numberShowMax, setNumberShowMax] = useState<boolean>(
    (widget.config.show_max as boolean) ?? true
  );
  const [numberShowUnit, setNumberShowUnit] = useState<boolean>(
    (widget.config.show_unit as boolean) ?? true
  );
  const [numberShowStatus, setNumberShowStatus] = useState<boolean>(
    (widget.config.show_status as boolean) ?? true
  );
  const [numberShowTitle, setNumberShowTitle] = useState<boolean>(
    (widget.config.show_title as boolean) ?? true
  );
  const [numberSize, setNumberSize] = useState<string>(
    (widget.config.size as string) ?? 'normal'
  );

  // Hide border (scan_line, gif_display)
  const [hideBorder, setHideBorder] = useState<boolean>(
    (widget.config.hide_border as boolean) ?? false
  );

  // Shield Display config
  const [shieldSegments, setShieldSegments] = useState<ShieldSegment[]>(
    (widget.config.segments as ShieldSegment[]) ?? []
  );
  const [shieldTwoSplit, setShieldTwoSplit] = useState<string>(
    (widget.config.two_segment_split as string) ?? 'port_starboard'
  );
  const [shieldShowLabels, setShieldShowLabels] = useState<boolean>(
    (widget.config.show_labels as boolean) ?? false
  );
  const [shieldImageUrl, setShieldImageUrl] = useState<string>(
    (widget.config.ship_image_url as string) ?? ''
  );
  const [showShieldPicker, setShowShieldPicker] = useState(false);

  // Cargo Bay config
  const [cargoBayIds, setCargoBayIds] = useState<string[]>(
    (widget.config.bay_ids as string[]) ?? []
  );
  const [cargoShowInventory, setCargoShowInventory] = useState<boolean>(
    (widget.config.show_inventory as boolean) ?? true
  );

  // Holomap config
  const [holomapLayerIds, setHolomapLayerIds] = useState<string[]>(
    (widget.config.layer_ids as string[]) ?? []
  );

  // Ticks Widget config
  const [ticksTitle, setTicksTitle] = useState<string>(
    (widget.config.title as string) ?? ''
  );
  const [ticksCount, setTicksCount] = useState<number>(
    (widget.config.tick_count as number) ?? 4
  );
  const [ticksFilledCount, setTicksFilledCount] = useState<number>(
    (widget.config.filled_count as number) ?? 0
  );
  const [ticksSize, setTicksSize] = useState<string>(
    (widget.config.tick_size as string) ?? 'medium'
  );
  const [ticksColor, setTicksColor] = useState<string>(
    (widget.config.color as string) ?? 'secondary'
  );
  const [ticksOrientation, setTicksOrientation] = useState<string>(
    (widget.config.orientation as string) ?? 'horizontal'
  );

  // Phase Bars config
  const [phaseBarCount, setPhaseBarCount] = useState<number>(
    (widget.config.bar_count as number) ?? 4
  );
  const [phaseBarWidth, setPhaseBarWidth] = useState<number>(
    (widget.config.bar_width as number) ?? 15
  );
  const [phaseBarOrientation, setPhaseBarOrientation] = useState<string>(
    (widget.config.orientation as string) ?? 'horizontal'
  );
  const [phaseBarColor, setPhaseBarColor] = useState<string>(
    (widget.config.color as string) ?? '#00d4ff'
  );
  const [phaseBarOpacity, setPhaseBarOpacity] = useState<number>(
    (widget.config.base_opacity as number) ?? 1
  );
  const [phaseBarThickness, setPhaseBarThickness] = useState<number>(
    (widget.config.thickness as number) ?? 100
  );

  // Soundboard config
  const [soundboardTitle, setSoundboardTitle] = useState<string>(
    (widget.config.title as string) ?? 'Soundboard'
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: Partial<WidgetInstance> = {
        label: label.trim() || null,
        bindings: {
          ...widget.bindings,
          system_state_id: systemStateId || undefined,
          asset_id: assetId || undefined,
        },
        config: {
          ...widget.config,
          ...(widget.widget_type === 'title' && {
            text: titleText,
          }),
          ...((widget.widget_type === 'health_bar' || widget.widget_type === 'status_display') && {
            orientation,
          }),
          ...(widget.widget_type === 'status_display' && {
            showLabel,
          }),
          ...(widget.widget_type === 'data_table' && {
            dataSource,
            columns: selectedColumns.length > 0 ? selectedColumns : undefined,
          }),
          ...(widget.widget_type === 'contact_display' && {
            contact_id: contactId || undefined,
          }),
          ...(widget.widget_type === 'arc_gauge' && {
            sweep: arcSweep,
            show_ticks: arcShowTicks,
          }),
          ...(widget.widget_type === 'waveform' && {
            wave_type: waveType,
            show_name: waveShowName,
          }),
          ...(widget.widget_type === 'scan_line' && {
            speed: scanSpeed,
            direction: scanDirection,
            color: scanColor,
            glow: scanGlow,
            thickness: scanThickness,
            effect: scanEffect,
            show_grid: scanShowGrid,
            hide_border: hideBorder,
          }),
          ...(widget.widget_type === 'radar_ping' && {
            mode: radarMode,
            speed: scanSpeed,
            direction: scanDirection,
            color: scanColor,
            glow: scanGlow,
            thickness: scanThickness,
            effect: scanEffect,
            show_grid: scanShowGrid,
            ping_frequency: pingFrequency,
            hide_border: hideBorder,
          }),
          ...(widget.widget_type === 'pulse' && {
            origin: pulseOrigin,
            color: scanColor,
            ping_frequency: pingFrequency,
            glow: scanGlow,
            thickness: scanThickness,
            effect: scanEffect,
            show_grid: scanShowGrid,
            hide_border: hideBorder,
          }),
          ...(widget.widget_type === 'phase_bars' && {
            bar_count: phaseBarCount,
            bar_width: phaseBarWidth,
            speed: scanSpeed,
            orientation: phaseBarOrientation,
            color: phaseBarColor,
            base_opacity: phaseBarOpacity,
            glow: scanGlow,
            thickness: phaseBarThickness,
            show_grid: scanShowGrid,
            hide_border: hideBorder,
          }),
          ...(widget.widget_type === 'gif_display' && {
            object_fit: gifObjectFit,
            status_dim: gifStatusDim,
            hide_border: hideBorder,
          }),
          ...(widget.widget_type === 'number_display' && {
            show_max: numberShowMax,
            show_unit: numberShowUnit,
            show_status: numberShowStatus,
            show_title: numberShowTitle,
            size: numberSize,
          }),
          ...(widget.widget_type === 'shield_display' && {
            segments: shieldSegments,
            two_segment_split: shieldTwoSplit,
            show_labels: shieldShowLabels,
            ship_image_url: shieldImageUrl || undefined,
          }),
          ...(widget.widget_type === 'cargo_bay' && {
            bay_ids: cargoBayIds.length > 0 ? cargoBayIds : undefined,
            show_inventory: cargoShowInventory,
          }),
          ...(widget.widget_type === 'holomap' && {
            layer_ids: holomapLayerIds.length > 0 ? holomapLayerIds : undefined,
          }),
          ...(widget.widget_type === 'ticks' && {
            title: ticksTitle || undefined,
            tick_count: ticksCount,
            filled_count: Math.min(ticksFilledCount, ticksCount),
            tick_size: ticksSize,
            color: ticksColor,
            orientation: ticksOrientation,
          }),
          ...(widget.widget_type === 'soundboard' && {
            title: soundboardTitle.trim() || 'Soundboard',
          }),
        },
      };

      await onSave(updates);
      onClose();
    } catch (err) {
      console.error('Failed to save widget config:', err);
      alert('Failed to save widget configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      console.error('Failed to delete widget:', err);
      alert('Failed to delete widget');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={modalRef} className="modal-content widget-creation-modal" role="dialog" aria-modal="true" aria-label={`Configure ${widgetType?.name || widget.widget_type}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            Configure {widgetType?.name || widget.widget_type}
          </h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Widget Info */}
          <div className="config-section">
            <div className="config-info">
              <div className="info-row">
                <span className="info-label">Type:</span>
                <span className="info-value">{widgetType?.name || widget.widget_type}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Position:</span>
                <span className="info-value">
                  ({widget.x}, {widget.y})
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Size:</span>
                <span className="info-value">
                  {widget.width}×{widget.height}
                </span>
              </div>
            </div>
          </div>

          {/* Label */}
          <div className="configure-section">
            <label className="configure-label">Widget Label (Optional)</label>
            <input
              type="text"
              className="config-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter a custom label"
            />
            <p className="field-hint">
              Custom label for this widget instance
            </p>
          </div>

          {/* Title Widget Text */}
          {widget.widget_type === 'title' && (
            <div className="configure-section">
              <label className="configure-label">Title Text</label>
              <input
                type="text"
                className="config-input"
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                placeholder="Enter title text"
              />
              <p className="field-hint">
                The text displayed in this title widget
              </p>
            </div>
          )}

          {/* System State Binding */}
          {(widget.widget_type === 'health_bar' ||
            widget.widget_type === 'status_display' ||
            widget.widget_type === 'arc_gauge' ||
            widget.widget_type === 'waveform' ||
            widget.widget_type === 'number_display' ||
            (widget.widget_type === 'gif_display' && gifStatusDim)) && (
            <div className="configure-section">
              <label className="configure-label">System State Binding</label>
              <select
                className="config-input"
                value={systemStateId}
                onChange={(e) => setSystemStateId(e.target.value)}
              >
                <option value="">-- None --</option>
                {systemStates?.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name} ({state.category})
                  </option>
                ))}
              </select>
              <p className="field-hint">
                Link this widget to a specific system state
              </p>
            </div>
          )}

          {/* Orientation for Status/Health Widgets */}
          {(widget.widget_type === 'health_bar' ||
            widget.widget_type === 'status_display') && (
            <div className="configure-section">
              <label className="configure-label">Orientation</label>
              <select
                className="config-input"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
              >
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
              <p className="field-hint">
                Vertical orientation uses icon indicators instead of text labels
              </p>
            </div>
          )}

          {/* Show Abbreviated Label (Vertical Status Display only) */}
          {widget.widget_type === 'status_display' && orientation === 'vertical' && (
            <div className="configure-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showLabel}
                  onChange={(e) => setShowLabel(e.target.checked)}
                />
                <span>Show abbreviated status label</span>
              </label>
              <p className="field-hint">
                Display a short status code (OPR, DGR, CRT, etc.) below the icon
              </p>
            </div>
          )}

          {/* Arc Gauge Configuration */}
          {widget.widget_type === 'arc_gauge' && (
            <>
              <div className="configure-section">
                <label className="configure-label">Arc Sweep</label>
                <select
                  className="config-input"
                  value={arcSweep}
                  onChange={(e) => setArcSweep(Number(e.target.value))}
                >
                  <option value={180}>Semicircle (180°)</option>
                  <option value={270}>Three-quarter (270°)</option>
                </select>
                <p className="field-hint">
                  The angular sweep of the gauge arc
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={arcShowTicks}
                    onChange={(e) => setArcShowTicks(e.target.checked)}
                  />
                  <span>Segmented display</span>
                </label>
                <p className="field-hint">
                  Show discrete segments with gaps between status zones
                </p>
              </div>
            </>
          )}

          {/* Number Display Configuration */}
          {widget.widget_type === 'number_display' && (
            <>
              <div className="configure-section">
                <label className="configure-label">Size</label>
                <select
                  className="config-input"
                  value={numberSize}
                  onChange={(e) => setNumberSize(e.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="compact">Compact</option>
                </select>
                <p className="field-hint">
                  Compact size uses smaller fonts for tight spaces
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={numberShowMax}
                    onChange={(e) => setNumberShowMax(e.target.checked)}
                  />
                  <span>Show max value</span>
                </label>
                <p className="field-hint">
                  Display the maximum value (e.g., /100) next to the current value
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={numberShowUnit}
                    onChange={(e) => setNumberShowUnit(e.target.checked)}
                  />
                  <span>Show unit</span>
                </label>
                <p className="field-hint">
                  Display the unit label (%, MW, etc.)
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={numberShowStatus}
                    onChange={(e) => setNumberShowStatus(e.target.checked)}
                  />
                  <span>Show status label</span>
                </label>
                <p className="field-hint">
                  Display the status text (OPTIMAL, CRITICAL, etc.)
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={numberShowTitle}
                    onChange={(e) => setNumberShowTitle(e.target.checked)}
                  />
                  <span>Show title</span>
                </label>
                <p className="field-hint">
                  Display the system name at the bottom
                </p>
              </div>
            </>
          )}

          {/* Waveform Configuration */}
          {widget.widget_type === 'waveform' && (
            <>
              <div className="configure-section">
                <label className="configure-label">Wave Type</label>
                <select
                  className="config-input"
                  value={waveType}
                  onChange={(e) => setWaveType(e.target.value)}
                >
                  <option value="sine">Sine</option>
                  <option value="sawtooth">Sawtooth</option>
                  <option value="square">Square</option>
                  <option value="pulse">Pulse</option>
                </select>
                <p className="field-hint">
                  The waveform shape rendered on the oscilloscope
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={waveShowName}
                    onChange={(e) => setWaveShowName(e.target.checked)}
                  />
                  <span>Show system name</span>
                </label>
                <p className="field-hint">
                  Display the bound system name on the waveform
                </p>
              </div>
            </>
          )}

          {/* Scan Line Configuration */}
          {widget.widget_type === 'scan_line' && (
            <>
              <div className="configure-section">
                <label className="configure-label">Color</label>
                <select
                  className="config-input"
                  value={scanColor}
                  onChange={(e) => setScanColor(e.target.value)}
                >
                  <option value="var(--color-accent-cyan, #00d4ff)">Cyan</option>
                  <option value="var(--color-operational, #3fb950)">Green</option>
                  <option value="var(--color-degraded, #d4a72c)">Amber</option>
                  <option value="var(--color-compromised, #db6d28)">Orange</option>
                  <option value="var(--color-critical, #f85149)">Red</option>
                  <option value="var(--color-accent-purple, #8957e5)">Purple</option>
                  <option value="var(--color-text-primary, #e6edf3)">White</option>
                </select>
              </div>
              <div className="configure-section">
                <label className="configure-label">Direction</label>
                <select
                  className="config-input"
                  value={scanDirection}
                  onChange={(e) => setScanDirection(e.target.value)}
                >
                  <option value="down">Down</option>
                  <option value="up">Up</option>
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                </select>
              </div>
              <div className="configure-section">
                <label className="configure-label">Sweep Speed (seconds)</label>
                <input
                  type="number"
                  className="config-input"
                  min={1}
                  max={20}
                  step={0.5}
                  value={scanSpeed}
                  onChange={(e) => setScanSpeed(Number(e.target.value))}
                />
                <p className="field-hint">
                  Seconds per full sweep cycle
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Beam Thickness</label>
                <select
                  className="config-input"
                  value={scanThickness}
                  onChange={(e) => setScanThickness(e.target.value)}
                >
                  <option value="thin">Thin (1px)</option>
                  <option value="normal">Normal (2px)</option>
                  <option value="thick">Thick (4px)</option>
                </select>
              </div>
              <div className="configure-section">
                <label className="configure-label">Glow Intensity</label>
                <select
                  className="config-input"
                  value={scanGlow}
                  onChange={(e) => setScanGlow(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="configure-section">
                <label className="configure-label">Effect</label>
                <select
                  className="config-input"
                  value={scanEffect}
                  onChange={(e) => setScanEffect(e.target.value)}
                >
                  <option value="none">None</option>
                  <option value="flicker">Flicker</option>
                  <option value="jitter">Jitter</option>
                  <option value="pulse">Pulse</option>
                  <option value="strobe">Strobe</option>
                </select>
                <p className="field-hint">
                  Secondary animation applied to the beam
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={scanShowGrid}
                    onChange={(e) => setScanShowGrid(e.target.checked)}
                  />
                  <span>Show grid lines</span>
                </label>
                <p className="field-hint">
                  Faint horizontal grid lines for sci-fi texture
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hideBorder}
                    onChange={(e) => setHideBorder(e.target.checked)}
                  />
                  <span>Hide widget border</span>
                </label>
                <p className="field-hint">
                  Remove the chamfered border for a seamless look
                </p>
              </div>
            </>
          )}

          {/* Radar Ping Configuration */}
          {widget.widget_type === 'radar_ping' && (
            <>
              <div className="configure-section">
                <label className="configure-label">Mode</label>
                <select
                  className="config-input"
                  value={radarMode}
                  onChange={(e) => setRadarMode(e.target.value)}
                >
                  <option value="both">Sweep + Pulse</option>
                  <option value="sweep">Sweep Only</option>
                  <option value="pulse">Pulse Only</option>
                </select>
                <p className="field-hint">
                  Rotating sweep line, expanding pulse rings, or both
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Color</label>
                <select
                  className="config-input"
                  value={scanColor}
                  onChange={(e) => setScanColor(e.target.value)}
                >
                  <option value="var(--color-accent-cyan, #00d4ff)">Cyan</option>
                  <option value="var(--color-operational, #3fb950)">Green</option>
                  <option value="var(--color-degraded, #d4a72c)">Amber</option>
                  <option value="var(--color-compromised, #db6d28)">Orange</option>
                  <option value="var(--color-critical, #f85149)">Red</option>
                  <option value="var(--color-accent-purple, #8957e5)">Purple</option>
                  <option value="var(--color-text-primary, #e6edf3)">White</option>
                </select>
              </div>
              {(radarMode === 'sweep' || radarMode === 'both') && (
                <>
                  <div className="configure-section">
                    <label className="configure-label">Rotation</label>
                    <select
                      className="config-input"
                      value={scanDirection}
                      onChange={(e) => setScanDirection(e.target.value)}
                    >
                      <option value="cw">Clockwise</option>
                      <option value="ccw">Counter-clockwise</option>
                    </select>
                  </div>
                  <div className="configure-section">
                    <label className="configure-label">Rotation Speed (seconds)</label>
                    <input
                      type="number"
                      className="config-input"
                      min={1}
                      max={20}
                      step={0.5}
                      value={scanSpeed}
                      onChange={(e) => setScanSpeed(Number(e.target.value))}
                    />
                    <p className="field-hint">
                      Seconds per full rotation
                    </p>
                  </div>
                </>
              )}
              {(radarMode === 'pulse' || radarMode === 'both') && (
                <div className="configure-section">
                  <label className="configure-label">Ping Frequency (seconds)</label>
                  <input
                    type="number"
                    className="config-input"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={pingFrequency}
                    onChange={(e) => setPingFrequency(Number(e.target.value))}
                  />
                  <p className="field-hint">
                    Seconds between expanding ping rings
                  </p>
                </div>
              )}
              <div className="configure-section">
                <label className="configure-label">Beam Thickness</label>
                <select
                  className="config-input"
                  value={scanThickness}
                  onChange={(e) => setScanThickness(e.target.value)}
                >
                  <option value="thin">Thin (1px)</option>
                  <option value="normal">Normal (2px)</option>
                  <option value="thick">Thick (3px)</option>
                </select>
              </div>
              <div className="configure-section">
                <label className="configure-label">Glow Intensity</label>
                <select
                  className="config-input"
                  value={scanGlow}
                  onChange={(e) => setScanGlow(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="configure-section">
                <label className="configure-label">Effect</label>
                <select
                  className="config-input"
                  value={scanEffect}
                  onChange={(e) => setScanEffect(e.target.value)}
                >
                  <option value="none">None</option>
                  <option value="flicker">Flicker</option>
                  <option value="jitter">Jitter</option>
                  <option value="pulse">Pulse</option>
                  <option value="strobe">Strobe</option>
                </select>
                <p className="field-hint">
                  Secondary animation applied to the sweep beam
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={scanShowGrid}
                    onChange={(e) => setScanShowGrid(e.target.checked)}
                  />
                  <span>Show grid</span>
                </label>
                <p className="field-hint">
                  Concentric circles and crosshair lines
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hideBorder}
                    onChange={(e) => setHideBorder(e.target.checked)}
                  />
                  <span>Hide widget border</span>
                </label>
                <p className="field-hint">
                  Remove the chamfered border for a seamless look
                </p>
              </div>
            </>
          )}

          {/* Pulse Configuration */}
          {widget.widget_type === 'pulse' && (
            <>
              <div className="configure-section">
                <label className="configure-label">Pulse Origin</label>
                <select
                  className="config-input"
                  value={pulseOrigin}
                  onChange={(e) => setPulseOrigin(e.target.value)}
                >
                  <option value="top-left">Top Left</option>
                  <option value="top">Top</option>
                  <option value="top-right">Top Right</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom">Bottom</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
                <p className="field-hint">
                  Edge or corner where pulse rings emanate from
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Color</label>
                <select
                  className="config-input"
                  value={scanColor}
                  onChange={(e) => setScanColor(e.target.value)}
                >
                  <option value="var(--color-accent-cyan, #00d4ff)">Cyan</option>
                  <option value="var(--color-operational, #3fb950)">Green</option>
                  <option value="var(--color-degraded, #d4a72c)">Amber</option>
                  <option value="var(--color-compromised, #db6d28)">Orange</option>
                  <option value="var(--color-critical, #f85149)">Red</option>
                  <option value="var(--color-accent-purple, #8957e5)">Purple</option>
                  <option value="var(--color-text-primary, #e6edf3)">White</option>
                </select>
              </div>
              <div className="configure-section">
                <label className="configure-label">Ping Frequency (seconds)</label>
                <input
                  type="number"
                  className="config-input"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={pingFrequency}
                  onChange={(e) => setPingFrequency(Number(e.target.value))}
                />
                <p className="field-hint">
                  Seconds between expanding pulse rings
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Ring Thickness</label>
                <select
                  className="config-input"
                  value={scanThickness}
                  onChange={(e) => setScanThickness(e.target.value)}
                >
                  <option value="thin">Thin (1px)</option>
                  <option value="normal">Normal (2px)</option>
                  <option value="thick">Thick (3px)</option>
                </select>
              </div>
              <div className="configure-section">
                <label className="configure-label">Glow Intensity</label>
                <select
                  className="config-input"
                  value={scanGlow}
                  onChange={(e) => setScanGlow(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="configure-section">
                <label className="configure-label">Effect</label>
                <select
                  className="config-input"
                  value={scanEffect}
                  onChange={(e) => setScanEffect(e.target.value)}
                >
                  <option value="none">None</option>
                  <option value="flicker">Flicker</option>
                  <option value="jitter">Jitter</option>
                  <option value="pulse">Pulse</option>
                  <option value="strobe">Strobe</option>
                </select>
                <p className="field-hint">
                  Secondary animation applied to the rings
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={scanShowGrid}
                    onChange={(e) => setScanShowGrid(e.target.checked)}
                  />
                  <span>Show grid</span>
                </label>
                <p className="field-hint">
                  Faint concentric reference arcs from origin
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hideBorder}
                    onChange={(e) => setHideBorder(e.target.checked)}
                  />
                  <span>Hide widget border</span>
                </label>
                <p className="field-hint">
                  Remove the chamfered border for a seamless look
                </p>
              </div>
            </>
          )}

          {/* Phase Bars Configuration */}
          {widget.widget_type === 'phase_bars' && (
            <>
              <div className="configure-section">
                <label className="configure-label">Bar Count</label>
                <input
                  type="number"
                  className="config-input"
                  min={1}
                  max={10}
                  step={1}
                  value={phaseBarCount}
                  onChange={(e) => setPhaseBarCount(Number(e.target.value))}
                />
                <p className="field-hint">
                  Number of bouncing bars (1-10)
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Bar Width (%)</label>
                <input
                  type="number"
                  className="config-input"
                  min={5}
                  max={50}
                  step={5}
                  value={phaseBarWidth}
                  onChange={(e) => setPhaseBarWidth(Number(e.target.value))}
                />
                <p className="field-hint">
                  Width of each bar as percentage of widget
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Speed (seconds)</label>
                <input
                  type="number"
                  className="config-input"
                  min={1}
                  max={10}
                  step={0.5}
                  value={scanSpeed}
                  onChange={(e) => setScanSpeed(Number(e.target.value))}
                />
                <p className="field-hint">
                  Base animation cycle duration
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Orientation</label>
                <select
                  className="config-input"
                  value={phaseBarOrientation}
                  onChange={(e) => setPhaseBarOrientation(e.target.value)}
                >
                  <option value="horizontal">Horizontal (bars move up/down)</option>
                  <option value="vertical">Vertical (bars move left/right)</option>
                </select>
              </div>
              <div className="configure-section">
                <label className="configure-label">Color</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {[
                    { color: '#00d4ff', label: 'Cyan' },
                    { color: '#3fb950', label: 'Green' },
                    { color: '#d4a72c', label: 'Amber' },
                    { color: '#db6d28', label: 'Orange' },
                    { color: '#f85149', label: 'Red' },
                    { color: '#8957e5', label: 'Purple' },
                    { color: '#e6edf3', label: 'White' },
                  ].map(({ color, label }) => (
                    <button
                      key={color}
                      type="button"
                      title={label}
                      onClick={() => setPhaseBarColor(color)}
                      style={{
                        width: '28px',
                        height: '28px',
                        backgroundColor: color,
                        border: phaseBarColor.toLowerCase() === color.toLowerCase() ? '2px solid #fff' : '2px solid transparent',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        boxShadow: phaseBarColor.toLowerCase() === color.toLowerCase() ? '0 0 0 2px var(--color-accent-cyan)' : 'none',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={phaseBarColor}
                    onChange={(e) => setPhaseBarColor(e.target.value)}
                    style={{ width: '48px', height: '32px', padding: 0, border: 'none', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    className="config-input"
                    value={phaseBarColor}
                    onChange={(e) => setPhaseBarColor(e.target.value)}
                    placeholder="#00d4ff"
                    style={{ flex: 1 }}
                  />
                </div>
                <p className="field-hint">
                  Pick a preset or custom color
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Base Opacity ({Math.round(phaseBarOpacity * 100)}%)</label>
                <input
                  type="range"
                  className="config-input"
                  min={0}
                  max={1}
                  step={0.05}
                  value={phaseBarOpacity}
                  onChange={(e) => setPhaseBarOpacity(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <p className="field-hint">
                  Maximum opacity for bars (others scale relative to this)
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Glow Intensity</label>
                <select
                  className="config-input"
                  value={scanGlow}
                  onChange={(e) => setScanGlow(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="configure-section">
                <label className="configure-label">Thickness ({phaseBarThickness}%)</label>
                <input
                  type="range"
                  className="config-input"
                  min={10}
                  max={100}
                  step={5}
                  value={phaseBarThickness}
                  onChange={(e) => setPhaseBarThickness(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <p className="field-hint">
                  Bar size perpendicular to travel direction (centered)
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={scanShowGrid}
                    onChange={(e) => setScanShowGrid(e.target.checked)}
                  />
                  <span>Show grid lines</span>
                </label>
                <p className="field-hint">
                  Faint background grid for sci-fi texture
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hideBorder}
                    onChange={(e) => setHideBorder(e.target.checked)}
                  />
                  <span>Hide widget border</span>
                </label>
                <p className="field-hint">
                  Remove the chamfered border for a seamless look
                </p>
              </div>
            </>
          )}

          {/* GIF Display Configuration */}
          {widget.widget_type === 'gif_display' && (
            <>
              <div className="configure-section">
                <label className="configure-label">Image Fit</label>
                <select
                  className="config-input"
                  value={gifObjectFit}
                  onChange={(e) => setGifObjectFit(e.target.value)}
                >
                  <option value="contain">Contain (fit within)</option>
                  <option value="cover">Cover (fill, may crop)</option>
                  <option value="fill">Fill (stretch)</option>
                </select>
                <p className="field-hint">
                  How the image fills the widget area
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={gifStatusDim}
                    onChange={(e) => setGifStatusDim(e.target.checked)}
                  />
                  <span>Dim based on system status</span>
                </label>
                <p className="field-hint">
                  Bind to a system state to modulate opacity and saturation based on health
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hideBorder}
                    onChange={(e) => setHideBorder(e.target.checked)}
                  />
                  <span>Hide widget border</span>
                </label>
                <p className="field-hint">
                  Remove the chamfered border for a seamless look
                </p>
              </div>
            </>
          )}

          {/* Shield Display Configuration */}
          {widget.widget_type === 'shield_display' && (() => {
            const activeCount = shieldSegments.filter((s) => s.primary_id).length;

            // Positional labels for each slot
            const slotLabels = ((): string[] => {
              const n = shieldSegments.length;
              if (n <= 1) return ['Full Ring'];
              if (n === 2) {
                return shieldTwoSplit === 'fore_aft'
                  ? ['Fore', 'Aft']
                  : ['Starboard', 'Port'];
              }
              if (n === 3) return ['Fore', 'Starboard-Aft', 'Port-Aft'];
              return ['Fore-Starboard', 'Aft-Starboard', 'Aft-Port', 'Fore-Port'];
            })();

            const updateSegment = (i: number, patch: Partial<ShieldSegment>) => {
              setShieldSegments((prev) => {
                const next = [...prev];
                next[i] = { ...next[i], ...patch };
                return next;
              });
            };

            const removeSegment = (i: number) => {
              setShieldSegments((prev) => prev.filter((_, idx) => idx !== i));
            };

            return (
              <>
                <div className="configure-section">
                  <label className="configure-label">Shield Segments (1–4)</label>
                  <p className="field-hint">
                    Add up to 4 segments. Each segment covers an arc around the ship. The outer arc
                    is the primary system, the inner arc is the optional secondary system.
                  </p>

                  {shieldSegments.map((seg, i) => (
                    <div key={i} className="configure-subsection" style={{ marginBottom: '12px', paddingLeft: '8px', borderLeft: '2px solid var(--color-border, #30363d)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span className="configure-label" style={{ marginBottom: 0 }}>
                          Segment {i + 1}{slotLabels[i] ? ` — ${slotLabels[i]}` : ''}
                        </span>
                        <button
                          className="btn btn-small btn-danger"
                          type="button"
                          onClick={() => removeSegment(i)}
                        >
                          Remove
                        </button>
                      </div>

                      <label className="configure-label" style={{ fontSize: '0.8rem' }}>Primary System (Outer Arc)</label>
                      <select
                        className="config-input"
                        value={seg.primary_id ?? ''}
                        onChange={(e) => updateSegment(i, { primary_id: e.target.value || undefined })}
                      >
                        <option value="">-- None --</option>
                        {systemStates?.map((state) => (
                          <option key={state.id} value={state.id}>
                            {state.name} ({state.category})
                          </option>
                        ))}
                      </select>

                      <label className="configure-label" style={{ fontSize: '0.8rem', marginTop: '6px' }}>Secondary System (Inner Arc, optional)</label>
                      <select
                        className="config-input"
                        value={seg.secondary_id ?? ''}
                        onChange={(e) => updateSegment(i, { secondary_id: e.target.value || undefined })}
                      >
                        <option value="">-- None --</option>
                        {systemStates?.map((state) => (
                          <option key={state.id} value={state.id}>
                            {state.name} ({state.category})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}

                  {shieldSegments.length < 4 && (
                    <button
                      className="btn btn-small"
                      type="button"
                      onClick={() => setShieldSegments((prev) => [...prev, {}])}
                    >
                      + Add Segment
                    </button>
                  )}
                </div>

                {shieldSegments.length === 2 && (
                  <div className="configure-section">
                    <label className="configure-label">Two-Segment Split</label>
                    <select
                      className="config-input"
                      value={shieldTwoSplit}
                      onChange={(e) => setShieldTwoSplit(e.target.value)}
                    >
                      <option value="port_starboard">Port / Starboard (left–right)</option>
                      <option value="fore_aft">Fore / Aft (top–bottom)</option>
                    </select>
                    <p className="field-hint">
                      Which axis divides the two 180° arcs
                    </p>
                  </div>
                )}

                <div className="configure-section">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={shieldShowLabels}
                      onChange={(e) => setShieldShowLabels(e.target.checked)}
                    />
                    <span>Show system name labels</span>
                  </label>
                  <p className="field-hint">
                    Display the bound system name near each arc segment
                  </p>
                </div>

                {/* Ship image upload */}
                <div className="configure-section">
                  <label className="configure-label">Ship Image (Optional)</label>
                  <p className="field-hint">
                    Upload an image to replace the default triangle in the center.
                    Recommended: square PNG/SVG with transparency.
                  </p>
                  {shieldImageUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <img
                        src={shieldImageUrl}
                        alt="Ship preview"
                        style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: '50%', border: '1px solid var(--color-border, #30363d)', background: '#0d1117' }}
                      />
                      <button
                        className="btn btn-small btn-danger"
                        type="button"
                        onClick={() => setShieldImageUrl('')}
                      >
                        Remove image
                      </button>
                    </div>
                  )}
                  <button
                    className="btn btn-small"
                    type="button"
                    onClick={() => setShowShieldPicker(true)}
                  >
                    {shieldImageUrl ? 'Replace image' : 'Upload image'}
                  </button>
                  {showShieldPicker && (
                    <MediaPickerModal
                      currentUrl={shieldImageUrl || undefined}
                      onSelect={(url) => {
                        setShieldImageUrl(url);
                        setShowShieldPicker(false);
                      }}
                      onClose={() => setShowShieldPicker(false)}
                    />
                  )}
                </div>

                <div style={{ display: 'none' }}>{activeCount}</div>
              </>
            );
          })()}

          {/* Asset Binding */}
          {widget.widget_type === 'asset_display' && (
            <div className="configure-section">
              <label className="configure-label">Asset/Weapon Binding</label>
              <select
                className="config-input"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              >
                <option value="">-- None (Static Config) --</option>
                {assets?.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.asset_type})
                  </option>
                ))}
              </select>
              <p className="field-hint">
                Link this widget to a specific weapon/asset from the database.
                Updates to the asset will be reflected in real-time.
              </p>
            </div>
          )}

          {/* Contact Display Configuration */}
          {widget.widget_type === 'contact_display' && (
            <div className="configure-section">
              <label className="configure-label">Default Contact (Optional)</label>
              <select
                className="config-input"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
              >
                <option value="">-- No Default (Player Selects) --</option>
                {contacts?.slice().sort((a, b) => a.name.localeCompare(b.name)).map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} - {contact.threat_level}
                  </option>
                ))}
              </select>
              <p className="field-hint">
                Optionally pre-select a contact. Players can change the selection using the dropdown in the widget.
              </p>
            </div>
          )}

          {/* Data Table Configuration */}
          {widget.widget_type === 'data_table' && (
            <>
              <div className="configure-section">
                <label className="configure-label">Data Source</label>
                <select
                  className="config-input"
                  value={dataSource}
                  onChange={(e) => {
                    setDataSource(e.target.value);
                    setSelectedColumns([]); // Reset columns when changing source
                  }}
                >
                  <option value="cargo">Cargo Inventory</option>
                  <option value="assets">Weapons & Assets</option>
                  <option value="contacts">Contacts & Dossiers</option>
                </select>
                <p className="field-hint">
                  Select which data to display in the table
                </p>
              </div>

              <div className="configure-section">
                <label className="configure-label">Columns to Display</label>
                <div className="column-checkboxes">
                  {(dataSource === 'cargo'
                    ? ['name', 'category', 'location', 'size_class', 'notes']
                    : dataSource === 'assets'
                    ? ['name', 'asset_type', 'status', 'ammo_current', 'ammo_max', 'range', 'damage']
                    : ['name', 'affiliation', 'threat_level', 'role', 'last_contacted_at']
                  ).map((col) => (
                    <label key={col} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(col)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedColumns([...selectedColumns, col]);
                          } else {
                            setSelectedColumns(selectedColumns.filter((c) => c !== col));
                          }
                        }}
                      />
                      <span>{col.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
                <p className="field-hint">
                  Leave empty to show default columns
                </p>
              </div>
            </>
          )}

          {/* Cargo Bay Configuration */}
          {widget.widget_type === 'cargo_bay' && (
            <>
              <div className="configure-section">
                <label className="configure-label">Visible Cargo Bays</label>
                <div className="column-checkboxes">
                  {cargoBays?.map((bay) => (
                    <label key={bay.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={cargoBayIds.length === 0 || cargoBayIds.includes(bay.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // If adding when currently showing all, start fresh with just this one
                            if (cargoBayIds.length === 0) {
                              setCargoBayIds([bay.id]);
                            } else {
                              setCargoBayIds([...cargoBayIds, bay.id]);
                            }
                          } else {
                            // If unchecking and would result in all unchecked, show all instead
                            const newIds = cargoBayIds.filter((id) => id !== bay.id);
                            setCargoBayIds(newIds);
                          }
                        }}
                      />
                      <span>{bay.name}</span>
                    </label>
                  ))}
                </div>
                <p className="field-hint">
                  Select which cargo bays to show. Leave all unchecked to show all bays.
                </p>
              </div>
              <div className="configure-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={cargoShowInventory}
                    onChange={(e) => setCargoShowInventory(e.target.checked)}
                  />
                  <span>Show unplaced inventory drawer</span>
                </label>
                <p className="field-hint">
                  Display the drawer with cargo items not yet placed in a bay
                </p>
              </div>
            </>
          )}

          {/* Holomap Configuration */}
          {widget.widget_type === 'holomap' && (
            <div className="configure-section">
              <label className="configure-label">Visible Layers</label>
              <div className="column-checkboxes">
                {holomapLayers?.map((layer) => (
                  <label key={layer.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={holomapLayerIds.length === 0 || holomapLayerIds.includes(layer.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (holomapLayerIds.length === 0) {
                            setHolomapLayerIds([layer.id]);
                          } else {
                            setHolomapLayerIds([...holomapLayerIds, layer.id]);
                          }
                        } else {
                          const newIds = holomapLayerIds.filter((id) => id !== layer.id);
                          setHolomapLayerIds(newIds);
                        }
                      }}
                    />
                    <span>{layer.name}</span>
                  </label>
                ))}
              </div>
              <p className="field-hint">
                Select which deck layers to show. Leave all unchecked to show all layers.
              </p>
            </div>
          )}

          {/* Ticks Widget Configuration */}
          {widget.widget_type === 'ticks' && (
            <>
              <div className="configure-section">
                <label className="configure-label">Title (Optional)</label>
                <input
                  type="text"
                  className="config-input"
                  value={ticksTitle}
                  onChange={(e) => setTicksTitle(e.target.value)}
                  placeholder="e.g., Stress, Fuel, Charges"
                />
                <p className="field-hint">
                  Label displayed above the ticks
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Number of Ticks</label>
                <input
                  type="number"
                  className="config-input"
                  value={ticksCount}
                  min={1}
                  max={20}
                  onChange={(e) => setTicksCount(Math.min(20, Math.max(1, Number(e.target.value))))}
                />
                <p className="field-hint">
                  How many tick segments to display (1-20)
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Initially Filled</label>
                <input
                  type="number"
                  className="config-input"
                  value={ticksFilledCount}
                  min={0}
                  max={ticksCount}
                  onChange={(e) => setTicksFilledCount(Math.min(ticksCount, Math.max(0, Number(e.target.value))))}
                />
                <p className="field-hint">
                  Number of ticks filled at start (0-{ticksCount})
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Tick Size</label>
                <select
                  className="config-input"
                  value={ticksSize}
                  onChange={(e) => setTicksSize(e.target.value)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
                <p className="field-hint">
                  Size of each tick segment
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Widget Orientation</label>
                <select
                  className="config-input"
                  value={ticksOrientation}
                  onChange={(e) => setTicksOrientation(e.target.value)}
                >
                  <option value="horizontal">Horizontal (fill left-to-right)</option>
                  <option value="vertical">Vertical (fill top-to-bottom)</option>
                </select>
                <p className="field-hint">
                  Direction ticks flow and fill
                </p>
              </div>
              <div className="configure-section">
                <label className="configure-label">Color</label>
                <select
                  className="config-input"
                  value={ticksColor}
                  onChange={(e) => setTicksColor(e.target.value)}
                >
                  <option value="secondary">Secondary (amber)</option>
                  <option value="primary">Primary (cyan)</option>
                </select>
                <p className="field-hint">
                  Color theme for the ticks
                </p>
              </div>
            </>
          )}

          {/* Soundboard Widget Configuration */}
          {widget.widget_type === 'soundboard' && (
            <div className="configure-section">
              <label className="configure-label">Title</label>
              <input
                type="text"
                className="config-input"
                value={soundboardTitle}
                onChange={(e) => setSoundboardTitle(e.target.value)}
                placeholder="Soundboard"
              />
              <p className="field-hint">
                Header title displayed above the sound buttons
              </p>
            </div>
          )}

          {/* Delete Section */}
          {!showDeleteConfirm && (
            <div className="configure-section danger-zone">
              <label className="configure-label">Danger Zone</label>
              <button
                className="btn btn-danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Widget
              </button>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="configure-section danger-zone">
              <label className="configure-label">Confirm Deletion</label>
              <p className="delete-warning">
                Are you sure you want to delete this widget? This action cannot be undone.
              </p>
              <div className="delete-actions">
                <button
                  className="btn"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
