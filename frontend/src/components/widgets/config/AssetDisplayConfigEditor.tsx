import { useQuery } from '@tanstack/react-query';
import { useShipContext } from '../../../contexts/ShipContext';
import { assetsApi } from '../../../services/api';
import type { AssetDisplayConfig, WidgetConfigEditorProps } from '../../../types';

export function AssetDisplayConfigEditor({ bindings, onBindingsChange }: WidgetConfigEditorProps<AssetDisplayConfig>) {
  const { shipId } = useShipContext();
  // Modal-scoped key so live widget polling never re-renders the open form
  const { data: assets } = useQuery({
    queryKey: ['modal-assets', shipId],
    queryFn: () => assetsApi.list(shipId!),
    enabled: !!shipId,
    refetchInterval: false,
    staleTime: Infinity,
  });
  const assetId = typeof bindings.asset_id === 'string' ? bindings.asset_id : '';

  return (
    <div className="configure-section">
      <label className="configure-label">Asset/Weapon Binding</label>
      <select
        className="config-input"
        value={assetId}
        onChange={(e) => onBindingsChange({ asset_id: e.target.value || undefined })}
      >
        <option value="">-- None (Static Config) --</option>
        {assets?.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.name} ({asset.asset_type})
          </option>
        ))}
      </select>
      <p className="field-hint">
        Link this widget to a specific weapon/asset from the database.
        Updates to the asset will be reflected in real-time.
      </p>
    </div>
  );
}
