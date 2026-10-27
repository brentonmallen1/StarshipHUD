import { useCallback, useState } from 'react';
import type { Cargo, CargoCategory, CargoPlacementWithCargo } from '../../../types';
import { CARGO_SIZE_LABELS } from '../../../utils/cargoShapes';
import { getCargoColor } from './cargoDisplay';

const MIN_WIDTH = 120;
const MAX_WIDTH = 300;

interface CargoDetailProps {
  placement: CargoPlacementWithCargo | null;
  unplaced: Cargo | null;
  categoryMap: Map<string, CargoCategory>;
  canEditData: boolean;
  /** A bay is loaded, so unplaced cargo can be placed. */
  canPlace: boolean;
  onClose: () => void;
  onRotate: (placement: CargoPlacementWithCargo) => void;
  onMove: (placement: CargoPlacementWithCargo) => void;
  onRemove: (placement: CargoPlacementWithCargo) => void;
  onPlace: (cargo: Cargo) => void;
  onSaveNotes: (cargoId: string, notes: string) => void;
}

/** Notes field; keeps its own draft so background refetches don't clobber typing. */
function NotesRow({
  initial,
  canEditData,
  onSave,
}: {
  initial: string | undefined;
  canEditData: boolean;
  onSave: (notes: string) => void;
}) {
  const [draft, setDraft] = useState(initial || '');
  return (
    <div className="cargo-detail-row cargo-detail-notes-row">
      <span className="cargo-detail-label">Notes</span>
      {canEditData ? (
        <textarea
          className="cargo-notes-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onSave(draft)}
          placeholder="Add notes..."
          rows={3}
        />
      ) : (
        <span className="cargo-detail-value cargo-notes-display">{initial || '—'}</span>
      )}
    </div>
  );
}

/** Resizable side panel describing the selected (placed or unplaced) cargo. */
export function CargoDetail({
  placement,
  unplaced,
  categoryMap,
  canEditData,
  canPlace,
  onClose,
  onRotate,
  onMove,
  onRemove,
  onPlace,
  onSaveNotes,
}: CargoDetailProps) {
  const [panelWidth, setPanelWidth] = useState(160);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = panelWidth;

      const handleMove = (moveE: MouseEvent) => {
        const delta = startX - moveE.clientX;
        setPanelWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta)));
      };

      const handleUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [panelWidth]
  );

  return (
    <div className="cargo-detail-panel" style={{ width: panelWidth }}>
      <div
        className={`cargo-panel-resize-handle ${isResizing ? 'active' : ''}`}
        onMouseDown={handleResizeStart}
      />
      {placement ? (
        <>
          <div className="cargo-detail-header">
            <h4>{placement.cargo.name}</h4>
            <button className="cargo-detail-close" onClick={onClose}>
              &times;
            </button>
          </div>
          <div className="cargo-detail-content">
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">Category</span>
              <span className="cargo-detail-value" style={{ color: getCargoColor(placement.cargo, categoryMap) }}>
                {placement.cargo.category_name || 'Uncategorized'}
              </span>
            </div>
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">Size</span>
              <span className="cargo-detail-value">{CARGO_SIZE_LABELS[placement.cargo.size_class]}</span>
            </div>
            <NotesRow
              key={placement.cargo_id}
              initial={placement.cargo.notes}
              canEditData={canEditData}
              onSave={(notes) => onSaveNotes(placement.cargo_id, notes)}
            />

            {canEditData && (
              <div className="cargo-detail-actions">
                <button className="cargo-action-btn" onClick={() => onRotate(placement)}>
                  Rotate
                </button>
                <button className="cargo-action-btn" onClick={() => onMove(placement)}>
                  Move
                </button>
                <button className="cargo-action-btn danger" onClick={() => onRemove(placement)}>
                  Remove
                </button>
              </div>
            )}
          </div>
        </>
      ) : unplaced ? (
        <>
          <div className="cargo-detail-header">
            <h4>{unplaced.name}</h4>
            <button className="cargo-detail-close" onClick={onClose}>
              &times;
            </button>
          </div>
          <div className="cargo-detail-content">
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">Status</span>
              <span className="cargo-detail-value cargo-detail-value--unplaced">◇ Not Placed</span>
            </div>
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">Category</span>
              <span className="cargo-detail-value" style={{ color: getCargoColor(unplaced, categoryMap) }}>
                {unplaced.category_id
                  ? categoryMap.get(unplaced.category_id)?.name || 'Unknown'
                  : 'Uncategorized'}
              </span>
            </div>
            <div className="cargo-detail-row">
              <span className="cargo-detail-label">Size</span>
              <span className="cargo-detail-value">{CARGO_SIZE_LABELS[unplaced.size_class]}</span>
            </div>
            <NotesRow
              key={unplaced.id}
              initial={unplaced.notes}
              canEditData={canEditData}
              onSave={(notes) => onSaveNotes(unplaced.id, notes)}
            />

            {canEditData && canPlace && (
              <div className="cargo-detail-actions">
                <button className="cargo-action-btn" onClick={() => onPlace(unplaced)}>
                  Place in Bay
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="cargo-detail-empty">
          <span>Select cargo to view details</span>
        </div>
      )}
    </div>
  );
}
