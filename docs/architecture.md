# Architecture Documentation - EDOT Flow Visualizer

This document provides a comprehensive overview of the EDOT Flow Visualizer's architecture, design decisions, and implementation details.

## Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Architecture Diagram](#architecture-diagram)
- [Component Hierarchy](#component-hierarchy)
- [State Management](#state-management)
- [Data Flow](#data-flow)
- [Key Subsystems](#key-subsystems)
- [Design Decisions](#design-decisions)
- [Performance Considerations](#performance-considerations)
- [Extension Points](#extension-points)

---

## System Overview

EDOT Flow Visualizer is a Next.js-based web application that provides interactive visualization of Elastic Distribution of OpenTelemetry (EDOT) architecture patterns. It combines:

- **Visual Design**: Drag-and-drop node-based diagram builder
- **Configuration Generation**: Automatic YAML/Docker/K8s config export
- **Educational Features**: Animated data flow, validation, scenarios
- **Real-time Feedback**: Live validation and YAML preview

### Core Goals

1. **Intuitive**: Make OpenTelemetry architecture understandable at a glance
2. **Educational**: Teach EDOT patterns through interaction
3. **Practical**: Generate production-ready configurations
4. **Performant**: Smooth 60fps animations even with complex topologies

---

## Technology Stack

### Frontend

| Technology | Version | Purpose | Why Chosen |
|------------|---------|---------|------------|
| **Next.js** | 14.x | React framework | SSR, API routes, excellent DX, App Router |
| **React** | 18.x | UI library | Component model, hooks, ecosystem |
| **TypeScript** | 5.x | Type system | Type safety, better DX, fewer runtime errors |
| **@xyflow/react** | 12.x | Node diagram | Purpose-built for node-based UIs, performant |
| **Framer Motion** | 11.x | Animations | Smooth particle effects, spring physics |
| **Zustand** | 5.x | State management | Lightweight, simple API, perfect for real-time |
| **Tailwind CSS** | 3.x | Styling | Utility-first, rapid iteration, consistent design |
| **@elastic/eui** | Latest | UI components | Elastic design system, pre-built components |

### Build & Dev

| Tool | Purpose |
|------|---------|
| **npm** | Package management |
| **ESLint** | Code linting |
| **TypeScript Compiler** | Type checking |
| **PostCSS** | CSS processing |

### Libraries

| Library | Purpose |
|---------|---------|
| **yaml** | YAML generation and parsing |
| **nanoid** | Unique ID generation |
| **jszip** | ZIP file creation for K8s manifests |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    React Application                      │   │
│  │                                                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │   Canvas     │  │   Palette    │  │   Panels     │   │   │
│  │  │ (React Flow) │  │  (Drag src)  │  │  (Config,    │   │   │
│  │  │              │  │              │  │   Validation) │   │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │   │
│  │         │                 │                  │            │   │
│  │         └─────────────────┼──────────────────┘            │   │
│  │                           │                               │   │
│  │  ┌────────────────────────▼─────────────────────────┐    │   │
│  │  │            State Management (Zustand)            │    │   │
│  │  │                                                   │    │   │
│  │  │  ┌─────────────────┐  ┌──────────────────────┐  │    │   │
│  │  │  │   flowStore     │  │   telemetryStore     │  │    │   │
│  │  │  │  - nodes        │  │  - events            │  │    │   │
│  │  │  │  - edges        │  │  - stats             │  │    │   │
│  │  │  │  - scenario     │  │  - demo mode state   │  │    │   │
│  │  │  └─────────────────┘  └──────────────────────┘  │    │   │
│  │  │                                                   │    │   │
│  │  └───────────────────────────────────────────────────┘   │   │
│  │                           │                               │   │
│  │  ┌────────────────────────▼─────────────────────────┐    │   │
│  │  │              Generators & Validators             │    │   │
│  │  │                                                   │    │   │
│  │  │  • yaml-generator.ts                             │    │   │
│  │  │  • docker-compose-generator.ts                   │    │   │
│  │  │  • k8s-manifest-generator.ts                     │    │   │
│  │  │  • connection-validator.ts                       │    │   │
│  │  └───────────────────────────────────────────────────┘   │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                │ (Optional) API calls
                                │
┌───────────────────────────────▼───────────────────────────────────┐
│                      Next.js Server (SSR + API)                   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  API Routes (app/api/)                                           │
│  ┌────────────────────┐  ┌─────────────────────────────────┐    │
│  │  /api/otlp/v1/*    │  │  /api/telemetry/stream          │    │
│  │  (OTLP receivers)  │  │  (SSE for demo mode)            │    │
│  │  - traces          │  │  - Real-time event stream       │    │
│  │  - metrics         │  │  - Throughput updates           │    │
│  │  - logs            │  └─────────────────────────────────┘    │
│  └────────────────────┘                                          │
│                                                                   │
│  lib/telemetry/                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  processor.ts                                            │    │
│  │  - Telemetry event aggregation                          │    │
│  │  - Throughput calculation                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

### React Component Tree

```
App (layout.tsx)
└── OtelFlowPage (app/otel-flow/page.tsx)
    └── OtelFlowCanvas (components/OtelFlowCanvas.tsx)
        ├── ReactFlow
        │   ├── Custom Nodes
        │   │   ├── EDOTSDKNode
        │   │   ├── CollectorNode
        │   │   ├── ElasticNode
        │   │   ├── HostNode
        │   │   ├── DockerNode
        │   │   ├── K8sNamespaceNode
        │   │   ├── K8sDaemonSetNode
        │   │   └── K8sDeploymentNode
        │   └── Custom Edges
        │       └── AnimatedEdge
        ├── ComponentPalette (left sidebar)
        │   ├── SDK Section
        │   ├── Collector Section
        │   ├── Infrastructure Section
        │   └── Elastic Section
        ├── ControlPanel (top-right)
        │   ├── ScenarioSelector
        │   ├── DemoModeToggle
        │   ├── ZoomControls
        │   └── ResetButton
        ├── NodeConfigPanel (right sidebar, conditional)
        │   ├── SDK Config Form
        │   ├── Collector Config Form
        │   ├── Elastic Config Form
        │   └── Live YAML Preview
        ├── ConfigExportPanel (bottom-right)
        │   ├── YAML Tab
        │   ├── Docker Compose Tab
        │   └── Kubernetes Tab
        ├── ValidationPanel (conditional)
        │   ├── Errors List
        │   ├── Warnings List
        │   └── Suggestions List
        ├── TelemetryStatsPanel (conditional, demo mode)
        │   ├── Global Stats
        │   └── Per-Component Stats
        └── Legend (bottom-left)
```

### Node Component Structure

Each custom node follows this pattern:

```typescript
// Example: CollectorNode
export default memo(function CollectorNode({ data, selected }: NodeProps<CollectorNodeData>) {
  return (
    <div className={`collector-node ${selected ? 'selected' : ''}`}>
      {/* Input handle (left) */}
      <Handle type="target" position={Position.Left} />

      {/* Node content */}
      <div className="node-header">
        <Icon />
        <h3>{data.label}</h3>
      </div>

      <div className="node-body">
        {/* Receivers */}
        <ReceiverBadges receivers={data.config?.receivers} />

        {/* Processors */}
        <ProcessorBadges processors={data.config?.processors} />

        {/* Exporters */}
        <ExporterBadges exporters={data.config?.exporters} />
      </div>

      {/* Output handle (right) */}
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
```

---

## State Management

### Zustand Stores

We use two separate Zustand stores for logical separation:

#### 1. flowStore (app/otel-flow/store/flowStore.ts)

**Purpose**: Manage topology state (nodes, edges, scenarios)

**State**:
```typescript
{
  deploymentModel: DeploymentModel;        // serverless | ech | self-managed
  scenario: ScenarioId | 'custom';         // Current scenario
  originalScenario: ScenarioId;            // Base scenario before edits
  nodes: Node<EDOTNodeData>[];             // All nodes on canvas
  edges: Edge<FlowEdgeData>[];             // All edges on canvas
  selectedNodeId: string | null;           // Currently selected node
  isAnimating: boolean;                    // Animation enabled?
  isPaletteOpen: boolean;                  // Palette visible?
  isConfigPanelOpen: boolean;              // Config panel visible?
  isDetectionPanelOpen: boolean;           // Detection wizard visible?
  resetKey: number;                        // Force React Flow re-mount
}
```

**Key Actions**:
- `setScenario(id)` - Load preset scenario
- `onNodesChange(changes)` - Handle node updates (React Flow)
- `onEdgesChange(changes)` - Handle edge updates (React Flow)
- `onConnect(connection)` - Validate and create edge
- `addNode(node)` - Add new node to canvas
- `updateNodeData(id, data)` - Update node configuration
- `setSelectedNode(id)` - Select node for editing
- `resetToOriginal()` - Reset to last loaded scenario

**Why separate from telemetry?**
- Topology changes less frequently
- Can be persisted to localStorage
- Different re-render triggers

#### 2. telemetryStore (app/otel-flow/store/telemetryStore.ts)

**Purpose**: Manage live telemetry data and demo mode

**State**:
```typescript
{
  events: TelemetryEvent[];                // Recent telemetry events
  stats: Record<string, ThroughputStats>;  // Per-component throughput
  isConnected: boolean;                    // SSE connection status
  demoMode: boolean;                       // Demo mode enabled?
}
```

**Key Actions**:
- `addEvent(event)` - Add telemetry event
- `updateStats(componentId, stats)` - Update throughput
- `toggleDemoMode()` - Enable/disable demo mode
- `clearEvents()` - Clear event buffer

**Why separate from flow?**
- Updates frequently (multiple times per second)
- Shouldn't trigger topology re-renders
- Not persisted (ephemeral data)

### State Flow Diagram

```
User Action
    │
    ├─ Drag node from palette
    │     └─> flowStore.addNode() → nodes updated → Canvas re-renders
    │
    ├─ Connect two nodes
    │     └─> flowStore.onConnect() → validateConnection() → edges updated
    │
    ├─ Toggle receiver in config
    │     └─> flowStore.updateNodeData() → node.data updated → YAML regenerated
    │
    ├─ Enable demo mode
    │     └─> telemetryStore.toggleDemoMode() → Start SSE → events added
    │
    └─ Export config
          └─> Read flowStore.nodes → Generate YAML → Download
```

---

## Data Flow

### 1. Node Creation Flow

```
User drags SDK node from palette
    │
    ├─> ComponentPalette.onDragStart()
    │     • Sets drag data (node type, initial data)
    │
    └─> OtelFlowCanvas.onDrop()
          │
          ├─> Create Node object
          │     • Generate unique ID (nanoid)
          │     • Calculate drop position
          │     • Set default data based on type
          │
          └─> flowStore.addNode(node)
                │
                └─> nodes = [...nodes, newNode]
                      │
                      └─> React Flow re-renders with new node
```

### 2. Connection Creation Flow

```
User drags from output handle to input handle
    │
    └─> OtelFlowCanvas.onConnect(connection)
          │
          ├─> validateConnection(connection, nodes, deploymentModel)
          │     │
          │     ├─ Check: Source and target exist?
          │     ├─ Check: Valid node types? (e.g., SDK → Collector OK)
          │     ├─ Check: Not connecting to self?
          │     ├─ Check: Deployment model allows? (serverless vs self-managed)
          │     │
          │     └─> Return { valid: boolean, error?: string }
          │
          ├─> If valid:
          │     └─> flowStore.onEdgesChange([add edge])
          │           │
          │           └─> edges = [...edges, newEdge]
          │                 │
          │                 └─> React Flow renders edge
          │
          └─> If invalid:
                └─> Show validation error in ValidationPanel
```

### 3. Configuration Update Flow

```
User toggles "Host Metrics" receiver in NodeConfigPanel
    │
    └─> NodeConfigPanel.handleReceiverToggle('hostmetrics')
          │
          ├─> Read current node data from flowStore
          │
          ├─> Update config.receivers array
          │     • Add or remove hostmetrics receiver
          │
          └─> flowStore.updateNodeData(nodeId, { config: newConfig })
                │
                ├─> Find node by ID
                ├─> Merge new data: node.data = { ...node.data, ...newData }
                └─> Trigger re-render
                      │
                      ├─> CollectorNode re-renders with new config
                      │     • Shows/hides hostmetrics badge
                      │
                      └─> NodeConfigPanel re-renders
                            • YAML preview updates (generateCollectorConfig())
```

### 4. Demo Mode Telemetry Flow

```
User clicks "Demo Mode" button
    │
    └─> ControlPanel.toggleDemoMode()
          │
          └─> telemetryStore.toggleDemoMode()
                │
                ├─> demoMode = true
                │
                └─> Start SSE connection to /api/telemetry/stream
                      │
                      ├─> Server generates synthetic events
                      │     • Random traces, metrics, logs
                      │     • Based on current topology (nodes/edges)
                      │
                      └─> Events streamed to client
                            │
                            ├─> telemetryStore.addEvent(event)
                            │     • events = [...events, newEvent]
                            │     • Keep only last 100 events
                            │
                            ├─> telemetryStore.updateStats(componentId, stats)
                            │     • Calculate events/sec per component
                            │
                            └─> AnimatedEdge receives events
                                  │
                                  └─> Render particles
                                        • Trace = amber dot
                                        • Metric = blue pulse
                                        • Log = green particle
                                        • Animate along edge path
```

### 5. Export Flow

```
User clicks "Download YAML" in ConfigExportPanel
    │
    └─> ConfigExportPanel.handleDownload('yaml')
          │
          ├─> Read flowStore.nodes
          │
          ├─> Filter nodes: Find all Collector nodes
          │
          ├─> For each collector:
          │     └─> generateCollectorConfig(collector.data)
          │           │
          │           ├─> Build receivers object
          │           │     • OTLP: { grpc: {}, http: {} }
          │           │     • Hostmetrics: { scrapers: [...] }
          │           │
          │           ├─> Build processors array (ordered!)
          │           │     • Memory limiter first
          │           │     • Batch last
          │           │
          │           ├─> Build exporters object
          │           │     • Elasticsearch with env vars
          │           │
          │           └─> Build service.pipelines
          │                 • Traces: [receivers] → [processors] → [exporters]
          │                 • Metrics: [receivers] → [processors] → [exporters]
          │                 • Logs: [receivers] → [processors] → [exporters]
          │
          ├─> Convert to YAML string (YAML.stringify())
          │
          └─> Create download
                • Create Blob with YAML content
                • Create download link
                • Trigger download (collector-config.yaml)
```

---

## Key Subsystems

### 1. Validation System

**Location**: `app/otel-flow/lib/connection-validator.ts`

**Purpose**: Real-time validation of topology and configurations

**Components**:

#### Connection Validation
```typescript
function validateConnection(
  connection: Connection,
  nodes: Node[],
  deploymentModel: DeploymentModel
): ValidationResult
```

Rules:
- SDKs can connect to Collectors or Elastic
- Collectors can connect to Collectors or Elastic
- Elastic cannot connect to anything (sink only)
- For self-managed: Gateway required before Elastic
- For serverless/ECH: Direct to Elastic allowed

#### Topology Validation
```typescript
function validateTopology(
  nodes: Node[],
  edges: Edge[]
): ValidationMessage[]
```

Checks:
- Disconnected nodes
- Missing required components
- Processor order (memory_limiter first, batch last)
- Best practices (tail_sampling for gateways)

### 2. Config Generation System

**Locations**:
- `app/otel-flow/lib/yaml-generator.ts`
- `app/otel-flow/lib/docker-compose-generator.ts`
- `app/otel-flow/lib/k8s-manifest-generator.ts`

**Purpose**: Generate production-ready configurations from visual topology

**YAML Generator Flow**:
```typescript
// 1. Start with node data
const collectorData: CollectorNodeData = {
  label: "EDOT Collector",
  config: {
    receivers: [
      { type: 'otlp', enabled: true },
      { type: 'hostmetrics', enabled: true }
    ],
    processors: [
      { type: 'memory_limiter', enabled: true },
      { type: 'batch', enabled: true }
    ],
    exporters: [
      { type: 'elasticsearch', enabled: true }
    ]
  }
};

// 2. Build receivers
const receivers = {
  otlp: {
    protocols: {
      grpc: { endpoint: "0.0.0.0:4317" },
      http: { endpoint: "0.0.0.0:4318" }
    }
  },
  hostmetrics: {
    collection_interval: "10s",
    scrapers: ["cpu", "memory", "disk", "network"]
  }
};

// 3. Build processors (order matters!)
const processors = {
  memory_limiter: {
    check_interval: "1s",
    limit_mib: 512
  },
  batch: {
    timeout: "10s",
    send_batch_size: 1024
  }
};

// 4. Build exporters (use env vars for secrets!)
const exporters = {
  elasticsearch: {
    endpoints: ["${ELASTIC_ENDPOINT}"],
    api_key: "${ELASTIC_API_KEY}"
  }
};

// 5. Build service pipelines
const service = {
  pipelines: {
    traces: {
      receivers: ["otlp"],
      processors: ["memory_limiter", "batch"],
      exporters: ["elasticsearch"]
    },
    // ... metrics and logs
  }
};

// 6. Convert to YAML
const yaml = YAML.stringify({ receivers, processors, exporters, service });
```

### 3. Animation System

**Location**: `app/otel-flow/components/edges/AnimatedEdge.tsx`

**Purpose**: Visualize telemetry flow with animated particles

**How it works**:

```typescript
// 1. AnimatedEdge receives telemetry events from store
const events = useTelemetryStore(state =>
  state.events.filter(e => e.sourceComponent === edgeSource)
);

// 2. For each event, create a particle
events.map(event => ({
  id: event.id,
  type: event.type,  // 'traces' | 'metrics' | 'logs'
  progress: calculateProgress(event.timestamp), // 0 to 1
}));

// 3. Render particles using Framer Motion
<motion.div
  className={`particle particle-${event.type}`}
  initial={{ offsetDistance: "0%" }}
  animate={{ offsetDistance: "100%" }}
  transition={{ duration: 2, ease: "linear" }}
  style={{
    offsetPath: `path("${edgePath}")`,  // SVG path
  }}
/>
```

**Performance optimizations**:
- Limit particles per edge (max 20)
- Use CSS transforms (GPU-accelerated)
- Debounce particle creation (100ms)
- Cleanup old particles automatically

---

## Design Decisions

### Why @xyflow/react (React Flow)?

**Considered alternatives**: D3.js, Cytoscape.js, custom SVG

**Chose React Flow because**:
- Built for React (not a wrapper)
- Excellent performance with many nodes
- Built-in drag-and-drop, zooming, panning
- Extensible node/edge system
- Active development and community

### Why Zustand over Redux/Context?

**Considered alternatives**: Redux Toolkit, React Context, Jotai

**Chose Zustand because**:
- Minimal boilerplate
- No Provider wrapping needed
- Built-in middleware (persist, devtools)
- Perfect for real-time updates (no unnecessary re-renders)
- Small bundle size (~1KB)

### Why Separate Stores?

**Could have used**: Single store for everything

**Chose separation because**:
- **flowStore** changes infrequently (topology design)
  - Can be persisted to localStorage
  - Doesn't need to trigger re-renders on telemetry updates
- **telemetryStore** updates frequently (multiple times/sec)
  - Ephemeral data (no persistence)
  - Only triggers re-renders for stats panels and edges

### Why Server-Sent Events (SSE) over WebSockets?

**Considered alternatives**: WebSockets, polling

**Chose SSE because**:
- Simpler protocol (HTTP)
- Works with Next.js API routes out of the box
- One-way communication sufficient (server → client)
- Automatic reconnection
- Less overhead than WebSockets for our use case

### Why Generate Configs Client-Side?

**Could have used**: Server-side generation with API

**Chose client-side because**:
- No server state needed
- Faster (no round-trip)
- Works offline
- Simpler architecture
- All data already in browser

---

## Performance Considerations

### React Flow Optimizations

1. **Memoized Nodes**:
   ```typescript
   export default memo(function CollectorNode({ data, selected }) {
     // Only re-renders when data or selected changes
   });
   ```

2. **Selective Re-renders**:
   ```typescript
   // Only subscribe to needed state
   const nodes = useFlowStore(state => state.nodes);
   // Not: const state = useFlowStore(); // Re-renders on ANY change
   ```

3. **Edge Optimization**:
   ```typescript
   // Limit particle count
   const MAX_PARTICLES = 20;
   const particles = events.slice(0, MAX_PARTICLES);
   ```

### State Update Batching

```typescript
// Bad: Multiple updates trigger multiple re-renders
set({ nodes: [...nodes, newNode] });
set({ selectedNodeId: newNode.id });
set({ isConfigPanelOpen: true });

// Good: Single update, single re-render
set({
  nodes: [...nodes, newNode],
  selectedNodeId: newNode.id,
  isConfigPanelOpen: true,
});
```

### Animation Performance

- Use CSS `transform` and `opacity` (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left` (causes layout)
- Use `will-change: transform` sparingly
- Cleanup animations when components unmount

### Bundle Size

Current production bundle:
- Main bundle: ~250KB gzipped
- @xyflow/react: ~80KB
- Next.js runtime: ~90KB
- App code: ~80KB

Optimizations:
- Code splitting (each route is separate chunk)
- Tree-shaking (only import used components)
- Dynamic imports for heavy components (YAML parser)

---

## Extension Points

### Adding a New Node Type

1. **Create component** (`components/nodes/MyNode.tsx`)
2. **Define TypeScript types** (`types.ts`)
3. **Register node type** (`components/nodes/index.ts`)
4. **Add to palette** (`components/panels/ComponentPalette.tsx`)
5. **Update validation** (if needed, `lib/connection-validator.ts`)
6. **Update generators** (if needed, `lib/*-generator.ts`)

### Adding a New Export Format

1. **Create generator** (`lib/my-format-generator.ts`)
2. **Add tab** to `ConfigExportPanel.tsx`
3. **Add download handler**
4. **Update types** if needed

### Adding a New Validation Rule

1. **Edit validator** (`lib/connection-validator.ts`)
2. **Add rule** to `validateTopology()` or `validateConnection()`
3. **Return validation message** with type (error/warning/suggestion)

### Adding a New Scenario

1. **Edit scenarios** (`data/scenarios.ts`)
2. **Define nodes** and **edges**
3. **Add metadata** (name, description)
4. **Update scenario selector** UI

---

## Future Architecture Enhancements

### Planned Improvements

1. **Undo/Redo**:
   - Add history middleware to Zustand
   - Track state snapshots
   - Keyboard shortcuts (Cmd+Z)

2. **URL State Sync**:
   - Encode topology in URL
   - Shareable links
   - Browser back/forward support

3. **Real OTLP Receiver**:
   - Accept real telemetry via API
   - Display in UI
   - Compare with expected flow

4. **Multi-region Support**:
   - Group nodes by region
   - Show cross-region latency
   - Validate data residency

---

## Debugging Tips

### React Flow Debugging

```typescript
// Enable React Flow debug mode
<ReactFlow
  nodes={nodes}
  edges={edges}
  // Debug: log all node/edge changes
  onNodesChange={(changes) => {
    console.log('Node changes:', changes);
    onNodesChange(changes);
  }}
/>
```

### Zustand Debugging

```typescript
// Enable devtools
import { devtools } from 'zustand/middleware';

export const useFlowStore = create<FlowStore>()(
  devtools(
    persist(
      (set, get) => ({
        // ... store
      }),
      { name: 'flow-store' }
    ),
    { name: 'FlowStore' }
  )
);

// Then use Redux DevTools browser extension
```

### Performance Profiling

```bash
# Use React DevTools Profiler
# 1. Open React DevTools
# 2. Go to Profiler tab
# 3. Click Record
# 4. Interact with app
# 5. Stop and analyze flamegraph
```

---

## Additional Resources

- [React Flow Documentation](https://reactflow.dev/)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Framer Motion API](https://www.framer.com/motion/)
- [EDOT Collector Configuration](https://www.elastic.co/docs/reference/edot-collector)

---

**Last Updated**: 2026-01-09

For questions about the architecture, please open a discussion on GitHub.
