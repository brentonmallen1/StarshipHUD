import { useState, useMemo } from 'react';
import { useCrew } from '../../hooks/useShipData';
import type { WidgetRendererProps, Crew, CrewStatus } from '../../types';
import './CrewStatusWidget.css';

type SortField = 'status' | 'name' | 'role';
type SortDirection = 'asc' | 'desc';
type FilterType = CrewStatus | 'all' | 'active' | 'conditions';

interface CrewStatusConfig {
  showNpcOnly?: boolean;
  showPcOnly?: boolean;
  compactMode?: boolean;
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
  light_duty: 'LIGHT DUTY',
  incapacitated: 'INCAP',
  critical: 'CRITICAL',
  deceased: 'DECEASED',
  on_leave: 'ON LEAVE',
  missing: 'MISSING',
};

const STATUS_FULL_LABELS: Record<CrewStatus, string> = {
  fit_for_duty: 'Fit for Duty',
  light_duty: 'Light Duty',
  incapacitated: 'Incapacitated',
  critical: 'Critical',
  deceased: 'Deceased',
  on_leave: 'On Leave',
  missing: 'Missing',
};

export function CrewStatusWidget({ instance, isEditing }: WidgetRendererProps) {
  const config = instance.config as CrewStatusConfig;
  const { data: crew, isLoading, error } = useCrew();

  // Sorting and filtering state
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filter, setFilter] = useState<FilterType>('all');

  // Expand/collapse state
  const [expandedCrewId, setExpandedCrewId] = useState<string | null>(null);

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
      // Active means not deceased, not missing, not on leave
      filtered = filteredByConfig.filter(c =>
        c.status !== 'deceased' &&
        c.status !== 'missing' &&
        c.status !== 'on_leave'
      );
    } else if (filter === 'conditions') {
      // Has condition tags
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

  const handleRowClick = (crewId: string) => {
    setExpandedCrewId(prev => prev === crewId ? null : crewId);
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
          Displays crew members with health status, conditions, and expandable details.
          Useful for medical or command panels.
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
          const isExpanded = expandedCrewId === member.id;

          return (
            <div
              key={member.id}
              className={`crew-row status-${member.status} ${isExpanded ? 'expanded' : ''} ${member.condition_tags.length > 0 ? 'has-conditions' : ''}`}
            >
              {/* Collapsed Row (always visible) */}
              <div className="row-collapsed" onClick={() => handleRowClick(member.id)}>
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
                <div className="row-meta">
                  <span className={`status-label status-${member.status}`}>
                    {STATUS_LABELS[member.status]}
                  </span>
                  {member.condition_tags.length > 0 && (
                    <span className="condition-count" title={member.condition_tags.join(', ')}>
                      +{member.condition_tags.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="row-expanded">
                  <div className="crew-details">
                    <div className="detail-row">
                      <span className="detail-label">Status</span>
                      <span className={`detail-value status-${member.status}`}>
                        {STATUS_FULL_LABELS[member.status]}
                      </span>
                    </div>
                    {member.role && (
                      <div className="detail-row">
                        <span className="detail-label">Role</span>
                        <span className="detail-value">{member.role}</span>
                      </div>
                    )}
                    {!member.is_npc && member.player_name && (
                      <div className="detail-row">
                        <span className="detail-label">Player</span>
                        <span className="detail-value player-name">{member.player_name}</span>
                      </div>
                    )}
                    {member.condition_tags.length > 0 && (
                      <div className="detail-conditions">
                        <span className="detail-label">Conditions</span>
                        <div className="condition-tags">
                          {member.condition_tags.map((tag, idx) => (
                            <span key={idx} className="condition-tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {member.notes && (
                      <div className="detail-notes">
                        <span className="detail-label">Notes</span>
                        <p className="notes-text">{member.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
