import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getFocusFromURL,
  highlightWidget,
  findWidgetBySystemState,
  setLastVisitedPanel,
  type DeepLinkPayload,
  navigateToTarget,
} from '../utils/navigation';
import type { WidgetInstance } from '../types';

/**
 * Hook for handling deep-link navigation and focus
 */
export function useDeepLink(panelId?: string, widgets?: WidgetInstance[]) {
  const location = useLocation();

  useEffect(() => {
    if (!panelId || !widgets) return;

    // Store last visited panel
    setLastVisitedPanel(panelId);

    // Get focus information from URL
    const focus = getFocusFromURL();

    // Determine which widget to highlight
    let targetWidgetId = focus.widgetId;

    // If no direct widget specified, try to find by system state
    if (!targetWidgetId && focus.systemId && widgets) {
      targetWidgetId = findWidgetBySystemState(focus.systemId, widgets) || undefined;
    }

    // Apply highlight if we found a target
    if (targetWidgetId) {
      // Wait a bit for DOM to be ready
      setTimeout(() => {
        highlightWidget(targetWidgetId);
      }, 100);
    }
  }, [panelId, widgets, location]);
}

/**
 * Hook to get a navigation function for deep-links
 */
export function useDeepLinkNavigate() {
  const navigate = useNavigate();

  return (payload: DeepLinkPayload) => {
    navigateToTarget(navigate, payload);
  };
}
