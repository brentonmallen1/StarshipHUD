import { useState, useMemo } from 'react';
import { useSystemStates } from '../../hooks/useShipData';
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
  depth: number;  // 0 = root (no dependencies)
  x: number;
  y: number;
}

interface SystemDependenciesConfig {
  show_legend?: boolean;
  highlight_capped?: boolean;
  category_filter?: string;
}

function buildGraph(systems: SystemState[]): GraphNode[] {
  // Create a map for quick lookup
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

  // Calculate depth for each node (max distance from a root)
  const depths = new Map<string, number>();

  function calculateDepth(id: string, visited: Set<string> = new Set()): number {
    if (depths.has(id)) return depths.get(id)!;
    if (visited.has(id)) return 0; // Circular dependency protection
    visited.add(id);

    const system = systemMap.get(id);
    if (!system || !system.depends_on?.length) {
      depths.set(id, 0);
      return 0;
    }

    const maxParentDepth = Math.max(
      ...system.depends_on.map(depId =>
        systemMap.has(depId) ? calculateDepth(depId, visited) : -1
      )
    );
    const depth = maxParentDepth + 1;
    depths.set(id, depth);
    return depth;
  }

  systems.forEach(s => calculateDepth(s.id));

  // Create nodes
  const nodes: GraphNode[] = systems.map(s => {
    const ownStatusIdx = STATUS_ORDER.indexOf(s.status);
    const effectiveStatusIdx = STATUS_ORDER.indexOf(s.effective_status || s.status);
    // Capped = effective status is worse than own status
    const isCapped = effectiveStatusIdx < ownStatusIdx;

    return {
      id: s.id,
      name: s.name,
      status: s.status,
      effectiveStatus: s.effective_status || s.status,
      isCapped,
      dependsOn: s.depends_on || [],
      dependedBy: dependedByMap.get(s.id) || [],
      depth: depths.get(s.id) || 0,
      x: 0,
      y: 0,
    };
  });

  // Layout nodes in a hierarchical fashion
  layoutNodes(nodes);

  return nodes;
}

function layoutNodes(nodes: GraphNode[]) {
  // Group nodes by depth
  const byDepth = new Map<number, GraphNode[]>();
  nodes.forEach(n => {
    if (!byDepth.has(n.depth)) byDepth.set(n.depth, []);
    byDepth.get(n.depth)!.push(n);
  });

  const maxDepth = Math.max(...Array.from(byDepth.keys()), 0);
  const totalLevels = maxDepth + 1;

  // Calculate vertical spacing
  const verticalPadding = 15;
  const verticalSpacing = (100 - verticalPadding * 2) / Math.max(totalLevels - 1, 1);

  // Position nodes level by level
  byDepth.forEach((levelNodes, depth) => {
    const y = verticalPadding + depth * verticalSpacing;
    const horizontalPadding = 10;
    const width = 100 - horizontalPadding * 2;
    const spacing = width / Math.max(levelNodes.length, 1);

    levelNodes.forEach((node, idx) => {
      node.y = y;
      node.x = horizontalPadding + spacing / 2 + idx * spacing;
    });
  });
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
      {/* Glow effect for status */}
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
        strokeWidth={isSelected ? 1.5 : 0.5}
      />

      {/* Capped indicator - outer ring */}
      {node.isCapped && (
        <circle
          cx={node.x}
          cy={node.y}
          r={nodeRadius + 3}
          fill="none"
          stroke="var(--color-degraded)"
          strokeWidth="0.8"
          strokeDasharray="2,1"
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
        fontSize="3"
      >
        {node.name.length > 12 ? node.name.slice(0, 10) + '...' : node.name}
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
  // Draw a curved line from parent (from) to child (to)
  const midY = (from.y + to.y) / 2;

  const path = `M ${from.x} ${from.y} Q ${from.x} ${midY}, ${to.x} ${to.y}`;

  return (
    <path
      d={path}
      fill="none"
      stroke={isCapped ? 'var(--color-degraded)' : 'var(--color-border)'}
      strokeWidth={isCapped ? '0.8' : '0.5'}
      strokeOpacity={isCapped ? '0.8' : '0.4'}
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
              {STATUS_LABELS[node.effectiveStatus]} ⚠
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
      <div className="deps-canvas">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {/* Grid background */}
          <defs>
            <pattern id="dep-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="0.1"
                opacity="0.3"
              />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#dep-grid)" />

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
        </svg>
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
            <span>Capped</span>
          </div>
        </div>
      )}
    </div>
  );
}
