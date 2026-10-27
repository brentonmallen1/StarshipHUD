import { useQuery } from '@tanstack/react-query';
import { useShipContext } from '../../../contexts/ShipContext';
import { holomapApi } from '../../../services/api';
import type { HolomapConfig, WidgetConfigEditorProps } from '../../../types';
import { CheckboxListField } from './fields';

export function HolomapConfigEditor({ config, onChange }: WidgetConfigEditorProps<HolomapConfig>) {
  const { shipId } = useShipContext();
  // Modal-scoped key so live widget polling never re-renders the open form
  const { data: layers } = useQuery({
    queryKey: ['modal-holomap-layers', shipId],
    queryFn: () => holomapApi.listLayers(shipId!),
    enabled: !!shipId,
    refetchInterval: false,
    staleTime: Infinity,
  });
  return (
    <CheckboxListField
      label="Visible Layers"
      options={(layers ?? []).map((layer) => ({ value: layer.id, label: layer.name }))}
      selected={config.layer_ids}
      onChange={(layer_ids) => onChange({ layer_ids })}
      hint="Select which deck layers to show. Leave all unchecked to show all layers."
    />
  );
}
