import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { widgetAssetsApi } from '../../services/api';
import { useSectorMaps, useSectorMap, useSectorSprites } from '../../hooks/useShipData';
import {
  useCreateSectorMap,
  useUpdateSectorMap,
  useDeleteSectorMap,
  useSetActiveSectorMap,
  useDeactivateSectorMap,
  useCreateSectorSprite,
  useUpdateSectorSprite,
  useDeleteSectorSprite,
  useCreateMapObject,
  useUpdateMapObject,
  useDeleteMapObject,
  useCreateWaypoint,
  useDeleteWaypoint,
} from '../../hooks/useMutations';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { SectorMapHexGrid } from '../../components/SectorMapHexGrid';
import { MediaPickerModal } from '../../components/admin/MediaPickerModal';
import type { SectorMap, SectorSprite, SectorMapObject, SpriteCategory, VisibilityState } from '../../types';
import './Admin.css';
import './AdminSectorMap.css';

const CATEGORIES: { value: SpriteCategory; label: string; icon: string }[] = [
  { value: 'celestial', label: 'Celestial', icon: '⬤' },
  { value: 'station', label: 'Station', icon: '⬡' },
  { value: 'ship', label: 'Ship', icon: '◆' },
  { value: 'hazard', label: 'Hazard', icon: '⚠' },
  { value: 'other', label: 'Other', icon: '○' },
];

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
// Sprite Library Tab — media library as source of truth
// ---------------------------------------------------------------------------

function SpriteLibraryTab({ shipId }: { shipId: string }) {
  const queryClient = useQueryClient();
  const { data: sprites = [], isLoading: spritesLoading } = useSectorSprites(shipId);
  const { data: mediaAssets = [], isLoading: mediaLoading } = useQuery({
    queryKey: ['widget-assets'],
    queryFn: () => widgetAssetsApi.list(),
  });

  const createSprite = useCreateSectorSprite();
  const updateSprite = useUpdateSectorSprite();
  const deleteSprite = useDeleteSectorSprite();

  const [filterCategory, setFilterCategory] = useState<SpriteCategory | 'all'>('all');
  const [addingForUrl, setAddingForUrl] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<{
    name: string;
    category: SpriteCategory;
    default_locked: boolean;
  }>({ name: '', category: 'other', default_locked: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<SectorSprite>>({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle direct file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploaded = await widgetAssetsApi.upload(file);
      // Refresh the media assets list
      queryClient.invalidateQueries({ queryKey: ['widget-assets'] });
      // Auto-open the add form for this new asset
      setAddingForUrl(uploaded.image_url);
      setAddForm({ name: file.name.replace(/\.[^.]+$/, ''), category: 'other', default_locked: false });
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const spriteByUrl = new Map(sprites.map((s) => [s.image_url, s]));
  const filteredAssets =
    filterCategory === 'all'
      ? mediaAssets
      : mediaAssets.filter((a) => {
          const sprite = spriteByUrl.get(a.image_url);
          return sprite?.category === filterCategory;
        });

  const handleAddSprite = async (imageUrl: string, filename: string) => {
    await createSprite.mutateAsync({
      ship_id: shipId,
      image_url: imageUrl,
      name: addForm.name || filename.replace(/\.[^.]+$/, ''),
      category: addForm.category,
      default_locked: addForm.default_locked,
    });
    setAddingForUrl(null);
    setAddForm({ name: '', category: 'other', default_locked: false });
  };

  const handleUpdateSprite = async (id: string) => {
    await updateSprite.mutateAsync({ id, data: editData });
    setEditingId(null);
  };

  const handleRemoveSprite = async (sprite: SectorSprite) => {
    if (!window.confirm(`Remove "${sprite.name}" from sprite library? Objects using it will show a fallback.`)) return;
    await deleteSprite.mutateAsync(sprite.id);
  };

  const isLoading = spritesLoading || mediaLoading;

  return (
    <div className="sector-sprites">
      <div className="admin-header">
        <h3>Sprite Library</h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            className="btn btn-primary btn-small"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{ marginRight: 8 }}
          >
            {isUploading ? 'Uploading...' : '+ Upload Sprite'}
          </button>

          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 4 }}>Filter:</span>
          <button
            className={`admin-tab ${filterCategory === 'all' ? 'admin-tab--active' : ''}`}
            onClick={() => setFilterCategory('all')}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              className={`admin-tab ${filterCategory === c.value ? 'admin-tab--active' : ''}`}
              onClick={() => setFilterCategory(c.value)}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="admin-loading">Loading...</p>
      ) : mediaAssets.length === 0 ? (
        <p className="admin-empty">
          No media assets found. Upload images in the{' '}
          <a href="/admin/media" style={{ color: 'var(--color-optimal)' }}>Media Library</a>{' '}
          first, then register them as sprites here.
        </p>
      ) : (
        <div className="sector-sprites__media-list">
          {filteredAssets.map((asset) => {
            const sprite = spriteByUrl.get(asset.image_url);
            const isRegistered = !!sprite;
            const isAddingThis = addingForUrl === asset.image_url;
            const isEditingThis = sprite && editingId === sprite.id;

            return (
              <div
                key={asset.image_url}
                className={`sector-sprite-card ${isRegistered ? 'sector-sprite-card--registered' : ''}`}
              >
                <img src={asset.image_url} className="sector-sprite-card__img" alt={asset.filename} />

                <div className="sector-sprite-card__body">
                  {isEditingThis && sprite ? (
                    <>
                      <input
                        className="sector-sprite-card__name-input"
                        value={editData.name ?? sprite.name}
                        onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                        placeholder="Sprite name"
                      />
                      <select
                        value={editData.category ?? sprite.category}
                        onChange={(e) => setEditData((d) => ({ ...d, category: e.target.value as SpriteCategory }))}
                        style={{ fontSize: 11 }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      <label className="sector-sprite-card__lock-label">
                        <input
                          type="checkbox"
                          checked={editData.default_locked ?? sprite.default_locked}
                          onChange={(e) => setEditData((d) => ({ ...d, default_locked: e.target.checked }))}
                        />
                        Lock by default
                      </label>
                      <div className="sector-sprite-card__actions">
                        <button className="btn btn-small btn-primary" onClick={() => handleUpdateSprite(sprite.id)}>Save</button>
                        <button className="btn btn-small" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </>
                  ) : isRegistered && sprite ? (
                    <>
                      <span className="sector-sprite-card__name">{sprite.name}</span>
                      <span className="sector-sprite-card__category-badge">
                        {CATEGORIES.find((c) => c.value === sprite.category)?.icon}{' '}{sprite.category}
                      </span>
                      {sprite.default_locked && (
                        <span className="sector-sprite-card__badge">locked</span>
                      )}
                      <div className="sector-sprite-card__actions">
                        <button
                          className="btn btn-small"
                          onClick={() => { setEditingId(sprite.id); setEditData({ name: sprite.name, category: sprite.category, default_locked: sprite.default_locked }); }}
                        >Edit</button>
                        <button className="btn btn-small btn-danger" onClick={() => handleRemoveSprite(sprite)}>✕</button>
                      </div>
                    </>
                  ) : isAddingThis ? (
                    <>
                      <input
                        className="sector-sprite-card__name-input"
                        value={addForm.name}
                        onChange={(e) => setAddForm((d) => ({ ...d, name: e.target.value }))}
                        placeholder={asset.filename.replace(/\.[^.]+$/, '')}
                        autoFocus
                      />
                      <select
                        value={addForm.category}
                        onChange={(e) => setAddForm((d) => ({ ...d, category: e.target.value as SpriteCategory }))}
                        style={{ fontSize: 11 }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      <label className="sector-sprite-card__lock-label">
                        <input
                          type="checkbox"
                          checked={addForm.default_locked}
                          onChange={(e) => setAddForm((d) => ({ ...d, default_locked: e.target.checked }))}
                        />
                        Lock by default
                      </label>
                      <div className="sector-sprite-card__actions">
                        <button
                          className="btn btn-small btn-primary"
                          disabled={createSprite.isPending}
                          onClick={() => handleAddSprite(asset.image_url, asset.filename)}
                        >
                          {createSprite.isPending ? '...' : 'Add'}
                        </button>
                        <button className="btn btn-small" onClick={() => setAddingForUrl(null)}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="sector-sprite-card__name" style={{ color: 'var(--color-text-muted)' }}>
                        {asset.filename}
                      </span>
                      <button
                        className="btn btn-small btn-primary"
                        onClick={() => { setAddingForUrl(asset.image_url); setAddForm({ name: '', category: 'other', default_locked: false }); }}
                      >
                        + Add as Sprite
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
// Map Editor Tab
// ---------------------------------------------------------------------------

function MapEditorTab({ shipId }: { shipId: string }) {
  const { data: maps = [], isLoading: mapsLoading } = useSectorMaps(shipId);
  const { data: sprites = [] } = useSectorSprites(shipId);

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

  const [showMapForm, setShowMapForm] = useState(false);
  const [mapFormData, setMapFormData] = useState({ name: '', description: '' });

  const [selectedSpriteId, setSelectedSpriteId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [editingObjectData, setEditingObjectData] = useState<Partial<SectorMapObject>>({});
  const [waypointMode, setWaypointMode] = useState(false);

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

      // Waypoint placement mode
      if (waypointMode) {
        createWaypoint.mutate({ mapId: selectedMapId, data: { hex_q: q, hex_r: r, created_by: 'gm' } });
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
    [selectedMapId, waypointMode, selectedObjectId, selectedObject, selectedSpriteId, createWaypoint, createObject, updateObject]
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

  const interactionMode = waypointMode
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
                onClick={() => { setSelectedMapId(map.id); setSelectedObjectId(null); setWaypointMode(false); }}
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
        {/* Waypoint mode toggle */}
        {selectedMapId && (
          <div className="sector-inspector__section sector-inspector__section--compact">
            <button
              className={`btn btn-small sector-waypoint-mode-btn ${waypointMode ? 'btn-primary' : ''}`}
              onClick={() => {
                setWaypointMode((v) => !v);
                setSelectedSpriteId(null);
                setSelectedObjectId(null);
              }}
            >
              ⬡ {waypointMode ? 'Exit Waypoint Mode' : 'Place Waypoints'}
            </button>
          </div>
        )}

        {/* Sprite picker */}
        <div className="sector-inspector__section">
          <h4>Sprites</h4>
          {sprites.length === 0 ? (
            <p className="admin-empty">Add sprites in the Sprite Library tab first.</p>
          ) : (
            <div className="sector-sprite-picker">
              <button
                className={`sector-sprite-picker__none ${!selectedSpriteId && !waypointMode ? 'sector-sprite-picker__none--active' : ''}`}
                onClick={() => { setSelectedSpriteId(null); setWaypointMode(false); }}
                title="Select mode — click objects to inspect"
              >
                ✕ Select mode
              </button>
              {CATEGORIES.map((cat) => {
                const catSprites = sprites.filter((s) => s.category === cat.value);
                if (catSprites.length === 0) return null;
                return (
                  <div key={cat.value} className="sector-sprite-picker__group">
                    <span className="sector-sprite-picker__cat-label">{cat.icon} {cat.label}</span>
                    <div className="sector-sprite-picker__grid">
                      {catSprites.map((sprite) => (
                        <button
                          key={sprite.id}
                          className={`sector-sprite-picker__item ${selectedSpriteId === sprite.id ? 'sector-sprite-picker__item--active' : ''}`}
                          onClick={() => { setSelectedSpriteId(selectedSpriteId === sprite.id ? null : sprite.id); setWaypointMode(false); }}
                          title={sprite.name}
                        >
                          <img src={sprite.image_url} alt={sprite.name} />
                          <span>{sprite.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
                    onClick={() => { handleObjectClick(obj); setWaypointMode(false); }}
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
  const [tab, setTab] = useState<'library' | 'editor'>('editor');

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
            className={`admin-tab ${tab === 'library' ? 'admin-tab--active' : ''}`}
            onClick={() => setTab('library')}
          >
            Sprite Library
          </button>
        </div>
      </div>

      {tab === 'library' ? (
        <SpriteLibraryTab shipId={shipId} />
      ) : (
        <MapEditorTab shipId={shipId} />
      )}
    </div>
  );
}
