import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useModalA11y } from '../../hooks/useModalA11y';
import { widgetAssetsApi } from '../../services/api';
import './MediaPickerModal.css';

interface Props {
  currentUrl?: string;
  onSelect: (imageUrl: string) => void;
  onClose: () => void;
}

export function MediaPickerModal({ currentUrl, onSelect, onClose }: Props) {
  const modalRef = useModalA11y(onClose);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(currentUrl ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['widget-assets'],
    queryFn: () => widgetAssetsApi.list(),
    staleTime: 30_000,
  });

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await widgetAssetsApi.upload(file);
      await queryClient.invalidateQueries({ queryKey: ['widget-assets'] });
      setSelected(result.image_url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirm = () => {
    if (selected) onSelect(selected);
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal-content media-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Select Image"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Select Image</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="media-picker-toolbar">
          <button
            className="btn btn-small"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : '+ Upload New'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          {uploadError && <span className="media-picker-error">{uploadError}</span>}
        </div>

        <div className="modal-body media-picker-body">
          {isLoading ? (
            <div className="media-picker-empty">Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className="media-picker-empty">No uploaded images yet. Upload one above.</div>
          ) : (
            <div className="media-picker-grid">
              {assets.map((asset) => (
                <button
                  key={asset.filename}
                  className={`media-picker-item ${selected === asset.image_url ? 'selected' : ''}`}
                  onClick={() => setSelected(asset.image_url)}
                  title={asset.filename}
                  type="button"
                >
                  <img src={asset.image_url} alt={asset.filename} />
                  <span className="media-picker-filename">{asset.filename}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="media-picker-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!selected}
          >
            Use Selected
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
