import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useHolomapLayers, useHolomapLayer } from '../../hooks/useShipData';
import {
  useCreateHolomapLayer,
  useUpdateHolomapLayer,
  useDeleteHolomapLayer,
  useCreateHolomapMarker,
  useUpdateHolomapMarker,
  useDeleteHolomapMarker,
} from '../../hooks/useMutations';
import { holomapApi } from '../../services/api';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { PlaceholderDeckPlan } from '../../components/shared/PlaceholderDeckPlan';
import type { HolomapLayer, HolomapMarker, MarkerType, EventSeverity, HolomapImageUploadResponse } from '../../types';
import './Admin.css';
import './AdminHolomap.css';

// Recommended aspect ratio for holomap widget (matches the widget canvas area)
const RECOMMENDED_ASPECT_RATIO = 1.0; // Square is ideal for the widget

const MARKER_TYPES: { value: MarkerType; label: string; icon: string }[] = [
  { value: 'crew', label: 'Crew', icon: '●' },
  { value: 'objective', label: 'Objective', icon: '◆' },
  { value: 'hazard', label: 'Hazard', icon: '⚠' },
  { value: 'breach', label: 'Breach', icon: '◯' },
  { value: 'fire', label: 'Fire', icon: '🔥' },
  { value: 'damage', label: 'Damage', icon: '✕' },
  { value: 'other', label: 'Other', icon: '○' },
];

const SEVERITY_OPTIONS: { value: EventSeverity | ''; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

export function AdminHolomap() {
  const shipId = useCurrentShipId();
  const queryClient = useQueryClient();
  const { data: layers, isLoading } = useHolomapLayers(shipId ?? undefined);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const { data: selectedLayer } = useHolomapLayer(selectedLayerId || '');

  // Layer form state
  const [showLayerForm, setShowLayerForm] = useState(false);
  const [layerFormData, setLayerFormData] = useState({
    name: '',
    deck_level: '',
  });

  // Image editing state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageInfo, setImageInfo] = useState<HolomapImageUploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Marker state
  const [editingMarker, setEditingMarker] = useState<HolomapMarker | null>(null);
  const [placingMarker, setPlacingMarker] = useState(false);
  const [newMarkerType, setNewMarkerType] = useState<MarkerType>('crew');

  // Drag state for marker repositioning
  const [dragState, setDragState] = useState<{
    markerId: string;
    currentX: number;
    currentY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Mutations
  const createLayer = useCreateHolomapLayer();
  const updateLayer = useUpdateHolomapLayer();
  const deleteLayer = useDeleteHolomapLayer();
  const createMarker = useCreateHolomapMarker();
  const updateMarker = useUpdateHolomapMarker();
  const deleteMarker = useDeleteHolomapMarker();

  // Auto-select first layer
  if (layers?.length && !selectedLayerId) {
    setSelectedLayerId(layers[0].id);
  }

  const handleCreateLayer = () => {
    if (!layerFormData.name) {
      alert('Please enter a layer name');
      return;
    }
    createLayer.mutate(
      {
        ship_id: shipId ?? '',
        name: layerFormData.name,
        deck_level: layerFormData.deck_level || undefined,
        image_url: 'placeholder',
        sort_order: (layers?.length || 0) + 1,
      },
      {
        onSuccess: (newLayer) => {
          setShowLayerForm(false);
          setLayerFormData({ name: '', deck_level: '' });
          setSelectedLayerId(newLayer.id);
        },
      }
    );
  };

  const handleDeleteLayer = (layer: HolomapLayer) => {
    if (window.confirm(`Delete "${layer.name}"? All markers will be removed.`)) {
      deleteLayer.mutate(layer.id, {
        onSuccess: () => {
          if (selectedLayerId === layer.id) {
            setSelectedLayerId(layers?.[0]?.id || null);
          }
        },
      });
    }
  };

  const handleToggleVisibility = (layer: HolomapLayer) => {
    updateLayer.mutate({
      id: layer.id,
      data: { visible: !layer.visible },
    });
  };

  // Image upload handlers
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLayerId) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await holomapApi.uploadLayerImage(selectedLayerId, file);
      setImageInfo(result);
      // Invalidate queries to refresh layer data
      queryClient.invalidateQueries({ queryKey: ['holomap-layer', selectedLayerId] });
      queryClient.invalidateQueries({ queryKey: ['holomap-layers'] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteImage = async () => {
    if (!selectedLayerId) return;
    if (!window.confirm('Remove this image and revert to placeholder?')) return;

    try {
      await holomapApi.deleteLayerImage(selectedLayerId);
      setImageInfo(null);
      queryClient.invalidateQueries({ queryKey: ['holomap-layer', selectedLayerId] });
      queryClient.invalidateQueries({ queryKey: ['holomap-layers'] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleScaleChange = (scale: number) => {
    if (!selectedLayerId) return;
    updateLayer.mutate({
      id: selectedLayerId,
      data: { image_scale: scale },
    });
  };

  const handleOffsetChange = (axis: 'x' | 'y', value: number) => {
    if (!selectedLayerId) return;
    updateLayer.mutate({
      id: selectedLayerId,
      data: axis === 'x' ? { image_offset_x: value } : { image_offset_y: value },
    });
  };

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Don't place marker if dragging or not in placing mode
      if (dragState || !placingMarker || !selectedLayerId || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // Clamp to 0-1 range
      const clampedX = Math.max(0, Math.min(1, x));
      const clampedY = Math.max(0, Math.min(1, y));

      createMarker.mutate(
        {
          layerId: selectedLayerId,
          data: {
            type: newMarkerType,
            x: clampedX,
            y: clampedY,
            label: '',
          },
        },
        {
          onSuccess: (marker) => {
            setPlacingMarker(false);
            setEditingMarker(marker);
          },
        }
      );
    },
    [dragState, placingMarker, selectedLayerId, newMarkerType, createMarker]
  );

  const handleMarkerClick = (marker: HolomapMarker, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMarker(marker);
    setPlacingMarker(false);
  };

  const handleSaveMarker = () => {
    if (!editingMarker) return;
    updateMarker.mutate(
      {
        id: editingMarker.id,
        data: {
          type: editingMarker.type,
          label: editingMarker.label,
          description: editingMarker.description,
          severity: editingMarker.severity,
          visible: editingMarker.visible,
        },
      },
      {
        onSuccess: () => setEditingMarker(null),
      }
    );
  };

  const handleDeleteMarker = () => {
    if (!editingMarker) return;
    if (window.confirm('Delete this marker?')) {
      deleteMarker.mutate(editingMarker.id, {
        onSuccess: () => setEditingMarker(null),
      });
    }
  };

  // Drag handlers for marker repositioning
  const handleMarkerMouseDown = useCallback(
    (e: React.MouseEvent, marker: HolomapMarker) => {
      e.stopPropagation();
      e.preventDefault();
      setDragState({
        markerId: marker.id,
        currentX: marker.x,
        currentY: marker.y,
      });
    },
    []
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragState || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // Clamp to 0-1 range
      const clampedX = Math.max(0, Math.min(1, x));
      const clampedY = Math.max(0, Math.min(1, y));

      setDragState({
        ...dragState,
        currentX: clampedX,
        currentY: clampedY,
      });
    },
    [dragState]
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (dragState) {
      // Commit the drag position
      updateMarker.mutate({
        id: dragState.markerId,
        data: {
          x: dragState.currentX,
          y: dragState.currentY,
        },
      });
      setDragState(null);
    }
  }, [dragState, updateMarker]);

  const handleCanvasMouseLeave = useCallback(() => {
    // Cancel drag if mouse leaves canvas
    if (dragState) {
      setDragState(null);
    }
  }, [dragState]);

  // Check if layer has custom image
  const hasCustomImage = selectedLayer && selectedLayer.image_url && selectedLayer.image_url !== 'placeholder';

  if (isLoading) {
    return <div className="loading">Loading holomap data...</div>;
  }

  return (
    <div className="admin-holomap">
      <div className="admin-header">
        <h2 className="admin-page-title">Holomap / Deck Plans</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowLayerForm(!showLayerForm)}
        >
          {showLayerForm ? 'Cancel' : '+ New Layer'}
        </button>
      </div>

      {/* Layer creation form */}
      {showLayerForm && (
        <div className="create-form">
          <h3>Add Deck Layer</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Layer Name</label>
              <input
                type="text"
                value={layerFormData.name}
                onChange={(e) => setLayerFormData({ ...layerFormData, name: e.target.value })}
                placeholder="e.g., Deck 1 - Command"
              />
            </div>
            <div className="form-field">
              <label>Deck Level</label>
              <input
                type="text"
                value={layerFormData.deck_level}
                onChange={(e) => setLayerFormData({ ...layerFormData, deck_level: e.target.value })}
                placeholder="e.g., 1, 2, 3"
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleCreateLayer}>
              Create Layer
            </button>
          </div>
        </div>
      )}

      <div className="holomap-editor">
        {/* Layer list */}
        <div className="layer-panel">
          <h3>Layers</h3>
          {layers?.length === 0 && (
            <p className="empty-hint">No layers yet. Create one to get started.</p>
          )}
          <ul className="layer-list">
            {layers?.map((layer) => (
              <li
                key={layer.id}
                className={`layer-item ${selectedLayerId === layer.id ? 'selected' : ''}`}
                onClick={() => setSelectedLayerId(layer.id)}
              >
                <span className="layer-name">{layer.name}</span>
                <span className="layer-level">{layer.deck_level || '—'}</span>
                <div className="layer-actions">
                  <button
                    className={`btn btn-icon ${layer.visible ? '' : 'muted'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVisibility(layer);
                    }}
                    title={layer.visible ? 'Hide' : 'Show'}
                  >
                    {layer.visible ? '👁' : '🚫'}
                  </button>
                  <button
                    className="btn btn-icon btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLayer(layer);
                    }}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Image Editor Section */}
          {selectedLayer && (
            <div className="image-editor-section">
              <h3>Layer Image</h3>

              {/* Upload controls */}
              <div className="image-upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.gif,.webp,.svg"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  id="layer-image-upload"
                />
                <label htmlFor="layer-image-upload" className="btn upload-btn">
                  {isUploading ? 'Uploading...' : hasCustomImage ? 'Replace Image' : 'Upload Image'}
                </label>
                {hasCustomImage && (
                  <button className="btn btn-danger" onClick={handleDeleteImage}>
                    Remove
                  </button>
                )}
              </div>

              {uploadError && (
                <div className="upload-error">{uploadError}</div>
              )}

              {/* Aspect ratio info */}
              <div className="aspect-ratio-info">
                <span className="info-label">Recommended:</span>
                <span className="info-value">{RECOMMENDED_ASPECT_RATIO}:1 (square)</span>
              </div>
              {imageInfo && imageInfo.width > 0 && (
                <div className="aspect-ratio-info">
                  <span className="info-label">Current:</span>
                  <span className="info-value">
                    {imageInfo.width}x{imageInfo.height} ({imageInfo.aspect_ratio}:1)
                  </span>
                </div>
              )}

              {/* Scale control */}
              <div className="form-field">
                <label>Scale: {selectedLayer.image_scale?.toFixed(2) ?? 1}x</label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.05"
                  value={selectedLayer.image_scale ?? 1}
                  onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                  className="range-slider"
                />
              </div>

              {/* Offset controls */}
              <div className="form-field">
                <label>Offset X: {((selectedLayer.image_offset_x ?? 0) * 100).toFixed(0)}%</label>
                <input
                  type="range"
                  min="-0.5"
                  max="0.5"
                  step="0.01"
                  value={selectedLayer.image_offset_x ?? 0}
                  onChange={(e) => handleOffsetChange('x', parseFloat(e.target.value))}
                  className="range-slider"
                />
              </div>

              <div className="form-field">
                <label>Offset Y: {((selectedLayer.image_offset_y ?? 0) * 100).toFixed(0)}%</label>
                <input
                  type="range"
                  min="-0.5"
                  max="0.5"
                  step="0.01"
                  value={selectedLayer.image_offset_y ?? 0}
                  onChange={(e) => handleOffsetChange('y', parseFloat(e.target.value))}
                  className="range-slider"
                />
              </div>

              {/* Reset button */}
              <button
                className="btn"
                onClick={() => {
                  handleScaleChange(1);
                  handleOffsetChange('x', 0);
                  handleOffsetChange('y', 0);
                }}
              >
                Reset Transform
              </button>
            </div>
          )}
        </div>

        {/* Deck canvas */}
        <div className="canvas-panel">
          <div className="canvas-toolbar">
            <div className="toolbar-group">
              <label>Marker Type:</label>
              <select
                value={newMarkerType}
                onChange={(e) => setNewMarkerType(e.target.value as MarkerType)}
              >
                {MARKER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              className={`btn ${placingMarker ? 'btn-primary' : ''}`}
              onClick={() => setPlacingMarker(!placingMarker)}
              disabled={!selectedLayerId}
            >
              {placingMarker ? 'Cancel Placement' : '+ Place Marker'}
            </button>
          </div>

          <div
            className={`deck-canvas ${placingMarker ? 'placing' : ''}${dragState ? ' dragging' : ''}`}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseLeave}
          >
            {selectedLayer ? (
              <>
                {/* Content layer - contains both image/placeholder and markers */}
                {/* Click events and marker positioning are relative to this layer */}
                <div
                  ref={canvasRef}
                  className="deck-content-layer"
                  style={hasCustomImage ? {
                    transform: `scale(${selectedLayer.image_scale ?? 1}) translate(${(selectedLayer.image_offset_x ?? 0) * 100}%, ${(selectedLayer.image_offset_y ?? 0) * 100}%)`,
                  } : undefined}
                  onClick={handleCanvasClick}
                >
                  {/* Background image or placeholder */}
                  {hasCustomImage ? (
                    <img
                      src={selectedLayer.image_url}
                      alt={selectedLayer.name}
                      className="deck-image"
                    />
                  ) : (
                    <PlaceholderDeckPlan
                      className="deck-placeholder"
                      deckLevel={selectedLayer.deck_level}
                    />
                  )}

                  {/* Markers - inside content layer so they transform with the image */}
                  {selectedLayer.markers?.map((marker) => {
                    const isDragging = dragState?.markerId === marker.id;
                    const displayX = isDragging ? dragState.currentX : marker.x;
                    const displayY = isDragging ? dragState.currentY : marker.y;

                    return (
                      <div
                        key={marker.id}
                        className={`editor-marker type-${marker.type} ${editingMarker?.id === marker.id ? 'selected' : ''} ${marker.visible === false ? 'hidden-marker' : ''}${isDragging ? ' dragging' : ''}`}
                        style={{
                          left: `${displayX * 100}%`,
                          top: `${displayY * 100}%`,
                          cursor: isDragging ? 'grabbing' : 'grab',
                        }}
                        onClick={(e) => !isDragging && handleMarkerClick(marker, e)}
                        onMouseDown={(e) => handleMarkerMouseDown(e, marker)}
                        title={marker.label || marker.type}
                      >
                        {MARKER_TYPES.find((t) => t.value === marker.type)?.icon}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="no-layer-selected">
                Select a layer to view and edit markers
              </div>
            )}
          </div>

          {/* Marker count */}
          {selectedLayer && (
            <div className="canvas-footer">
              {selectedLayer.markers?.length || 0} marker(s) on this layer
            </div>
          )}
        </div>

        {/* Marker editor panel */}
        <div className="marker-panel">
          <h3>Marker Details</h3>
          {editingMarker ? (
            <div className="marker-form">
              <div className="form-field">
                <label>Type</label>
                <select
                  value={editingMarker.type}
                  onChange={(e) =>
                    setEditingMarker({ ...editingMarker, type: e.target.value as MarkerType })
                  }
                >
                  {MARKER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Severity</label>
                <select
                  value={editingMarker.severity || ''}
                  onChange={(e) =>
                    setEditingMarker({
                      ...editingMarker,
                      severity: (e.target.value || undefined) as EventSeverity | undefined,
                    })
                  }
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Label</label>
                <input
                  type="text"
                  value={editingMarker.label || ''}
                  onChange={(e) => setEditingMarker({ ...editingMarker, label: e.target.value })}
                  placeholder="Short label"
                />
              </div>

              <div className="form-field">
                <label>Description</label>
                <textarea
                  value={editingMarker.description || ''}
                  onChange={(e) =>
                    setEditingMarker({ ...editingMarker, description: e.target.value })
                  }
                  placeholder="Detailed description"
                  rows={3}
                />
              </div>

              <div className="form-field">
                <label>Position {dragState?.markerId === editingMarker.id && '(dragging)'}</label>
                <div className="position-display">
                  X: {((dragState?.markerId === editingMarker.id ? dragState.currentX : editingMarker.x) * 100).toFixed(1)}% | Y: {((dragState?.markerId === editingMarker.id ? dragState.currentY : editingMarker.y) * 100).toFixed(1)}%
                </div>
              </div>

              <div className="form-field visibility-toggle">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingMarker.visible !== false}
                    onChange={(e) =>
                      setEditingMarker({ ...editingMarker, visible: e.target.checked })
                    }
                  />
                  <span>Visible to Players</span>
                </label>
                <span className="visibility-hint">
                  {editingMarker.visible !== false ? 'Players can see this marker' : 'Hidden from player view'}
                </span>
              </div>

              <div className="marker-actions">
                <button className="btn btn-primary" onClick={handleSaveMarker}>
                  Save
                </button>
                <button className="btn" onClick={() => setEditingMarker(null)}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={handleDeleteMarker}>
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <p className="empty-hint">
              Click a marker to edit, or use "Place Marker" to add new ones.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
