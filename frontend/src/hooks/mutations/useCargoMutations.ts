import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cargoApi, cargoBaysApi, cargoCategoriesApi, cargoPlacementsApi } from '../../services/api';
import type { Cargo, CargoBay, CargoCategory } from '../../types';

// ============================================================================
// CARGO MUTATIONS
// ============================================================================

export function useUpdateCargo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Cargo> }) =>
      cargoApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
    },
  });
}

export function useCreateCargo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Cargo> & { ship_id: string }) =>
      cargoApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
    },
  });
}

export function useDeleteCargo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cargoApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
    },
  });
}

// ============================================================================
// CARGO BAY MUTATIONS
// ============================================================================

export function useCreateCargoBay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CargoBay> & { ship_id: string }) =>
      cargoBaysApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo-bays'] });
    },
  });
}

export function useUpdateCargoBay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CargoBay> }) =>
      cargoBaysApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo-bays'] });
      queryClient.invalidateQueries({ queryKey: ['cargo-bay'] });
      queryClient.invalidateQueries({ queryKey: ['cargo-bay-placements'] });
    },
  });
}

export function useDeleteCargoBay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cargoBaysApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo-bays'] });
      queryClient.invalidateQueries({ queryKey: ['cargo-bay-placements'] });
    },
  });
}

// ============================================================================
// CARGO CATEGORY MUTATIONS
// ============================================================================

export function useCreateCargoCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CargoCategory> & { ship_id: string }) =>
      cargoCategoriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo-categories'] });
    },
  });
}

export function useUpdateCargoCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CargoCategory> }) =>
      cargoCategoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo-categories'] });
      queryClient.invalidateQueries({ queryKey: ['cargo-category'] });
      // Also refresh cargo and placements since they may show category colors
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
      queryClient.invalidateQueries({ queryKey: ['cargo-bay-placements'] });
    },
  });
}

export function useDeleteCargoCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cargoCategoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo-categories'] });
      // Cargo items will have their category_id set to null
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
      queryClient.invalidateQueries({ queryKey: ['cargo-bay-placements'] });
    },
  });
}

// ============================================================================
// CARGO PLACEMENT MUTATIONS
// ============================================================================

export function useCreateCargoPlacement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { cargo_id: string; bay_id: string; x: number; y: number; rotation?: number }) =>
      cargoPlacementsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo-placements'] });
      queryClient.invalidateQueries({ queryKey: ['cargo-bay-placements'] });
      queryClient.invalidateQueries({ queryKey: ['cargo'] }); // Refresh unplaced status
    },
  });
}

export function useUpdateCargoPlacement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { x?: number; y?: number; rotation?: number } }) =>
      cargoPlacementsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo-placements'] });
      queryClient.invalidateQueries({ queryKey: ['cargo-bay-placements'] });
    },
  });
}

export function useDeleteCargoPlacement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cargoPlacementsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo-placements'] });
      queryClient.invalidateQueries({ queryKey: ['cargo-bay-placements'] });
      queryClient.invalidateQueries({ queryKey: ['cargo'] }); // Refresh unplaced status
    },
  });
}

export function useDeleteCargoPlacementByCargo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cargoId: string) => cargoPlacementsApi.deleteByCargo(cargoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo-placements'] });
      queryClient.invalidateQueries({ queryKey: ['cargo-bay-placements'] });
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
    },
  });
}
