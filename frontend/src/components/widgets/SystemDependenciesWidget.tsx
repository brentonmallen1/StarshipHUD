import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useSystemStates } from '../../hooks/useShipData';
import { computeLayoutWithPadding } from '../../utils/graphLayout';
import type { WidgetRendererProps, SystemState, SystemStatus } from '../../types';
import './SystemDependenciesWidget.css';

// Status colors matching the design system
const STATUS_COLORS: Record<SystemStatus, string> = {
  fully_operational: 'var(--color-fully-operational, #00ff64)',
  operational: 'var(--color-operational)',
  degraded: 'var(--color-degraded)',
  compromised: 'var(--color-compromised)',
  critical: 'var(--color-critical)',
  destroyed: 'var(--color-destroyed, #661111)',
  offline: 'var(--color-offline, #444)',
};

const STATUS_LABELS: Record<SystemStatus, string> = {
  fully_operational: 'OPTIMAL',
  operational: 'ONLINE',
  degraded: 'DEGRADED',
  compromised: 'IMPAIRED',
  critical: 'CRITICAL',
  destroyed: 'DESTROYED',
  offline: 'OFFLINE',
};

// Status priority for comparison (lower = worse)
const STATUS_ORDER: SystemStatus[] = [
  'destroyed',
  'critical',
  'compromised',
  'degraded',
  'offline',
  'operational',
  'fully_operational',
];

interface GraphNode {
  id: string;
  name: string;
  status: SystemStatus;
  effectiveStatus: SystemStatus;
  isCapped: boolean;
  dependsOn: string[];
  dependedBy: string[];
  x: number;
  y: number;
}

interface SystemDependenciesConfig {
  show_legend?: boolean;
  highlight_capped?: boolean;
  category_filter?: string;
}

function buildGraph(systems: SystemState[]): GraphNode[] {
  const systemMap = new Map<string, SystemState>();
  systems.forEach(s => systemMap.set(s.id, s));

  // Build reverse dependency map (who depends on this system)
  const dependedByMap = new Map<string, string[]>();
  systems.forEach(s => {
    (s.depends_on || []).forEach(depId => {
      if (!dependedByMap.has(depId)) {
        dependedByMap.set(depId, []);
      }
      dependedByMap.get(depId)!.push(s.id);
    });
  });

  // Build edges for dagre (parent -> child)
  const edges = systems.flatMap(s =>
    (s.depends_on || []).map(parentId => ({ from: parentId, to: s.id }))
  );

  // Compute layout using dagre
  const layoutNodes = systems.map(s => ({ id: s.id }));
  const layout = computeLayoutWithPadding(layoutNodes, edges, {
    direction: 'TB',
    rankSep: 40,
    nodeSep: 25,
  });

  // Create nodes with positions from dagre
  const nodes: GraphNode[] = systems.map(s => {
    const ownStatusIdx = STATUS_ORDER.indexOf(s.status);
    const effectiveStatusIdx = STATUS_ORDER.indexOf(s.effective_status || s.status);
    const isCapped = effectiveStatusIdx < ownStatusIdx;
    const pos = layout.nodes.get(s.id) || { x: 50, y: 50 };

    return {
      id: s.id,
      name: s.name,
      status: s.status,
      effectiveStatus: s.effective_status || s.status,
      isCapped,
      dependsOn: s.depends_on || [],
      dependedBy: dependedByMap.get(s.id) || [],
      x: pos.x,
      y: pos.y,
    };
  });

  return nodes;
}

interface NodeProps {
  node: GraphNode;
  isSelected: boolean;
  onSelect: (node: GraphNode) => void;
}

function DependencyNode({ node, isSelected, onSelect }: NodeProps) {
  const color = STATUS_COLORS[node.effectiveStatus];
  const nodeRadius = 4;

  return (
    <g
      className={`dep-node ${node.isCapped ? 'capped' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(node)}
      style={{ cursor: 'pointer' }}
    >
      {/* Glow effect */}
      <circle
        cx={node.x}
        cy={node.y}
        r={nodeRadius + 2}
        fill="none"
        stroke={color}
        strokeWidth="1"
        opacity="0.4"
        className="node-glow"
      />

      {/* Main node circle */}
      <circle
        cx={node.x}
        cy={node.y}
        r={nodeRadius}
        fill={color}
        stroke={isSelected ? 'var(--color-accent-cyan)' : color}
        strokeWidth={isSelected ? 1.2 : 0.4}
      />

      {/* Capped indicator - subtle dashed ring, no animation */}
      {node.isCapped && (
        <circle
          cx={node.x}
          cy={node.y}
          r={nodeRadius + 3.5}
          fill="none"
          stroke="var(--color-degraded)"
          strokeWidth="0.6"
          strokeDasharray="1.5,1"
          opacity="0.7"
          className="capped-ring"
        />
      )}

      {/* Node label */}
      <text
        x={node.x}
        y={node.y + nodeRadius + 4}
        textAnchor="middle"
        className="node-label"
        fill="var(--color-text-secondary)"
        fontSize="2.8"
      >
        {node.name.length > 12 ? node.name.slice(0, 10) + '…' : node.name}
      </text>
    </g>
  );
}

interface EdgeProps {
  from: GraphNode;
  to: GraphNode;
  isCapped: boolean;
}

function DependencyEdge({ from, to, isCapped }: EdgeProps) {
  // Draw a curved path from parent to child
  // Use vertical bezier that goes down from parent, then curves to child
  const midY = (from.y + to.y) / 2;

  // Path: start at from, curve down vertically, then curve to target
  const path = `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;

  return (
    <path
      d={path}
      fill="none"
      stroke={isCapped ? 'var(--color-degraded)' : 'var(--color-border)'}
      strokeWidth={isCapped ? '0.6' : '0.4'}
      strokeOpacity={isCapped ? '0.7' : '0.4'}
      className={`dep-edge ${isCapped ? 'capped' : ''}`}
    />
  );
}

interface DetailPanelProps {
  node: GraphNode;
  systems: SystemState[];
  onClose: () => void;
}

function DetailPanel({ node, systems, onClose }: DetailPanelProps) {
  const parentNames = node.dependsOn
    .map(id => systems.find(s => s.id === id)?.name || id)
    .join(', ');

  const childNames = node.dependedBy
    .map(id => systems.find(s => s.id === id)?.name || id)
    .join(', ');

  return (
    <div className="dep-detail-panel">
      <div className="detail-header">
        <span className="detail-name">{node.name}</span>
        <button className="detail-close" onClick={onClose}>×</button>
      </div>
      <div className="detail-body">
        <div className="detail-row">
          <span className="detail-label">Status</span>
          <span className={`detail-value status-${node.status}`}>
            {STATUS_LABELS[node.status]}
          </span>
        </div>
        {node.isCapped && (
          <div className="detail-row capped-warning">
            <span className="detail-label">Effective</span>
            <span className={`detail-value status-${node.effectiveStatus}`}>
              {STATUS_LABELS[node.effectiveStatus]} (capped)
            </span>
          </div>
        )}
        {node.dependsOn.length > 0 && (
          <div className="detail-row">
            <span className="detail-label">Depends on</span>
            <span className="detail-value">{parentNames}</span>
          </div>
        )}
        {node.dependedBy.length > 0 && (
          <div className="detail-row">
            <span className="detail-label">Supports</span>
            <span className="detail-value">{childNames}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SystemDependenciesWidget({ instance, isEditing }: WidgetRendererProps) {
  const config = instance.config as SystemDependenciesConfig;
  const { data: systems, isLoading, error } = useSystemStates();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Zoom and pan state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, transformX: 0, transformY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Zoom to fit on initial load
  const handleZoomToFit = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  // Auto zoom-to-fit on mount
  useEffect(() => {
    handleZoomToFit();
  }, [handleZoomToFit]);

  // Zoom handlers
  const handleZoom = useCallback((delta: number) => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(3, prev.scale + delta))
    }));
  }, []);

  // Pan handlers
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
  }, [transform.x, transform.y]);

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

  // Filter systems if category is specified
  const filteredSystems = useMemo(() => {
    if (!systems) return [];
    if (config.category_filter) {
      return systems.filter(s => s.category === config.category_filter);
    }
    return systems;
  }, [systems, config.category_filter]);

  // Build the graph
  const nodes = useMemo(() => buildGraph(filteredSystems), [filteredSystems]);

  // Create node lookup map
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Build edges
  const edges = useMemo(() => {
    const result: { from: GraphNode; to: GraphNode; isCapped: boolean }[] = [];
    nodes.forEach(node => {
      node.dependsOn.forEach(parentId => {
        const parent = nodeMap.get(parentId);
        if (parent) {
          result.push({
            from: parent,
            to: node,
            isCapped: node.isCapped,
          });
        }
      });
    });
    return result;
  }, [nodes, nodeMap]);

  // Count stats
  const stats = useMemo(() => {
    const capped = nodes.filter(n => n.isCapped).length;
    const critical = nodes.filter(n =>
      n.effectiveStatus === 'critical' || n.effectiveStatus === 'destroyed'
    ).length;
    return { total: nodes.length, capped, critical };
  }, [nodes]);

  const handleSelectNode = (node: GraphNode) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  };

  if (isEditing) {
    return (
      <div className="system-deps-widget editing">
        <div className="widget-title">System Dependencies</div>
        <div className="editing-hint">
          Shows dependency graph with status cascade visualization.
          {config.category_filter && (
            <span> Filtered to: {config.category_filter}</span>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="system-deps-widget loading">
        <div className="widget-title">System Dependencies</div>
        <div className="loading-text">Loading systems...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="system-deps-widget error">
        <div className="widget-title">System Dependencies</div>
        <div className="error-text">Failed to load systems</div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="system-deps-widget empty">
        <div className="widget-title">System Dependencies</div>
        <div className="empty-text">No systems configured</div>
      </div>
    );
  }

  return (
    <div className="system-deps-widget">
      {/* Header with stats */}
      <div className="deps-header">
        <span className="deps-title">System Dependencies</span>
        <div className="deps-stats">
          <span className="stat">{stats.total} systems</span>
          {stats.capped > 0 && (
            <span className="stat capped">⚠ {stats.capped} capped</span>
          )}
          {stats.critical > 0 && (
            <span className="stat critical">● {stats.critical} critical</span>
          )}
        </div>
      </div>

      {/* Graph SVG */}
      <div
        ref={canvasRef}
        className={`deps-canvas ${isPanning ? 'panning' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {/* Subtle grid background */}
          <defs>
            <pattern id="dep-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="0.1"
                opacity="0.15"
              />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#dep-grid)" />

          {/* Transform group for zoom/pan */}
          <g
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: '50px 50px'
            }}
          >
            {/* Edges */}
            <g className="edges">
              {edges.map((edge, i) => (
                <DependencyEdge
                  key={`${edge.from.id}-${edge.to.id}-${i}`}
                  from={edge.from}
                  to={edge.to}
                  isCapped={edge.isCapped}
                />
              ))}
            </g>

            {/* Nodes */}
            <g className="nodes">
              {nodes.map(node => (
                <DependencyNode
                  key={node.id}
                  node={node}
                  isSelected={selectedNode?.id === node.id}
                  onSelect={handleSelectNode}
                />
              ))}
            </g>
          </g>
        </svg>

        {/* Zoom controls */}
        <div className="zoom-controls">
          <button onClick={() => handleZoom(0.2)} title="Zoom in">+</button>
          <button onClick={handleZoomToFit} title="Fit to view">⊡</button>
          <button onClick={() => handleZoom(-0.2)} title="Zoom out">−</button>
        </div>
      </div>

      {/* Selected node details */}
      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          systems={filteredSystems}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* Legend */}
      {config.show_legend !== false && (
        <div className="deps-legend">
          <div className="legend-item">
            <span className="legend-dot operational" />
            <span>Online</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot degraded" />
            <span>Degraded</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot critical" />
            <span>Critical</span>
          </div>
          <div className="legend-item capped">
            <span className="legend-ring" />
            <span>Capped by parent</span>
          </div>
        </div>
      )}
    </div>
  );
}
