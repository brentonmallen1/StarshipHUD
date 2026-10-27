import { useQuery } from '@tanstack/react-query';
import { useShipContext } from '../../../contexts/ShipContext';
import { cargoBaysApi } from '../../../services/api';

/**
 * Cargo bays for config editors. Modal-scoped query key and no polling, so
 * live widget refetches never re-render the open form and steal focus.
 */
export function useModalCargoBays() {
  const { shipId } = useShipContext();
  return useQuery({
    queryKey: ['modal-cargo-bays', shipId],
    queryFn: () => cargoBaysApi.list(shipId!),
    enabled: !!shipId,
    refetchInterval: false,
    staleTime: Infinity,
  });
}
