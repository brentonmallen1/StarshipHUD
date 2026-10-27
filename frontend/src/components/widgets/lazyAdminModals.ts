/**
 * GM authoring modals used from inside widgets, loaded on demand.
 *
 * Widgets render on player consoles; these modals are only opened by a GM,
 * so they are code-split and mounted only while open (wrap in <Suspense>).
 */
import { lazy } from 'react';

export const TaskFormModal = lazy(() =>
  import('../admin/TaskFormModal').then((m) => ({ default: m.TaskFormModal })),
);

export const ShipEditModal = lazy(() =>
  import('../admin/ShipEditModal').then((m) => ({ default: m.ShipEditModal })),
);

export const SystemsByStatusModal = lazy(() =>
  import('../admin/SystemsByStatusModal').then((m) => ({ default: m.SystemsByStatusModal })),
);

export const AllClearModal = lazy(() =>
  import('../admin/AllClearModal').then((m) => ({ default: m.AllClearModal })),
);

export const TimerEditModal = lazy(() =>
  import('../admin/TimerEditModal').then((m) => ({ default: m.TimerEditModal })),
);
