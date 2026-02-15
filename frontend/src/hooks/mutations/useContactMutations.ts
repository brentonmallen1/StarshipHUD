import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi, crewApi } from '../../services/api';
import type { Contact, Crew } from '../../types';

// ============================================================================
// CONTACT MUTATIONS
// ============================================================================

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Contact> }) =>
      contactsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact'] });
    },
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Contact> & { ship_id: string }) =>
      contactsApi.create(data),
    onSuccess: (newContact) => {
      // Add the new contact to the cache immediately for instant UI feedback
      queryClient.setQueriesData<Contact[]>(
        { queryKey: ['contacts'] },
        (oldData) => oldData ? [...oldData, newContact] : [newContact]
      );
      // Also invalidate to ensure consistency with server
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

// ============================================================================
// CREW MUTATIONS
// ============================================================================

export function useUpdateCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Crew> }) =>
      crewApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew'] });
      queryClient.invalidateQueries({ queryKey: ['crew-member'] });
    },
  });
}

export function useCreateCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Crew> & { ship_id: string }) =>
      crewApi.create(data),
    onSuccess: (newCrew) => {
      queryClient.setQueriesData<Crew[]>(
        { queryKey: ['crew'] },
        (oldData) => oldData ? [...oldData, newCrew] : [newCrew]
      );
      queryClient.invalidateQueries({ queryKey: ['crew'] });
    },
  });
}

export function useDeleteCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crewApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew'] });
    },
  });
}
