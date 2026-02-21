import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { widgetAssetsApi } from '../../services/api';
import './Admin.css';
import './AdminMedia.css';

interface Asset {
  image_url: string;
  filename: string;
}

function ImageLightbox({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  return createPortal(
    <div className="media-lightbox-overlay" onClick={onClose}>
      <div className="media-lightbox" onClick={(e) => e.stopPropagation()}>
        <button className="media-lightbox__close" onClick={onClose}>×</button>
        <img src={asset.image_url} alt={asset.filename} className="media-lightbox__image" />
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
    if (selected.size === assets.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(assets.map((a) => a.image_url)));
    }
  };

  const allSelected = assets.length > 0 && selected.size === assets.length;

  return (
    <div className="admin-media">
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
            {isUploading ? 'Uploading...' : 'Upload Image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="admin-loading">Loading...</p>
      ) : assets.length === 0 ? (
        <div className="media-empty">
          <p>No images uploaded yet.</p>
          <p className="hint">Use the Upload Image button to add images. Uploaded images can be used in Image Display and Shield widgets.</p>
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
            {assets.map((asset) => {
              const isSelected = selected.has(asset.image_url);
              return (
                <div
                  key={asset.filename}
                  className={`media-card ${isSelected ? 'media-card--selected' : ''}`}
                >
                  <div
                    className="media-card__thumb"
                    onClick={() => setPreviewAsset(asset)}
                    title="Click to preview"
                  >
                    <img src={asset.image_url} alt={asset.filename} />
                    <div className="media-card__thumb-overlay">
                      <span>Preview</span>
                    </div>
                  </div>
                  <div className="media-card__info">
                    <label className="media-card__select">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(asset.image_url)}
                      />
                    </label>
                    <span className="media-card__filename" title={asset.filename}>
                      {asset.filename}
                    </span>
                  </div>
                  <div className="media-card__actions">
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => handleDelete(asset.image_url, asset.filename)}
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
