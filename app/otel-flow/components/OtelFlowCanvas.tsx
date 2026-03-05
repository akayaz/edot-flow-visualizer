'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nanoid } from 'nanoid';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

import { useFlowStore } from '../store/flowStore';
import { useValidationStore } from '../store/validationStore';
import { useHealthScoreStore } from '../store/healthScoreStore';
import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';
import { ComponentPalette } from './panels/ComponentPalette';
import { ControlPanel } from './panels/ControlPanel';
import { ConfigExportPanel } from './panels/ConfigExportPanel';
import { Legend } from './panels/Legend';
import { StatusPanel } from './panels/StatusPanel';
import { NodeConfigPanel } from './panels/NodeConfigPanel';
import { DetectionWizardPanel } from './panels/DetectionWizardPanel';
import { QuickStartPanel } from './panels/QuickStartPanel';
import { EmptyState } from './panels/EmptyState';
import { ZoomControls } from './panels/ZoomControls';
import { useTelemetryStream } from '../lib/useTelemetryStream';
import { useEuiTheme } from '@elastic/eui';
import { useThemeStore } from '../store/themeStore';
import type { PaletteItem, EDOTNodeData } from '../types';

// Infrastructure node types that can be parents
const INFRASTRUCTURE_NODE_TYPES = [
  'infrastructureHost',
  'infrastructureDocker',
  'infrastructureK8sNamespace',
  'infrastructureK8sDaemonSet',
  'infrastructureK8sDeployment',
];

// Mapping of infrastructure node types to allowed child node types
// This enforces correct K8s architecture patterns:
// - Namespace: can contain SDKs, DaemonSets, Deployments, and Collectors
// - DaemonSet: only Collector Agents (per-node collectors)
// - Deployment: only Collector Gateways or SDKs (scalable workloads)
// - Host/Docker: can contain SDKs and Collectors
const ALLOWED_CHILDREN: Record<string, string[]> = {
  infrastructureHost: [
    'edotSdk',
    'collector',
    'infrastructureDocker', // Docker containers can be nested in hosts
  ],
  infrastructureDocker: [
    'edotSdk',
    'collector',
  ],
  infrastructureK8sNamespace: [
    'edotSdk',
    'collector',
    'infrastructureK8sDaemonSet',
    'infrastructureK8sDeployment',
  ],
  infrastructureK8sDaemonSet: [
    'collector', // Only collectors (agent mode) - validated by collector type below
  ],
  infrastructureK8sDeployment: [
    'edotSdk',
    'collector', // Only collectors (gateway mode) - validated by collector type below
  ],
};

/**
 * Check if a child node type is allowed to be placed inside a parent node type.
 * Returns an object with validity and a reason if invalid.
 */
function isChildAllowedInParent(
  childNodeType: string,
  parentNodeType: string,
  childData?: Partial<EDOTNodeData>
): { allowed: boolean; reason?: string } {
  const allowedChildren = ALLOWED_CHILDREN[parentNodeType];
  
  if (!allowedChildren) {
    return { allowed: false, reason: `Unknown parent type: ${parentNodeType}` };
  }

  // Check basic type allowance
  if (!allowedChildren.includes(childNodeType)) {
    const parentName = parentNodeType.replace('infrastructure', '').replace(/([A-Z])/g, ' $1').trim();
    const childName = childNodeType === 'collector' ? 'Collector' : 
                      childNodeType === 'edotSdk' ? 'EDOT SDK' : 
                      childNodeType.replace('infrastructure', '').replace(/([A-Z])/g, ' $1').trim();
    return { 
      allowed: false, 
      reason: `${childName} cannot be placed inside ${parentName}` 
    };
  }

  // Special validation for collectors in K8s contexts
  if (childNodeType === 'collector' && childData) {
    const componentType = childData.componentType;
    
    // DaemonSet should only contain Collector Agents
    if (parentNodeType === 'infrastructureK8sDaemonSet' && componentType === 'collector-gateway') {
      return { 
        allowed: false, 
        reason: 'K8s DaemonSet should only contain Collector Agents (not Gateways). DaemonSets run one pod per node, ideal for agent-mode collectors.' 
      };
    }
    
    // Deployment should only contain Collector Gateways
    if (parentNodeType === 'infrastructureK8sDeployment' && componentType === 'collector-agent') {
      return { 
        allowed: false, 
        reason: 'K8s Deployment should only contain Collector Gateways (not Agents). Deployments are for scalable workloads like gateway collectors.' 
      };
    }
  }

  return { allowed: true };
}

// Default dimensions for nodes (fallback when measured is not available)
const DEFAULT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  // Infrastructure nodes
  infrastructureHost: { width: 500, height: 350 },
  infrastructureDocker: { width: 450, height: 300 },
  infrastructureK8sNamespace: { width: 900, height: 600 },
  infrastructureK8sDaemonSet: { width: 400, height: 250 },
  infrastructureK8sDeployment: { width: 400, height: 250 },
  // EDOT component nodes (resizable)
  edotSdk: { width: 200, height: 120 },
};

/**
 * Calculate the absolute position of a node by traversing up the parent chain.
 * Nested nodes have positions relative to their parent, so we need to sum up
 * all parent positions to get the absolute canvas position.
 */
function getAbsolutePosition(
  node: Node,
  allNodes: Node[]
): { x: number; y: number } {
  let absoluteX = node.position.x;
  let absoluteY = node.position.y;

  let currentNode = node;
  while (currentNode.parentId) {
    const parent = allNodes.find((n) => n.id === currentNode.parentId);
    if (!parent) break;
    absoluteX += parent.position.x;
    absoluteY += parent.position.y;
    currentNode = parent;
  }

  return { x: absoluteX, y: absoluteY };
}

/**
 * Get the nesting depth of a node (how many parents it has).
 * Used to sort potential parents so we prefer the innermost container.
 */
function getNodeDepth(node: Node, allNodes: Node[]): number {
  let depth = 0;
  let currentNode = node;
  while (currentNode.parentId) {
    const parent = allNodes.find((n) => n.id === currentNode.parentId);
    if (!parent) break;
    depth++;
    currentNode = parent;
  }
  return depth;
}

/**
 * Get node dimensions - prefers measured dimensions, falls back to style,
 * then to default dimensions based on node type.
 */
function getNodeDimensions(node: Node): { width: number; height: number } {
  // Prefer measured dimensions from React Flow
  if (node.measured?.width && node.measured?.height) {
    return { width: node.measured.width, height: node.measured.height };
  }

  // Fall back to style dimensions
  const styleWidth = typeof node.style?.width === 'number' ? node.style.width : undefined;
  const styleHeight = typeof node.style?.height === 'number' ? node.style.height : undefined;
  if (styleWidth && styleHeight) {
    return { width: styleWidth, height: styleHeight };
  }

  // Fall back to default dimensions for known node types
  const nodeType = node.type || '';
  if (DEFAULT_DIMENSIONS[nodeType]) {
    return DEFAULT_DIMENSIONS[nodeType];
  }

  // Ultimate fallback
  return { width: 200, height: 150 };
}

// Drop rejection notification type
interface DropRejection {
  message: string;
  timestamp: number;
}

function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const { resolvedTheme } = useThemeStore();
  const { euiTheme } = useEuiTheme();

  // Quick Start panel state
  const [isQuickStartOpen, setIsQuickStartOpen] = useState(false);

  // Drop rejection notification state
  const [dropRejection, setDropRejection] = useState<DropRejection | null>(null);

  // Auto-dismiss drop rejection notification after 5 seconds
  useEffect(() => {
    if (dropRejection) {
      const timer = setTimeout(() => {
        setDropRejection(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [dropRejection]);

  // Connect to telemetry stream
  const { toggleDemo } = useTelemetryStream();

  const {
    nodes,
    edges,
    resetKey,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNode,
    selectedNodeId,
    scenario,
    deploymentModel,
    isDetectionPanelOpen,
    openDetectionPanel,
    closeDetectionPanel,
  } = useFlowStore();

  const { validateTopology } = useValidationStore();
  const { calculate: calculateHealthScore, autoCalculate } = useHealthScoreStore();

  // Trigger validation whenever nodes, edges, or deployment model changes
  useEffect(() => {
    validateTopology({
      nodes,
      edges,
      selectedNodeId: selectedNodeId || undefined,
      scenario,
      deploymentModel,
    });
  }, [nodes, edges, selectedNodeId, scenario, deploymentModel, validateTopology]);

  // Trigger health score calculation whenever topology changes
  useEffect(() => {
    if (autoCalculate) {
      calculateHealthScore({
        nodes,
        edges,
        scenario,
        deploymentModel,
      });
    }
  }, [nodes, edges, scenario, deploymentModel, autoCalculate, calculateHealthScore]);

  // Handle node click
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  // Handle drag over for drop zone
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop from palette
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const data = event.dataTransfer.getData('application/reactflow');
      if (!data) return;

      const item: PaletteItem = JSON.parse(data);

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Map component type to node type
      const nodeType =
        item.type === 'edot-sdk'
          ? 'edotSdk'
          : item.type === 'elastic-apm'
          ? 'elasticApm'
          : item.type === 'infrastructure-host'
          ? 'infrastructureHost'
          : item.type === 'infrastructure-docker'
          ? 'infrastructureDocker'
          : item.type === 'infrastructure-k8s-namespace'
          ? 'infrastructureK8sNamespace'
          : item.type === 'infrastructure-k8s-daemonset'
          ? 'infrastructureK8sDaemonSet'
          : item.type === 'infrastructure-k8s-deployment'
          ? 'infrastructureK8sDeployment'
          : 'collector';

      // Get all nodes from React Flow
      const reactFlowNodes = getNodes();

      // Find all infrastructure nodes that contain the drop position
      // Uses absolute positions and fallback dimensions for proper hit-testing
      const potentialParents = reactFlowNodes
        .filter((node) => {
          // Only allow infrastructure nodes as parents
          if (!node.type || !INFRASTRUCTURE_NODE_TYPES.includes(node.type)) {
            return false;
          }

          // Calculate absolute position (accounts for nested nodes)
          const absolutePos = getAbsolutePosition(node, reactFlowNodes);
          const dimensions = getNodeDimensions(node);

          // Check if drop position is within node bounds
          const isWithinBounds =
            position.x >= absolutePos.x &&
            position.x <= absolutePos.x + dimensions.width &&
            position.y >= absolutePos.y &&
            position.y <= absolutePos.y + dimensions.height;

          return isWithinBounds;
        })
        // Sort by depth (deepest/innermost first) so we prefer nested containers
        .sort((a, b) => getNodeDepth(b, reactFlowNodes) - getNodeDepth(a, reactFlowNodes));

      // Select the innermost parent (first in sorted list)
      const parentNode = potentialParents[0] || null;

      // Validate child-parent relationship if dropping onto a parent
      if (parentNode && parentNode.type) {
        const validation = isChildAllowedInParent(nodeType, parentNode.type, item.defaultData);
        
        if (!validation.allowed) {
          console.warn('🚫 Drop rejected:', validation.reason);
          setDropRejection({
            message: validation.reason || 'This component cannot be placed here',
            timestamp: Date.now(),
          });
          return; // Don't create the node
        }
      }

      // Debug logging for parent detection
      if (parentNode) {
        const parentAbsPos = getAbsolutePosition(parentNode, reactFlowNodes);
        const parentDimensions = getNodeDimensions(parentNode);
        console.log('🎯 Parent detected!', {
          parentId: parentNode.id,
          parentType: parentNode.type,
          parentDepth: getNodeDepth(parentNode, reactFlowNodes),
          dropPosition: position,
          parentAbsoluteBounds: {
            x: parentAbsPos.x,
            y: parentAbsPos.y,
            width: parentDimensions.width,
            height: parentDimensions.height,
          },
          allPotentialParents: potentialParents.map((n) => ({
            id: n.id,
            type: n.type,
            depth: getNodeDepth(n, reactFlowNodes),
          })),
        });
      } else {
        console.log('📍 No parent detected, placing on canvas', {
          dropPosition: position,
          availableInfrastructureNodes: reactFlowNodes
            .filter((n) => n.type && INFRASTRUCTURE_NODE_TYPES.includes(n.type))
            .map((n) => {
              const absPos = getAbsolutePosition(n, reactFlowNodes);
              const dims = getNodeDimensions(n);
              return {
                id: n.id,
                type: n.type,
                absoluteBounds: { x: absPos.x, y: absPos.y, ...dims },
              };
            }),
        });
      }

      // Calculate relative position if dropping inside a parent
      let nodePosition = position;
      if (parentNode) {
        const parentAbsPos = getAbsolutePosition(parentNode, reactFlowNodes);
        nodePosition = {
          x: position.x - parentAbsPos.x,
          y: position.y - parentAbsPos.y,
        };
      }

      // Get default dimensions for resizable nodes (infrastructure + SDK)
      const defaultDimensions = DEFAULT_DIMENSIONS[nodeType];

      const newNode = {
        id: nanoid(),
        type: nodeType,
        position: nodePosition,
        data: {
          label: item.label,
          ...item.defaultData,
        } as EDOTNodeData,
        // Set initial dimensions for resizable nodes
        ...(defaultDimensions && {
          style: {
            width: defaultDimensions.width,
            height: defaultDimensions.height,
          },
        }),
        ...(parentNode && {
          parentId: parentNode.id,
          extent: 'parent' as const,
          expandParent: true,
        }),
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode, getNodes]
  );

  return (
    <div ref={reactFlowWrapper} className="w-full h-screen" style={{ backgroundColor: euiTheme.colors.backgroundBaseSubdued }}>
      <ReactFlow
        key={resetKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        fitView
        fitViewOptions={{ 
          padding: 0.3,
          maxZoom: 1,  // Prevent over-zooming on small topologies
          minZoom: 0.5, // Don't zoom out too far on initial fit
        }}
        defaultEdgeOptions={{ type: 'animated' }}
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        elevateEdgesOnSelect
        elevateNodesOnSelect
      >
        {/* Custom zoom controls replace the default Controls */}
        <ZoomControls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'edotSdk':
                return '#22c55e';
              case 'collector':
                return '#06b6d4';
              case 'elasticApm':
                return '#00bfb3';
              case 'infrastructureHost':
                return '#f59e0b'; // Amber
              case 'infrastructureDocker':
                return '#3b82f6'; // Blue
              case 'infrastructureK8sNamespace':
              case 'infrastructureK8sDaemonSet':
              case 'infrastructureK8sDeployment':
                return '#326ce5'; // Kubernetes blue
              default:
                return '#6b7280';
            }
          }}
          maskColor={resolvedTheme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)'}
          className="!bg-white/90 dark:!bg-gray-900/90 backdrop-blur !border-gray-200 dark:!border-gray-700 rounded-xl overflow-hidden"
        />
      </ReactFlow>

      {/* UI Panels */}
      <ComponentPalette />
      <ControlPanel
        onToggleDemo={toggleDemo}
        onOpenDetection={openDetectionPanel}
      />
      <ConfigExportPanel />
      <NodeConfigPanel />
      <Legend />
      <StatusPanel />
      <DetectionWizardPanel
        isOpen={isDetectionPanelOpen}
        onClose={closeDetectionPanel}
      />
      <QuickStartPanel
        isOpen={isQuickStartOpen}
        onClose={() => setIsQuickStartOpen(false)}
      />

      {/* Empty State - shows when canvas has no nodes */}
      {nodes.length === 0 && (
        <EmptyState onOpenQuickStart={() => setIsQuickStartOpen(true)} />
      )}

      {/* Drop Rejection Notification */}
      <AnimatePresence>
        {dropRejection && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-950/95 to-red-950/95 backdrop-blur-md border border-orange-500/30 shadow-lg shadow-orange-500/10 max-w-md">
              <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-200">
                  Cannot place component here
                </p>
                <p className="text-xs text-orange-300/80 mt-1">
                  {dropRejection.message}
                </p>
              </div>
              <button
                onClick={() => setDropRejection(null)}
                className="text-orange-400/60 hover:text-orange-300 transition-colors p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function OtelFlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
