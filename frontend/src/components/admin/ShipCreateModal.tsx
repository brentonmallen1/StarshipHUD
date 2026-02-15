import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shipsApi } from '../../services/api';
import { useModalA11y } from '../../hooks/useModalA11y';
import type { Ship, ShipCreate } from '../../types';
import './ShipCreateModal.css';

interface ShipCreateModalProps {
  onClose: () => void;
  onCreated: (ship: Ship) => void;
}

export function ShipCreateModal({ onClose, onCreated }: ShipCreateModalProps) {
  const modalRef = useModalA11y(onClose);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [shipClass, setShipClass] = useState('');
  const [registry, setRegistry] = useState('');
  const [description, setDescription] = useState('');
  const [seedType, setSeedType] = useState<'blank' | 'full'>('blank');

  const createMutation = useMutation({
    mutationFn: (data: ShipCreate) => shipsApi.create(data),
    onSuccess: (ship) => {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      onCreated(ship);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createMutation.mutate({
      name: name.trim(),
      ship_class: shipClass.trim() || undefined,
      registry: registry.trim() || undefined,
      description: description.trim() || undefined,
      seed_type: seedType,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={modalRef} className="modal-content ship-create-modal" role="dialog" aria-modal="true" aria-label="Commission New Vessel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Commission New Vessel</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="ship-name">Ship Name *</label>
            <input
              id="ship-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., ISV Normandy"
              autoFocus
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ship-class">Ship Class</label>
              <input
                id="ship-class"
                type="text"
                value={shipClass}
                onChange={(e) => setShipClass(e.target.value)}
                placeholder="e.g., Horizon-class Explorer"
              />
            </div>

            <div className="form-group">
              <label htmlFor="ship-registry">Registry</label>
              <input
                id="ship-registry"
                type="text"
                value={registry}
                onChange={(e) => setRegistry(e.target.value)}
                placeholder="e.g., ISV-7743"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="ship-description">Description</label>
            <textarea
              id="ship-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the vessel..."
              rows={2}
            />
          </div>

          <div className="form-group seed-type-group">
            <label>Initial Configuration</label>
            <div className="seed-type-options">
              <label className={`seed-option ${seedType === 'blank' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="seedType"
                  value="blank"
                  checked={seedType === 'blank'}
                  onChange={() => setSeedType('blank')}
                />
                <div className="seed-option-content">
                  <span className="seed-option-title">Blank Ship</span>
                  <span className="seed-option-desc">
                    Empty vessel - configure everything from scratch
                  </span>
                </div>
              </label>

              <label className={`seed-option ${seedType === 'full' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="seedType"
                  value="full"
                  checked={seedType === 'full'}
                  onChange={() => setSeedType('full')}
                />
                <div className="seed-option-content">
                  <span className="seed-option-title">Full Demo Data</span>
                  <span className="seed-option-desc">
                    Pre-configured systems, panels, crew, cargo, and sample scenarios
                  </span>
                </div>
              </label>
            </div>
          </div>

          {createMutation.error && (
            <div className="form-error">
              Failed to create ship: {createMutation.error.message}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Commissioning...' : 'Commission Vessel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
