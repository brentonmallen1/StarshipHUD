import { useCallback } from 'react';
import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { widgetsApi } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import type { WidgetInstance } from '../types';

/**
 * Query keys whose data is a panel carrying `widgets: WidgetInstance[]`
 * (see usePanel / usePanelBySlug in useShipData.ts).
 */
const PANEL_QUERY_ROOTS = ['panel', 'panel-by-slug'] as const;

type PanelLike = { widgets?: WidgetInstance[] };

function isPanelQuery(queryKey: QueryKey): boolean {
  return (PANEL_QUERY_ROOTS as readonly unknown[]).includes(queryKey[0]);
}

/** Every cached panel snapshot, so optimistic edits can be rolled back. */
function snapshotPanels(qc: QueryClient) {
  return qc.getQueriesData<PanelLike>({ predicate: (q) => isPanelQuery(q.queryKey) });
}

/** Latest cached config for a widget, from whichever panel query holds it. */
function findCachedConfig(qc: QueryClient, widgetId: string): Record<string, unknown> | undefined {
  for (const [, panel] of snapshotPanels(qc)) {
    const widget = panel?.widgets?.find((w) => w.id === widgetId);
    if (widget) return widget.config;
  }
  return undefined;
}

function writeConfig(qc: QueryClient, widgetId: string, config: Record<string, unknown>) {
  for (const [key, panel] of snapshotPanels(qc)) {
    if (!panel?.widgets?.some((w) => w.id === widgetId)) continue;
    qc.setQueryData<PanelLike>(key, {
      ...panel,
      widgets: panel.widgets.map((w) => (w.id === widgetId ? { ...w, config } : w)),
    });
  }
}

interface Variables {
  widgetId: string;
  config: Record<string, unknown>;
}

/**
 * Persist runtime config edits made from inside a widget (soundboard buttons,
 * scene clocks, pinned contacts, …).
 *
 * Widgets send a *partial* patch. It is merged into the latest cached config
 * (not the possibly-stale `instance.config` the widget rendered with), written
 * optimistically to every cached copy of the panel, then PATCHed. On failure
 * the cache is rolled back and a toast is shown; either way the panel queries
 * are invalidated so the server stays authoritative.
 */
export function useUpdateWidgetConfig() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const mutation = useMutation({
    mutationFn: ({ widgetId, config }: Variables) => widgetsApi.update(widgetId, { config }),
    onMutate: async ({ widgetId, config }: Variables) => {
      await queryClient.cancelQueries({ predicate: (q) => isPanelQuery(q.queryKey) });
      const previous = snapshotPanels(queryClient);
      writeConfig(queryClient, widgetId, config);
      return { previous };
    },
    onError: (err, _vars, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      console.error('Failed to save widget config:', err);
      addToast({
        type: 'error',
        message: `Widget settings not saved: ${err instanceof Error ? err.message : 'unknown error'}`,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ predicate: (q) => isPanelQuery(q.queryKey) });
    },
  });

  const { mutate } = mutation;

  /**
   * Merge `patch` into the widget's latest config and save it.
   * `widget.config` is only used if the widget isn't in any cached panel.
   */
  const updateWidgetConfig = useCallback(
    (widget: Pick<WidgetInstance, 'id' | 'config'>, patch: Record<string, unknown>) => {
      const base = findCachedConfig(queryClient, widget.id) ?? widget.config ?? {};
      mutate({ widgetId: widget.id, config: { ...base, ...patch } });
    },
    [queryClient, mutate],
  );

  return { updateWidgetConfig, isPending: mutation.isPending };
}
