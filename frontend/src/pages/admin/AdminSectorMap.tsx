import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSectorMaps, useSectorMap, useSectorSprites, useGmWaypointPresets } from '../../hooks/useShipData';
import {
  useCreateSectorMap,
  useUpdateSectorMap,
  useDeleteSectorMap,
  useSetActiveSectorMap,
  useDeactivateSectorMap,
  useCreateMapObject,
  useUpdateMapObject,
  useDeleteMapObject,
  useCreateWaypoint,
  useDeleteWaypoint,
  useClearGmWaypoints,
  useCreateGmPreset,
  useUpdateGmPreset,
  useDeleteGmPreset,
  useResetGmPresets,
  useReorderGmPresets,
} from '../../hooks/useMutations';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { SectorMapHexGrid } from '../../components/SectorMapHexGrid';
import { MediaPickerModal } from '../../components/admin/MediaPickerModal';
import { SpritePickerModal } from '../../components/admin/SpritePickerModal';
import type { SectorMap, SectorMapObject, VisibilityState, GmWaypointPreset } from '../../types';
import './Admin.css';
import './AdminSectorMap.css';

const GRID_COLOR_PRESETS: { value: string; label: string; color: string }[] = [
  { value: 'cyan', label: 'Cyan', color: '#00d4ff' },
  { value: 'white', label: 'White', color: '#ffffff' },
  { value: 'grey', label: 'Grey', color: '#808080' },
  { value: 'black', label: 'Black', color: '#000000' },
];

const VIS_STATES: VisibilityState[] = ['visible', 'hidden', 'anomaly'];
const VIS_LABELS: Record<VisibilityState, string> = {
  visible: '👁 Visible',
  hidden: '◌ Hidden',
  anomaly: '? Anomaly',
};
const VIS_BTN_CLASSES: Record<VisibilityState, string> = {
  visible: '',
  hidden: 'btn-warning',
  anomaly: 'btn-anomaly',
};

// ---------------------------------------------------------------------------
// Map Settings Panel — inline panel in the inspector sidebar
// ---------------------------------------------------------------------------

interface MapSettingsPanelProps {
  map: SectorMap;
  localBgScale: number;
  localBgRotation: number;
  localBgOffsetX: number;
  localBgOffsetY: number;
  localBgOpacity: number;
  setLocalBgScale: (v: number) => void;
  setLocalBgRotation: (v: number) => void;
  setLocalBgOffsetX: (v: number) => void;
  setLocalBgOffsetY: (v: number) => void;
  setLocalBgOpacity: (v: number) => void;
  onBack: () => void;
}

function MapSettingsPanel({
  map,
  localBgScale,
  localBgRotation,
  localBgOffsetX,
  localBgOffsetY,
  localBgOpacity,
  setLocalBgScale,
  setLocalBgRotation,
  setLocalBgOffsetX,
  setLocalBgOffsetY,
  setLocalBgOpacity,
  onBack,
}: MapSettingsPanelProps) {
  const updateMap = useUpdateSectorMap();
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const patch = useCallback(
    (data: Partial<SectorMap>) => updateMap.mutate({ id: map.id, data }),
    [updateMap, map.id]
  );

  return (
    <div className="sector-settings-panel">
      {/* Header with back button */}
      <div className="sector-settings-panel__header">
        <button className="sector-settings-panel__back" onClick={onBack} title="Back to inspector">
          ← Back
        </button>
        <h4>Map Settings</h4>
      </div>

      <div className="sector-settings-panel__body">
        {/* Background image via MediaPickerModal */}
        <div className="form-row">
          <label>Background</label>
          <div className="sector-bg-picker-row">
            <button className="btn btn-small" onClick={() => setShowMediaPicker(true)}>
              {map.background_image_url ? 'Change' : 'Select'}
            </button>
            {map.background_image_url && (
              <button
                className="btn btn-small btn-danger"
                onClick={() => patch({ background_image_url: null })}
                title="Remove background image"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        {map.background_image_url && (
          <img src={map.background_image_url} className="sector-sprite-preview" alt="" />
        )}

        {/* Background transform sliders — live preview while dragging */}
        {map.background_image_url && (
          <>
            <div className="form-row">
              <label>Scale</label>
              <input
                type="range" min={0.1} max={5} step={0.05}
                value={localBgScale}
                onChange={(e) => setLocalBgScale(parseFloat(e.target.value))}
                onPointerUp={(e) => patch({ bg_scale: parseFloat(e.currentTarget.value) })}
              />
              <span className="sector-slider-val">{localBgScale.toFixed(2)}×</span>
            </div>
            <div className="form-row">
              <label>Rotate</label>
              <input
                type="range" min={-180} max={180} step={1}
                value={localBgRotation}
                onChange={(e) => setLocalBgRotation(parseFloat(e.target.value))}
                onPointerUp={(e) => patch({ bg_rotation: parseFloat(e.currentTarget.value) })}
              />
              <span className="sector-slider-val">{Math.round(localBgRotation)}°</span>
            </div>
            <div className="form-row">
              <label>Offset X</label>
              <input
                type="range" min={-500} max={500} step={5}
                value={localBgOffsetX}
                onChange={(e) => setLocalBgOffsetX(parseFloat(e.target.value))}
                onPointerUp={(e) => patch({ bg_offset_x: parseFloat(e.currentTarget.value) })}
              />
              <span className="sector-slider-val">{Math.round(localBgOffsetX)}</span>
            </div>
            <div className="form-row">
              <label>Offset Y</label>
              <input
                type="range" min={-500} max={500} step={5}
                value={localBgOffsetY}
                onChange={(e) => setLocalBgOffsetY(parseFloat(e.target.value))}
                onPointerUp={(e) => patch({ bg_offset_y: parseFloat(e.currentTarget.value) })}
              />
              <span className="sector-slider-val">{Math.round(localBgOffsetY)}</span>
            </div>
            <div className="form-row">
              <label>Opacity</label>
              <input
                type="range" min={0} max={1} step={0.05}
                value={localBgOpacity}
                onChange={(e) => setLocalBgOpacity(parseFloat(e.target.value))}
                onPointerUp={(e) => patch({ bg_opacity: parseFloat(e.currentTarget.value) })}
              />
              <span className="sector-slider-val">{Math.round(localBgOpacity * 100)}%</span>
            </div>
          </>
        )}

        {/* Grid visible */}
        <div className="form-row form-row--checkbox">
          <label>
            <input
              type="checkbox"
              checked={map.grid_visible}
              onChange={(e) => patch({ grid_visible: e.target.checked })}
            />
            Show hex grid
          </label>
        </div>

        {/* Grid color & opacity */}
        {map.grid_visible && (
          <>
            <div className="form-row">
              <label>Grid Color</label>
              <div className="sector-map-color-presets">
                {GRID_COLOR_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    className={`sector-map-color-btn ${map.grid_color === p.value ? 'sector-map-color-btn--active' : ''}`}
                    style={{ '--preset-color': p.color } as React.CSSProperties}
                    title={p.label}
                    onClick={() => patch({ grid_color: p.value })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <label>Grid Opacity</label>
              <input
                type="range" min={0} max={1} step={0.05}
                value={map.grid_opacity}
                onChange={(e) => patch({ grid_opacity: parseFloat(e.target.value) })}
              />
              <span className="sector-slider-val">{Math.round(map.grid_opacity * 100)}%</span>
            </div>
          </>
        )}

        {/* Background color */}
        <div className="form-row">
          <label>BG Color</label>
          <input
            type="color"
            value={map.background_color}
            onChange={(e) => patch({ background_color: e.target.value })}
            style={{ width: 36, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
          />
        </div>
      </div>

      {showMediaPicker && (
        <MediaPickerModal
          currentUrl={map.background_image_url ?? undefined}
          onSelect={(url) => { patch({ background_image_url: url }); setShowMediaPicker(false); }}
          onClose={() => setShowMediaPicker(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Waypoints Tab — GM waypoint preset management
// ---------------------------------------------------------------------------

const WAYPOINT_SYMBOLS = ['◆', '▲', '●', '■', '★', '◇', '▽', '○'];

function WaypointsTab({ shipId }: { shipId: string }) {
  const { data: presets = [], isLoading } = useGmWaypointPresets(shipId);
  const createPreset = useCreateGmPreset();
  const updatePreset = useUpdateGmPreset();
  const deletePreset = useDeleteGmPreset();
  const resetPresets = useResetGmPresets();
  const reorderPresets = useReorderGmPresets();

  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState<{ pinSlot?: number } | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    color: string;
    symbol: string;
    text_color: string;
    show_label: boolean;
  }>({ name: '', color: '#ff6b6b', symbol: '◆', text_color: '#ffffff', show_label: true });

  // Sort presets: pinned first (by pin_order), then unpinned (by created_at)
  const sortedPresets = useMemo(() => {
    return [...presets].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.is_pinned && b.is_pinned) return (a.pin_order ?? 99) - (b.pin_order ?? 99);
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [presets]);

  const pinnedPresets = presets.filter((p) => p.is_pinned).sort((a, b) => (a.pin_order ?? 99) - (b.pin_order ?? 99));
  const pinnedCount = pinnedPresets.length;

  const handleCreate = async () => {
    if (!creatingNew) return;
    try {
      await createPreset.mutateAsync({
        ship_id: shipId,
        name: editForm.name || null,
        color: editForm.color,
        symbol: editForm.symbol,
        text_color: editForm.text_color,
        show_label: editForm.show_label,
        is_pinned: creatingNew.pinSlot !== undefined,
        pin_order: creatingNew.pinSlot ?? null,
      });
      setCreatingNew(null);
      resetEditForm();
    } catch (err) {
      console.error('Failed to create preset:', err);
      alert('Failed to create preset. Check console for details.');
    }
  };

  const handleUpdate = async (presetId: string) => {
    try {
      await updatePreset.mutateAsync({
        id: presetId,
        data: {
          name: editForm.name || null,
          color: editForm.color,
          symbol: editForm.symbol,
          text_color: editForm.text_color,
          show_label: editForm.show_label,
        },
      });
      setEditingPresetId(null);
      resetEditForm();
    } catch (err) {
      console.error('Failed to update preset:', err);
      alert('Failed to update preset. Check console for details.');
    }
  };

  const handleDelete = async (preset: GmWaypointPreset) => {
    if (!confirm(`Delete "${preset.name || 'this preset'}"?`)) return;
    await deletePreset.mutateAsync(preset.id);
  };

  const togglePin = async (preset: GmWaypointPreset) => {
    if (preset.is_pinned) {
      // Unpin: rebuild order without this preset
      const newOrder = pinnedPresets.filter((p) => p.id !== preset.id).map((p) => p.id);
      await reorderPresets.mutateAsync({ shipId, presetIds: newOrder });
    } else {
      // Pin: add to end if there's room
      if (pinnedCount >= 6) {
        alert('Maximum 6 pinned presets. Unpin one first.');
        return;
      }
      const newOrder = [...pinnedPresets.map((p) => p.id), preset.id];
      await reorderPresets.mutateAsync({ shipId, presetIds: newOrder });
    }
  };

  const resetEditForm = () => {
    setEditForm({ name: '', color: '#ff6b6b', symbol: '◆', text_color: '#ffffff', show_label: true });
  };

  const startEdit = (preset: GmWaypointPreset) => {
    setEditingPresetId(preset.id);
    setEditForm({
      name: preset.name ?? '',
      color: preset.color,
      symbol: preset.symbol,
      text_color: preset.text_color,
      show_label: preset.show_label,
    });
  };

  const startCreate = (pinSlot?: number) => {
    setCreatingNew({ pinSlot });
    resetEditForm();
  };

  if (isLoading) return <p className="admin-loading">Loading...</p>;

  return (
    <div className="sector-waypoints-tab">
      {/* Quick Access Section */}
      <section className="sector-waypoints-tab__quick">
        <h3>Quick Access</h3>
        <p className="sector-waypoints-tab__description">
          These 6 presets appear in the map editor for fast placement.
        </p>
        <div className="sector-waypoints-tab__slots">
          {[0, 1, 2, 3, 4, 5].map((slot) => {
            const preset = pinnedPresets.find((p) => p.pin_order === slot);
            return preset ? (
              <div
                key={slot}
                className="sector-pinned-slot"
                style={{ '--wp-color': preset.color } as React.CSSProperties}
                onClick={() => startEdit(preset)}
                title={`Edit ${preset.name || 'preset'}`}
              >
                <span className="sector-pinned-slot__symbol">{preset.symbol}</span>
                <span className="sector-pinned-slot__name">{preset.name || `Slot ${slot + 1}`}</span>
              </div>
            ) : (
              <button
                key={slot}
                className="sector-empty-slot"
                onClick={() => startCreate(slot)}
                title="Add new pinned preset"
              >
                <span className="sector-empty-slot__plus">+</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* All Presets Section */}
      <section className="sector-waypoints-tab__all">
        <div className="sector-waypoints-tab__header">
          <h3>All Presets</h3>
          <button className="btn btn-small btn-primary" onClick={() => startCreate()}>
            + Add New
          </button>
        </div>

        {/* Create Form */}
        {creatingNew && (
          <div className="sector-preset-form">
            <div className="sector-preset-form__header">
              <span>New Preset {creatingNew.pinSlot !== undefined ? `(Pinned to slot ${creatingNew.pinSlot + 1})` : '(Unpinned)'}</span>
              <button className="btn btn-small" onClick={() => setCreatingNew(null)}>✕</button>
            </div>
            <PresetFormFields form={editForm} setForm={setEditForm} />
            <div className="sector-preset-form__actions">
              <button className="btn btn-small btn-primary" onClick={handleCreate}>Create</button>
              <button className="btn btn-small" onClick={() => setCreatingNew(null)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Preset List */}
        <div className="sector-preset-list">
          {sortedPresets.map((preset) =>
            editingPresetId === preset.id ? (
              <div key={preset.id} className="sector-preset-form">
                <div className="sector-preset-form__header">
                  <span>Editing: {preset.name || preset.symbol}</span>
                  <button className="btn btn-small" onClick={() => setEditingPresetId(null)}>✕</button>
                </div>
                <PresetFormFields form={editForm} setForm={setEditForm} />
                <div className="sector-preset-form__actions">
                  <button className="btn btn-small btn-primary" onClick={() => handleUpdate(preset.id)}>Save</button>
                  <button className="btn btn-small" onClick={() => setEditingPresetId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div key={preset.id} className="sector-preset-row">
                <button
                  className={`sector-preset-row__pin ${preset.is_pinned ? 'sector-preset-row__pin--active' : ''}`}
                  onClick={() => togglePin(preset)}
                  title={preset.is_pinned ? 'Unpin from quick access' : 'Pin to quick access'}
                  disabled={!preset.is_pinned && pinnedCount >= 6}
                >
                  {preset.is_pinned ? '📌' : '○'}
                </button>
                <span
                  className="sector-preset-row__symbol"
                  style={{ '--wp-color': preset.color } as React.CSSProperties}
                >
                  {preset.symbol}
                </span>
                <span className="sector-preset-row__name">{preset.name || '(unnamed)'}</span>
                <button
                  className={`sector-preset-row__label-toggle ${preset.show_label ? 'sector-preset-row__label-toggle--active' : ''}`}
                  onClick={() => updatePreset.mutate({ id: preset.id, data: { show_label: !preset.show_label } })}
                  title={preset.show_label ? 'Hide name on map' : 'Show name on map'}
                >
                  {preset.show_label ? 'Aa' : '—'}
                </button>
                <div className="sector-preset-row__actions">
                  <button className="btn btn-small" onClick={() => startEdit(preset)}>Edit</button>
                  <button className="btn btn-small btn-danger" onClick={() => handleDelete(preset)}>⊗</button>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* Reset Button */}
      <div className="sector-waypoints-tab__footer">
        <button
          className="btn btn-small"
          onClick={() => {
            if (confirm('Reset all presets to defaults? This will delete any custom presets.')) {
              resetPresets.mutate(shipId);
            }
          }}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

/** Reusable form fields for creating/editing presets */
function PresetFormFields({
  form,
  setForm,
}: {
  form: { name: string; color: string; symbol: string; text_color: string; show_label: boolean };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
}) {
  return (
    <div className="sector-preset-form__fields">
      <div className="form-row">
        <label>Name (optional)</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Alpha"
        />
      </div>
      <div className="form-row">
        <label>Symbol</label>
        <div className="sector-symbol-picker">
          {WAYPOINT_SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              className={`sector-symbol-btn ${form.symbol === s ? 'sector-symbol-btn--active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, symbol: s }))}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="form-row form-row--inline">
        <label>Color</label>
        <input
          type="color"
          value={form.color}
          onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
        />
        <span className="form-row__hex">{form.color}</span>
      </div>
      <div className="form-row form-row--inline">
        <label>Text Color</label>
        <input
          type="color"
          value={form.text_color}
          onChange={(e) => setForm((f) => ({ ...f, text_color: e.target.value }))}
        />
        <span className="form-row__hex">{form.text_color}</span>
      </div>
      <div className="form-row form-row--checkbox">
        <label>
          <input
            type="checkbox"
            checked={form.show_label}
            onChange={(e) => setForm((f) => ({ ...f, show_label: e.target.checked }))}
          />
          Show name on map
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Map Editor Tab
// ---------------------------------------------------------------------------

function MapEditorTab({ shipId }: { shipId: string }) {
  const { data: maps = [], isLoading: mapsLoading } = useSectorMaps(shipId);
  const { data: sprites = [] } = useSectorSprites(shipId);
  const { data: gmPresets = [] } = useGmWaypointPresets(shipId);

  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const { data: selectedMapData } = useSectorMap(selectedMapId ?? '');

  const createMap = useCreateSectorMap();
  const deleteMap = useDeleteSectorMap();
  const setActive = useSetActiveSectorMap();
  const deactivate = useDeactivateSectorMap();
  const createObject = useCreateMapObject();
  const updateObject = useUpdateMapObject();
  const deleteObject = useDeleteMapObject();
  const createWaypoint = useCreateWaypoint();
  const deleteWaypoint = useDeleteWaypoint();
  const clearGmWaypoints = useClearGmWaypoints();

  const [showMapForm, setShowMapForm] = useState(false);
  const [mapFormData, setMapFormData] = useState({ name: '', description: '' });

  const [selectedSpriteId, setSelectedSpriteId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [editingObjectData, setEditingObjectData] = useState<Partial<SectorMapObject>>({});
  const [activePresetSlot, setActivePresetSlot] = useState<number | null>(null);
  const [showSpritePicker, setShowSpritePicker] = useState(false);

  // Local bg transform state for live preview
  const [localBgScale, setLocalBgScale] = useState(1.0);
  const [localBgRotation, setLocalBgRotation] = useState(0);
  const [localBgOffsetX, setLocalBgOffsetX] = useState(0);
  const [localBgOffsetY, setLocalBgOffsetY] = useState(0);
  const [localBgOpacity, setLocalBgOpacity] = useState(1.0);

  // Settings panel (replaces inspector content when shown)
  const [showSettings, setShowSettings] = useState(false);

  // Sync local bg state when selected map changes
  useEffect(() => {
    if (selectedMapData) {
      setLocalBgScale(selectedMapData.bg_scale ?? 1.0);
      setLocalBgRotation(selectedMapData.bg_rotation ?? 0);
      setLocalBgOffsetX(selectedMapData.bg_offset_x ?? 0);
      setLocalBgOffsetY(selectedMapData.bg_offset_y ?? 0);
      setLocalBgOpacity(selectedMapData.bg_opacity ?? 1.0);
    }
  }, [selectedMapData?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resizable inspector panel
  const [inspectorWidth, setInspectorWidth] = useState(240);
  const resizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, width: 0 });

  // Auto-select active map on initial load
  useEffect(() => {
    if (selectedMapId || maps.length === 0) return;
    const activeMap = maps.find((m) => m.is_active);
    if (activeMap) {
      setSelectedMapId(activeMap.id);
    }
  }, [maps, selectedMapId]);

  const selectedObject = selectedMapData?.objects.find((o) => o.id === selectedObjectId);
  const spriteMap = new Map(sprites.map((s) => [s.id, s]));

  // Create displayMap with local bg values for live preview
  const displayMap = useMemo(() => {
    if (!selectedMapData) return null;
    return {
      ...selectedMapData,
      bg_scale: localBgScale,
      bg_rotation: localBgRotation,
      bg_offset_x: localBgOffsetX,
      bg_offset_y: localBgOffsetY,
      bg_opacity: localBgOpacity,
    };
  }, [selectedMapData, localBgScale, localBgRotation, localBgOffsetX, localBgOffsetY, localBgOpacity]);

  // Create displayObjects with local editing values for live preview
  const displayObjects = useMemo(() => {
    if (!selectedMapData?.objects) return [];
    if (!selectedObjectId || Object.keys(editingObjectData).length === 0) {
      return selectedMapData.objects;
    }
    return selectedMapData.objects.map((obj) =>
      obj.id === selectedObjectId
        ? {
            ...obj,
            scale: editingObjectData.scale ?? obj.scale,
            rotation: editingObjectData.rotation ?? obj.rotation,
          }
        : obj
    );
  }, [selectedMapData?.objects, selectedObjectId, editingObjectData]);

  const handleCreateMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapFormData.name) return;
    const created = await createMap.mutateAsync({ ...mapFormData, ship_id: shipId });
    setSelectedMapId(created.id);
    setMapFormData({ name: '', description: '' });
    setShowMapForm(false);
  };

  const handleDeleteMap = async (map: SectorMap) => {
    if (!window.confirm(`Delete map "${map.name}" and all its objects?`)) return;
    await deleteMap.mutateAsync(map.id);
    if (selectedMapId === map.id) setSelectedMapId(null);
  };

  const handleHexClick = useCallback(
    (q: number, r: number) => {
      if (!selectedMapId) return;

      // Quick waypoint placement mode
      if (activePresetSlot !== null) {
        const preset = gmPresets.find((p) => p.pin_order === activePresetSlot);
        if (preset) {
          // Delete existing waypoint with this color (one per preset)
          const existing = (selectedMapData?.waypoints ?? []).find(
            (wp) => wp.created_by === 'gm' && wp.color === preset.color
          );
          if (existing) {
            deleteWaypoint.mutate(existing.id);
          }
          createWaypoint.mutate({
            mapId: selectedMapId,
            data: {
              hex_q: q,
              hex_r: r,
              color: preset.color,
              symbol: preset.symbol,
              label: preset.name ?? undefined,
              text_color: preset.text_color,
              background_color: preset.background_color,
              show_label: preset.show_label,
              created_by: 'gm',
            },
          });
          setActivePresetSlot(null);
        }
        return;
      }

      // Move selected unlocked object to clicked hex
      if (selectedObjectId && selectedObject && !selectedObject.locked) {
        updateObject.mutate({ id: selectedObjectId, data: { hex_q: q, hex_r: r } });
        setSelectedObjectId(null);
        return;
      }

      // Place selected sprite
      if (selectedSpriteId) {
        createObject.mutate({ mapId: selectedMapId, data: { sprite_id: selectedSpriteId, hex_q: q, hex_r: r } });
        return;
      }
    },
    [selectedMapId, activePresetSlot, gmPresets, selectedMapData?.waypoints, selectedObjectId, selectedObject, selectedSpriteId, createWaypoint, deleteWaypoint, createObject, updateObject]
  );

  const handleObjectClick = useCallback(
    (obj: SectorMapObject) => {
      if (selectedObjectId === obj.id) {
        setSelectedObjectId(null);
        setEditingObjectData({});
      } else {
        setSelectedObjectId(obj.id);
        setEditingObjectData({
          label: obj.label ?? '',
          description: obj.description ?? '',
          scale: obj.scale,
          rotation: obj.rotation,
        });
      }
    },
    [selectedObjectId]
  );

  const handleObjectDrop = useCallback(
    (objId: string, q: number, r: number) => {
      updateObject.mutate({ id: objId, data: { hex_q: q, hex_r: r } });
    },
    [updateObject]
  );

  const handleObjectSave = async () => {
    if (!selectedObjectId) return;
    await updateObject.mutateAsync({ id: selectedObjectId, data: editingObjectData });
    setSelectedObjectId(null);
    setEditingObjectData({});
  };

  const handleToggleLock = (obj: SectorMapObject) => {
    updateObject.mutate({ id: obj.id, data: { locked: !obj.locked } });
  };

  const handleCycleVisibility = (obj: SectorMapObject) => {
    const current: VisibilityState = obj.visibility_state ?? 'visible';
    const next = VIS_STATES[(VIS_STATES.indexOf(current) + 1) % VIS_STATES.length];
    updateObject.mutate({ id: obj.id, data: { visibility_state: next } });
  };

  const handleDeleteObject = async (obj: SectorMapObject) => {
    await deleteObject.mutateAsync(obj.id);
    if (selectedObjectId === obj.id) {
      setSelectedObjectId(null);
      setEditingObjectData({});
    }
  };

  // Resize handle pointer events
  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    resizingRef.current = true;
    resizeStartRef.current = { x: e.clientX, width: inspectorWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [inspectorWidth]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizingRef.current) return;
    const dx = resizeStartRef.current.x - e.clientX; // drag left = wider
    const newWidth = Math.max(180, Math.min(520, resizeStartRef.current.width + dx));
    setInspectorWidth(newWidth);
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizingRef.current = false;
  }, []);

  const interactionMode = activePresetSlot !== null
    ? 'waypoint'
    : selectedSpriteId
    ? 'place'
    : selectedObjectId
    ? 'select'
    : 'view';

  return (
    <div
      className="sector-editor"
      style={{ gridTemplateColumns: `200px 1fr ${inspectorWidth}px` }}
    >
      {/* Map list sidebar */}
      <div className="sector-editor__sidebar">
        <div className="sector-editor__sidebar-header">
          <span>Maps</span>
          <button className="btn btn-small btn-primary" onClick={() => setShowMapForm(true)}>+</button>
        </div>

        {showMapForm && (
          <form className="sector-map-create-form" onSubmit={handleCreateMap}>
            <input
              value={mapFormData.name}
              onChange={(e) => setMapFormData((d) => ({ ...d, name: e.target.value }))}
              placeholder="Map name"
              required
              autoFocus
            />
            <div className="sector-map-create-form__actions">
              <button type="submit" className="btn btn-small btn-primary">Create</button>
              <button type="button" className="btn btn-small" onClick={() => setShowMapForm(false)}>Cancel</button>
            </div>
          </form>
        )}

        {mapsLoading ? (
          <p className="admin-loading">Loading...</p>
        ) : (
          <ul className="sector-map-list">
            {maps.map((map) => (
              <li
                key={map.id}
                className={`sector-map-list__item ${selectedMapId === map.id ? 'sector-map-list__item--selected' : ''}`}
                onClick={() => { setSelectedMapId(map.id); setSelectedObjectId(null); setActivePresetSlot(null); }}
              >
                <div className="sector-map-list__info">
                  <span className="sector-map-list__name">{map.name}</span>
                  {map.is_active && <span className="sector-map-list__active-badge">LIVE</span>}
                </div>
                <div className="sector-map-list__actions">
                  {map.is_active ? (
                    <button
                      className="btn btn-small btn-warning"
                      onClick={(e) => { e.stopPropagation(); deactivate.mutate(map.id); }}
                      title="Hide from players"
                    >
                      Hide
                    </button>
                  ) : (
                    <button
                      className="btn btn-small btn-primary"
                      onClick={(e) => { e.stopPropagation(); setActive.mutate(map.id); }}
                      title="Show to players"
                    >
                      Show
                    </button>
                  )}
                  <button
                    className="btn btn-small btn-danger"
                    onClick={(e) => { e.stopPropagation(); handleDeleteMap(map); }}
                    title="Delete map"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Main canvas */}
      <div className="sector-editor__canvas">
        {!selectedMapId ? (
          <div className="sector-editor__empty">
            <p>Select or create a map to start editing</p>
          </div>
        ) : !displayMap ? (
          <p className="admin-loading">Loading map...</p>
        ) : (
          <SectorMapHexGrid
            map={displayMap}
            objects={displayObjects}
            sprites={sprites}
            waypoints={selectedMapData?.waypoints ?? []}
            gmView
            interaction={{
              mode: interactionMode,
              selectedSpriteId: selectedSpriteId ?? undefined,
              selectedObjectId: selectedObjectId ?? undefined,
            }}
            onHexClick={handleHexClick}
            onObjectClick={handleObjectClick}
            onObjectDrop={handleObjectDrop}
          />
        )}
      </div>

      {/* Right panel with resize handle */}
      <div className="sector-editor__inspector">
        {/* Resize drag handle */}
        <div
          className="sector-editor__resize-handle"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
        />

        {/* Settings panel OR normal inspector content */}
        {showSettings && selectedMapData ? (
          <MapSettingsPanel
            map={selectedMapData}
            localBgScale={localBgScale}
            localBgRotation={localBgRotation}
            localBgOffsetX={localBgOffsetX}
            localBgOffsetY={localBgOffsetY}
            localBgOpacity={localBgOpacity}
            setLocalBgScale={setLocalBgScale}
            setLocalBgRotation={setLocalBgRotation}
            setLocalBgOffsetX={setLocalBgOffsetX}
            setLocalBgOffsetY={setLocalBgOffsetY}
            setLocalBgOpacity={setLocalBgOpacity}
            onBack={() => setShowSettings(false)}
          />
        ) : (
          <>
        {/* Quick Waypoints */}
        {selectedMapId && gmPresets.length > 0 && (
          <div className="sector-inspector__section sector-inspector__section--compact">
            <div className="sector-quick-waypoints">
              <div className="sector-quick-waypoints__header">
                <span className="sector-quick-waypoints__label">Waypoints</span>
                {(selectedMapData?.waypoints ?? []).filter((wp) => wp.created_by === 'gm').length > 0 && (
                  <button
                    className="sector-quick-waypoints__clear"
                    onClick={() => selectedMapId && clearGmWaypoints.mutate(selectedMapId)}
                    title="Clear all GM waypoints"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="sector-quick-waypoints__buttons">
                {gmPresets.filter((p) => p.is_pinned).map((preset) => {
                  const isUsed = (selectedMapData?.waypoints ?? []).some(
                    (wp) => wp.created_by === 'gm' && wp.color === preset.color
                  );
                  const isActive = activePresetSlot === preset.pin_order;
                  return (
                    <button
                      key={preset.id}
                      className={[
                        'sector-quick-waypoint-btn',
                        isUsed ? 'sector-quick-waypoint-btn--used' : '',
                        isActive ? 'sector-quick-waypoint-btn--active' : '',
                      ].filter(Boolean).join(' ')}
                      style={{ '--wp-color': preset.color } as React.CSSProperties}
                      onClick={() => {
                        if (isUsed) {
                          // Clear this waypoint
                          const existing = (selectedMapData?.waypoints ?? []).find(
                            (wp) => wp.created_by === 'gm' && wp.color === preset.color
                          );
                          if (existing) deleteWaypoint.mutate(existing.id);
                        } else {
                          // Select for placement
                          setActivePresetSlot(isActive ? null : preset.pin_order);
                          setSelectedSpriteId(null);
                          setSelectedObjectId(null);
                        }
                      }}
                      title={isUsed ? `Clear ${preset.name ?? 'waypoint'}` : `Place ${preset.name ?? 'waypoint'}`}
                    >
                      <span className="sector-quick-waypoint-btn__symbol">{preset.symbol}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Sprite picker */}
        <div className="sector-inspector__section">
          <h4>Place Sprite</h4>
          <div className="sector-sprite-actions">
            <button
              className={`btn btn-small ${!selectedSpriteId && activePresetSlot === null ? '' : 'btn-muted'}`}
              onClick={() => { setSelectedSpriteId(null); setActivePresetSlot(null); }}
              title="Select mode — click objects to inspect"
            >
              ✕ Select Mode
            </button>
            <button
              className="btn btn-small btn-primary"
              onClick={() => setShowSpritePicker(true)}
              disabled={!selectedMapId}
            >
              + Choose Sprite
            </button>
          </div>
          {selectedSpriteId && spriteMap.has(selectedSpriteId) && (
            <div className="sector-current-sprite">
              <img src={spriteMap.get(selectedSpriteId)!.image_url} alt="" />
              <span className="sector-current-sprite__name">{spriteMap.get(selectedSpriteId)!.name}</span>
              <span className="sector-current-sprite__hint">Click on map to place</span>
            </div>
          )}
          {sprites.length === 0 && (
            <p className="admin-hint">No sprites available. Add sprites in the <a href="/admin/media">Media Library</a>.</p>
          )}
        </div>

        {showSpritePicker && (
          <SpritePickerModal
            shipId={shipId}
            currentSpriteId={selectedSpriteId ?? undefined}
            onSelect={(sprite) => {
              setSelectedSpriteId(sprite.id);
              setActivePresetSlot(null);
              setShowSpritePicker(false);
            }}
            onClose={() => setShowSpritePicker(false)}
          />
        )}

        {/* Object list */}
        {selectedMapData && selectedMapData.objects.length > 0 && (
          <div className="sector-inspector__section">
            <h4>Map Objects ({selectedMapData.objects.length})</h4>
            <div className="sector-object-list">
              {selectedMapData.objects.map((obj) => {
                const sprite = obj.sprite_id ? spriteMap.get(obj.sprite_id) : undefined;
                return (
                  <div
                    key={obj.id}
                    className={`sector-object-row ${selectedObjectId === obj.id ? 'sector-object-row--selected' : ''}`}
                    onClick={() => { handleObjectClick(obj); setActivePresetSlot(null); }}
                  >
                    {sprite ? (
                      <img src={sprite.image_url} className="sector-object-row__thumb" alt="" />
                    ) : (
                      <div className="sector-object-row__thumb sector-object-row__thumb--fallback">○</div>
                    )}
                    <span className="sector-object-row__label">
                      {obj.label || sprite?.name || 'Object'}
                    </span>
                    <span className="sector-object-row__vis" title={obj.visibility_state}>
                      {obj.visibility_state === 'visible' ? '👁' : obj.visibility_state === 'hidden' ? '◌' : '?'}
                    </span>
                    <button
                      className="sector-object-row__delete"
                      onClick={(e) => { e.stopPropagation(); handleDeleteObject(obj); }}
                      title="Delete object"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Object inspector */}
        {selectedObject && (
          <div className="sector-inspector__section sector-inspector__object">
            <h4>Selected Object</h4>
            <div className="sector-obj-inspector">
              {selectedObject.sprite_id && spriteMap.has(selectedObject.sprite_id) && (
                <div className="sector-obj-inspector__sprite-row">
                  <img
                    src={spriteMap.get(selectedObject.sprite_id)!.image_url}
                    alt=""
                    className="sector-obj-inspector__sprite-img"
                  />
                  <span>{spriteMap.get(selectedObject.sprite_id)!.name}</span>
                </div>
              )}

              <div className="form-row">
                <label>Label</label>
                <input
                  type="text"
                  value={editingObjectData.label ?? ''}
                  onChange={(e) => setEditingObjectData((d) => ({ ...d, label: e.target.value }))}
                  placeholder="Station Alpha"
                />
              </div>
              <div className="form-row">
                <label>Description</label>
                <textarea
                  value={editingObjectData.description ?? ''}
                  onChange={(e) => setEditingObjectData((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Shown to players when they click..."
                  rows={2}
                />
              </div>
              <div className="form-row">
                <label>Scale</label>
                <input
                  type="range" min={0.25} max={10} step={0.25}
                  value={editingObjectData.scale ?? selectedObject.scale}
                  onChange={(e) => setEditingObjectData((d) => ({ ...d, scale: parseFloat(e.target.value) }))}
                  onPointerUp={(e) => updateObject.mutate({
                    id: selectedObject.id,
                    data: { scale: parseFloat(e.currentTarget.value) },
                  })}
                />
                <span className="sector-slider-val">
                  {(editingObjectData.scale ?? selectedObject.scale).toFixed(2)}×
                </span>
              </div>
              <div className="form-row">
                <label>Rotation</label>
                <input
                  type="range" min={-180} max={180} step={5}
                  value={editingObjectData.rotation ?? selectedObject.rotation ?? 0}
                  onChange={(e) => setEditingObjectData((d) => ({ ...d, rotation: parseFloat(e.target.value) }))}
                  onPointerUp={(e) => updateObject.mutate({
                    id: selectedObject.id,
                    data: { rotation: parseFloat(e.currentTarget.value) },
                  })}
                />
                <span className="sector-slider-val">
                  {Math.round(editingObjectData.rotation ?? selectedObject.rotation ?? 0)}°
                </span>
              </div>

              <div className="sector-obj-inspector__toggles">
                <button
                  className={`btn btn-small ${selectedObject.locked ? 'btn-warning' : ''}`}
                  onClick={() => handleToggleLock(selectedObject)}
                  title={selectedObject.locked ? 'Unlock' : 'Lock'}
                >
                  {selectedObject.locked ? '🔒 Locked' : '🔓 Unlocked'}
                </button>
                <button
                  className={`btn btn-small ${VIS_BTN_CLASSES[selectedObject.visibility_state ?? 'visible']}`}
                  onClick={() => handleCycleVisibility(selectedObject)}
                  title="Click to cycle visibility state"
                >
                  {VIS_LABELS[selectedObject.visibility_state ?? 'visible']}
                </button>
              </div>

              <div className="sector-obj-inspector__coords">
                q: {selectedObject.hex_q}, r: {selectedObject.hex_r}
                {!selectedObject.locked && (
                  <span className="sector-obj-inspector__move-hint"> — drag or click hex to move</span>
                )}
              </div>

              <div className="sector-obj-inspector__footer">
                <button className="btn btn-primary" onClick={handleObjectSave}>Save</button>
                <button className="btn btn-danger" onClick={() => handleDeleteObject(selectedObject)}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Waypoints list */}
        {selectedMapData && (selectedMapData.waypoints?.length ?? 0) > 0 && (
          <div className="sector-inspector__section">
            <h4>Waypoints ({selectedMapData.waypoints?.length ?? 0})</h4>
            <div className="sector-object-list">
              {(selectedMapData.waypoints ?? []).map((wp) => (
                <div key={wp.id} className="sector-object-row">
                  <div
                    className="sector-object-row__thumb sector-object-row__thumb--waypoint"
                    style={{ background: wp.color }}
                  />
                  <span className="sector-object-row__label">
                    {wp.label || `${wp.hex_q}, ${wp.hex_r}`}
                  </span>
                  <span className="sector-object-row__vis" title={`Created by ${wp.created_by}`}>
                    {wp.created_by === 'gm' ? 'GM' : 'PLR'}
                  </span>
                  <button
                    className="sector-object-row__delete"
                    onClick={() => deleteWaypoint.mutate(wp.id)}
                    title="Delete waypoint"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map settings gear button */}
        {selectedMapData && (
          <div className="sector-inspector__section sector-inspector__section--compact">
            <button
              className="btn btn-small sector-settings-btn"
              onClick={() => setShowSettings(true)}
              title="Map Settings"
            >
              ⚙ Map Settings
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function AdminSectorMap() {
  const shipId = useCurrentShipId();
  const [tab, setTab] = useState<'editor' | 'waypoints'>('editor');

  if (!shipId) return <p className="admin-loading">No ship selected.</p>;

  return (
    <div className="admin-sector-map">
      <div className="admin-header">
        <h2>Sector Map</h2>
        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === 'editor' ? 'admin-tab--active' : ''}`}
            onClick={() => setTab('editor')}
          >
            Map Editor
          </button>
          <button
            className={`admin-tab ${tab === 'waypoints' ? 'admin-tab--active' : ''}`}
            onClick={() => setTab('waypoints')}
          >
            Waypoints
          </button>
        </div>
      </div>

      {tab === 'waypoints' ? (
        <WaypointsTab shipId={shipId} />
      ) : (
        <MapEditorTab shipId={shipId} />
      )}
    </div>
  );
}
