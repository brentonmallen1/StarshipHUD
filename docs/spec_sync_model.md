# Sync Model Specification (Task 0.5)

This document defines how **frontend and backend synchronize state** — polling, caching, and future upgrade paths.

---

## Design Principles

1. **Backend is Source of Truth**: Frontend is a renderer; it fetches and displays
2. **Eventual Consistency**: Brief staleness is acceptable for immersion
3. **Graceful Degradation**: Offline/slow connections show stale data, not errors
4. **Upgrade Path**: Start with polling; websockets can be added later

---

## Sync Strategy (MVP)

### Polling-Based Updates

```typescript
interface PollingConfig {
  // Panel data (layout, widgets)
  panelInterval: number;      // 30 seconds - rarely changes

  // System states (status, values)
  statesInterval: number;     // 3 seconds - core gameplay data

  // Events/alerts
  eventsInterval: number;     // 2 seconds - time-sensitive

  // Scenarios (admin only)
  scenariosInterval: number;  // 10 seconds - GM reference
}

const defaultPolling: PollingConfig = {
  panelInterval: 30000,
  statesInterval: 3000,
  eventsInterval: 2000,
  scenariosInterval: 10000,
};
```

### Conditional Fetching

Use ETags and `If-Modified-Since` to reduce bandwidth:

```typescript
// Request
GET /api/system-states
If-None-Match: "abc123"

// Response (no changes)
304 Not Modified

// Response (changes)
200 OK
ETag: "def456"
[...data...]
```

---

## Data Freshness Indicators

### Stale Data UI

When data is older than expected:

```typescript
interface FreshnessState {
  lastFetch: Date;
  isStale: boolean;      // > 2x expected interval
  isVeryStale: boolean;  // > 5x expected interval
  isOffline: boolean;    // Fetch failed
}
```

Visual indicators:
- `isStale`: Subtle dimming or timestamp warning
- `isVeryStale`: "Connection issues" banner
- `isOffline`: Prominent offline indicator

---

## Cache Strategy

### Frontend Cache Layers

```typescript
// In-memory cache (React Query / SWR pattern)
interface CacheEntry<T> {
  data: T;
  fetchedAt: Date;
  etag?: string;
}

// Local storage for persistence across refreshes
interface PersistedCache {
  lastPanelId: string;      // Return to last panel
  systemStates: CacheEntry<SystemState[]>;  // Show immediately on load
}
```

### Cache Invalidation

Invalidate on:
- User action (mutation)
- Explicit refresh request
- Cache TTL expiration
- Backend push (future websocket)

---

## Mutation Flow

When frontend modifies data:

```
1. User triggers action
2. Optimistic update (UI reflects change immediately)
3. API request sent
4. On success: Confirm optimistic state, invalidate related queries
5. On failure: Rollback optimistic state, show error
```

### Example: Status Change

```typescript
async function updateSystemStatus(id: string, newStatus: Status) {
  // Optimistic update
  cache.updateSystemState(id, { status: newStatus });

  try {
    await api.patch(`/system-states/${id}`, { status: newStatus });
    // Success - data will be refreshed on next poll
  } catch (error) {
    // Rollback
    cache.invalidateSystemState(id);
    showError('Failed to update status');
  }
}
```

---

## Event Streaming (Future)

When upgrading to websockets:

```typescript
interface EventStream {
  type: 'state_change' | 'alert' | 'event' | 'scenario_run';
  payload: unknown;
  timestamp: string;
}

// Client subscribes to ship events
ws.subscribe(`/ships/${shipId}/events`);

// Server pushes relevant events
ws.on('message', (event: EventStream) => {
  switch (event.type) {
    case 'state_change':
      cache.updateSystemState(event.payload.id, event.payload);
      break;
    case 'alert':
      alertStore.add(event.payload);
      break;
  }
});
```

---

## Conflict Resolution

If two clients modify the same resource:

1. **Last Write Wins** (MVP): Simple, acceptable for GM-controlled game
2. **Optimistic Locking** (Future): Include version in updates

```typescript
// Request with version
PATCH /api/system-states/abc123
{
  "status": "critical",
  "version": 5
}

// Response if version mismatch
409 Conflict
{
  "error": "Version conflict",
  "currentVersion": 6,
  "currentData": {...}
}
```

---

## Batch Operations

For efficiency, support batch fetching:

```typescript
// Instead of N requests for N systems
GET /api/system-states?ids=a,b,c

// Panel snapshot includes all related data
GET /api/panels/:id/snapshot
{
  panel: Panel,
  widgets: WidgetInstance[],
  systemStates: SystemState[],
  datasets: Dataset[]
}
```

---

## Offline Behavior

When connection is lost:

1. Continue showing cached data
2. Queue mutations locally
3. Show offline indicator
4. On reconnect:
   - Sync queued mutations
   - Refresh all cached data
   - Show "reconnected" notification

---

## Acceptance Checks

- [ ] Frontend polls backend at configured intervals
- [ ] Conditional fetching reduces unnecessary data transfer
- [ ] Stale data shows appropriate indicators
- [ ] Mutations are optimistic with rollback on failure
- [ ] Cache persists across page refreshes
- [ ] Offline mode degrades gracefully
