import { useState, useRef } from 'react';
import { widgetAssetsApi } from '../../services/api';
import type { WidgetRendererProps } from '../../types';
import { getConfig } from '../../types';
import type { GifDisplayConfig } from '../../types';
import './GifDisplayWidget.css';

const STATUS_OPACITY: Record<string, number> = {
  optimal: 1.0,
  operational: 1.0,
  degraded: 0.8,
  compromised: 0.6,
  critical: 0.5,
  destroyed: 0.2,
  offline: 0.15,
};

export function GifDisplayWidget({
  instance,
  systemStates,
  isEditing,
  onConfigChange,
}: WidgetRendererProps) {
  const config = getConfig<GifDisplayConfig>(instance.config);
  const [localImageUrl, setLocalImageUrl] = useState(config.image_url);
  const imageUrl = localImageUrl ?? config.image_url;
  const objectFit = config.object_fit ?? 'contain';
  const baseOpacity = config.opacity ?? 1;
  const statusDim = config.status_dim ?? false;

  const systemId = instance.bindings?.system_state_id as string | undefined;
  const system = systemId ? systemStates.get(systemId) : null;
  const status = system?.effective_status ?? system?.status ?? 'operational';

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const statusOpacity = statusDim ? (STATUS_OPACITY[status] ?? 1) : 1;
  const effectiveOpacity = baseOpacity * statusOpacity;

  const statusFilter =
    statusDim && (status === 'destroyed' || status === 'offline')
      ? 'saturate(0.2) brightness(0.4)'
      : statusDim && status === 'critical'
        ? 'saturate(0.6) brightness(0.8)'
        : undefined;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await widgetAssetsApi.upload(file);
      setLocalImageUrl(result.image_url);
      onConfigChange?.({ ...config, image_url: result.image_url });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isEditing) {
    return (
      <div className="gif-display-widget gif-display-widget--editing">
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt="Widget asset"
              className="gif-display-widget__image"
              style={{ objectFit }}
            />
            <div className="gif-display-widget__edit-overlay">
              <button
                className="btn btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Replace Image'}
              </button>
            </div>
          </>
        ) : (
          <button
            className="btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Image / GIF'}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          onChange={handleUpload}
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="gif-display-widget gif-display-widget--empty">
        <span className="gif-display-widget__empty-text">NO IMAGE</span>
      </div>
    );
  }

  return (
    <div
      className={`gif-display-widget ${statusDim ? `status-${status}` : ''}`}
    >
      <img
        src={imageUrl}
        alt=""
        className="gif-display-widget__image"
        style={{
          objectFit,
          opacity: effectiveOpacity,
          filter: statusFilter,
        }}
      />
    </div>
  );
}
