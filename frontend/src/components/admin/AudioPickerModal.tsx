import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useModalA11y } from '../../hooks/useModalA11y';
import { widgetAssetsApi } from '../../services/api';
import './AudioPickerModal.css';

interface Props {
  currentUrl?: string;
  onSelect: (audioUrl: string) => void;
  onClose: () => void;
}

export function AudioPickerModal({ currentUrl, onSelect, onClose }: Props) {
  const modalRef = useModalA11y(onClose);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [selected, setSelected] = useState<string | null>(currentUrl ?? null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: allAssets = [], isLoading } = useQuery({
    queryKey: ['widget-assets'],
    queryFn: () => widgetAssetsApi.list(),
    staleTime: 30_000,
  });

  // Filter to audio files only
  const audioAssets = allAssets.filter((a) => a.type === 'audio');

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await widgetAssetsApi.upload(file);
      await queryClient.invalidateQueries({ queryKey: ['widget-assets'] });
      setSelected(result.url);
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

  const togglePlay = (url: string) => {
    if (playingUrl === url) {
      audioRef.current?.pause();
      setPlayingUrl(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
      setPlayingUrl(url);
    }
  };

  const handleAudioEnded = () => {
    setPlayingUrl(null);
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <audio ref={audioRef} onEnded={handleAudioEnded} style={{ display: 'none' }} />
      <div
        ref={modalRef}
        className="modal-content audio-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Select Audio"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Select Audio</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="audio-picker-toolbar">
          <button
            className="btn btn-small"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : '+ Upload Audio'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg,audio/webm"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          {uploadError && <span className="audio-picker-error">{uploadError}</span>}
        </div>

        <div className="modal-body audio-picker-body">
          {isLoading ? (
            <div className="audio-picker-empty">Loading audio files...</div>
          ) : audioAssets.length === 0 ? (
            <div className="audio-picker-empty">No audio files uploaded yet. Upload one above.</div>
          ) : (
            <div className="audio-picker-list">
              {audioAssets.map((asset) => {
                const isSelected = selected === asset.url;
                const isPlaying = playingUrl === asset.url;
                return (
                  <div
                    key={asset.filename}
                    className={`audio-picker-item ${isSelected ? 'audio-picker-item--selected' : ''}`}
                    onClick={() => setSelected(asset.url)}
                  >
                    <button
                      type="button"
                      className={`audio-picker-play ${isPlaying ? 'audio-picker-play--playing' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay(asset.url);
                      }}
                      title={isPlaying ? 'Stop' : 'Play preview'}
                    >
                      {isPlaying ? '⏹' : '▶'}
                    </button>
                    <span className="audio-picker-filename">{asset.filename}</span>
                    {isSelected && <span className="audio-picker-check">✓</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="audio-picker-footer">
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
