# CLAUDE.md - EDOT Flow Visualizer

## 🚀 Quick Status (Last Updated: Dec 2024)

| Phase | Status | Notes |
|-------|--------|-------|
| Core Visualization | ✅ Complete | Drag-drop, animations, 6 scenarios |
| Phase 3: Infrastructure | ✅ Complete | Host, Docker, K8s nodes with nesting |
| Phase 4: Interactive Config | 🟡 Mostly Done | NodeConfigPanel + real-time validation complete |
| Phase 5: Export | 🟡 Partial | YAML + Docker Compose + K8s manifests done |
| Phase 6-9 | ❌ Not Started | Educational, real integration, sharing |

**Next Priority**: Keyboard shortcuts (Delete key) or YAML import

---

## Project Overview

**EDOT Flow Visualizer** is an interactive, real-time visualization tool that demonstrates how telemetry data flows through Elastic Distribution of OpenTelemetry (EDOT) components. The goal is to make OpenTelemetry architecture intuitive and educational through animated diagrams.

### Key Value Proposition
- **Educational**: Helps users understand when to use SDK vs Collector (Agent vs Gateway)
- **Interactive**: Drag-and-drop topology building with real-time data flow animation
- **Practical**: Generates working EDOT Collector YAML configs from visual topologies
- **EDOT-Focused**: Specifically tailored to Elastic's distribution, not generic OTel

## Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Framework | Next.js 14+ (App Router) | SSR, API routes, excellent DX |
| UI | React 18 + TypeScript | Type safety, component model |
| Flow Visualization | @xyflow/react (React Flow v12) | Purpose-built for node-based diagrams |
| Animation | Framer Motion | Smooth particle animations |
| State | Zustand | Lightweight, perfect for real-time updates |
| Styling | Tailwind CSS + shadcn/ui | Rapid iteration, modern look |
| Real-time | Server-Sent Events (SSE) | Simple, works with Next.js |

## EDOT Architecture Reference

### EDOT Components (from Elastic docs)

1. **EDOT SDKs** - Language-specific instrumentation:
   - Java, Python, Node.js, .NET, Go, PHP, Ruby
   - iOS and Android for mobile
   - Auto-instrumentation + manual spans
   - Sends OTLP to Collector or directly to Elastic

2. **EDOT Collector** - Two deployment modes:
   - **Agent Mode**: Sidecar/DaemonSet, per-host, collects host metrics
   - **Gateway Mode**: Centralized, handles sampling/transformation/routing

3. **Receivers** (inputs):
   - `otlp` - OTLP gRPC/HTTP from SDKs
   - `hostmetrics` - CPU, memory, disk, network
   - `filelog` - Log file tailing
   - `prometheus` - Scrape Prometheus endpoints

4. **Processors** (transformation):
   - `batch` - Batch telemetry for efficiency
   - `memory_limiter` - Prevent OOM
   - `tail_sampling` - Smart sampling decisions
   - `transform` - Modify attributes
   - `filter` - Drop unwanted data
   - `attributes` - Add/modify attributes

5. **Exporters** (outputs):
   - `otlp/elastic` - Send to Elastic APM/Observability
   - `otlp` - Generic OTLP endpoint
   - `debug` - Console output for debugging

### Reference Architecture Patterns

```
Pattern 1: Simple (Getting Started)
┌─────────┐     OTLP      ┌─────────────────┐
│ App +   │──────────────▶│ Elastic         │
│ EDOT SDK│               │ Observability   │
└─────────┘               └─────────────────┘

Pattern 2: With Agent (Recommended)
┌─────────┐     OTLP      ┌─────────────┐     OTLP      ┌─────────────────┐
│ App +   │──────────────▶│ EDOT        │──────────────▶│ Elastic         │
│ EDOT SDK│               │ Collector   │               │ Observability   │
└─────────┘               │ (Agent)     │               └─────────────────┘
                          │ +hostmetrics│
                          └─────────────┘

Pattern 3: Gateway (Production)
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│ App 1   │────▶│ Agent 1     │────▶│ EDOT        │────▶│ Elastic         │
└─────────┘     └─────────────┘     │ Collector   │     │ Observability   │
┌─────────┐     ┌─────────────┐     │ (Gateway)   │     └─────────────────┘
│ App 2   │────▶│ Agent 2     │────▶│ +sampling   │
└─────────┘     └─────────────┘     │ +transform  │
                                    └─────────────┘
```

## Project Structure

```
edot-flow-visualizer/
├── app/
│   ├── page.tsx                      # Landing page
│   ├── layout.tsx                    # Root layout
│   ├── globals.css                   # Global styles
│   │
│   ├── otel-flow/                    # Main visualizer
│   │   ├── page.tsx                  # Visualizer page
│   │   ├── components/
│   │   │   ├── OtelFlowCanvas.tsx    # React Flow wrapper
│   │   │   ├── nodes/                # Custom node components
│   │   │   │   ├── index.ts
│   │   │   │   ├── EDOTSDKNode.tsx
│   │   │   │   ├── CollectorNode.tsx
│   │   │   │   ├── ElasticNode.tsx
│   │   │   │   ├── HostNode.tsx          # Infrastructure
│   │   │   │   ├── DockerNode.tsx        # Infrastructure
│   │   │   │   ├── K8sNamespaceNode.tsx  # Infrastructure
│   │   │   │   ├── K8sDaemonSetNode.tsx  # Infrastructure
│   │   │   │   └── K8sDeploymentNode.tsx # Infrastructure
│   │   │   ├── edges/
│   │   │   │   ├── index.ts
│   │   │   │   └── AnimatedEdge.tsx
│   │   │   └── panels/
│   │   │       ├── ComponentPalette.tsx
│   │   │       ├── ConfigExportPanel.tsx
│   │   │       ├── NodeConfigPanel.tsx   # NEW: Edit node config inline
│   │   │       ├── ControlPanel.tsx
│   │   │       ├── Legend.tsx
│   │   │       └── TelemetryStatsPanel.tsx
│   │   ├── store/
│   │   │   ├── flowStore.ts          # Topology state
│   │   │   └── telemetryStore.ts     # Live data state
│   │   ├── lib/
│   │   │   ├── yaml-generator.ts         # Collector YAML export
│   │   │   ├── docker-compose-generator.ts # Docker Compose export
│   │   │   ├── k8s-manifest-generator.ts   # K8s manifests export
│   │   │   ├── connection-validator.ts     # Connection validation rules
│   │   │   └── useTelemetryStream.ts       # SSE hook
│   │   ├── data/
│   │   │   └── scenarios.ts          # Preset topologies
│   │   └── types.ts                  # TypeScript definitions
│   │
│   └── api/
│       ├── otlp/v1/
│       │   ├── traces/route.ts       # OTLP traces receiver
│       │   ├── metrics/route.ts      # OTLP metrics receiver
│       │   └── logs/route.ts         # OTLP logs receiver
│       └── telemetry/
│           └── stream/route.ts       # SSE endpoint
│
├── lib/
│   └── telemetry/
│       └── processor.ts              # Telemetry aggregation
│
├── public/
│   └── elastic-logo.svg
│
├── CLAUDE.md                         # This file
├── .cursorrules                      # Cursor AI rules
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Implementation Guidelines

### Node Components Design

Each EDOT component should have:
1. **Visual identity** - Distinct color/icon per component type
2. **Status indicators** - Show throughput when available
3. **Expandable details** - Click to see config
4. **Handles** - Input (left) and output (right) connection points

Color scheme:
- SDK nodes: Green border (language-specific accent)
- Collector Agent: Cyan border
- Collector Gateway: Pink/Magenta border
- Elastic APM: Elastic gradient (teal to blue)

### Animation System

Particles flow along edges to represent telemetry:
- **Traces**: Amber/orange dots
- **Metrics**: Blue pulses
- **Logs**: Green particles

Particle density = throughput volume (1-10 scale)

### YAML Generation Rules

When generating Collector configs:
1. Always include `memory_limiter` first in processors
2. Use `batch` processor for efficiency
3. For gateways, include `tail_sampling`
4. Export to `otlp/elastic` with env var placeholders
5. Generate valid YAML that passes `otelcol validate`

### State Management

Two Zustand stores:
1. **flowStore** - Topology (nodes, edges, selected node, scenario)
2. **telemetryStore** - Live data (events buffer, throughput stats, connection status)

### Performance Considerations

- Limit particle count per edge (max ~20)
- Throttle telemetry updates to 100ms
- Use React.memo on all node components
- Virtualize large topologies

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## Key Files to Understand First

1. `app/otel-flow/types.ts` - All TypeScript interfaces
2. `app/otel-flow/data/scenarios.ts` - Preset topologies
3. `app/otel-flow/store/flowStore.ts` - Main state
4. `app/otel-flow/components/OtelFlowCanvas.tsx` - Core visualization

## Testing the Visualizer

1. Start dev server: `npm run dev`
2. Navigate to `/otel-flow`
3. Use scenario selector to switch between patterns
4. Drag components from palette to canvas
5. Connect nodes by dragging from output to input handles
6. Click "Export Config" to generate YAML
7. Toggle demo mode to see animated data flow

## EDOT Documentation Links

- Main EDOT docs: https://www.elastic.co/docs/reference/opentelemetry
- EDOT Collector: https://www.elastic.co/docs/reference/edot-collector
- Architecture: https://www.elastic.co/docs/reference/opentelemetry/architecture
- GitHub: https://github.com/elastic/opentelemetry

## Common Tasks

### Adding a new node type

1. Create component in `components/nodes/`
2. Add to `nodeTypes` in `components/nodes/index.ts`
3. Add to palette items in `ComponentPalette.tsx`
4. Update `types.ts` with new data interface

### Adding a new scenario

1. Add to `scenarios` object in `data/scenarios.ts`
2. Add metadata to `ScenarioSelector.tsx`

### Modifying YAML generation

1. Edit `lib/yaml-generator.ts`
2. Follow OTel Collector config schema
3. Test output with `otelcol validate --config=generated.yaml`

## WOW Factor Checklist

- [x] Smooth 60fps particle animations
- [x] Satisfying drag-and-drop with snap-to-grid
- [x] Instant scenario switching with transition animations
- [x] Live throughput counters updating in real-time
- [x] One-click YAML export with syntax highlighting
- [x] Dark mode with glowing particle effects
- [ ] Responsive on tablet/desktop

---

## Known Issues / TODOs

### High Priority
- [x] **Reset/Rollback button doesn't fully reset canvas** - FIXED: Added `resetKey` state that increments on reset, forcing React Flow to re-mount completely. See `flowStore.ts:26` and `OtelFlowCanvas.tsx:104`.

### Medium Priority
- [ ] Node deletion via keyboard (Delete/Backspace key)
- [ ] Undo/redo support for topology changes
- [ ] Edge deletion on click

### Low Priority
- [ ] Mobile responsiveness improvements
- [ ] Keyboard navigation for accessibility

---

## Product Roadmap

### Phase 3: Infrastructure Context ✅ COMPLETE
**Goal**: Show where EDOT components run - critical for understanding Agent vs Gateway deployment patterns.

All infrastructure nodes implemented with parent-child nesting:
- [x] **HostNode** - Physical/virtual machine container
- [x] **DockerNode** - Container runtime with network config
- [x] **K8sNamespaceNode** - Kubernetes namespace
- [x] **K8sDaemonSetNode** - DaemonSet for agents
- [x] **K8sDeploymentNode** - Deployment for gateways
- [x] Nested node rendering (parentId, extent: 'parent')
- [x] Docker + Kubernetes scenarios in `scenarios.ts`
- [x] Docker Compose generator
- [x] K8s manifest generator
- [x] Connection validation (`connection-validator.ts`)

---

### Phase 4: Interactive Configuration 🟡 MOSTLY COMPLETE
**Goal**: Edit collector configurations directly in the UI with immediate visual feedback.

- [x] **NodeConfigPanel** - Side panel with form-based config editing
  - SDK: label, service name, language selector, auto-instrumentation toggle
  - Collector: toggle receivers/processors/exporters, mode indicator
  - Elastic: label and features toggle
- [x] **Real-time YAML Preview** - Live update as you toggle components
- [x] **Config Validation** - Real-time validation with errors, warnings, and suggestions
  - Collector validation: receivers, processors order, exporters
  - Topology validation: disconnected nodes, missing destinations, architecture recommendations
  - Best practices: memory_limiter first, batch last, tail_sampling on Gateway
- [ ] **Processor Ordering UI** - Drag to reorder processors
- [ ] **Detailed Config** - Edit endpoints, auth, TLS, processor params
- [ ] **Environment Variable Management** - Define and reference env vars

---

### Phase 5: Import & Export Ecosystem 🟡 PARTIAL
**Goal**: Bidirectional workflow - import existing configs, export deployment manifests.

#### 5.1 Import Capabilities
- [ ] **Import YAML** - Parse existing `otel.yml` and visualize topology
- [ ] **Import from URL** - Fetch config from GitHub/Gist
- [ ] **Auto-detect Architecture** - Analyze config to suggest visualization

#### 5.2 Export Formats
- [x] **EDOT Collector YAML** - Full config with EDOT-specific components
- [x] **Docker Compose** - `docker-compose-generator.ts`
- [x] **Kubernetes Manifests** - `k8s-manifest-generator.ts` (DaemonSet, Deployment, ConfigMap, Service, RBAC)
- [ ] **Helm Values** - For EDOT Helm chart
- [ ] **Terraform** - Infrastructure as Code for cloud deployments

---

### Phase 6: Educational Enhancements
**Goal**: Make the visualizer a learning tool, not just a diagram builder.

- [ ] **Component Tooltips** - Hover for "why use this?" explanations
- [ ] **Best Practices Warnings** - Alert when anti-patterns detected
  - "memory_limiter should be first processor"
  - "Gateway mode recommended for >5 services"
  - "tail_sampling requires Gateway mode"
- [ ] **Guided Tours** - Step-by-step walkthrough for new users
- [ ] **Documentation Links** - Direct links to relevant Elastic docs
- [ ] **Architecture Decision Helper** - Wizard to recommend topology based on requirements

---

### Phase 7: Real-World Integration
**Goal**: Connect to actual EDOT infrastructure for live demonstrations.

- [ ] **OTLP Receiver Mode** - Accept real telemetry from actual SDKs
- [ ] **Collector Health Monitoring** - Show collector status (up/down/degraded)
- [ ] **Throughput Metrics** - Real spans/sec, events/sec from actual traffic
- [ ] **Trace Sampling Preview** - Show which traces would be sampled/dropped
- [ ] **Error Highlighting** - Visual indicators when errors occur in pipeline

---

### Phase 8: Collaboration & Sharing
**Goal**: Enable team collaboration and knowledge sharing.

- [ ] **Shareable URLs** - Encode topology in URL for sharing
- [ ] **Export as Image** - PNG/SVG for documentation
- [ ] **Embed Mode** - Iframe-friendly for docs/blogs
- [ ] **Template Library** - Community-contributed topologies
- [ ] **Comments/Annotations** - Add notes to topology elements

---

### Phase 9: Advanced Topologies
**Goal**: Support complex production architectures.

- [ ] **Multi-Region** - Show geo-distributed collectors
- [ ] **Load Balancing** - Visualize load balancer in front of gateways
- [ ] **Failover Paths** - Primary/secondary routing visualization
- [ ] **Data Transformation Flows** - Show how data changes through processors
- [ ] **Cost Estimation** - Estimated resource usage based on topology

---

## Priority Matrix

| Phase | Status | Next Actions |
|-------|--------|--------------|
| Phase 3: Infrastructure | ✅ Done | - |
| Phase 4: Interactive Config | 🟡 Partial | Processor drag-reorder, detailed config |
| Phase 5: Import/Export | 🟡 Partial | YAML import, Helm, Terraform |
| Phase 6: Educational | ❌ Not Started | Tooltips, best practices, guided tours |
| Phase 7: Real Integration | ❌ Not Started | Live OTLP receiver, health monitoring |
| Phase 8: Collaboration | ❌ Not Started | Shareable URLs, image export |
| Phase 9: Advanced Topologies | ❌ Not Started | Multi-region, load balancing |

### Recommended Next Steps
1. **Quick Win**: Keyboard shortcuts (Delete/Backspace for node deletion)
2. **High Value**: YAML import (parse existing configs to visualize)
3. **Polish**: Processor drag-to-reorder in NodeConfigPanel

---

## Success Metrics

- **Adoption**: Users creating topologies, not just viewing presets
- **Education**: Reduced support questions about EDOT architecture
- **Utility**: Generated YAML configs used in production
- **Engagement**: Time spent exploring different scenarios
- **Sharing**: Topologies shared via URL or embedded in docs
