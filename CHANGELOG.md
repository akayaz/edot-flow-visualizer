# Changelog

All notable changes to the EDOT Flow Visualizer project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Keyboard shortcuts (Delete key for node deletion)
- Undo/Redo support
- YAML import (visualize existing configs)
- Shareable URLs (encode topology in URL)
- Export as PNG/SVG images
- Processor drag-to-reorder in NodeConfigPanel

---

## [0.1.0] - 2024-12-XX (Current Release)

### Added

#### Core Visualization
- **Interactive Canvas**: Drag-and-drop node-based diagram builder using @xyflow/react
- **Component Types**:
  - EDOT SDK nodes (Node.js, Python, Java, .NET, Go, PHP, Ruby, Android, iOS)
  - Collector nodes (Agent and Gateway modes)
  - Elastic Observability destination nodes
  - Infrastructure nodes (Host, Docker, Kubernetes Namespace, DaemonSet, Deployment)
- **Animated Data Flow**: Framer Motion-powered particle animations showing telemetry flow
  - Amber particles for traces
  - Blue particles for metrics
  - Green particles for logs
- **6 Preset Scenarios**:
  - Simple (SDK → Elastic)
  - Agent (SDK → Collector Agent → Elastic)
  - Gateway (Multiple SDKs → Gateway → Elastic)
  - Production (Complex HA setup with agents and gateways)
  - Docker (Container-based deployment)
  - Kubernetes (DaemonSet and Deployment patterns)

#### Configuration & Export
- **Node Configuration Panel**: Real-time editing of component configurations
  - SDK: Language, service name, auto-instrumentation toggle
  - Collector: Receivers, processors, exporters (toggle on/off)
  - Elastic: Features selection (APM, logs, metrics, profiling)
- **Live YAML Preview**: Configuration updates reflected instantly
- **Multiple Export Formats**:
  - **YAML**: Production-ready EDOT Collector configurations
  - **Docker Compose**: Full container stack with networks and volumes
  - **Kubernetes Manifests**: DaemonSet, Deployment, ConfigMap, Service, RBAC
- **Environment Variable Support**: All exports use env vars for secrets (no hardcoded credentials)

#### Validation & Feedback
- **Real-time Validation System**:
  - Connection validation (prevent invalid connections)
  - Topology validation (disconnected nodes, missing components)
  - Configuration validation (processor order, best practices)
- **Validation Panel**: Shows errors, warnings, and suggestions
  - ❌ Errors: Critical issues that must be fixed
  - ⚠️ Warnings: Potential problems
  - 💡 Suggestions: Best practice recommendations
- **Best Practices Enforcement**:
  - Memory limiter processor must be first
  - Batch processor should be last
  - Tail sampling only for gateways
  - Architecture recommendations based on deployment model

#### User Experience
- **Demo Mode**: Generate synthetic telemetry to visualize data flow
  - Toggle on/off with ⚡ button
  - Real-time particle animations
  - Live throughput statistics
- **Telemetry Stats Panel**: Shows events/sec per telemetry type and component
- **Component Palette**: Organized drag sources for all node types
- **Control Panel**: Scenario selector, zoom controls, reset button
- **Legend**: Explains telemetry types and their colors
- **Responsive Zoom**: Fit view, zoom in/out controls

#### Infrastructure Context
- **Parent-Child Node Relationships**: Show deployment context
  - Place collectors inside Host nodes
  - Nest collectors in Docker containers
  - Deploy collectors in Kubernetes namespaces
- **Nested Rendering**: Infrastructure nodes act as containers
- **Deployment Context**: Visual indication of where components run

#### State Management
- **Zustand Stores**:
  - `flowStore`: Topology state (nodes, edges, scenario)
  - `telemetryStore`: Live telemetry data and demo mode state
- **LocalStorage Persistence**: Topology state persists across sessions
- **Reset Functionality**: Reset to original scenario with canvas re-mount

#### Technical Foundation
- **Next.js 14** with App Router
- **TypeScript** throughout for type safety
- **React 18** with modern hooks
- **Tailwind CSS** for styling
- **@elastic/eui** for Elastic UI components
- **@xyflow/react 12** for node-based diagrams
- **Framer Motion 11** for animations
- **Zustand 5** for state management

### Fixed
- **Reset Button Issue**: Fixed canvas not fully resetting by adding `resetKey` state that increments on reset, forcing React Flow to re-mount completely

### Documentation
- Initial README.md with project overview
- Basic installation and usage instructions
- Architecture patterns documentation
- CLAUDE.md for AI development context

---

## Version History

### Version Numbering

We use [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backward-compatible manner
- **PATCH** version for backward-compatible bug fixes

### Upcoming Versions (Roadmap)

#### v0.2.0 - User Experience Enhancements
**Planned Features**:
- Keyboard shortcuts (Delete, Undo, Redo, Duplicate)
- YAML import (parse and visualize existing configs)
- Shareable URLs (encode topology in URL parameters)
- Export as PNG/SVG for documentation
- Dark/Light theme toggle
- Improved mobile responsiveness

**Target**: Q1 2025

#### v0.3.0 - Advanced Configuration
**Planned Features**:
- Processor drag-to-reorder interface
- Detailed processor configuration (parameters, thresholds)
- Environment variable management UI
- Helm values export for Kubernetes
- Terraform export for infrastructure as code
- Configuration templates library

**Target**: Q2 2025

#### v0.4.0 - Educational Features
**Planned Features**:
- Interactive tutorial overlays
- Component tooltips with detailed explanations
- Best practices wizard (guided recommendations)
- Architecture decision helper
- Direct links to Elastic documentation from nodes
- Video tutorials integration

**Target**: Q3 2025

#### v1.0.0 - Production Ready
**Planned Features**:
- Real OTLP receiver mode (accept actual telemetry)
- Live collector health monitoring
- Trace sampling preview (show what gets sampled/dropped)
- Multi-region topology support
- Template library (community-contributed topologies)
- Performance benchmarking tools

**Target**: Q4 2025

---

## Migration Guides

### Migrating from Pre-release to v0.1.0

No migration needed - first official release.

---

## Breaking Changes

### v0.1.0
- Initial release - no breaking changes

---

## Contributors

Thank you to all the contributors who helped build EDOT Flow Visualizer!

<!--
Add contributors here as the project grows:
- [@username](https://github.com/username) - Feature description
-->

---

## Notes

### How to Report Issues

If you encounter a bug or have a feature request:
1. Check [existing issues](https://github.com/your-org/edot-flow-visualizer/issues)
2. If not found, [create a new issue](https://github.com/your-org/edot-flow-visualizer/issues/new)
3. Use the appropriate issue template (bug report, feature request)
4. Provide detailed information and steps to reproduce

### Changelog Maintenance

- This changelog is manually updated with each release
- Unreleased changes are tracked in the [Unreleased] section
- On release, [Unreleased] items move to the new version section
- Follow [Keep a Changelog](https://keepachangelog.com/) format

### Versioning Policy

- We follow [Semantic Versioning](https://semver.org/)
- Pre-1.0 versions (0.x.x) may have breaking changes in minor versions
- Post-1.0 versions guarantee backward compatibility in minor/patch versions
- Breaking changes will be clearly documented with migration guides

---

**Legend**:
- `Added` - New features
- `Changed` - Changes to existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security fixes

---

For the complete roadmap, see [docs/roadmap.md](./docs/roadmap.md) (coming soon).

For detailed release notes and upgrade guides, check the [Releases page](https://github.com/your-org/edot-flow-visualizer/releases).
