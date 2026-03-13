import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Node,
  Edge,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import { nanoid } from 'nanoid';
import { scenarios } from '../data/scenarios';
import { validateConnection } from '../lib/connection-validator';
import type { ScenarioId, EDOTNodeData, FlowEdgeData, DeploymentModel, DeploymentTarget, CollectorNodeData } from '../types';
import { useHealthScoreStore } from './healthScoreStore';

interface SetDetectedTopologyOptions {
  animate?: boolean;
  fitView?: boolean;
  clearExisting?: boolean;
}

interface ClearSnapshot {
  nodes: Node<EDOTNodeData>[];
  edges: Edge<FlowEdgeData>[];
  scenario: ScenarioId | 'custom';
}

interface FlowStore {
  // State
  deploymentModel: DeploymentModel;
  deploymentTarget: DeploymentTarget | null;
  scenario: ScenarioId | 'custom';
  originalScenario: ScenarioId; // Tracks the base scenario before customization
  nodes: Node<EDOTNodeData>[];
  edges: Edge<FlowEdgeData>[];
  selectedNodeId: string | null;
  isAnimating: boolean;
  isPaletteOpen: boolean;
  isConfigPanelOpen: boolean;
  isDetectionPanelOpen: boolean;
  initialDetectionMethod: 'yaml' | 'traffic' | null; // For deep-linking from homepage
  resetKey: number; // Used to force React Flow re-mount
  clearSnapshot: ClearSnapshot | null; // One-level undo for clear canvas
  undoStack: ClearSnapshot[]; // General undo stack for destructive topology actions

  // Actions - Deployment
  setDeploymentModel: (model: DeploymentModel) => void;
  setDeploymentTarget: (target: DeploymentTarget | null) => void;

  // Actions - Topology
  setScenario: (scenarioId: ScenarioId) => void;
  onNodesChange: (changes: NodeChange<Node<EDOTNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge<FlowEdgeData>>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node<EDOTNodeData>) => void;
  updateNodeData: (nodeId: string, data: Partial<EDOTNodeData>) => void;
  removeNode: (nodeId: string) => void;

  // Actions - Detection
  setDetectedTopology: (
    nodes: Node<EDOTNodeData>[],
    edges: Edge<FlowEdgeData>[],
    options?: SetDetectedTopologyOptions
  ) => void;
  mergeDetectedNodes: (
    newNodes: Node<EDOTNodeData>[],
    newEdges: Edge<FlowEdgeData>[]
  ) => void;

  // Actions - UI (with panel mutual exclusivity)
  setSelectedNode: (nodeId: string | null) => void;
  toggleAnimation: () => void;
  togglePalette: () => void;
  toggleConfigPanel: () => void;
  openDetectionPanel: (method?: 'yaml' | 'traffic') => void;
  closeDetectionPanel: () => void;
  clearInitialDetectionMethod: () => void;

  // Actions - Reset
  resetToOriginal: () => void;
  undoClear: () => void;
  undo: () => void;
}

export const useFlowStore = create<FlowStore>()(
  persist(
    (set, get) => {
      const pushUndoSnapshot = (): void => {
        const state = get();

        // Avoid storing no-op snapshots when topology is already empty.
        if (state.nodes.length === 0 && state.edges.length === 0) {
          return;
        }

        const snapshot: ClearSnapshot = {
          nodes: state.nodes,
          edges: state.edges,
          scenario: state.scenario,
        };

        set({
          undoStack: [...state.undoStack, snapshot].slice(-20),
        });
      };

      return ({
      // Initial state - start with empty canvas and serverless deployment
      deploymentModel: 'serverless',
      deploymentTarget: null,
      scenario: 'custom',
      originalScenario: 'simple',
      nodes: [],
      edges: [],
      selectedNodeId: null,
      isAnimating: true,
      isPaletteOpen: true,
      isConfigPanelOpen: false,
      isDetectionPanelOpen: false,
      initialDetectionMethod: null,
      resetKey: 0,
      clearSnapshot: null,
      undoStack: [],

      // Set deployment target (docker or kubernetes)
      setDeploymentTarget: (target) => set({ deploymentTarget: target }),

      // Set deployment model (affects validation rules)
      // For Serverless/ECH: auto-adds a Gateway if Elastic backend exists without one
      // (Gateway routes through Managed OTLP Endpoint for these deployments)
      setDeploymentModel: (model) => {
        const currentNodes = get().nodes;
        const currentEdges = get().edges;

        // For Serverless or ECH, auto-attach a Gateway to Elastic backend if needed
        const isManagedEndpoint = model === 'serverless' || model === 'ech';
        
        if (isManagedEndpoint) {
          const elasticNode = currentNodes.find(n => n.data.componentType === 'elastic-apm');
          const gatewayNode = currentNodes.find(n => n.data.componentType === 'collector-gateway');

          // If there's an Elastic node but no Gateway, add one
          if (elasticNode && !gatewayNode) {
            const gatewayId = `gateway-${nanoid(6)}`;
            
            // Position the Gateway between sources and Elastic
            const gatewayX = elasticNode.position.x - 200;
            const gatewayY = elasticNode.position.y;

            const newGateway: Node<EDOTNodeData> = {
              id: gatewayId,
              type: 'collector',
              position: { x: gatewayX, y: gatewayY },
              data: {
                label: 'Collector Gateway',
                componentType: 'collector-gateway',
                description: 'Gateway for Managed OTLP Endpoint routing',
                config: {
                  receivers: [{ type: 'otlp' as const, enabled: true }],
                  processors: [
                    { type: 'memory_limiter' as const, enabled: true },
                    { type: 'batch' as const, enabled: true },
                  ],
                  exporters: [{ type: 'elasticsearch' as const, enabled: true }],
                },
              } as CollectorNodeData,
            };

            // Find all edges that go directly to Elastic (to be rerouted through Gateway)
            const edgesToElastic = currentEdges.filter(e => e.target === elasticNode.id);
            
            // Create new edges: sources → Gateway, Gateway → Elastic
            const updatedEdges: Edge<FlowEdgeData>[] = [];
            const processedSources = new Set<string>();

            for (const edge of currentEdges) {
              if (edge.target === elasticNode.id) {
                // Reroute: Source → Gateway instead of Source → Elastic
                if (!processedSources.has(edge.source)) {
                  updatedEdges.push({
                    ...edge,
                    id: `e-${edge.source}-${gatewayId}`,
                    target: gatewayId,
                  });
                  processedSources.add(edge.source);
                }
              } else {
                // Keep other edges as-is
                updatedEdges.push(edge);
              }
            }

            // Add edge from Gateway to Elastic
            if (edgesToElastic.length > 0) {
              updatedEdges.push({
                id: `e-${gatewayId}-${elasticNode.id}`,
                source: gatewayId,
                target: elasticNode.id,
                type: 'animated',
                data: {
                  telemetryTypes: ['traces', 'metrics', 'logs'],
                  animated: true,
                  volume: 5,
                  protocol: 'otlp-grpc',
                },
              });
            }

            // Shift Elastic node to the right to make room for Gateway
            const updatedNodes = currentNodes.map(n => {
              if (n.id === elasticNode.id) {
                return {
                  ...n,
                  position: { ...n.position, x: n.position.x + 100 },
                };
              }
              return n;
            });

            set({
              deploymentModel: model,
              nodes: [...updatedNodes, newGateway],
              edges: updatedEdges,
              scenario: 'custom',
            });
            return;
          }
        }

        // Default: just update the deployment model
        set({ deploymentModel: model });
      },

      // Switch to a preset scenario (deep clone to force React Flow re-render)
      setScenario: (scenarioId) => {
        const scenario = scenarios[scenarioId];
        if (!scenario) return;

        // Deep clone nodes and edges to ensure React Flow detects the change
        // IMPORTANT: Explicitly preserve parent-child properties (using parentId for React Flow v12)
        const clonedNodes = scenario.nodes.map((node) => ({
          ...node,
          position: { ...node.position },
          data: { ...node.data },
          // Preserve style if present
          ...(node.style && { style: { ...node.style } }),
          // Explicitly preserve parent-child relationship properties (React Flow v12 uses parentId)
          ...((node.parentId || (node as unknown as { parentNode?: string }).parentNode) && {
            parentId: node.parentId || (node as unknown as { parentNode?: string }).parentNode,
            extent: node.extent,
            expandParent: node.expandParent,
          }),
        }));

        const clonedEdges = scenario.edges.map((edge) => ({
          ...edge,
          data: edge.data ? { ...edge.data } : undefined,
        }));

        set({
          scenario: scenarioId,
          originalScenario: scenarioId, // Track as the new original
          nodes: clonedNodes,
          edges: clonedEdges,
          selectedNodeId: null,
        });

        // Trigger health score calculation for new scenario
        const { deploymentModel } = get();
        const { autoCalculate, calculate } = useHealthScoreStore.getState();
        if (autoCalculate) {
          calculate({ nodes: clonedNodes, edges: clonedEdges, deploymentModel, scenario: scenarioId });
        }
      },

      // Handle node position changes, selection, etc.
      onNodesChange: (changes) => {
        const hasNodeRemoval = changes.some((c) => c.type === 'remove');
        const hasSignificantChange = changes.some(
          (c) => c.type === 'add' || c.type === 'remove'
        );

        if (hasNodeRemoval) {
          pushUndoSnapshot();
        }

        set({
          nodes: applyNodeChanges(changes, get().nodes),
          // Mark as custom if nodes are modified (except selection)
          scenario: changes.some((c) => c.type !== 'select') ? 'custom' : get().scenario,
        });

        // Trigger health score recalculation for significant changes
        if (hasSignificantChange) {
          const { nodes, edges, deploymentModel, scenario } = get();
          const { autoCalculate, calculate } = useHealthScoreStore.getState();
          if (autoCalculate) {
            calculate({ nodes, edges, deploymentModel, scenario });
          }
        }
      },

      // Handle edge changes
      onEdgesChange: (changes) => {
        const hasEdgeRemoval = changes.some((c) => c.type === 'remove');

        if (hasEdgeRemoval) {
          pushUndoSnapshot();
        }

        set({
          edges: applyEdgeChanges(changes, get().edges),
          scenario: 'custom',
        });

        // Trigger health score recalculation
        const { nodes, edges, deploymentModel, scenario } = get();
        const { autoCalculate, calculate } = useHealthScoreStore.getState();
        if (autoCalculate) {
          calculate({ nodes, edges, deploymentModel, scenario });
        }
      },

      // Handle new connections between nodes
      onConnect: (connection) => {
        const { nodes, deploymentModel } = get();
        
        // Find source and target nodes
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const targetNode = nodes.find((n) => n.id === connection.target);
        
        // If nodes not found, don't create the edge
        if (!sourceNode || !targetNode) {
          console.warn('Connection failed: source or target node not found');
          return;
        }
        
        // Validate the connection with deployment model context
        const validation = validateConnection(sourceNode, targetNode, { deploymentModel });
        
        // If connection is invalid, prevent it and log the reason
        if (!validation.valid) {
          console.warn(`Connection prevented: ${validation.reason}`);
          // TODO: Could add toast notification here for better UX
          return;
        }
        
        // Create the edge with optional warning
        const newEdge: Edge<FlowEdgeData> = {
          id: `e-${connection.source}-${connection.target}-${nanoid(4)}`,
          source: connection.source!,
          target: connection.target!,
          type: 'animated',
          data: {
            telemetryTypes: ['traces', 'metrics', 'logs'],
            animated: true,
            volume: 5,
            warning: validation.warning, // Add warning if present
          },
        };
        
        // Log warning if present
        if (validation.warning) {
          console.info(`Connection warning: ${validation.warning}`);
        }

        set({
          edges: addEdge(newEdge, get().edges),
          scenario: 'custom',
        });
      },

      // Add a new node (from palette drag or click)
      addNode: (node) => {
        set({
          nodes: [...get().nodes, node],
          scenario: 'custom',
        });
      },

      // Update node data (e.g., change service name)
      updateNodeData: (nodeId, data) => {
        set({
          nodes: get().nodes.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, ...data } as EDOTNodeData }
              : node
          ),
          scenario: 'custom',
        });
      },

      // Remove a node and its connected edges
      removeNode: (nodeId) => {
        set({
          nodes: get().nodes.filter((n) => n.id !== nodeId),
          edges: get().edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          ),
          selectedNodeId:
            get().selectedNodeId === nodeId ? null : get().selectedNodeId,
          scenario: 'custom',
        });
      },

      // Set topology from detection results (replaces current topology)
      setDetectedTopology: (nodes, edges, options = {}) => {
        const { clearExisting = true } = options;

        // Deep clone nodes to ensure React Flow detects changes
        const clonedNodes = nodes.map((node) => ({
          ...node,
          position: { ...node.position },
          data: { ...node.data },
          ...(node.style && { style: { ...node.style } }),
          ...(node.parentId && {
            parentId: node.parentId,
            extent: node.extent,
            expandParent: node.expandParent,
          }),
        }));

        const clonedEdges = edges.map((edge) => ({
          ...edge,
          data: edge.data ? { ...edge.data } : undefined,
        }));

        set({
          nodes: clearExisting ? clonedNodes : [...get().nodes, ...clonedNodes],
          edges: clearExisting ? clonedEdges : [...get().edges, ...clonedEdges],
          scenario: 'custom',
          selectedNodeId: null,
          resetKey: get().resetKey + 1, // Force re-render
        });
      },

      // Merge detected nodes with existing topology (adds new, keeps existing)
      mergeDetectedNodes: (newNodes, newEdges) => {
        const existingNodeIds = new Set(get().nodes.map((n) => n.id));
        const existingEdgeIds = new Set(get().edges.map((e) => e.id));

        // Filter out nodes and edges that already exist
        const uniqueNewNodes = newNodes.filter((n) => !existingNodeIds.has(n.id));
        const uniqueNewEdges = newEdges.filter((e) => !existingEdgeIds.has(e.id));

        // Deep clone new nodes
        const clonedNodes = uniqueNewNodes.map((node) => ({
          ...node,
          position: { ...node.position },
          data: { ...node.data },
          ...(node.style && { style: { ...node.style } }),
          ...(node.parentId && {
            parentId: node.parentId,
            extent: node.extent,
            expandParent: node.expandParent,
          }),
        }));

        const clonedEdges = uniqueNewEdges.map((edge) => ({
          ...edge,
          data: edge.data ? { ...edge.data } : undefined,
        }));

        set({
          nodes: [...get().nodes, ...clonedNodes],
          edges: [...get().edges, ...clonedEdges],
          scenario: 'custom',
        });
      },

      // UI state management (with panel mutual exclusivity for right-side panels)
      setSelectedNode: (nodeId) => {
        // When selecting a node, close other right-side panels to avoid overlap
        set({ 
          selectedNodeId: nodeId,
          isConfigPanelOpen: false,
          isDetectionPanelOpen: false,
        });
      },
      toggleAnimation: () => set((state) => ({ isAnimating: !state.isAnimating })),
      togglePalette: () => set((state) => ({ isPaletteOpen: !state.isPaletteOpen })),
      toggleConfigPanel: () => {
        const state = get();
        // When opening config panel, close other right-side panels
        if (!state.isConfigPanelOpen) {
          set({ 
            isConfigPanelOpen: true,
            selectedNodeId: null,
            isDetectionPanelOpen: false,
          });
        } else {
          set({ isConfigPanelOpen: false });
        }
      },
      openDetectionPanel: (method?: 'yaml' | 'traffic') => {
        // When opening detection panel, close other right-side panels
        set({
          isDetectionPanelOpen: true,
          isConfigPanelOpen: false,
          selectedNodeId: null,
          // Always reset to method selection unless explicitly deep-linking.
          initialDetectionMethod: method ?? null,
        });
      },
      closeDetectionPanel: () => set({ isDetectionPanelOpen: false, initialDetectionMethod: null }),
      clearInitialDetectionMethod: () => set({ initialDetectionMethod: null }),

      // Reset to a blank canvas (force React Flow re-mount with resetKey)
      // Snapshots current state so user can undo
      resetToOriginal: () => {
        const state = get();

        // Snapshot current topology for undo (only if non-empty)
        const snapshot: ClearSnapshot | null = state.nodes.length > 0
          ? { nodes: state.nodes, edges: state.edges, scenario: state.scenario }
          : null;

        if (snapshot) {
          pushUndoSnapshot();
        }

        set({
          scenario: 'custom',
          nodes: [],
          edges: [],
          selectedNodeId: null,
          isConfigPanelOpen: false,
          isDetectionPanelOpen: false,
          resetKey: state.resetKey + 1,
          clearSnapshot: snapshot,
        });

        // Clear health score so empty-state guidance is shown in Health panel.
        useHealthScoreStore.getState().clear();
      },

      // Undo the last clear — restores the snapshotted topology
      undoClear: () => {
        const { clearSnapshot } = get();
        if (!clearSnapshot) return;

        set({
          nodes: clearSnapshot.nodes,
          edges: clearSnapshot.edges,
          scenario: clearSnapshot.scenario,
          clearSnapshot: null,
          resetKey: get().resetKey + 1,
        });

        // Trigger health score recalculation
        const { deploymentModel } = get();
        const { autoCalculate, calculate } = useHealthScoreStore.getState();
        if (autoCalculate) {
          calculate({
            nodes: clearSnapshot.nodes,
            edges: clearSnapshot.edges,
            deploymentModel,
            scenario: clearSnapshot.scenario,
          });
        }
      },
      undo: () => {
        const { undoStack } = get();
        if (undoStack.length === 0) return;

        const previousSnapshot = undoStack[undoStack.length - 1];

        set({
          nodes: previousSnapshot.nodes,
          edges: previousSnapshot.edges,
          scenario: previousSnapshot.scenario,
          selectedNodeId: null,
          isConfigPanelOpen: false,
          isDetectionPanelOpen: false,
          undoStack: undoStack.slice(0, -1),
          resetKey: get().resetKey + 1,
        });

        const { deploymentModel } = get();
        const { autoCalculate, calculate } = useHealthScoreStore.getState();
        if (autoCalculate) {
          calculate({
            nodes: previousSnapshot.nodes,
            edges: previousSnapshot.edges,
            deploymentModel,
            scenario: previousSnapshot.scenario,
          });
        }
      },
    });
    },
    {
      name: 'edot-flow-storage',
      // Only persist certain fields
      partialize: (state) => ({
        deploymentModel: state.deploymentModel,
        isPaletteOpen: state.isPaletteOpen,
      }),
    }
  )
);
