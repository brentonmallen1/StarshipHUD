import { useState, useEffect } from 'react';
import { useModalA11y } from '../../hooks/useModalA11y';
import type { Ship, ShipUpdate } from '../../types';
import './ShipEditModal.css';

interface ShipEditModalProps {
  ship: Ship;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ShipUpdate) => void;
  isSaving?: boolean;
}

type AttributeValue = string | number | boolean;

export function ShipEditModal({ ship, isOpen, onClose, onSave, isSaving }: ShipEditModalProps) {
  const modalRef = useModalA11y(onClose);
  const [name, setName] = useState(ship.name);
  const [shipClass, setShipClass] = useState(ship.ship_class ?? '');
  const [registry, setRegistry] = useState(ship.registry ?? '');
  const [description, setDescription] = useState(ship.description ?? '');
  const [attributes, setAttributes] = useState<Record<string, AttributeValue>>(ship.attributes ?? {});
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  // Reset form when ship changes
  useEffect(() => {
    setName(ship.name);
    setShipClass(ship.ship_class ?? '');
    setRegistry(ship.registry ?? '');
    setDescription(ship.description ?? '');
    setAttributes(ship.attributes ?? {});
  }, [ship]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      ship_class: shipClass || undefined,
      registry: registry || undefined,
      description: description || undefined,
      attributes,
    });
  };

  const addAttribute = () => {
    if (!newAttrKey.trim()) return;

    // Parse value - try number, then boolean, then string
    let parsedValue: AttributeValue = newAttrValue;
    const numValue = Number(newAttrValue);
    if (!isNaN(numValue) && newAttrValue.trim() !== '') {
      parsedValue = numValue;
    } else if (newAttrValue.toLowerCase() === 'true') {
      parsedValue = true;
    } else if (newAttrValue.toLowerCase() === 'false') {
      parsedValue = false;
    }

    setAttributes({ ...attributes, [newAttrKey.trim()]: parsedValue });
    setNewAttrKey('');
    setNewAttrValue('');
  };

  const removeAttribute = (key: string) => {
    const newAttrs = { ...attributes };
    delete newAttrs[key];
    setAttributes(newAttrs);
  };

  const updateAttributeValue = (key: string, value: string) => {
    // Parse value on update
    let parsedValue: AttributeValue = value;
    const numValue = Number(value);
    if (!isNaN(numValue) && value.trim() !== '') {
      parsedValue = numValue;
    } else if (value.toLowerCase() === 'true') {
      parsedValue = true;
    } else if (value.toLowerCase() === 'false') {
      parsedValue = false;
    }
    setAttributes({ ...attributes, [key]: parsedValue });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={modalRef} className="modal-content ship-edit-modal" role="dialog" aria-modal="true" aria-label="Edit Ship" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Ship</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-section">
              <h3>Ship Details</h3>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="ship-name">Name</label>
                  <input
                    id="ship-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="ship-class">Class</label>
                  <input
                    id="ship-class"
                    type="text"
                    value={shipClass}
                    onChange={e => setShipClass(e.target.value)}
                    placeholder="e.g., Heavy Cruiser"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="ship-registry">Registry</label>
                  <input
                    id="ship-registry"
                    type="text"
                    value={registry}
                    onChange={e => setRegistry(e.target.value)}
                    placeholder="e.g., ISV-2847"
                  />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="ship-description">Description</label>
                <textarea
                  id="ship-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Ship description..."
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Custom Attributes</h3>
              <div className="attributes-list">
                {Object.entries(attributes).map(([key, value]) => (
                  <div key={key} className="attribute-row">
                    <span className="attribute-key">{key}</span>
                    <input
                      type="text"
                      value={String(value)}
                      onChange={e => updateAttributeValue(key, e.target.value)}
                      className="attribute-value-input"
                    />
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => removeAttribute(key)}
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {Object.keys(attributes).length === 0 && (
                  <p className="no-attributes">No custom attributes</p>
                )}
              </div>

              <div className="add-attribute-row">
                <input
                  type="text"
                  value={newAttrKey}
                  onChange={e => setNewAttrKey(e.target.value)}
                  placeholder="Attribute name"
                  className="new-attr-key"
                />
                <input
                  type="text"
                  value={newAttrValue}
                  onChange={e => setNewAttrValue(e.target.value)}
                  placeholder="Value"
                  className="new-attr-value"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAttribute();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={addAttribute}
                  disabled={!newAttrKey.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
