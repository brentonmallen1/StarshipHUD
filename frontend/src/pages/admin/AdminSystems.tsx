import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSystemStates } from '../../hooks/useShipData';
import { useUpdateSystemState } from '../../hooks/useMutations';
import { computeLayout } from '../../utils/graphLayout';
import type { SystemStatus, SystemState } from '../../types';
import './Admin.css';

type ViewMode = 'table' | 'tree' | 'graph';

interface TreeNode {
  system: SystemState;
  children: TreeNode[];
  depth: number;
}

interface GraphNode {
  id: string;
  name: string;
  status: SystemStatus;
  effectiveStatus: SystemStatus;
  isCapped: boolean;
  x: number;
  y: number;
  depth: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

export function AdminSystems() {
  const { data: systems, isLoading } = useSystemStates();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<SystemStatus>('operational');
  const [editDependsOn, setEditDependsOn] = useState<string[]>([]);
  const [originalValue, setOriginalValue] = useState<number>(0);
  const [originalStatus, setOriginalStatus] = useState<SystemStatus>('operational');
  const [originalDependsOn, setOriginalDependsOn] = useState<string[]>([]);
  const [showDepsDropdown, setShowDepsDropdown] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Graph view state
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, transformX: 0, transformY: 0 });
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // Mutation hook
  const updateSystem = useUpdateSystemState();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDepsDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize expanded nodes when switching to tree view - expand all by default
  useEffect(() => {
    if (viewMode === 'tree' && systems) {
      setExpandedNodes(new Set(systems.map(s => s.id)));
    }
  }, [viewMode, systems]);

  const startEditing = (id: string, value: number, status: SystemStatus, dependsOn: string[]) => {
    setEditingId(id);
    setEditValue(value);
    setEditStatus(status);
    setEditDependsOn(dependsOn || []);
    setOriginalValue(value);
    setOriginalStatus(status);
    setOriginalDependsOn(dependsOn || []);
    setShowDepsDropdown(false);
    if (viewMode === 'graph') {
      setSelectedNode(id);
    }
  };

  const saveChanges = (systemId: string) => {
    const data: { value?: number; status?: SystemStatus; depends_on?: string[] } = {};

    if (editValue !== originalValue) {
      data.value = editValue;
    }

    if (editStatus !== originalStatus) {
      data.status = editStatus;
    }

    const depsChanged = JSON.stringify(editDependsOn.sort()) !== JSON.stringify(originalDependsOn.sort());
    if (depsChanged) {
      data.depends_on = editDependsOn;
    }

    if (Object.keys(data).length > 0) {
      updateSystem.mutate(
        { id: systemId, data },
        { onSuccess: () => setEditingId(null) }
      );
    } else {
      setEditingId(null);
    }
  };

  const toggleDependency = (depId: string) => {
    setEditDependsOn(prev =>
      prev.includes(depId)
        ? prev.filter(id => id !== depId)
        : [...prev, depId]
    );
  };

  const getSystemName = (id: string) => {
    return systems?.find(s => s.id === id)?.name || id;
  };

  const toggleExpanded = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Build tree structure
  const treeData = useMemo(() => {
    if (!systems) return [];

    const childrenMap = new Map<string, SystemState[]>();

    // Build children map (reverse of depends_on)
    systems.forEach(system => {
      (system.depends_on || []).forEach(parentId => {
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(system);
      });
    });

    // Find roots (systems with no dependencies)
    const roots = systems.filter(s => !s.depends_on || s.depends_on.length === 0);

    function buildNode(system: SystemState, depth: number, visited: Set<string>): TreeNode | null {
      if (visited.has(system.id)) return null;
      visited.add(system.id);

      const children = (childrenMap.get(system.id) || [])
        .map(child => buildNode(child, depth + 1, new Set(visited)))
        .filter((n): n is TreeNode => n !== null)
        .sort((a, b) => a.system.name.localeCompare(b.system.name));

      return { system, children, depth };
    }

    return roots
      .map(root => buildNode(root, 0, new Set()))
      .filter((n): n is TreeNode => n !== null)
      .sort((a, b) => a.system.name.localeCompare(b.system.name));
  }, [systems]);

  // Build graph structure with dagre layout
  const graphData = useMemo(() => {
    if (!systems) return { nodes: [], edges: [], width: 200, height: 200 };

    const edges: GraphEdge[] = [];

    // Create edges (parent -> child)
    systems.forEach(system => {
      (system.depends_on || []).forEach(parentId => {
        edges.push({ from: parentId, to: system.id });
      });
    });

    // Compute layout using dagre
    const layoutNodes = systems.map(s => ({ id: s.id, width: 80, height: 50 }));
    const layout = computeLayout(layoutNodes, edges, {
      direction: 'TB',
      rankSep: 60,
      nodeSep: 40,
      marginX: 40,
      marginY: 40,
    });

    // Create nodes with positions from dagre
    const nodes: GraphNode[] = systems.map(system => {
      const isCapped = system.effective_status && system.effective_status !== system.status;
      const pos = layout.nodes.get(system.id) || { x: 100, y: 100, width: 80, height: 50 };

      return {
        id: system.id,
        name: system.name,
        status: system.status,
        effectiveStatus: (system.effective_status || system.status) as SystemStatus,
        isCapped: !!isCapped,
        x: pos.x,
        y: pos.y,
        depth: 0,
      };
    });

    return { nodes, edges, width: layout.width, height: layout.height };
  }, [systems]);

  // Graph zoom to fit
  const handleZoomToFit = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  // Graph pan/zoom handlers
  const handleZoom = useCallback((delta: number) => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(3, prev.scale + delta))
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !e.defaultPrevented) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        transformX: transform.x,
        transformY: transform.y
      };
    }
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform(prev => ({
        ...prev,
        x: panStartRef.current.transformX + dx,
        y: panStartRef.current.transformY + dy
      }));
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const getStatusColor = (status: SystemStatus): string => {
    const colors: Record<SystemStatus, string> = {
      optimal: '#00ffcc',
      operational: '#3fb950',
      degraded: '#d4a72c',
      compromised: '#db6d28',
      critical: '#f85149',
      destroyed: '#8b0000',
      offline: '#6e7681',
    };
    return colors[status] || '#6e7681';
  };

  if (isLoading) {
    return <div className="loading">Loading systems...</div>;
  }

  const renderEditPanel = (system: SystemState | undefined) => {
    if (!system || editingId !== system.id) return null;

    return (
      <div className="graph-edit-panel">
        <div className="edit-panel-header">
          <span className="edit-panel-title">{system.name}</span>
          <button className="edit-panel-close" onClick={() => setEditingId(null)}>×</button>
        </div>
        <div className="edit-panel-body">
          <div className="edit-field">
            <label>Value</label>
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(Number(e.target.value))}
              min={0}
              max={system.max_value}
            />
          </div>
          <div className="edit-field">
            <label>Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as SystemStatus)}
            >
              <option value="optimal">Optimal</option>
              <option value="operational">Operational</option>
              <option value="degraded">Degraded</option>
              <option value="compromised">Compromised</option>
              <option value="critical">Critical</option>
              <option value="destroyed">Destroyed</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          <div className="edit-field" ref={dropdownRef}>
            <label>Depends On</label>
            <button
              className="deps-dropdown-btn"
              onClick={() => setShowDepsDropdown(!showDepsDropdown)}
            >
              {editDependsOn.length === 0
                ? 'None'
                : `${editDependsOn.length} selected`}
              <span className="dropdown-arrow">▼</span>
            </button>
            {showDepsDropdown && (
              <div className="deps-dropdown">
                {systems
                  ?.filter(s => s.id !== system.id)
                  .map(s => (
                    <label key={s.id} className="deps-option">
                      <input
                        type="checkbox"
                        checked={editDependsOn.includes(s.id)}
                        onChange={() => toggleDependency(s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
              </div>
            )}
          </div>
          <div className="edit-panel-actions">
            <button
              className="btn btn-small btn-primary"
              onClick={() => saveChanges(system.id)}
            >
              Save
            </button>
            <button
              className="btn btn-small"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Minimal file-explorer style tree node
  const renderTreeNode = (node: TreeNode): JSX.Element => {
    const { system, children, depth } = node;
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(system.id);
    const isCapped = system.effective_status && system.effective_status !== system.status;
    const isEditing = editingId === system.id;
    const effectiveStatus = system.effective_status || system.status;

    return (
      <div key={system.id} className="file-tree-node">
        <div
          className={`file-tree-row ${isEditing ? 'editing' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
          onClick={() => !isEditing && startEditing(system.id, system.value, system.status, system.depends_on)}
        >
          <span
            className={`file-tree-toggle ${hasChildren ? '' : 'hidden'}`}
            onClick={(e) => {
              e.stopPropagation();
              hasChildren && toggleExpanded(system.id);
            }}
          >
            {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
          </span>
          <span className={`file-tree-status-dot status-${effectiveStatus}`} />
          <span className="file-tree-name">{system.name}</span>
          {isCapped && <span className="file-tree-capped" title={`Own: ${system.status}`}>⚠</span>}
          <span className="file-tree-value">{system.value}{system.unit}</span>
        </div>
        {isEditing && (
          <div className="file-tree-edit" style={{ paddingLeft: `${depth * 16 + 24}px` }}>
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(Number(e.target.value))}
              min={0}
              max={system.max_value}
              onClick={(e) => e.stopPropagation()}
            />
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as SystemStatus)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="optimal">Fully Op</option>
              <option value="operational">Online</option>
              <option value="degraded">Degraded</option>
              <option value="compromised">Compromised</option>
              <option value="critical">Critical</option>
              <option value="destroyed">Destroyed</option>
              <option value="offline">Offline</option>
            </select>
            <button className="btn btn-small btn-primary" onClick={(e) => { e.stopPropagation(); saveChanges(system.id); }}>Save</button>
            <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>Cancel</button>
          </div>
        )}
        {hasChildren && isExpanded && (
          <div className="file-tree-children">
            {children.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="admin-systems">
      <div className="admin-header-row">
        <h2 className="admin-page-title">System States</h2>
        <div className="view-toggle">
          <button
            className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Table
          </button>
          <button
            className={`view-btn ${viewMode === 'tree' ? 'active' : ''}`}
            onClick={() => setViewMode('tree')}
          >
            Tree
          </button>
          <button
            className={`view-btn ${viewMode === 'graph' ? 'active' : ''}`}
            onClick={() => setViewMode('graph')}
          >
            Graph
          </button>
        </div>
      </div>

      {viewMode === 'table' && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>System</th>
              <th>Category</th>
              <th>Value</th>
              <th>Status</th>
              <th>Depends On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {systems?.map((system) => {
              const isCapped = system.effective_status && system.effective_status !== system.status;

              return (
                <tr key={system.id}>
                  <td>{system.name}</td>
                  <td>
                    <span className="badge">{system.category}</span>
                  </td>
                  <td>
                    {editingId === system.id ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(Number(e.target.value))}
                        min={0}
                        max={system.max_value}
                        style={{ width: '80px' }}
                      />
                    ) : (
                      <span className={`status-${system.effective_status || system.status}`}>
                        {system.value}{system.unit}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingId === system.id ? (
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as SystemStatus)}
                      >
                        <option value="optimal">Optimal</option>
                        <option value="operational">Operational</option>
                        <option value="degraded">Degraded</option>
                        <option value="compromised">Compromised</option>
                        <option value="critical">Critical</option>
                        <option value="destroyed">Destroyed</option>
                        <option value="offline">Offline</option>
                      </select>
                    ) : (
                      <div className="status-cell">
                        <span className={`status-badge status-${system.effective_status || system.status}`}>
                          {(system.effective_status || system.status).replace('_', ' ')}
                        </span>
                        {isCapped && (
                          <span className="capped-indicator" title={`Own status: ${system.status.replace('_', ' ')} (capped by dependency)`}>
                            ⚠
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {editingId === system.id ? (
                      <div className="deps-editor" ref={dropdownRef}>
                        <button
                          className="deps-dropdown-btn"
                          onClick={() => setShowDepsDropdown(!showDepsDropdown)}
                        >
                          {editDependsOn.length === 0
                            ? 'None'
                            : `${editDependsOn.length} selected`}
                          <span className="dropdown-arrow">▼</span>
                        </button>
                        {showDepsDropdown && (
                          <div className="deps-dropdown">
                            {systems
                              ?.filter(s => s.id !== system.id)
                              .map(s => (
                                <label key={s.id} className="deps-option">
                                  <input
                                    type="checkbox"
                                    checked={editDependsOn.includes(s.id)}
                                    onChange={() => toggleDependency(s.id)}
                                  />
                                  {s.name}
                                </label>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="deps-list">
                        {system.depends_on?.length > 0
                          ? system.depends_on.map(getSystemName).join(', ')
                          : '—'}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingId === system.id ? (
                      <>
                        <button
                          className="btn btn-small btn-primary"
                          onClick={() => saveChanges(system.id)}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-small"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-small"
                        onClick={() =>
                          startEditing(system.id, system.value, system.status, system.depends_on)
                        }
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {viewMode === 'tree' && (
        <div className="file-tree-view">
          {treeData.map(node => renderTreeNode(node))}
        </div>
      )}

      {viewMode === 'graph' && (
        <div className="graph-view-container">
          <div
            ref={graphContainerRef}
            className={`graph-canvas-admin ${isPanning ? 'panning' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <svg
              viewBox={`0 0 ${graphData.width} ${graphData.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <g
                style={{
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  transformOrigin: `${graphData.width / 2}px ${graphData.height / 2}px`
                }}
              >
                {/* Edges - curved bezier paths */}
                {graphData.edges.map((edge, idx) => {
                  const fromNode = graphData.nodes.find(n => n.id === edge.from);
                  const toNode = graphData.nodes.find(n => n.id === edge.to);
                  if (!fromNode || !toNode) return null;

                  const midY = (fromNode.y + toNode.y) / 2;
                  const path = `M ${fromNode.x} ${fromNode.y} C ${fromNode.x} ${midY}, ${toNode.x} ${midY}, ${toNode.x} ${toNode.y}`;

                  return (
                    <path
                      key={`edge-${idx}`}
                      d={path}
                      fill="none"
                      stroke={toNode.isCapped ? 'var(--color-degraded)' : 'var(--color-border)'}
                      strokeWidth={1.5}
                      strokeOpacity={toNode.isCapped ? 0.6 : 0.4}
                    />
                  );
                })}

                {/* Nodes */}
                {graphData.nodes.map(node => {
                  const isSelected = selectedNode === node.id;
                  const color = getStatusColor(node.effectiveStatus);

                  return (
                    <g
                      key={node.id}
                      className="graph-node-admin"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedNode(node.id);
                        const system = systems?.find(s => s.id === node.id);
                        if (system) {
                          startEditing(system.id, system.value, system.status, system.depends_on);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Glow */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={14}
                        fill={color}
                        opacity={isSelected ? 0.5 : 0.25}
                      />
                      {/* Capped indicator */}
                      {node.isCapped && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={16}
                          fill="none"
                          stroke="#d4a72c"
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          opacity="0.7"
                        />
                      )}
                      {/* Node circle */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={10}
                        fill={color}
                        stroke={isSelected ? '#fff' : color}
                        strokeWidth={isSelected ? 2 : 1}
                      />
                      {/* Label */}
                      <text
                        x={node.x}
                        y={node.y + 24}
                        textAnchor="middle"
                        fill="#a0a0a0"
                        fontSize={10}
                        fontFamily="var(--font-mono)"
                      >
                        {node.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Zoom controls */}
            <div className="graph-zoom-controls">
              <button onClick={() => handleZoom(0.2)} title="Zoom in">+</button>
              <button onClick={handleZoomToFit} title="Fit to view">⊡</button>
              <button onClick={() => handleZoom(-0.2)} title="Zoom out">−</button>
            </div>
          </div>

          {/* Edit panel for graph view */}
          {selectedNode && renderEditPanel(systems?.find(s => s.id === selectedNode))}
        </div>
      )}
    </div>
  );
}
