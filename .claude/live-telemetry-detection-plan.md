# Live Telemetry Flow Detection - Implementation Plan

## Feature Overview

**Goal**: When pointed to an existing repository or project with OpenTelemetry instrumentation, automatically detect the telemetry flow and reconstruct it visually on the canvas, allowing users to understand and improve their existing setup.

---

## Architecture

```
Repository/Project Input
         │
         ▼
┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐
│  YAML Parser     │  │  Traffic Analyzer │  │  Code Scanner    │
│  (Config Files)  │  │  (Live OTLP)      │  │  (SDK Detection) │
└────────┬─────────┘  └─────────┬─────────┘  └─────────┬────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌────────────────────────────────────────────────────────────────┐
│                    Detection Aggregator                        │
│  • Merge results from all sources                              │
│  • Resolve conflicts (config vs traffic vs code)               │
│  • Generate confidence scores                                  │
└────────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
┌──────────────────┐     ┌───────────────────┐
│  Layout Engine   │────▶│  Flow Store       │
│  (Auto-position) │     │  (nodes/edges)    │
└──────────────────┘     └───────────────────┘
                                 │
                                 ▼
                          Canvas Render
```

---

## Detection Methods

### 1. YAML Config Parser (Priority: High)
Parse existing `otel.yml`, `docker-compose.yml`, K8s manifests and reconstruct topology.

**Detection Logic**:
- `hostmetrics` receiver → Agent mode collector
- `tail_sampling` processor → Gateway mode collector
- `otlp` exporter to another collector → Agent forwarding to Gateway
- `elasticsearch` exporter → Connection to Elastic

### 2. Traffic Analyzer (Priority: Medium)
Infer topology from live OTLP telemetry patterns.

**Detection Logic**:
- Group events by `serviceName` → SDK nodes
- Analyze `sourceComponent`/`targetComponent` → Edge connections
- `telemetry.sdk.language` attribute → SDK language type
- Batched events from same source → Gateway aggregation

### 3. Code Scanner (Priority: Medium)
Detect OTel SDK instrumentation in source code.

**Language Detection Patterns**:
| Language | Package/Import |
|----------|----------------|
| Node.js | `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node` |
| Python | `opentelemetry-sdk`, `opentelemetry-instrumentation` |
| Java | `io.opentelemetry:opentelemetry-sdk` |
| Go | `go.opentelemetry.io/otel` |
| .NET | `OpenTelemetry.Extensions.Hosting` |

---

## New Files to Create

```
app/
├── api/
│   └── detection/
│       ├── scan/route.ts           # File upload endpoint
│       ├── traffic/route.ts        # Traffic analysis endpoint
│       └── github/route.ts         # GitHub repo fetch
│
└── otel-flow/
    ├── lib/
    │   └── detection/
    │       ├── index.ts            # Public exports
    │       ├── types.ts            # Detection interfaces
    │       ├── yaml-parser.ts      # OTel YAML parser
    │       ├── docker-compose-parser.ts
    │       ├── k8s-manifest-parser.ts
    │       ├── traffic-analyzer.ts
    │       ├── code-scanner.ts
    │       ├── aggregator.ts       # Merge detection results
    │       └── layout-engine.ts    # Auto-position nodes
    │
    ├── store/
    │   └── detectionStore.ts       # Detection state
    │
    └── components/
        ├── panels/
        │   ├── DetectionWizardPanel.tsx
        │   └── DetectionPreviewPanel.tsx
        └── detection/
            ├── FileUploader.tsx
            ├── TrafficMonitor.tsx
            ├── RepositoryInput.tsx
            └── ConflictResolver.tsx
```

---

## Key Interfaces

```typescript
// Detection result from any method
interface DetectionResult {
  nodes: Node<EDOTNodeData>[];
  edges: Edge<FlowEdgeData>[];
  warnings: string[];
  confidence: number; // 0-1
}

// Parsed collector configuration
interface ParsedCollectorConfig {
  mode: 'agent' | 'gateway';
  receivers: ReceiverConfig[];
  processors: ProcessorConfig[];
  exporters: ExporterConfig[];
}

// Aggregated from multiple sources
interface AggregatedDetection {
  nodes: Node<EDOTNodeData>[];
  edges: Edge<FlowEdgeData>[];
  sources: ('yaml' | 'traffic' | 'code')[];
  conflicts: DetectionConflict[];
  overallConfidence: number;
}
```

---

## Files to Modify

### 1. `/app/otel-flow/store/flowStore.ts`
Add action to apply detected topology:
```typescript
setDetectedTopology: (nodes, edges, options?) => void;
```

### 2. `/app/otel-flow/types.ts`
Add detection-related type definitions.

### 3. `/lib/telemetry/processor.ts`
Extend TelemetryBuffer with traffic analysis methods:
```typescript
getEventsByService(): Map<string, TelemetryEvent[]>;
getConnectionStats(): ConnectionStats[];
```

---

## UI Flow

```
┌─────────────────────────────────────────────────────────┐
│  Detect Telemetry Flow                             [X]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  How would you like to detect your topology?            │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ 📄 Import YAML  │  │ 📡 Live Traffic │              │
│  │ Upload config   │  │ Analyze OTLP    │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ 🔍 Scan Repo    │  │ ✨ Auto-Detect  │              │
│  │ GitHub/Local    │  │ All Methods     │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: YAML Import (Foundation) ✅ COMPLETE
1. ✅ Create `detection/types.ts` with interfaces
2. ✅ Implement `yaml-parser.ts` (reverse yaml-generator.ts logic)
3. ✅ Create basic `layout-engine.ts` (left-to-right positioning)
4. ✅ Add `setDetectedTopology()` to flowStore
5. ✅ Build `FileUploader.tsx` component
6. ✅ Create `DetectionWizardPanel.tsx` (YAML method only)
7. ✅ Add detection button to ControlPanel
8. ✅ Integrate DetectionWizardPanel into OtelFlowCanvas

### Phase 2: Docker/K8s Parsing
1. Implement `docker-compose-parser.ts`
2. Implement `k8s-manifest-parser.ts`
3. Extend wizard to handle multiple file types

### Phase 3: Traffic Analysis ✅ COMPLETE
1. ✅ Extend `TelemetryBuffer` with analysis methods
2. ✅ Implement `traffic-analyzer.ts`
3. ✅ Create `TrafficMonitor.tsx` component
4. ✅ Add `/api/detection/traffic/route.ts`
5. ✅ Integrate traffic detection into DetectionWizardPanel

### Phase 4: Code Scanning
1. Create language-specific scanners (Node.js, Python first)
2. Implement `code-scanner.ts` coordinator
3. Add GitHub API integration
4. Create `RepositoryInput.tsx`

### Phase 5: Aggregation & Polish
1. Implement `aggregator.ts` for combining methods
2. Create `ConflictResolver.tsx`
3. Add `DetectionPreviewPanel.tsx`
4. Create `detectionStore.ts`
5. Enhance layout with infrastructure grouping

---

## Dependencies to Add

```json
{
  "dagre": "^0.8.x",    // Graph layout algorithm
  "jszip": "^3.x"       // ZIP file handling for repo upload
}
```

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `lib/yaml-generator.ts` | Reverse-engineer for YAML parser |
| `store/flowStore.ts` | Extend with detection action |
| `types.ts` | Add detection interfaces |
| `lib/telemetry/processor.ts` | Extend buffer for traffic analysis |
| `components/panels/ConfigExportPanel.tsx` | UI pattern to follow |

---

## Success Criteria

- [x] Users can upload existing `otel.yml` and see topology rendered
- [ ] Docker Compose files with OTEL services are parsed correctly
- [ ] K8s manifests (DaemonSet, Deployment) are detected
- [x] Live OTLP traffic infers service connections
- [ ] Code scanning detects instrumented services from GitHub URLs
- [ ] Multiple detection methods can be combined with conflict resolution
- [ ] Detected topology passes existing validation rules
- [x] Users can review and edit before applying to canvas

---

## Files Created (Phase 1)

| File | Description |
|------|-------------|
| `app/otel-flow/lib/detection/types.ts` | All detection-related TypeScript interfaces |
| `app/otel-flow/lib/detection/yaml-parser.ts` | OTel Collector YAML parser |
| `app/otel-flow/lib/detection/layout-engine.ts` | Auto-positioning algorithm |
| `app/otel-flow/lib/detection/index.ts` | Public API exports |
| `app/otel-flow/components/detection/FileUploader.tsx` | Drag-drop file upload component |
| `app/otel-flow/components/detection/index.ts` | Component exports |
| `app/otel-flow/components/panels/DetectionWizardPanel.tsx` | Main detection wizard UI |

## Files Modified (Phase 1)

| File | Changes |
|------|---------|
| `app/otel-flow/store/flowStore.ts` | Added `setDetectedTopology()` and `mergeDetectedNodes()` actions |
| `app/otel-flow/components/panels/ControlPanel.tsx` | Added detection button with sparkles icon |
| `app/otel-flow/components/OtelFlowCanvas.tsx` | Integrated DetectionWizardPanel

---

## Files Created (Phase 3)

| File | Description |
|------|-------------|
| `app/otel-flow/lib/detection/traffic-analyzer.ts` | Converts traffic snapshots to topology detection results |
| `app/otel-flow/components/detection/TrafficMonitor.tsx` | Real-time traffic monitoring UI with progress stats |
| `app/api/detection/traffic/route.ts` | API endpoint for starting/stopping traffic analysis |

## Files Modified (Phase 3)

| File | Changes |
|------|---------|
| `lib/telemetry/processor.ts` | Extended TelemetryBuffer with traffic analysis methods (startAnalysis, stopAnalysis, getAnalysisProgress, analyzeExistingEvents, getEventsByService, getConnectionStats) |
| `app/otel-flow/lib/detection/index.ts` | Added exports for traffic-analyzer functions |
| `app/otel-flow/components/detection/index.ts` | Added TrafficMonitor export |
| `app/otel-flow/components/panels/DetectionWizardPanel.tsx` | Integrated TrafficMonitor component with start/stop/progress polling |
