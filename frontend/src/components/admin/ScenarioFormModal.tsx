import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useEvents, useAllSensorContacts, useAllHolomapMarkers } from '../../hooks/useShipData';
import { widgetAssetsApi, panelsApi } from '../../services/api';
import type { Scenario, ScenarioAction, ScenarioCreate, ScenarioUpdate, SystemState, PanelWithWidgets } from '../../types';
import type { SoundboardWidgetConfig } from '../../types';
import { ActionBuilder } from './ActionBuilder';
import './ScenarioForm.css';

interface ScenarioFormModalProps {
  scenario?: Scenario; // If provided, we're editing; otherwise creating
  shipId: string;
  systems: SystemState[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ScenarioCreate | ScenarioUpdate) => void;
  isSaving?: boolean;
}

export function ScenarioFormModal({
  scenario,
  shipId,
  systems,
  isOpen,
  onClose,
  onSave,
  isSaving,
}: ScenarioFormModalProps) {
  const isEditing = !!scenario;
  const modalRef = useModalA11y(onClose);

  // Fetch data for action selectors
  const { data: events } = useEvents(shipId, 500);
  const { data: sensorContacts } = useAllSensorContacts(shipId);
  const { data: holomapMarkers } = useAllHolomapMarkers(shipId);

  // Fetch audio assets
  const { data: allAssets = [] } = useQuery({
    queryKey: ['widget-assets'],
    queryFn: () => widgetAssetsApi.list(),
    staleTime: 30_000,
  });

  // Filter to audio assets only
  const audioAssets = useMemo(
    () => allAssets.filter((a) => a.type === 'audio').map((a) => a.url),
    [allAssets]
  );

  // Fetch panels with widgets to find soundboard widgets
  const { data: panelsWithWidgets = [] } = useQuery({
    queryKey: ['panels-with-widgets', shipId],
    queryFn: async (): Promise<PanelWithWidgets[]> => {
      const panelsList = await panelsApi.list(shipId);
      if (panelsList.length === 0) return [];
      const withWidgets = await Promise.all(
        panelsList.map((p) => panelsApi.get(p.id))
      );
      return withWidgets;
    },
    enabled: !!shipId,
    staleTime: 30_000,
  });

  // Extract soundboard widgets from panels
  const soundboardWidgets = useMemo(() => {
    const widgets: { id: string; panelName: string; config: SoundboardWidgetConfig }[] = [];
    for (const panel of panelsWithWidgets) {
      for (const widget of panel.widgets ?? []) {
        if (widget.widget_type === 'soundboard' && widget.config) {
          widgets.push({
            id: widget.id,
            panelName: panel.name,
            config: widget.config as SoundboardWidgetConfig,
          });
        }
      }
    }
    return widgets;
  }, [panelsWithWidgets]);

  // Filter to transmission events only
  const transmissions = useMemo(
    () => events?.filter((e) => e.type === 'transmission_received') ?? [],
    [events]
  );

  const [name, setName] = useState(scenario?.name ?? '');
  const [description, setDescription] = useState(scenario?.description ?? '');
  const [actions, setActions] = useState<ScenarioAction[]>(scenario?.actions ?? []);

  // Reset form when scenario changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setName(scenario?.name ?? '');
      setDescription(scenario?.description ?? '');
      setActions(scenario?.actions ?? []);
    }
  }, [scenario, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing) {
      const updateData: ScenarioUpdate = {
        name,
        description: description || undefined,
        actions,
      };
      onSave(updateData);
    } else {
      const createData: ScenarioCreate = {
        ship_id: shipId,
        name,
        description: description || undefined,
        actions,
      };
      onSave(createData);
    }
  };

  const isValid = name.trim().length > 0 && actions.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={modalRef} className="modal-content scenario-form-modal" role="dialog" aria-modal="true" aria-label={isEditing ? 'Edit Scenario' : 'Create Scenario'} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Scenario' : 'Create Scenario'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Basic Info Section */}
            <div className="form-section">
              <h3>Basic Info</h3>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="scenario-name">Name *</label>
                  <input
                    id="scenario-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., Hull Breach"
                    required
                  />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="scenario-description">Description</label>
                <textarea
                  id="scenario-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description of what this scenario does..."
                />
              </div>
            </div>

            {/* Actions Section */}
            <div className="form-section">
              <h3>Actions *</h3>
              <p className="section-hint">
                Define what happens when this scenario is executed. Actions run in order.
              </p>
              <ActionBuilder
                actions={actions}
                systems={systems}
                transmissions={transmissions}
                holomapMarkers={holomapMarkers}
                sensorContacts={sensorContacts}
                audioAssets={audioAssets}
                soundboardWidgets={soundboardWidgets}
                onChange={setActions}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isValid || isSaving}
            >
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Scenario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
