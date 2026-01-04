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

export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: Map<string, NodePosition>;
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
  nodeWidth: 80,
  nodeHeight: 50,
  rankSep: 80,
  nodeSep: 40,
  marginX: 40,
  marginY: 40,
};

/**
 * Compute DAG layout using dagre.
 * Returns actual dagre coordinates - use the returned width/height for your viewBox.
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

  // Extract results - use dagre's actual coordinates
  const resultNodes = new Map<string, NodePosition>();
  const graphInfo = g.graph();

  nodes.forEach(node => {
    const layoutNode = g.node(node.id);
    if (layoutNode) {
      resultNodes.set(node.id, {
        x: layoutNode.x,
        y: layoutNode.y,
        width: layoutNode.width,
        height: layoutNode.height,
      });
    }
  });

  return {
    nodes: resultNodes,
    width: graphInfo.width ?? 200,
    height: graphInfo.height ?? 200,
  };
}
