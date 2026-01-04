import dagre from '@dagrejs/dagre';

export interface LayoutNode {
  id: string;
  width?: number;
  height?: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
}

export interface LayoutResult {
  nodes: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

export interface LayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;  // Vertical spacing between ranks
  nodeSep?: number;  // Horizontal spacing between nodes
  marginX?: number;
  marginY?: number;
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  direction: 'TB',
  nodeWidth: 60,
  nodeHeight: 40,
  rankSep: 50,
  nodeSep: 30,
  marginX: 20,
  marginY: 20,
};

/**
 * Compute DAG layout using dagre.
 * Returns node positions normalized to a 0-100 coordinate system for SVG viewBox.
 */
export function computeLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions = {}
): LayoutResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Create a new directed graph
  const g = new dagre.graphlib.Graph();

  // Set graph options
  g.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSep,
    nodesep: opts.nodeSep,
    marginx: opts.marginX,
    marginy: opts.marginY,
  });

  // Default to assigning a new object as a label for each new edge
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes
  nodes.forEach(node => {
    g.setNode(node.id, {
      width: node.width ?? opts.nodeWidth,
      height: node.height ?? opts.nodeHeight,
    });
  });

  // Add edges
  edges.forEach(edge => {
    // dagre expects edges from parent to child
    g.setEdge(edge.from, edge.to);
  });

  // Run the layout algorithm
  dagre.layout(g);

  // Extract results
  const resultNodes = new Map<string, { x: number; y: number }>();
  const graphInfo = g.graph();
  // Guard against zero dimensions which would cause NaN from division
  const graphWidth = Math.max(graphInfo.width ?? 100, 1);
  const graphHeight = Math.max(graphInfo.height ?? 100, 1);

  // Normalize positions to 0-100 range for SVG viewBox
  nodes.forEach(node => {
    const layoutNode = g.node(node.id);
    if (layoutNode) {
      resultNodes.set(node.id, {
        x: (layoutNode.x / graphWidth) * 100,
        y: (layoutNode.y / graphHeight) * 100,
      });
    }
  });

  return {
    nodes: resultNodes,
    width: graphWidth,
    height: graphHeight,
  };
}

/**
 * Compute layout with padding to prevent nodes from touching edges.
 * Returns positions in 5-95 range instead of 0-100.
 */
export function computeLayoutWithPadding(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions = {}
): LayoutResult {
  const result = computeLayout(nodes, edges, options);

  // Rescale from 0-100 to 5-90 to add padding
  const padding = 5;
  const scale = 90;

  result.nodes.forEach((pos, id) => {
    result.nodes.set(id, {
      x: padding + (pos.x / 100) * scale,
      y: padding + (pos.y / 100) * scale,
    });
  });

  return result;
}
