import type { Node, Edge } from '@xyflow/react';
import type { EDOTNodeData, FlowEdgeData } from '../../types';
import type { LayoutOptions, LayoutResult, NodeLayer, LayoutDirection } from './types';

/**
 * Layout Engine for Auto-Positioning Detected Nodes
 *
 * Uses a layered graph layout algorithm (similar to Sugiyama) to
 * automatically position nodes in a logical flow from sources to destinations.
 *
 * Layer order (Left-to-Right):
 * 0: SDK/Source nodes
 * 1: Agent collectors
 * 2: Gateway collectors
 * 3: Elastic/Destination nodes
 */

// ============ Default Options ============

const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  direction: 'LR',
  nodeSpacing: { x: 250, y: 120 },
  layerSpacing: 300,
  groupByInfrastructure: false,
  fitView: true,
  animate: true,
};

// Node dimensions for layout calculations
const NODE_DIMENSIONS = {
  sdk: { width: 180, height: 100 },
  collector: { width: 200, height: 120 },
  elastic: { width: 180, height: 100 },
  infrastructure: { width: 400, height: 300 },
};

// ============ Main Layout Function ============

/**
 * Apply automatic layout to nodes and edges
 */
export function layoutTopology(
  nodes: Node<EDOTNodeData>[],
  edges: Edge<FlowEdgeData>[],
  options: Partial<LayoutOptions> = {}
): LayoutResult {
  const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };

  // Create a working copy
  const layoutNodes = nodes.map((n) => ({ ...n, position: { ...n.position } }));

  // Assign nodes to layers based on type and connections
  const layers = assignNodesToLayers(layoutNodes, edges);

  // Calculate positions for each layer
  const positionedNodes = calculateLayerPositions(layers, opts);

  // Calculate bounds
  const bounds = calculateBounds(positionedNodes);

  return {
    nodes: positionedNodes,
    edges,
    bounds,
  };
}

// ============ Layer Assignment ============

/**
 * Assign nodes to layers based on their type and position in the data flow
 */
function assignNodesToLayers(
  nodes: Node<EDOTNodeData>[],
  edges: Edge<FlowEdgeData>[]
): NodeLayer[] {
  const layers: Map<number, Node<EDOTNodeData>[]> = new Map();

  // Build adjacency lists
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const edge of edges) {
    if (!outgoing.has(edge.source)) {
      outgoing.set(edge.source, []);
    }
    outgoing.get(edge.source)!.push(edge.target);

    if (!incoming.has(edge.target)) {
      incoming.set(edge.target, []);
    }
    incoming.get(edge.target)!.push(edge.source);
  }

  // Assign initial layer based on node type
  for (const node of nodes) {
    const layer = getNodeLayer(node, incoming, outgoing);

    if (!layers.has(layer)) {
      layers.set(layer, []);
    }
    layers.get(layer)!.push(node);
  }

  // Convert to array of NodeLayer objects
  const result: NodeLayer[] = [];
  const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);

  for (const depth of sortedLayers) {
    const layerNodes = layers.get(depth)!;
    const type = getLayerType(depth);

    result.push({
      depth,
      nodes: layerNodes,
      type,
    });
  }

  return result;
}

/**
 * Determine which layer a node belongs to
 */
function getNodeLayer(
  node: Node<EDOTNodeData>,
  incoming: Map<string, string[]>,
  outgoing: Map<string, string[]>
): number {
  const componentType = node.data.componentType;

  // Infrastructure nodes are handled separately
  if (componentType.startsWith('infrastructure-')) {
    return -1; // Background layer
  }

  // SDK nodes are sources (layer 0)
  if (componentType === 'edot-sdk') {
    return 0;
  }

  // Collector agents are layer 1
  if (componentType === 'collector-agent') {
    return 1;
  }

  // Collector gateways are layer 2
  if (componentType === 'collector-gateway') {
    return 2;
  }

  // Elastic Observability is the destination (layer 3)
  if (componentType === 'elastic-apm') {
    return 3;
  }

  // For unknown types, use connectivity to determine layer
  const hasIncoming = (incoming.get(node.id)?.length || 0) > 0;
  const hasOutgoing = (outgoing.get(node.id)?.length || 0) > 0;

  if (!hasIncoming && hasOutgoing) {
    return 0; // Source
  }
  if (hasIncoming && !hasOutgoing) {
    return 3; // Destination
  }

  return 1; // Middle
}

/**
 * Get the type of a layer based on its depth
 */
function getLayerType(depth: number): NodeLayer['type'] {
  switch (depth) {
    case -1:
      return 'infrastructure';
    case 0:
      return 'source';
    case 1:
      return 'collector';
    case 2:
      return 'gateway';
    case 3:
      return 'destination';
    default:
      return depth < 0 ? 'infrastructure' : 'destination';
  }
}

// ============ Position Calculation ============

/**
 * Calculate positions for all nodes in each layer
 */
function calculateLayerPositions(
  layers: NodeLayer[],
  options: LayoutOptions
): Node<EDOTNodeData>[] {
  const positionedNodes: Node<EDOTNodeData>[] = [];
  const { direction, nodeSpacing, layerSpacing } = options;

  // Filter out infrastructure layer for main layout
  const mainLayers = layers.filter((l) => l.type !== 'infrastructure');
  const infraLayer = layers.find((l) => l.type === 'infrastructure');

  // Calculate starting position
  const startX = 100;
  const startY = 100;

  // Position main layers
  for (let layerIndex = 0; layerIndex < mainLayers.length; layerIndex++) {
    const layer = mainLayers[layerIndex];
    const layerX = startX + layerIndex * layerSpacing;

    // Calculate total height needed for this layer
    const layerHeight = layer.nodes.length * nodeSpacing.y;
    const layerStartY = startY + (mainLayers.length > 1 ? 0 : layerHeight / 2);

    // Position nodes in layer
    for (let nodeIndex = 0; nodeIndex < layer.nodes.length; nodeIndex++) {
      const node = layer.nodes[nodeIndex];
      const nodeY = layerStartY + nodeIndex * nodeSpacing.y;

      // Apply position based on direction
      const position = calculatePosition(
        layerX,
        nodeY,
        direction,
        layerIndex,
        nodeIndex,
        nodeSpacing,
        layerSpacing
      );

      positionedNodes.push({
        ...node,
        position,
      });
    }
  }

  // Position infrastructure nodes as containers
  if (infraLayer) {
    for (const node of infraLayer.nodes) {
      // Infrastructure nodes are positioned as backgrounds
      positionedNodes.push({
        ...node,
        position: { x: 50, y: 50 },
        style: {
          ...node.style,
          zIndex: -1,
        },
      });
    }
  }

  return positionedNodes;
}

/**
 * Calculate position based on layout direction
 */
function calculatePosition(
  x: number,
  y: number,
  direction: LayoutDirection,
  layerIndex: number,
  nodeIndex: number,
  nodeSpacing: { x: number; y: number },
  layerSpacing: number
): { x: number; y: number } {
  switch (direction) {
    case 'LR': // Left to Right (default)
      return { x, y };
    case 'RL': // Right to Left
      return { x: -x, y };
    case 'TB': // Top to Bottom
      return { x: y, y: x };
    case 'BT': // Bottom to Top
      return { x: y, y: -x };
    default:
      return { x, y };
  }
}

// ============ Bounds Calculation ============

/**
 * Calculate the bounding box of all positioned nodes
 */
function calculateBounds(nodes: Node<EDOTNodeData>[]): LayoutResult['bounds'] {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const dimensions = getNodeDimensions(node);

    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + dimensions.width);
    maxY = Math.max(maxY, node.position.y + dimensions.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Get dimensions for a node based on its type
 */
function getNodeDimensions(node: Node<EDOTNodeData>): { width: number; height: number } {
  const componentType = node.data.componentType;

  if (componentType === 'edot-sdk') {
    return NODE_DIMENSIONS.sdk;
  }
  if (componentType === 'collector-agent' || componentType === 'collector-gateway') {
    return NODE_DIMENSIONS.collector;
  }
  if (componentType === 'elastic-apm') {
    return NODE_DIMENSIONS.elastic;
  }
  if (componentType.startsWith('infrastructure-')) {
    return NODE_DIMENSIONS.infrastructure;
  }

  return NODE_DIMENSIONS.sdk;
}

// ============ Advanced Layout Functions ============

/**
 * Apply layout with edge crossing minimization
 * Uses barycenter heuristic for node ordering within layers
 */
export function layoutWithCrossingMinimization(
  nodes: Node<EDOTNodeData>[],
  edges: Edge<FlowEdgeData>[],
  options: Partial<LayoutOptions> = {}
): LayoutResult {
  const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };

  // Create working copy
  const layoutNodes = nodes.map((n) => ({ ...n, position: { ...n.position } }));

  // Assign to layers
  const layers = assignNodesToLayers(layoutNodes, edges);

  // Minimize crossings using barycenter method
  const orderedLayers = minimizeCrossings(layers, edges);

  // Calculate positions
  const positionedNodes = calculateLayerPositions(orderedLayers, opts);

  return {
    nodes: positionedNodes,
    edges,
    bounds: calculateBounds(positionedNodes),
  };
}

/**
 * Minimize edge crossings using barycenter heuristic
 */
function minimizeCrossings(
  layers: NodeLayer[],
  edges: Edge<FlowEdgeData>[]
): NodeLayer[] {
  const MAX_ITERATIONS = 10;

  // Build adjacency for barycenter calculation
  const neighbors = new Map<string, string[]>();
  for (const edge of edges) {
    if (!neighbors.has(edge.source)) {
      neighbors.set(edge.source, []);
    }
    neighbors.get(edge.source)!.push(edge.target);

    if (!neighbors.has(edge.target)) {
      neighbors.set(edge.target, []);
    }
    neighbors.get(edge.target)!.push(edge.source);
  }

  // Iterate to minimize crossings
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let improved = false;

    // Forward pass (layer 0 to n-1)
    for (let i = 1; i < layers.length; i++) {
      const reordered = reorderLayerByBarycenter(layers[i], layers[i - 1], neighbors);
      if (reordered) {
        improved = true;
      }
    }

    // Backward pass (layer n-1 to 0)
    for (let i = layers.length - 2; i >= 0; i--) {
      const reordered = reorderLayerByBarycenter(layers[i], layers[i + 1], neighbors);
      if (reordered) {
        improved = true;
      }
    }

    if (!improved) {
      break;
    }
  }

  return layers;
}

/**
 * Reorder nodes in a layer based on barycenter of connected nodes in adjacent layer
 */
function reorderLayerByBarycenter(
  layer: NodeLayer,
  adjacentLayer: NodeLayer,
  neighbors: Map<string, string[]>
): boolean {
  // Calculate barycenter for each node
  const barycenters = new Map<string, number>();

  // Create position map for adjacent layer
  const adjacentPositions = new Map<string, number>();
  adjacentLayer.nodes.forEach((node, index) => {
    adjacentPositions.set(node.id, index);
  });

  for (const node of layer.nodes) {
    const nodeNeighbors = neighbors.get(node.id) || [];
    const adjacentNeighbors = nodeNeighbors.filter((n) => adjacentPositions.has(n));

    if (adjacentNeighbors.length > 0) {
      const sum = adjacentNeighbors.reduce((acc, n) => acc + adjacentPositions.get(n)!, 0);
      barycenters.set(node.id, sum / adjacentNeighbors.length);
    } else {
      // Keep original position if no neighbors
      barycenters.set(node.id, layer.nodes.indexOf(node));
    }
  }

  // Sort by barycenter
  const originalOrder = layer.nodes.map((n) => n.id);
  layer.nodes.sort((a, b) => {
    const ba = barycenters.get(a.id) || 0;
    const bb = barycenters.get(b.id) || 0;
    return ba - bb;
  });

  // Check if order changed
  const newOrder = layer.nodes.map((n) => n.id);
  return originalOrder.some((id, i) => id !== newOrder[i]);
}

// ============ Utility Functions ============

/**
 * Center nodes vertically within their layer
 */
export function centerNodesVertically(
  nodes: Node<EDOTNodeData>[],
  targetHeight: number
): Node<EDOTNodeData>[] {
  if (nodes.length === 0) return nodes;

  // Group by approximate X position (layer)
  const layers = new Map<number, Node<EDOTNodeData>[]>();

  for (const node of nodes) {
    const layerX = Math.round(node.position.x / 100) * 100;
    if (!layers.has(layerX)) {
      layers.set(layerX, []);
    }
    layers.get(layerX)!.push(node);
  }

  // Center each layer
  const centeredNodes: Node<EDOTNodeData>[] = [];

  for (const [, layerNodes] of Array.from(layers.entries())) {
    // Calculate current bounds
    const minY = Math.min(...layerNodes.map((n) => n.position.y));
    const maxY = Math.max(...layerNodes.map((n) => n.position.y + getNodeDimensions(n).height));
    const layerHeight = maxY - minY;

    // Calculate offset to center
    const offset = (targetHeight - layerHeight) / 2 - minY;

    // Apply offset
    for (const node of layerNodes) {
      centeredNodes.push({
        ...node,
        position: {
          x: node.position.x,
          y: node.position.y + offset,
        },
      });
    }
  }

  return centeredNodes;
}

/**
 * Apply layout and fit to viewport
 */
export function layoutAndFit(
  nodes: Node<EDOTNodeData>[],
  edges: Edge<FlowEdgeData>[],
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 50
): LayoutResult {
  // First apply standard layout
  const result = layoutTopology(nodes, edges);

  // Calculate scale to fit viewport
  const scaleX = (viewportWidth - padding * 2) / result.bounds.width;
  const scaleY = (viewportHeight - padding * 2) / result.bounds.height;
  const scale = Math.min(scaleX, scaleY, 1); // Don't scale up

  // Apply scale and center
  const scaledNodes = result.nodes.map((node) => ({
    ...node,
    position: {
      x: padding + (node.position.x - result.bounds.x) * scale,
      y: padding + (node.position.y - result.bounds.y) * scale,
    },
  }));

  return {
    nodes: scaledNodes,
    edges: result.edges,
    bounds: calculateBounds(scaledNodes),
  };
}
