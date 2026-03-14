import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { widgetAssetsApi } from '../../services/api';
import { useCurrentShipId } from '../../contexts/ShipContext';
import { useSectorSprites } from '../../hooks/useShipData';
import {
  useCreateSectorSprite,
  useUpdateSectorSprite,
  useDeleteSectorSprite,
} from '../../hooks/useMutations';
import type { SectorSprite, SpriteCategory } from '../../types';
import './Admin.css';
import './AdminMedia.css';

interface Asset {
  url: string;
  image_url: string;  // backwards compat
  filename: string;
  type: 'image' | 'audio';
}

type AssetFilter = 'all' | 'image' | 'audio';

const CATEGORIES: { value: SpriteCategory; label: string; icon: string }[] = [
  { value: 'celestial', label: 'Celestial', icon: '⬤' },
  { value: 'station', label: 'Station', icon: '⬡' },
  { value: 'ship', label: 'Ship', icon: '◆' },
  { value: 'hazard', label: 'Hazard', icon: '⚠' },
  { value: 'other', label: 'Other', icon: '○' },
];

function ImageLightbox({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  return createPortal(
    <div className="media-lightbox-overlay" onClick={onClose}>
      <div className="media-lightbox" onClick={(e) => e.stopPropagation()}>
        <button className="media-lightbox__close" onClick={onClose}>×</button>
        <img src={asset.url} alt={asset.filename} className="media-lightbox__image" />
        <span className="media-lightbox__filename">{asset.filename}</span>
      </div>
    </div>,
    document.body
  );
}

export function AdminMedia() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sprite state
  const shipId = useCurrentShipId();
  const { data: sprites = [] } = useSectorSprites(shipId ?? '');
  // Map sprites by URL for quick lookup
  const spriteByUrl = new Map(sprites.map((s) => [s.image_url, s]));

  const createSprite = useCreateSectorSprite();
  const updateSprite = useUpdateSectorSprite();
  const deleteSprite = useDeleteSectorSprite();

  const [addingSpriteUrl, setAddingSpriteUrl] = useState<string | null>(null);
  const [editingSpriteId, setEditingSpriteId] = useState<string | null>(null);
  const [spriteForm, setSpriteForm] = useState<{
    name: string;
    category: SpriteCategory;
    default_locked: boolean;
  }>({ name: '', category: 'other', default_locked: false });

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['widget-assets'],
    queryFn: () => widgetAssetsApi.list(),
    staleTime: 30_000,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      await widgetAssetsApi.upload(file);
      await queryClient.invalidateQueries({ queryKey: ['widget-assets'] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (imageUrl: string, filename: string) => {
    if (!window.confirm(`Delete "${filename}"? Any widgets using this image will show a broken image.`)) return;
    try {
      await widgetAssetsApi.delete(imageUrl);
      setSelected((prev) => { const next = new Set(prev); next.delete(imageUrl); return next; });
      await queryClient.invalidateQueries({ queryKey: ['widget-assets'] });
    } catch (err) {
      alert('Delete failed. Please try again.');
      console.error(err);
    }
  };

  const handleDeleteSelected = async () => {
    const count = selected.size;
    if (!window.confirm(`Delete ${count} image${count === 1 ? '' : 's'}? Any widgets using these images will show a broken image.`)) return;
    const toDelete = [...selected];
    try {
      await Promise.all(toDelete.map((url) => widgetAssetsApi.delete(url)));
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ['widget-assets'] });
    } catch (err) {
      alert('Some deletions failed. Please try again.');
      console.error(err);
    }
  };

  const toggleSelect = (imageUrl: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(imageUrl)) next.delete(imageUrl);
      else next.add(imageUrl);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredAssets.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredAssets.map((a) => a.url)));
    }
  };

  // Filter assets by type
  const filteredAssets = filter === 'all'
    ? assets
    : assets.filter((a) => a.type === filter);

  const allSelected = filteredAssets.length > 0 && selected.size === filteredAssets.length;

  // Audio playback
  const toggleAudioPlay = (url: string) => {
    if (playingAudioUrl === url) {
      audioRef.current?.pause();
      setPlayingAudioUrl(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
      setPlayingAudioUrl(url);
    }
  };

  const handleAudioEnded = () => {
    setPlayingAudioUrl(null);
  };

  // Sprite handlers
  const startAddSprite = (asset: Asset) => {
    setAddingSpriteUrl(asset.url);
    setSpriteForm({ name: '', category: 'other', default_locked: false });
  };

  const handleAddSprite = async (asset: Asset) => {
    if (!shipId) return;
    await createSprite.mutateAsync({
      ship_id: shipId,
      image_url: asset.url,
      name: spriteForm.name || asset.filename.replace(/\.[^.]+$/, ''),
      category: spriteForm.category,
      default_locked: spriteForm.default_locked,
    });
    setAddingSpriteUrl(null);
  };

  const startEditSprite = (sprite: SectorSprite) => {
    setEditingSpriteId(sprite.id);
    setSpriteForm({
      name: sprite.name,
      category: sprite.category,
      default_locked: sprite.default_locked,
    });
  };

  const handleUpdateSprite = async (spriteId: string) => {
    await updateSprite.mutateAsync({ id: spriteId, data: spriteForm });
    setEditingSpriteId(null);
  };

  const handleRemoveSprite = async (sprite: SectorSprite) => {
    if (!window.confirm(`Remove "${sprite.name}" from sprites? The media file will remain.`)) return;
    await deleteSprite.mutateAsync(sprite.id);
  };

  return (
    <div className="admin-media">
      {/* Hidden audio element for preview playback */}
      <audio ref={audioRef} onEnded={handleAudioEnded} style={{ display: 'none' }} />

      <div className="admin-header">
        <h2>Media Library</h2>
        <div className="admin-header-actions">
          {uploadError && <span className="upload-error">{uploadError}</span>}
          {selected.size > 0 && (
            <button className="btn btn-danger" onClick={handleDeleteSelected}>
              Delete Selected ({selected.size})
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,audio/mpeg,audio/wav,audio/ogg,audio/webm"
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="media-filter-tabs">
        <button
          className={`media-filter-tab ${filter === 'all' ? 'media-filter-tab--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({assets.length})
        </button>
        <button
          className={`media-filter-tab ${filter === 'image' ? 'media-filter-tab--active' : ''}`}
          onClick={() => setFilter('image')}
        >
          Images ({assets.filter((a) => a.type === 'image').length})
        </button>
        <button
          className={`media-filter-tab ${filter === 'audio' ? 'media-filter-tab--active' : ''}`}
          onClick={() => setFilter('audio')}
        >
          Audio ({assets.filter((a) => a.type === 'audio').length})
        </button>
      </div>

      {isLoading ? (
        <p className="admin-loading">Loading...</p>
      ) : filteredAssets.length === 0 ? (
        <div className="media-empty">
          <p>No {filter === 'all' ? 'media' : filter === 'image' ? 'images' : 'audio files'} uploaded yet.</p>
          <p className="hint">Use the Upload button to add images or audio files.</p>
        </div>
      ) : (
        <>
          <div className="media-toolbar">
            <label className="media-select-all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
              />
              {allSelected ? 'Deselect all' : 'Select all'}
            </label>
            {selected.size > 0 && (
              <span className="media-selection-count">{selected.size} selected</span>
            )}
          </div>

          <div className="media-grid">
            {filteredAssets.map((asset) => {
              const isSelected = selected.has(asset.url);
              const sprite = asset.type === 'image' ? spriteByUrl.get(asset.url) : undefined;
              const isAddingSprite = addingSpriteUrl === asset.url;
              const isEditingSprite = sprite && editingSpriteId === sprite.id;
              const isAudio = asset.type === 'audio';
              const isPlaying = playingAudioUrl === asset.url;

              return (
                <div
                  key={asset.filename}
                  className={`media-card ${isSelected ? 'media-card--selected' : ''} ${sprite ? 'media-card--sprite' : ''} ${isAudio ? 'media-card--audio' : ''}`}
                >
                  {isAudio ? (
                    <div
                      className={`media-card__audio-thumb ${isPlaying ? 'media-card__audio-thumb--playing' : ''}`}
                      onClick={() => toggleAudioPlay(asset.url)}
                      title={isPlaying ? 'Click to stop' : 'Click to play'}
                    >
                      <span className="media-card__audio-icon">{isPlaying ? '⏹' : '▶'}</span>
                      <span className="media-card__audio-label">{isPlaying ? 'Playing...' : 'Play'}</span>
                    </div>
                  ) : (
                    <div
                      className="media-card__thumb"
                      onClick={() => setPreviewAsset(asset)}
                      title="Click to preview"
                    >
                      <img src={asset.url} alt={asset.filename} />
                      <div className="media-card__thumb-overlay">
                        <span>Preview</span>
                      </div>
                      {sprite && (
                        <div className="media-card__sprite-badge">
                          {CATEGORIES.find((c) => c.value === sprite.category)?.icon} Sprite
                        </div>
                      )}
                    </div>
                  )}
                  <div className="media-card__info">
                    <label className="media-card__select">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(asset.url)}
                      />
                    </label>
                    <div className="media-card__details">
                      {sprite && <span className="media-card__sprite-name">{sprite.name}</span>}
                      <span className="media-card__filename" title={asset.filename}>
                        {asset.filename}
                      </span>
                    </div>
                  </div>
                  <div className="media-card__actions">
                    {/* Sprite controls only for images */}
                    {!isAudio && (
                      <>
                        {isAddingSprite ? (
                          <div className="media-card__sprite-form">
                            <input
                              type="text"
                              value={spriteForm.name}
                              onChange={(e) => setSpriteForm((f) => ({ ...f, name: e.target.value }))}
                              placeholder={asset.filename.replace(/\.[^.]+$/, '')}
                              autoFocus
                            />
                            <select
                              value={spriteForm.category}
                              onChange={(e) => setSpriteForm((f) => ({ ...f, category: e.target.value as SpriteCategory }))}
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                              ))}
                            </select>
                            <label className="media-card__sprite-lock">
                              <input
                                type="checkbox"
                                checked={spriteForm.default_locked}
                                onChange={(e) => setSpriteForm((f) => ({ ...f, default_locked: e.target.checked }))}
                              />
                              Lock by default
                            </label>
                            <div className="media-card__sprite-form-actions">
                              <button
                                className="btn btn-small btn-primary"
                                onClick={() => handleAddSprite(asset)}
                                disabled={createSprite.isPending}
                              >
                                {createSprite.isPending ? '...' : 'Save'}
                              </button>
                              <button className="btn btn-small" onClick={() => setAddingSpriteUrl(null)}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : isEditingSprite && sprite ? (
                          <div className="media-card__sprite-form">
                            <input
                              type="text"
                              value={spriteForm.name}
                              onChange={(e) => setSpriteForm((f) => ({ ...f, name: e.target.value }))}
                              placeholder="Sprite name"
                              autoFocus
                            />
                            <select
                              value={spriteForm.category}
                              onChange={(e) => setSpriteForm((f) => ({ ...f, category: e.target.value as SpriteCategory }))}
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                              ))}
                            </select>
                            <label className="media-card__sprite-lock">
                              <input
                                type="checkbox"
                                checked={spriteForm.default_locked}
                                onChange={(e) => setSpriteForm((f) => ({ ...f, default_locked: e.target.checked }))}
                              />
                              Lock by default
                            </label>
                            <div className="media-card__sprite-form-actions">
                              <button
                                className="btn btn-small btn-primary"
                                onClick={() => handleUpdateSprite(sprite.id)}
                                disabled={updateSprite.isPending}
                              >
                                {updateSprite.isPending ? '...' : 'Save'}
                              </button>
                              <button className="btn btn-small" onClick={() => setEditingSpriteId(null)}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : sprite ? (
                          <div className="media-card__sprite-controls">
                            <button className="btn btn-small" onClick={() => startEditSprite(sprite)}>
                              Edit Sprite
                            </button>
                            <button className="btn btn-small btn-warning" onClick={() => handleRemoveSprite(sprite)}>
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-small btn-primary"
                            onClick={() => startAddSprite(asset)}
                            disabled={!shipId}
                            title={!shipId ? 'Select a ship first' : 'Register as map sprite'}
                          >
                            + Add as Sprite
                          </button>
                        )}
                      </>
                    )}
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => handleDelete(asset.url, asset.filename)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {previewAsset && (
        <ImageLightbox asset={previewAsset} onClose={() => setPreviewAsset(null)} />
      )}
    </div>
  );
}
