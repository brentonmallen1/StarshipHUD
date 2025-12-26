// Deep-link navigation utilities

import type { NavigateFunction } from 'react-router-dom';

/**
 * Deep-link payload for cross-panel navigation
 */
export interface DeepLinkPayload {
  // Target location
  target: {
    panel_id: string;
    widget_instance_id?: string;
  };

  // Why we're linking
  reason: DeepLinkReason;

  // Optional focus hints
  focus?: FocusHint;
}

export type DeepLinkReason =
  | 'alert'
  | 'event'
  | 'marker'
  | 'system_state'
  | 'task'
  | 'contact'
  | 'transmission';

export interface FocusHint {
  system_state_id?: string;
  incident_id?: string;
  task_id?: string;
  contact_id?: string;
  holomap_marker_id?: string;
}

/**
 * Navigate to a panel with optional widget focus
 */
export function navigateToTarget(
  navigate: NavigateFunction,
  payload: DeepLinkPayload
): void {
  const { target, focus } = payload;

  // Build the URL
  let url = `/panel/${target.panel_id}`;

  // Add query params for focus
  const params = new URLSearchParams();

  if (target.widget_instance_id) {
    params.set('widget', target.widget_instance_id);
  }

  if (focus?.system_state_id) {
    params.set('system', focus.system_state_id);
  }

  if (focus?.incident_id) {
    params.set('incident', focus.incident_id);
  }

  if (focus?.task_id) {
    params.set('task', focus.task_id);
  }

  if (params.toString()) {
    url += `?${params.toString()}`;
  }

  // Navigate
  navigate(url);
}

/**
 * Extract focus information from current URL
 */
export function getFocusFromURL(): {
  widgetId?: string;
  systemId?: string;
  incidentId?: string;
  taskId?: string;
} {
  const params = new URLSearchParams(window.location.search);

  return {
    widgetId: params.get('widget') || undefined,
    systemId: params.get('system') || undefined,
    incidentId: params.get('incident') || undefined,
    taskId: params.get('task') || undefined,
  };
}

/**
 * Apply focus highlight to a widget element
 */
export function highlightWidget(widgetId: string, duration = 3000): void {
  const element = document.querySelector(`[data-widget-id="${widgetId}"]`);

  if (!element) {
    console.warn(`Widget ${widgetId} not found for highlight`);
    return;
  }

  // Add highlight class
  element.classList.add('widget-focused');

  // Scroll into view
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  // Remove highlight after duration
  setTimeout(() => {
    element.classList.remove('widget-focused');
  }, duration);
}

/**
 * Find a widget by system state binding
 */
export function findWidgetBySystemState(
  systemStateId: string,
  widgets: Array<{ id: string; bindings: Record<string, unknown> }>
): string | null {
  const widget = widgets.find(
    (w) => w.bindings.system_state_id === systemStateId
  );
  return widget?.id || null;
}

/**
 * Store last visited panel for returning later
 */
export function setLastVisitedPanel(panelId: string): void {
  localStorage.setItem('last-panel', panelId);
}

/**
 * Get last visited panel
 */
export function getLastVisitedPanel(): string | null {
  return localStorage.getItem('last-panel');
}
