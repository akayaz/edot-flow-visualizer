# Contributing to EDOT Flow Visualizer

Thank you for your interest in contributing to EDOT Flow Visualizer! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Common Tasks](#common-tasks)
- [Getting Help](#getting-help)

---

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and considerate in all interactions.

**Expected Behavior:**
- Be respectful of differing viewpoints and experiences
- Give and gracefully accept constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

**Unacceptable Behavior:**
- Harassment, discrimination, or trolling
- Personal attacks or derogatory comments
- Publishing others' private information
- Any conduct that could reasonably be considered inappropriate

If you experience or witness unacceptable behavior, please report it by opening an issue or contacting the maintainers.

---

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **npm** 9.x or higher (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- A code editor (we recommend [VS Code](https://code.visualstudio.com/))
- Basic knowledge of React, TypeScript, and Next.js

### Recommended VS Code Extensions

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense

---

## Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/edot-flow-visualizer.git
   cd edot-flow-visualizer
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/edot-flow-visualizer.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Open your browser** to [http://localhost:3000](http://localhost:3000)

7. **Verify everything works**:
   - Navigate to `/otel-flow`
   - Load a preset scenario
   - Try demo mode
   - Export a configuration

---

## Project Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 14+ (App Router) | Server-side rendering, API routes |
| **UI** | React 18 + TypeScript | Type-safe component development |
| **Visualization** | @xyflow/react (React Flow v12) | Node-based diagram rendering |
| **Animation** | Framer Motion | Smooth particle animations |
| **State** | Zustand | Lightweight global state |
| **Styling** | Tailwind CSS + @elastic/eui | Utility-first styling + Elastic components |

### Key Concepts

#### 1. Nodes
Custom React components representing EDOT components:
- `EDOTSDKNode` - Language-specific SDKs
- `CollectorNode` - EDOT Collectors (Agent/Gateway)
- `ElasticNode` - Elastic Observability destination
- `HostNode`, `DockerNode`, `K8sNamespaceNode`, etc. - Infrastructure context

**Location**: `app/otel-flow/components/nodes/`

#### 2. Edges
Connections between nodes with animated particles:
- `AnimatedEdge` - Shows telemetry flowing (traces, metrics, logs)

**Location**: `app/otel-flow/components/edges/`

#### 3. Panels
UI panels for interaction:
- `ComponentPalette` - Drag source for new nodes
- `NodeConfigPanel` - Edit selected node configuration
- `ConfigExportPanel` - Export YAML/Docker/K8s configs
- `ValidationPanel` - Real-time validation feedback
- `TelemetryStatsPanel` - Live throughput statistics

**Location**: `app/otel-flow/components/panels/`

#### 4. State Management (Zustand)
Two stores manage application state:

**`flowStore`** (`app/otel-flow/store/flowStore.ts`):
- Nodes and edges (topology)
- Selected node
- Current scenario
- Reset key for canvas re-mounting

**`telemetryStore`** (`app/otel-flow/store/telemetryStore.ts`):
- Live telemetry events
- Throughput statistics
- Demo mode state

#### 5. Generators
Export logic for different formats:
- `yaml-generator.ts` - EDOT Collector YAML configs
- `docker-compose-generator.ts` - Docker Compose files
- `k8s-manifest-generator.ts` - Kubernetes manifests

**Location**: `app/otel-flow/lib/`

#### 6. Scenarios
Preset topologies demonstrating common patterns:
- Simple, Agent, Gateway, Production, Docker, Kubernetes

**Location**: `app/otel-flow/data/scenarios.ts`

### Directory Structure

```
app/otel-flow/
├── components/
│   ├── nodes/           # Custom node components
│   ├── edges/           # Custom edge components
│   ├── panels/          # UI panels
│   └── OtelFlowCanvas.tsx  # Main React Flow wrapper
├── store/
│   ├── flowStore.ts     # Topology state
│   └── telemetryStore.ts   # Telemetry state
├── lib/
│   ├── yaml-generator.ts
│   ├── docker-compose-generator.ts
│   ├── k8s-manifest-generator.ts
│   ├── connection-validator.ts
│   └── useTelemetryStream.ts
├── data/
│   └── scenarios.ts     # Preset topologies
├── types.ts             # TypeScript interfaces
└── page.tsx             # Main visualizer page
```

---

## How to Contribute

### Types of Contributions

We welcome various types of contributions:

#### 🐛 Bug Reports
Found a bug? Please open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Browser and OS information

#### ✨ Feature Requests
Have an idea? Open an issue describing:
- The problem it solves
- Proposed solution
- Alternative approaches considered
- Any relevant examples or mockups

#### 📖 Documentation
Improvements to docs are always welcome:
- Fix typos or clarify explanations
- Add examples or tutorials
- Improve code comments
- Write guides for common tasks

#### 🎨 Code Contributions
Ready to code? See the [Development Workflow](#development-workflow) section.

---

## Development Workflow

### 1. Create a Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test improvements

### 2. Make Changes

Write your code following our [Code Style Guidelines](#code-style-guidelines).

### 3. Test Your Changes

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Run development server
npm run dev
```

Manually test:
- Load each affected scenario
- Test interactions (drag-drop, connections, config)
- Verify exports (YAML, Docker, K8s)
- Check validation messages
- Test demo mode

### 4. Commit Your Changes

Write clear, descriptive commit messages:

```bash
git add .
git commit -m "feat: add keyboard shortcut for node deletion"
# or
git commit -m "fix: resolve animation lag with many particles"
# or
git commit -m "docs: improve contributing guide setup section"
```

**Commit message format**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation change
- `refactor:` - Code refactoring
- `test:` - Test additions or fixes
- `chore:` - Maintenance tasks

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub.

---

## Code Style Guidelines

### TypeScript

- **Always use TypeScript** - No `.js` or `.jsx` files
- **Enable strict mode** - Already configured in `tsconfig.json`
- **Define interfaces** in `types.ts` for shared types
- **Use type inference** where obvious
- **Avoid `any`** - Use `unknown` if type is truly unknown

Example:
```typescript
// Good
interface MyNodeData extends BaseNodeData {
  customField: string;
}

// Bad
interface MyNodeData {
  label: any;  // Don't use 'any'
}
```

### React Components

- **Use functional components** with hooks
- **Prefer named exports** for components
- **Use TypeScript props interfaces**
- **Memoize expensive computations** with `useMemo`
- **Memoize callbacks** with `useCallback` when passed to children

Example:
```typescript
import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';

interface MyNodeData {
  label: string;
  value: number;
}

export default memo(function MyNode({ data, selected }: NodeProps<MyNodeData>) {
  return (
    <div className="my-node">
      <h3>{data.label}</h3>
      <p>{data.value}</p>
    </div>
  );
});
```

### Styling

- **Use Tailwind utility classes** for styling
- **Follow Elastic design system** when using EUI components
- **Keep classes organized** (layout → spacing → colors → effects)
- **Extract repeated patterns** into components

Example:
```typescript
<div className="flex flex-col gap-2 p-4 bg-white rounded-lg shadow-md">
  {/* Layout → Spacing → Colors → Effects */}
</div>
```

### State Management

- **Use Zustand stores** for global state
- **Use React state** for local component state
- **Keep stores focused** - separate concerns (flow vs telemetry)
- **Use selectors** to prevent unnecessary re-renders

Example:
```typescript
// In component
const nodes = useFlowStore((state) => state.nodes);
const addNode = useFlowStore((state) => state.addNode);
```

### File Organization

- **One component per file**
- **Co-locate related files** (component + styles + tests)
- **Use index.ts** for clean exports
- **Keep files focused** - single responsibility

---

## Testing Guidelines

### Manual Testing Checklist

Before submitting a PR, test:

- [ ] Load each preset scenario
- [ ] Drag and drop new nodes
- [ ] Create connections between nodes
- [ ] Delete nodes (if implemented)
- [ ] Configure nodes via NodeConfigPanel
- [ ] Export YAML configuration
- [ ] Export Docker Compose (if applicable)
- [ ] Export K8s manifests (if applicable)
- [ ] Enable Demo Mode
- [ ] Observe particle animations
- [ ] Check validation panel messages
- [ ] Verify no console errors
- [ ] Test on different screen sizes
- [ ] Test in different browsers (Chrome, Firefox, Safari)

### Type Checking

Always run type checker before committing:

```bash
npm run typecheck
```

Fix any TypeScript errors.

### Linting

Check code style:

```bash
npm run lint
```

Auto-fix issues when possible:

```bash
npm run lint -- --fix
```

---

## Pull Request Process

### Before Submitting

1. **Sync with upstream** to avoid conflicts:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run checks**:
   ```bash
   npm run typecheck
   npm run lint
   ```

3. **Test manually** (see checklist above)

4. **Write clear PR description** (see template below)

### PR Title Format

Use conventional commit format:
- `feat: Add keyboard shortcuts for node deletion`
- `fix: Resolve particle animation performance issue`
- `docs: Improve README quick start section`

### PR Description Template

```markdown
## Description
Brief summary of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Other (please describe)

## Motivation
Why is this change needed? What problem does it solve?

## Changes Made
- List key changes
- Include file paths if helpful

## Testing
How was this tested?
- [ ] Manual testing (describe scenarios)
- [ ] Type checking passed
- [ ] Linting passed

## Screenshots (if applicable)
Add screenshots or GIFs showing the change.

## Related Issues
Closes #123
Related to #456

## Checklist
- [ ] Code follows project style guidelines
- [ ] TypeScript types are properly defined
- [ ] Comments added for complex logic
- [ ] Documentation updated (if needed)
- [ ] No console warnings or errors
```

### Review Process

1. **Maintainers review** your PR
2. **Address feedback** by pushing new commits
3. **Once approved**, maintainers will merge

**Be patient** - reviews may take a few days. Feel free to ping after a week if no response.

---

## Common Tasks

### Adding a New Node Type

1. **Create the component** in `app/otel-flow/components/nodes/`:

```typescript
// MyCustomNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

interface MyCustomNodeData {
  label: string;
  customField?: string;
}

export default memo(function MyCustomNode({ data, selected }: NodeProps<MyCustomNodeData>) {
  return (
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-content">
        <h3>{data.label}</h3>
        {data.customField && <p>{data.customField}</p>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
```

2. **Register in `nodes/index.ts`**:

```typescript
import MyCustomNode from './MyCustomNode';

export const nodeTypes = {
  // ... existing types
  myCustom: MyCustomNode,
};
```

3. **Add TypeScript types** in `types.ts`:

```typescript
export interface MyCustomNodeData extends BaseNodeData {
  customField?: string;
}
```

4. **Add to palette** in `ComponentPalette.tsx`:

```typescript
const paletteItems = [
  // ... existing items
  {
    type: 'myCustom',
    label: 'My Custom Node',
    icon: <IconComponent />,
    description: 'Brief description',
    category: 'Custom', // or existing category
  },
];
```

### Adding a New Scenario

Edit `app/otel-flow/data/scenarios.ts`:

```typescript
export const scenarios: Record<ScenarioId, Scenario> = {
  // ... existing scenarios
  myScenario: {
    id: 'myScenario',
    name: 'My Scenario Name',
    description: 'What this demonstrates',
    nodes: [
      {
        id: 'node1',
        type: 'edotSDK',
        position: { x: 100, y: 100 },
        data: {
          label: 'My App',
          language: 'nodejs',
          serviceName: 'my-service',
        },
      },
      {
        id: 'node2',
        type: 'collector',
        position: { x: 400, y: 100 },
        data: {
          label: 'EDOT Collector',
          mode: 'agent',
          receivers: ['otlp', 'hostmetrics'],
          processors: ['memory_limiter', 'batch'],
          exporters: ['otlp/elastic'],
        },
      },
      // ... more nodes
    ],
    edges: [
      {
        id: 'e1',
        source: 'node1',
        target: 'node2',
        animated: true,
        type: 'custom',
      },
      // ... more edges
    ],
  },
};
```

Then add to scenario selector in `DeploymentSelector.tsx` or similar component.

### Modifying YAML Export

Edit `app/otel-flow/lib/yaml-generator.ts`:

```typescript
export function generateCollectorConfig(node: CollectorNodeData): string {
  // Build receivers object
  const receivers = buildReceivers(node.receivers || []);

  // Build processors array (order matters!)
  const processors = buildProcessors(node.processors || []);

  // Build exporters object
  const exporters = buildExporters(node.exporters || []);

  // Generate YAML
  return YAML.stringify({
    receivers,
    processors,
    exporters,
    service: {
      pipelines: {
        traces: {
          receivers: ['otlp'],
          processors: processors.map(p => p.name),
          exporters: ['otlp/elastic'],
        },
        // ... metrics and logs
      },
    },
  });
}
```

### Adding Validation Rules

Edit `app/otel-flow/lib/connection-validator.ts`:

```typescript
export function validateTopology(nodes: Node[], edges: Edge[]): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Add your validation logic
  nodes.forEach(node => {
    if (node.type === 'collector') {
      const data = node.data as CollectorNodeData;

      // Example: Check if memory_limiter is first processor
      if (data.processors && data.processors.length > 0) {
        if (data.processors[0] !== 'memory_limiter') {
          results.push({
            type: 'warning',
            message: 'memory_limiter should be the first processor',
            nodeId: node.id,
            suggestion: 'Move memory_limiter to the beginning of processors list',
          });
        }
      }
    }
  });

  return results;
}
```

---

## Getting Help

### Resources

- **Documentation**: [docs/](./docs/) directory
- **EDOT Docs**: [https://www.elastic.co/docs/reference/opentelemetry](https://www.elastic.co/docs/reference/opentelemetry)
- **React Flow Docs**: [https://reactflow.dev/](https://reactflow.dev/)
- **CLAUDE.md**: Internal development context and architecture

### Asking Questions

- **GitHub Discussions**: For general questions and ideas
- **GitHub Issues**: For bugs and specific problems
- **PR Comments**: For questions about specific code

When asking for help:
1. Describe what you're trying to do
2. Show what you've tried
3. Include error messages (full stack traces)
4. Mention your environment (OS, Node version, browser)

---

## Recognition

All contributors will be recognized in:
- GitHub contributors page
- Future CHANGELOG entries
- Project documentation (if significant contribution)

Thank you for contributing to EDOT Flow Visualizer! 🎉

---

**Questions?** Open an issue or start a discussion. We're here to help!
