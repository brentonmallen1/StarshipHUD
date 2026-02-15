import { useState, useEffect, useMemo } from 'react';
import { getWidgetCategories, getWidgetTypesByCategory } from './widgetRegistry';
import { findNextAvailablePosition } from '../../utils/gridPlacement';
import { useModalA11y } from '../../hooks/useModalA11y';
import type { WidgetTypeDefinition, WidgetInstance, StationGroup } from '../../types';
import './WidgetCreationModal.css';

interface Props {
  panelId: string;
  gridColumns: number;
  gridRows: number;
  existingWidgets: WidgetInstance[];
  stationGroup?: StationGroup;
  onClose: () => void;
  onCreate: (widgetType: string, x: number, y: number, width: number, height: number) => Promise<void>;
}

export function WidgetCreationModal({ gridColumns, gridRows, existingWidgets, stationGroup, onClose, onCreate }: Props) {
  const modalRef = useModalA11y(onClose);
  const [step, setStep] = useState<'category' | 'type' | 'configure'>('category');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedType, setSelectedType] = useState<WidgetTypeDefinition | null>(null);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [width, setWidth] = useState(4);
  const [height, setHeight] = useState(3);
  const [useAutoPlacement, setUseAutoPlacement] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Filter out 'gm' category for non-admin panels
  const categories = useMemo(() => {
    const allCategories = getWidgetCategories();
    if (stationGroup === 'admin') {
      return allCategories;
    }
    return allCategories.filter((cat) => cat !== 'gm');
  }, [stationGroup]);

  // Auto-calculate position when size changes and auto-placement is enabled
  useEffect(() => {
    if (useAutoPlacement && selectedType) {
      const position = findNextAvailablePosition(
        existingWidgets,
        gridColumns,
        gridRows,
        width,
        height
      );
      setX(position.x);
      setY(position.y);
    }
  }, [width, height, useAutoPlacement, existingWidgets, gridColumns, gridRows, selectedType]);

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setStep('type');
  };

  const handleTypeSelect = (type: WidgetTypeDefinition) => {
    setSelectedType(type);
    setWidth(type.defaultWidth);
    setHeight(type.defaultHeight);
    setStep('configure');
  };

  const handleCreate = async () => {
    if (!selectedType) return;

    setIsCreating(true);
    try {
      await onCreate(selectedType.type, x, y, width, height);
      onClose();
    } catch (err) {
      console.error('Failed to create widget:', err);
      alert('Failed to create widget');
    } finally {
      setIsCreating(false);
    }
  };

  const handleBack = () => {
    if (step === 'configure') {
      setStep('type');
    } else if (step === 'type') {
      setStep('category');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={modalRef} className="modal-content widget-creation-modal" role="dialog" aria-modal="true" aria-label="Add Widget" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Widget</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Step 1: Category Selection */}
          {step === 'category' && (
            <div className="widget-categories">
              <p className="step-description">Select a widget category:</p>
              <div className="category-grid">
                {categories.map((category) => (
                  <button
                    key={category}
                    className="category-card"
                    onClick={() => handleCategorySelect(category)}
                  >
                    <div className="category-name">{category}</div>
                    <div className="category-count">
                      {getWidgetTypesByCategory(category).length} widgets
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Widget Type Selection */}
          {step === 'type' && (
            <div className="widget-types">
              <p className="step-description">
                Select a {selectedCategory} widget:
              </p>
              <div className="type-list">
                {getWidgetTypesByCategory(selectedCategory).map((type) => (
                  <button
                    key={type.type}
                    className="type-card"
                    onClick={() => handleTypeSelect(type)}
                  >
                    <div className="type-header">
                      <div className="type-name">{type.name}</div>
                      <div className="type-size">
                        {type.defaultWidth}×{type.defaultHeight}
                      </div>
                    </div>
                    <div className="type-description">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Size Configuration */}
          {step === 'configure' && selectedType && (
            <div className="widget-configure">
              <p className="step-description">
                Configure {selectedType.name}:
              </p>

              <div className="configure-grid">
                <div className="configure-section">
                  <label className="configure-label">Size</label>
                  <div className="configure-row">
                    <div className="configure-field">
                      <label>Width</label>
                      <input
                        type="number"
                        value={width}
                        onChange={(e) => setWidth(Math.max(selectedType.minWidth, Math.min(gridColumns, parseInt(e.target.value) || selectedType.minWidth)))}
                        min={selectedType.minWidth}
                        max={gridColumns}
                      />
                    </div>
                    <div className="configure-field">
                      <label>Height</label>
                      <input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(Math.max(selectedType.minHeight, Math.min(gridRows, parseInt(e.target.value) || selectedType.minHeight)))}
                        min={selectedType.minHeight}
                        max={gridRows}
                      />
                    </div>
                  </div>
                </div>

                <div className="configure-section">
                  <label className="configure-label">
                    <input
                      type="checkbox"
                      checked={useAutoPlacement}
                      onChange={(e) => setUseAutoPlacement(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    Auto-place widget
                  </label>
                  {!useAutoPlacement && (
                    <div className="configure-row">
                      <div className="configure-field">
                        <label>X Position</label>
                        <input
                          type="number"
                          value={x}
                          onChange={(e) => setX(Math.max(0, Math.min(gridColumns - width, parseInt(e.target.value) || 0)))}
                          min={0}
                          max={gridColumns - width}
                        />
                      </div>
                      <div className="configure-field">
                        <label>Y Position</label>
                        <input
                          type="number"
                          value={y}
                          onChange={(e) => setY(Math.max(0, Math.min(gridRows - height, parseInt(e.target.value) || 0)))}
                          min={0}
                          max={gridRows - height}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="configure-preview">
                <div className="preview-label">Placement:</div>
                <div className="preview-info">
                  Position: ({x}, {y}) • Size: {width}×{height}
                  {useAutoPlacement && <span className="auto-placement-badge"> (auto)</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step !== 'category' && (
            <button className="btn" onClick={handleBack}>
              Back
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          {step === 'configure' && (
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Widget'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
