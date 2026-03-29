import { useState, useMemo } from 'react';
import { useCrew } from '../../hooks/useShipData';
import { useUpdateCrew } from '../../hooks/useMutations';
import { CrewStatusDropdown } from '../controls/InlineEditControls';
import type { WidgetRendererProps, Crew, CrewStatus } from '../../types';
import './CrewStatusWidget.css';

type SortField = 'status' | 'name' | 'role';
type SortDirection = 'asc' | 'desc';
type FilterType = CrewStatus | 'all' | 'active' | 'conditions';

interface CrewStatusConfig {
  showNpcOnly?: boolean;
  showPcOnly?: boolean;
  compactMode?: boolean;
  showHeartbeat?: boolean;
}

// Map crew status to heartbeat animation state
type HeartbeatState = 'healthy' | 'degraded' | 'erratic' | 'offline' | 'flatline';
const HEARTBEAT_STATE: Record<CrewStatus, HeartbeatState> = {
  fit_for_duty: 'healthy',
  light_duty: 'degraded',
  incapacitated: 'degraded',
  critical: 'erratic',
  on_leave: 'healthy',
  missing: 'offline',
  deceased: 'flatline',
};

// SVG path data for each heartbeat state
const HEARTBEAT_PATHS: Record<HeartbeatState, string> = {
  healthy: 'M 0,15 L 8,15 Q 10,15 11,13 Q 12,11 13,15 L 18,15 L 20,15 L 21,18 L 23,5 L 25,22 L 27,15 L 32,15 Q 34,15 35,13 Q 37,11 38,15 L 50,15 L 58,15 Q 60,15 61,13 Q 62,11 63,15 L 68,15 L 70,15 L 71,18 L 73,5 L 75,22 L 77,15 L 82,15 Q 84,15 85,13 Q 87,11 88,15 L 100,15',
  degraded: 'M 0,15 L 10,15 Q 12,15 13,14 Q 14,13 15,15 L 20,15 L 22,16 L 24,9 L 26,19 L 28,15 L 35,15 Q 37,15 38,14 Q 39,13 40,15 L 50,15 L 60,15 Q 62,15 63,14 Q 64,13 65,15 L 70,15 L 72,16 L 74,9 L 76,19 L 78,15 L 85,15 Q 87,15 88,14 Q 89,13 90,15 L 100,15',
  erratic: 'M 0,15 L 5,15 L 6,17 L 8,7 L 10,20 L 12,15 L 18,15 L 19,16 L 21,10 L 22,18 L 24,15 L 32,15 L 33,17 L 35,6 L 37,21 L 39,15 L 45,15 L 46,16 L 48,8 L 50,19 L 52,15 L 55,15 L 56,17 L 58,7 L 60,20 L 62,15 L 68,15 L 69,16 L 71,10 L 72,18 L 74,15 L 82,15 L 83,17 L 85,6 L 87,21 L 89,15 L 95,15 L 96,16 L 98,8 L 100,15',
  offline: 'M 0,15 L 100,15',
  flatline: 'M 0,15 L 100,15',
};

// Animation durations per state (seconds)
const HEARTBEAT_DURATION: Record<HeartbeatState, number> = {
  healthy: 2,
  degraded: 2.8,
  erratic: 1.2,
  offline: 0,
  flatline: 0,
};

/** Deterministic hash for consistent animation offset per crew member */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash % 1000) / 1000;
}

const STATUS_ORDER: Record<CrewStatus, number> = {
  critical: 0,
  incapacitated: 1,
  light_duty: 2,
  fit_for_duty: 3,
  on_leave: 4,
  missing: 5,
  deceased: 6,
};

const STATUS_LABELS: Record<CrewStatus, string> = {
  fit_for_duty: 'FIT',
  light_duty: 'LIGHT',
  incapacitated: 'INCAP',
  critical: 'CRIT',
  deceased: 'DECEASED',
  on_leave: 'LEAVE',
  missing: 'MISSING',
};

export function CrewStatusWidget({ instance, isEditing, canEditData }: WidgetRendererProps) {
  const config = instance.config as CrewStatusConfig;
  const { data: crew, isLoading, error } = useCrew();
  const updateCrew = useUpdateCrew();

  // Sorting and filtering state
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filter, setFilter] = useState<FilterType>('all');

  // Handler for inline status changes
  const handleStatusChange = (memberId: string, newStatus: CrewStatus) => {
    updateCrew.mutate({ id: memberId, data: { status: newStatus } });
  };

  // Filter crew based on config
  const filteredByConfig = useMemo(() => {
    if (!crew) return [];
    let result = crew;
    if (config.showNpcOnly) {
      result = result.filter(c => c.is_npc);
    } else if (config.showPcOnly) {
      result = result.filter(c => !c.is_npc);
    }
    return result;
  }, [crew, config.showNpcOnly, config.showPcOnly]);

  // Sort and filter crew
  const sortedCrew = useMemo(() => {
    if (!filteredByConfig) return [];

    // Apply filter
    let filtered = filteredByConfig;
    if (filter === 'active') {
      filtered = filteredByConfig.filter(c =>
        c.status !== 'deceased' &&
        c.status !== 'missing' &&
        c.status !== 'on_leave'
      );
    } else if (filter === 'conditions') {
      filtered = filteredByConfig.filter(c => c.condition_tags.length > 0);
    } else if (filter !== 'all') {
      filtered = filteredByConfig.filter(c => c.status === filter);
    }

    // Sort
    return filtered.slice().sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'status':
          comparison = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'role':
          comparison = (a.role || '').localeCompare(b.role || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredByConfig, sortField, sortDirection, filter]);

  // Count crew by status
  const statusCounts = useMemo(() => {
    if (!filteredByConfig) return {} as Record<CrewStatus, number>;
    return filteredByConfig.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<CrewStatus, number>);
  }, [filteredByConfig]);

  // Count crew with conditions
  const conditionCount = useMemo(() => {
    if (!filteredByConfig) return 0;
    return filteredByConfig.filter(c => c.condition_tags.length > 0).length;
  }, [filteredByConfig]);

  // Count active crew
  const activeCount = useMemo(() => {
    if (!filteredByConfig) return 0;
    return filteredByConfig.filter(c =>
      c.status !== 'deceased' &&
      c.status !== 'missing' &&
      c.status !== 'on_leave'
    ).length;
  }, [filteredByConfig]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="crew-status-widget">
        <div className="crew-header">
          <h3 className="crew-title">Crew Status</h3>
        </div>
        <div className="crew-content">
          <div className="crew-empty">
            <div className="empty-icon">...</div>
            <p className="empty-message">Loading crew...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="crew-status-widget">
        <div className="crew-header">
          <h3 className="crew-title">Crew Status</h3>
        </div>
        <div className="crew-content">
          <div className="crew-empty">
            <div className="empty-icon">!</div>
            <p className="empty-message">Failed to load crew</p>
          </div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="crew-status-widget editing">
        <div className="crew-header">
          <h3 className="crew-title">Crew Status</h3>
        </div>
        <p className="editing-hint">
          Displays crew members with health status and conditions.
        </p>
      </div>
    );
  }

  return (
    <div className={`crew-status-widget ${config.compactMode ? 'compact' : ''}`}>
      <div className="crew-header">
        <h3 className="crew-title">Crew Status</h3>
        <div className="crew-header-right">
          <span className="crew-count">{filteredByConfig?.length || 0}</span>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="status-summary">
        <button
          className={`status-chip all ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          ALL
        </button>
        <button
          className={`status-chip active-filter ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          ACTIVE ({activeCount})
        </button>
        {conditionCount > 0 && (
          <button
            className={`status-chip conditions ${filter === 'conditions' ? 'active' : ''}`}
            onClick={() => setFilter('conditions')}
          >
            CONDITIONS ({conditionCount})
          </button>
        )}
        {statusCounts.critical > 0 && (
          <button
            className={`status-chip critical ${filter === 'critical' ? 'active' : ''}`}
            onClick={() => setFilter('critical')}
          >
            <span className="status-indicator" />
            CRIT ({statusCounts.critical})
          </button>
        )}
        {statusCounts.incapacitated > 0 && (
          <button
            className={`status-chip incapacitated ${filter === 'incapacitated' ? 'active' : ''}`}
            onClick={() => setFilter('incapacitated')}
          >
            <span className="status-indicator" />
            INCAP ({statusCounts.incapacitated})
          </button>
        )}
        {statusCounts.light_duty > 0 && (
          <button
            className={`status-chip light_duty ${filter === 'light_duty' ? 'active' : ''}`}
            onClick={() => setFilter('light_duty')}
          >
            <span className="status-indicator" />
            LIGHT ({statusCounts.light_duty})
          </button>
        )}
      </div>

      {/* Sort Controls */}
      <div className="crew-sort">
        <button
          className={`sort-btn ${sortField === 'status' ? 'active' : ''}`}
          onClick={() => handleSort('status')}
        >
          Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          className={`sort-btn ${sortField === 'name' ? 'active' : ''}`}
          onClick={() => handleSort('name')}
        >
          Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          className={`sort-btn ${sortField === 'role' ? 'active' : ''}`}
          onClick={() => handleSort('role')}
        >
          Role {sortField === 'role' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
      </div>

      {/* Crew List */}
      <div className="crew-list">
        {sortedCrew.length === 0 && (
          <div className="crew-empty">
            <div className="empty-icon">-</div>
            <p className="empty-message">No crew found</p>
          </div>
        )}

        {sortedCrew.map((member: Crew) => {
          const state = HEARTBEAT_STATE[member.status];
          const duration = HEARTBEAT_DURATION[state];
          const delay = duration > 0 ? -hashString(member.id) * duration : 0;

          return (
            <div
              key={member.id}
              className={`crew-row status-${member.status} ${member.condition_tags.length > 0 ? 'has-conditions' : ''}`}
            >
              <div className="row-indicator">
                <span className="status-dot" />
              </div>

              <div className="row-main">
                <span className="crew-name">
                  {member.name}
                  {!member.is_npc && <span className="pc-badge">PC</span>}
                </span>
                {member.role && (
                  <span className="crew-role">{member.role}</span>
                )}
              </div>

              {/* Heartbeat (if enabled) */}
              {config.showHeartbeat && (
                <div className={`crew-heartbeat heartbeat--${state}`}>
                  <svg
                    className="heartbeat-svg"
                    viewBox="0 0 100 30"
                    preserveAspectRatio="none"
                    style={{ animationDelay: `${delay}s` }}
                  >
                    <path className="heartbeat-path" d={HEARTBEAT_PATHS[state]} />
                  </svg>
                </div>
              )}

              {/* Status - always visible, dropdown when editable */}
              <div className="row-status">
                {canEditData ? (
                  <CrewStatusDropdown
                    value={member.status}
                    onChange={(newStatus) => handleStatusChange(member.id, newStatus)}
                  />
                ) : (
                  <span className={`status-label status-${member.status}`}>
                    {STATUS_LABELS[member.status]}
                  </span>
                )}
              </div>

              {/* Condition count badge */}
              {member.condition_tags.length > 0 && (
                <span className="condition-count" title={member.condition_tags.join(', ')}>
                  +{member.condition_tags.length}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
