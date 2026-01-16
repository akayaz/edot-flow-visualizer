# 🔭 EDOT Flow Visualizer

**Interactive visualization tool for Elastic Distribution of OpenTelemetry (EDOT) architecture patterns**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![React Flow](https://img.shields.io/badge/React_Flow-12-purple)](https://reactflow.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-cyan?logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

> **📸 Note**: Visual demos and screenshots are being prepared. See [docs/SCREENSHOTS_NEEDED.md](./docs/SCREENSHOTS_NEEDED.md) for details.

<!--
TODO: Add hero screenshot/GIF here once captured
![EDOT Flow Visualizer Demo](./docs/images/demo.gif)
-->

---

## 📑 Table of Contents

- [Why EDOT Flow Visualizer?](#why-edot-flow-visualizer)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Architecture Patterns](#-architecture-patterns)
- [Key Features](#-key-features-in-depth)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Usage Guide](#-usage-guide)
- [Customization](#-customization)
- [Troubleshooting](#-troubleshooting)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## Why EDOT Flow Visualizer?

Understanding OpenTelemetry architecture can be challenging. When should you use SDKs directly? When do you need a Collector? What's the difference between Agent and Gateway modes? How do receivers, processors, and exporters work together?

**EDOT Flow Visualizer** makes these questions easy to answer through interactive, animated diagrams. It's designed specifically for [Elastic's Distribution of OpenTelemetry (EDOT)](https://www.elastic.co/docs/reference/opentelemetry), helping you:

- **Learn EDOT patterns visually** through interactive topologies
- **Design your observability architecture** with drag-and-drop components
- **Generate production configs** automatically from your visual designs
- **Understand data flow** with real-time particle animations
- **Explore best practices** with validation and recommendations

Whether you're new to OpenTelemetry or designing a production deployment, this tool bridges the gap between concepts and implementation.

---

## ✨ Features

### Core Capabilities

- **🎨 Interactive Topology Builder** - Drag-and-drop EDOT components to design your observability architecture
- **🌊 Animated Data Flow** - Watch telemetry particles (traces, metrics, logs) flow through your pipeline in real-time
- **📋 Config Export** - Generate production-ready Collector YAML, Docker Compose, and Kubernetes manifests from your visual design
- **📚 Educational Scenarios** - Learn EDOT patterns through 6 preset architectures (Simple, Agent, Gateway, Production, Docker, Kubernetes)
- **🎯 EDOT-Focused** - Specifically designed for Elastic's distribution of OpenTelemetry, not generic OTel
- **⚡ Demo Mode** - Generate simulated telemetry to see live throughput stats and particle animations
- **📊 Live Stats Panel** - Real-time traces/metrics/logs throughput monitoring
- **🔧 Visual Components** - Collectors display their receivers, processors, and exporters with configuration options
- **✅ Real-time Validation** - Get warnings, errors, and best practice recommendations as you build
- **🏗️ Infrastructure Context** - Place components in Hosts, Docker containers, and Kubernetes namespaces

### Component Types

| Component | Description | Use Case |
|-----------|-------------|----------|
| **EDOT SDK** | Language-specific instrumentation (Node.js, Python, Java, .NET, Go, PHP, Ruby) | Instrument your applications |
| **Collector Agent** | Per-host/sidecar mode with host metrics | Collect telemetry and infrastructure metrics |
| **Collector Gateway** | Centralized mode for sampling and routing | Handle high volume, sampling, and transformation |
| **Elastic Observability** | Destination for telemetry data | APM, Logs, Metrics, and Traces in Elastic |
| **Infrastructure Nodes** | Host, Docker, Kubernetes containers | Show deployment context |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/edot-flow-visualizer.git
cd edot-flow-visualizer

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Quick Start (Alternative)

```bash
# Build and run with Docker Compose
docker compose up -d

# Access at http://localhost:3000
open http://localhost:3000

# View logs
docker compose logs -f
```

See [DOCKER-QUICKSTART.md](./DOCKER-QUICKSTART.md) for Docker details and [DEPLOYMENT.md](./DEPLOYMENT.md) for Kubernetes deployment.

### First Steps

1. **Navigate to the visualizer**: Go to `/otel-flow` or click "Try It Now" on the landing page
2. **Explore scenarios**: Use the scenario selector to load preset architectures
3. **Try demo mode**: Click the ⚡ button to see animated telemetry flow
4. **Build your own**: Drag components from the palette to the canvas
5. **Export configs**: Click "Export Config" to generate YAML files

---

## 🐳 Deployment Options

| Method | Best For | Documentation | Setup Time |
|--------|----------|---------------|------------|
| **npm** | Local development | See [Quick Start](#-quick-start) | 2 min |
| **Docker** | Team sharing, consistent environments | [DOCKER-QUICKSTART.md](./DOCKER-QUICKSTART.md) | 2 min |
| **Docker Compose** | Local production testing | [DOCKER-QUICKSTART.md](./DOCKER-QUICKSTART.md) | 1 min |
| **Kubernetes** | Production deployment | [DEPLOYMENT.md](./DEPLOYMENT.md) | 15 min |
| **GKE** | Google Cloud production | [DEPLOYMENT.md](./DEPLOYMENT.md#gke-specific-deployment) | 30 min |

### Quick Commands (with Make)

```bash
# Docker
make compose-up          # Start with Docker Compose
make docker-build        # Build Docker image
make push               # Push to registry

# Kubernetes
make k8s-deploy         # Deploy to Kubernetes
make k8s-status         # Check deployment status
make k8s-logs          # View logs

# Development
make dev                # Start dev server
make typecheck          # Type check

# See all commands
make help
```

---

## 🏗️ Architecture Patterns

The visualizer includes 6 preset scenarios aligned with [EDOT reference architectures](https://www.elastic.co/docs/reference/opentelemetry/architecture):

### 1️⃣ Simple Pattern
**Direct SDK to Elastic connection. Best for getting started.**

```
[App + EDOT SDK] ──────▶ [Elastic Observability]
```

**When to use:**
- Quick prototyping and development
- Small applications with low volume
- Learning and experimentation

---

### 2️⃣ Agent Pattern
**SDK through per-host Collector. Adds infrastructure metrics.**

```
[App + EDOT SDK] ──────▶ [Collector Agent] ──────▶ [Elastic Observability]
                             ↑
                         hostmetrics
```

**When to use:**
- Production applications on VMs or bare metal
- Need host-level metrics (CPU, memory, disk, network)
- Want to decouple app from backend destination
- Buffer telemetry during outages

**Components:**
- Agent includes: OTLP receiver, hostmetrics receiver, batch processor, memory_limiter

---

### 3️⃣ Gateway Pattern
**Multiple services through centralized gateway. Enables sampling and transformation.**

```
[Frontend SDK] ─┐
[API SDK] ──────┼──▶ [Gateway Collector] ──────▶ [Elastic Observability]
[Worker SDK] ───┘        (tail_sampling)
```

**When to use:**
- Multiple services sending telemetry
- Need intelligent sampling decisions
- Want to reduce data volume
- Centralized transformation and enrichment

**Components:**
- Gateway includes: OTLP receiver, tail_sampling processor, transform processor

---

### 4️⃣ Production Pattern
**Full HA setup with agents and load-balanced gateways.**

```
[Service 1] → [Agent 1] ─┬─▶ [Gateway 1] ─┬─▶ [Elastic Observability]
[Service 2] → [Agent 2] ─┤                │
[Service 3] → [Agent 3] ─┼─▶ [Gateway 2] ─┘
[Service 4] → [Agent 4] ─┘
```

**When to use:**
- Production at scale (10+ services)
- High availability requirements
- Need load balancing and failover
- Compliance and data governance requirements

---

### 5️⃣ Docker Pattern
**Collectors deployed as Docker containers with network isolation.**

**When to use:**
- Docker-based deployments
- Need container-level isolation
- Want easy horizontal scaling
- Using Docker Compose for orchestration

**Export:**
- Generates full `docker-compose.yml` with networks, volumes, and environment variables

---

### 6️⃣ Kubernetes Pattern
**Collectors deployed as DaemonSets (agents) and Deployments (gateways) in K8s.**

**When to use:**
- Kubernetes deployments
- Need per-node agents (DaemonSets)
- Centralized gateways (Deployments)
- Auto-scaling and rolling updates

**Export:**
- Generates K8s manifests: DaemonSet, Deployment, ConfigMap, Service, RBAC

---

## 🎯 Key Features In-Depth

### Drag & Drop Components

Build your observability architecture visually:

1. **Drag from palette**: Choose from SDK, Collector, Infrastructure, or Elastic nodes
2. **Drop on canvas**: Place components anywhere
3. **Connect**: Drag from output handle (right) to input handle (left)
4. **Configure**: Click a node to open the configuration panel
5. **Validate**: See real-time validation warnings and suggestions

### Collector Component Display

Each Collector node shows its internal configuration:

- **📥 Receivers**: OTLP, Host Metrics, File Log, Prometheus
- **⚙️ Processors**: Memory Limiter, Batch, Tail Sampling, Transform, Filter
- **📤 Exporters**: Elastic, OTLP, Debug, File
- **Pipeline Order**: Visual indicator showing processing flow

Click any collector to toggle components on/off and see live YAML updates.

### Animated Telemetry Flow

Watch telemetry move through your pipeline:

- **🟠 Traces** - Amber particles
- **🔵 Metrics** - Blue particles
- **🟢 Logs** - Green particles

Particle count and speed reflect throughput volume in demo mode.

### Demo Mode

Click the ⚡ **Demo Mode** button to:
- Generate realistic traces, metrics, and logs
- See dynamic particle animations on edges
- Watch the Live Stats Panel update in real-time
- Understand data flow patterns

### Configuration Export

Generate production-ready configs with one click:

| Format | Contents | Use Case |
|--------|----------|----------|
| **YAML** | EDOT Collector configuration | Deploy to any environment |
| **Docker Compose** | Full Docker stack with networks | Quick local deployment |
| **Kubernetes Manifests** | DaemonSet, Deployment, ConfigMap, Service, RBAC | Production K8s deployment |

All exports include:
- Environment variable placeholders for secrets
- Best practice defaults (memory limits, batch sizes)
- Comments explaining key configuration choices

### Real-time Validation

Get instant feedback as you build:

- **❌ Errors**: Critical issues (e.g., disconnected nodes)
- **⚠️ Warnings**: Potential problems (e.g., missing processors)
- **💡 Suggestions**: Best practices (e.g., "Add tail_sampling for gateways")

Validation rules based on official EDOT documentation and production patterns.

### Infrastructure Context

Show where components run:

- **Host Nodes**: Physical or virtual machines
- **Docker Nodes**: Container runtime with network config
- **K8s Namespace Nodes**: Kubernetes namespace
- **K8s DaemonSet/Deployment**: Kubernetes workload types

Nest components inside infrastructure nodes to show deployment context (e.g., "Collector Agent in Docker on Host A").

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [Next.js](https://nextjs.org/) | 14.x | React framework with App Router, API routes |
| [React](https://react.dev/) | 18.x | UI component library |
| [TypeScript](https://www.typescriptlang.org/) | 5.x | Type safety and developer experience |
| [@xyflow/react](https://reactflow.dev/) | 12.x | Node-based diagram rendering |
| [Framer Motion](https://www.framer.com/motion/) | 11.x | Smooth particle animations |
| [Zustand](https://zustand-demo.pmnd.rs/) | 5.x | Lightweight state management |
| [Tailwind CSS](https://tailwindcss.com/) | 3.x | Utility-first styling |
| [@elastic/eui](https://elastic.github.io/eui/) | Latest | Elastic UI components |
| [yaml](https://www.npmjs.com/package/yaml) | 2.x | YAML config generation |

---

## 📁 Project Structure

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
│   │   │   │   ├── EDOTSDKNode.tsx
│   │   │   │   ├── CollectorNode.tsx
│   │   │   │   ├── ElasticNode.tsx
│   │   │   │   ├── HostNode.tsx
│   │   │   │   ├── DockerNode.tsx
│   │   │   │   ├── K8sNamespaceNode.tsx
│   │   │   │   ├── K8sDaemonSetNode.tsx
│   │   │   │   └── K8sDeploymentNode.tsx
│   │   │   ├── edges/
│   │   │   │   └── AnimatedEdge.tsx
│   │   │   └── panels/
│   │   │       ├── ComponentPalette.tsx
│   │   │       ├── ConfigExportPanel.tsx
│   │   │       ├── NodeConfigPanel.tsx
│   │   │       ├── ValidationPanel.tsx
│   │   │       ├── ControlPanel.tsx
│   │   │       ├── Legend.tsx
│   │   │       └── TelemetryStatsPanel.tsx
│   │   ├── store/
│   │   │   ├── flowStore.ts          # Topology state
│   │   │   └── telemetryStore.ts     # Live telemetry data
│   │   ├── lib/
│   │   │   ├── yaml-generator.ts
│   │   │   ├── docker-compose-generator.ts
│   │   │   ├── k8s-manifest-generator.ts
│   │   │   ├── connection-validator.ts
│   │   │   └── useTelemetryStream.ts
│   │   ├── data/
│   │   │   └── scenarios.ts          # Preset topologies
│   │   └── types.ts                  # TypeScript definitions
│   │
│   └── api/
│       ├── otlp/v1/                  # OTLP receiver endpoints
│       │   ├── traces/route.ts
│       │   ├── metrics/route.ts
│       │   └── logs/route.ts
│       └── telemetry/
│           ├── stream/route.ts       # SSE endpoint
│           └── demo/route.ts         # Demo mode control
│
├── lib/telemetry/
│   └── processor.ts                  # Telemetry aggregation
│
├── docs/                             # Documentation
│   └── images/                       # Screenshots and assets
│
├── public/
│   ├── favicon.svg
│   └── opentelemetry-logo.svg
│
├── CLAUDE.md                         # AI development context
├── CONTRIBUTING.md                   # Contribution guidelines
├── LICENSE                           # MIT License
├── README.md                         # This file
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

---

## 📖 Usage Guide

### Building Your First Topology

1. **Start with a scenario** (recommended for learning):
   - Use the scenario selector dropdown
   - Choose "Simple" or "Agent" pattern
   - Observe the components and connections

2. **Or start from scratch**:
   - Clear the canvas (click Reset)
   - Drag an SDK node from the palette
   - Drag a Collector or Elastic node
   - Connect them by dragging from the right handle to the left handle

3. **Configure components**:
   - Click any node to open the Node Config Panel
   - Toggle receivers, processors, exporters (for Collectors)
   - Change labels and service names (for SDKs)
   - See live YAML preview update

4. **Validate your topology**:
   - Check the Validation Panel for warnings
   - Follow suggestions for best practices
   - Ensure all nodes are connected

5. **Export your config**:
   - Click "Export Config" button
   - Choose YAML, Docker Compose, or K8s Manifests
   - Download or copy to clipboard

### Using Demo Mode

1. Click the **⚡ Demo Mode** button in the Control Panel
2. Watch particles animate along edges
3. Observe the Telemetry Stats Panel update
4. Particle density reflects throughput (more particles = higher volume)
5. Click again to pause/resume

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Z` | Undo (coming soon) |
| `Cmd/Ctrl + Shift + Z` | Redo (coming soon) |
| `Delete/Backspace` | Delete selected node (coming soon) |
| `Cmd/Ctrl + D` | Duplicate node (coming soon) |
| `+/-` | Zoom in/out |
| `0` | Fit view |

---

## 🎨 Customization

### Adding a New Node Type

1. **Create component** in `app/otel-flow/components/nodes/`:
   ```tsx
   // MyCustomNode.tsx
   import React from 'react';
   import { NodeProps } from '@xyflow/react';

   export default function MyCustomNode({ data, selected }: NodeProps) {
     return (
       <div className="custom-node">
         <h3>{data.label}</h3>
         {/* Your custom content */}
       </div>
     );
   }
   ```

2. **Register** in `app/otel-flow/components/nodes/index.ts`:
   ```tsx
   import MyCustomNode from './MyCustomNode';

   export const nodeTypes = {
     // ... existing types
     myCustom: MyCustomNode,
   };
   ```

3. **Add to palette** in `ComponentPalette.tsx`:
   ```tsx
   const paletteItems = [
     // ... existing items
     {
       type: 'myCustom',
       label: 'My Custom Node',
       icon: <IconComponent />,
       description: 'Does something custom',
     },
   ];
   ```

4. **Update types** in `types.ts`:
   ```tsx
   export interface MyCustomNodeData extends BaseNodeData {
     // Your custom data fields
   }
   ```

### Adding a New Scenario

Edit `app/otel-flow/data/scenarios.ts`:

```tsx
export const scenarios: Record<ScenarioId, Scenario> = {
  // ... existing scenarios
  myScenario: {
    id: 'myScenario',
    name: 'My Custom Scenario',
    description: 'Description of what this demonstrates',
    nodes: [
      {
        id: 'node1',
        type: 'edotSDK',
        position: { x: 100, y: 100 },
        data: { label: 'My App', language: 'nodejs' },
      },
      // ... more nodes
    ],
    edges: [
      {
        id: 'e1',
        source: 'node1',
        target: 'node2',
        animated: true,
      },
      // ... more edges
    ],
  },
};
```

### Customizing YAML Generation

Edit `app/otel-flow/lib/yaml-generator.ts`:

```tsx
export function generateCollectorConfig(node: CollectorNodeData): string {
  // Customize YAML structure
  // Add custom receivers, processors, exporters
  // Change defaults and best practices
}
```

---

## 🔧 Troubleshooting

### Common Issues

**Issue: Nodes won't connect**
- **Cause**: Connections are validated. Some connections are invalid (e.g., SDK to SDK).
- **Solution**: Check the Validation Panel for errors. Ensure you're connecting output (right) to input (left).

**Issue: Demo mode doesn't show particles**
- **Cause**: Need valid connections between nodes.
- **Solution**: Ensure all nodes are connected in a valid pipeline. Try loading a preset scenario first.

**Issue: Export shows "No collectors found"**
- **Cause**: No Collector nodes on canvas.
- **Solution**: Add at least one Collector node to generate YAML configs.

**Issue: TypeScript errors after adding custom node**
- **Cause**: Missing type definitions.
- **Solution**: Update `types.ts` with your custom node's data interface. Run `npm run typecheck`.

**Issue: Animations are laggy**
- **Cause**: Too many particles or complex topology.
- **Solution**: Reduce particle count in Demo Mode settings (coming soon) or simplify topology.

### Development Issues

**Port 3000 already in use:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

**Module not found errors:**
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
```

**Type errors:**
```bash
# Run type checker
npm run typecheck

# If issues persist, delete and regenerate .next
rm -rf .next
npm run dev
```

### Getting Help

- **Documentation**: Check [docs/](./docs/) for detailed guides
- **Issues**: [Open an issue](https://github.com/your-org/edot-flow-visualizer/issues) on GitHub
- **Discussions**: Join [GitHub Discussions](https://github.com/your-org/edot-flow-visualizer/discussions)
- **EDOT Docs**: Official [Elastic EDOT documentation](https://www.elastic.co/docs/reference/opentelemetry)

---

## 📚 Documentation

- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project
- **[Developer Guide](./docs/developer-guide.md)** - Architecture and development details (coming soon)
- **[User Guide](./docs/user-guide.md)** - Step-by-step tutorials (coming soon)
- **[EDOT Reference](./docs/edot-reference.md)** - EDOT components explained (coming soon)
- **[Deployment Guide](./docs/deployment.md)** - Production deployment (coming soon)

### External Resources

- [EDOT Documentation](https://www.elastic.co/docs/reference/opentelemetry) - Official Elastic EDOT docs
- [EDOT Collector](https://www.elastic.co/docs/reference/edot-collector) - Collector configuration
- [OpenTelemetry](https://opentelemetry.io/) - Official OTel docs
- [React Flow Docs](https://reactflow.dev/) - React Flow library docs

---

## 🤝 Contributing

We welcome contributions! Whether it's:

- 🐛 Bug reports and fixes
- ✨ New features or enhancements
- 📖 Documentation improvements
- 💡 Ideas and feature requests
- 🎨 UI/UX improvements

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development setup
- Code style guidelines
- Pull request process
- Community guidelines

### Quick Contribution Guide

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to your fork: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

---

## 🗺️ Roadmap

### Current Status (v0.1.0)

- ✅ Core visualization with drag-and-drop
- ✅ 6 preset scenarios
- ✅ Animated telemetry flow
- ✅ YAML/Docker/K8s config export
- ✅ Real-time validation
- ✅ Node configuration panel
- ✅ Infrastructure context (Host, Docker, K8s)

### Upcoming Features

#### v0.2.0 - User Experience
- [ ] Keyboard shortcuts (Delete, Undo/Redo)
- [ ] YAML import (visualize existing configs)
- [ ] Shareable URLs
- [ ] Export as PNG/SVG
- [ ] Dark/Light theme toggle

#### v0.3.0 - Advanced Configuration
- [ ] Processor drag-to-reorder
- [ ] Detailed processor configuration
- [ ] Environment variable management
- [ ] Helm values export
- [ ] Terraform export

#### v0.4.0 - Educational
- [ ] Interactive tutorials
- [ ] Component tooltips with explanations
- [ ] Best practices wizard
- [ ] Guided architecture recommendations
- [ ] Documentation links from nodes

#### v1.0.0 - Production Ready
- [ ] Real OTLP receiver mode
- [ ] Live collector health monitoring
- [ ] Trace sampling preview
- [ ] Multi-region topologies
- [ ] Template library

See [docs/roadmap.md](./docs/roadmap.md) for the complete roadmap (coming soon).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Elastic** for EDOT and excellent OpenTelemetry tooling
- **OpenTelemetry** community for standardizing observability
- **@xyflow/react** team for the amazing node-based diagram library
- All contributors who help improve this tool

---

## 📬 Contact

- **Issues**: [GitHub Issues](https://github.com/your-org/edot-flow-visualizer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/edot-flow-visualizer/discussions)
- **Twitter**: [@your_handle](https://twitter.com/your_handle)

---

**Built with 💚 for the OpenTelemetry community**

*Making observability architecture intuitive, one diagram at a time.*
