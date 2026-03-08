import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useSectorSprites } from '../../hooks/useShipData';
import type { SectorSprite, SpriteCategory } from '../../types';
import './SpritePickerModal.css';

const CATEGORIES: { value: SpriteCategory | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '◯' },
  { value: 'celestial', label: 'Celestial', icon: '⬤' },
  { value: 'station', label: 'Station', icon: '⬡' },
  { value: 'ship', label: 'Ship', icon: '◆' },
  { value: 'hazard', label: 'Hazard', icon: '⚠' },
  { value: 'other', label: 'Other', icon: '○' },
];

interface Props {
  shipId: string;
  currentSpriteId?: string;
  onSelect: (sprite: SectorSprite) => void;
  onClose: () => void;
}

export function SpritePickerModal({ shipId, currentSpriteId, onSelect, onClose }: Props) {
  const modalRef = useModalA11y(onClose);
  const { data: sprites = [], isLoading } = useSectorSprites(shipId);
  const [selected, setSelected] = useState<string | null>(currentSpriteId ?? null);
  const [filterCategory, setFilterCategory] = useState<SpriteCategory | 'all'>('all');

  const filteredSprites =
    filterCategory === 'all'
      ? sprites
      : sprites.filter((s) => s.category === filterCategory);

  const handleConfirm = () => {
    const sprite = sprites.find((s) => s.id === selected);
    if (sprite) onSelect(sprite);
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal-content sprite-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Select Sprite"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Select Sprite</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="sprite-picker-filters">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              className={`sprite-picker-filter ${filterCategory === cat.value ? 'sprite-picker-filter--active' : ''}`}
              onClick={() => setFilterCategory(cat.value)}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        <div className="modal-body sprite-picker-body">
          {isLoading ? (
            <div className="sprite-picker-empty">Loading sprites...</div>
          ) : sprites.length === 0 ? (
            <div className="sprite-picker-empty">
              No sprites available.
              <br />
              <span className="hint">Add sprites in the Media Library first.</span>
            </div>
          ) : filteredSprites.length === 0 ? (
            <div className="sprite-picker-empty">No sprites in this category.</div>
          ) : (
            <div className="sprite-picker-grid">
              {filteredSprites.map((sprite) => (
                <button
                  key={sprite.id}
                  className={`sprite-picker-item ${selected === sprite.id ? 'sprite-picker-item--selected' : ''}`}
                  onClick={() => setSelected(sprite.id)}
                  title={sprite.name}
                  type="button"
                >
                  <img src={sprite.image_url} alt={sprite.name} />
                  <span className="sprite-picker-name">{sprite.name}</span>
                  <span className="sprite-picker-category">
                    {CATEGORIES.find((c) => c.value === sprite.category)?.icon}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sprite-picker-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={!selected}>
            Use Selected
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
