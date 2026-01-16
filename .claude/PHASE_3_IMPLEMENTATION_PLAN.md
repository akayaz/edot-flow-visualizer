# Phase 3: Infrastructure Context - Implementation Plan

## Overview
Add infrastructure context (Host, Docker, Kubernetes) to the EDOT Flow Visualizer to show WHERE components run. This is critical for understanding Agent vs Gateway deployment patterns.

## Goals
1. Allow users to visually place EDOT components within infrastructure containers
2. Support parent-child relationships (Host contains SDK apps + Collectors)
3. Generate infrastructure-aware deployment configs (Docker Compose, K8s manifests)
4. Maintain visual clarity with nested node rendering

## Architecture Analysis Summary

### Current State
- **No parent-child relationships** - All nodes are peers
- **4 node types**: EDOTSDKNode, CollectorNode, ElasticNode (+ AnimatedEdge)
- **Type system**: Uses discriminated unions with BaseNodeData
- **Registration**: nodeTypes object in nodes/index.ts
- **Palette**: Drag-and-drop from ComponentPalette.tsx
- **YAML generation**: Single collector config only (no topology analysis)

### React Flow Parent-Child Support
React Flow DOES support nested nodes via:
- `parentNode: 'parent-id'` field on child nodes
- `extent: 'parent'` to constrain child movement
- Explicit `width` and `height` on parent nodes
- Child positions are RELATIVE to parent

## Implementation Steps

### Step 1: Extend Type System (types.ts)

**New component types** (simplified to 5 infrastructure types):
```typescript
export type InfrastructureComponentType =
  | 'infrastructure-host'
  | 'infrastructure-docker'
  | 'infrastructure-k8s-namespace'
  | 'infrastructure-k8s-daemonset'
  | 'infrastructure-k8s-deployment';

export type EDOTComponentType =
  | 'edot-sdk'
  | 'collector-agent'
  | 'collector-gateway'
  | 'elastic-apm'
  | InfrastructureComponentType;
```

**New data interfaces**:
```typescript
export interface HostNodeData extends BaseNodeData {
  componentType: 'infrastructure-host';
  hostname: string;
  os: 'linux' | 'windows' | 'darwin';
  ipAddress?: string;
}

export interface DockerNodeData extends BaseNodeData {
  componentType: 'infrastructure-docker';
  containerName: string;
  imageName: string;
  imageTag: string;
  networkMode?: 'bridge' | 'host' | 'overlay';
  ports?: { host: number; container: number }[];
  environment?: Record<string, string>;
}

export interface K8sNamespaceNodeData extends BaseNodeData {
  componentType: 'infrastructure-k8s-namespace';
  name: string;
  labels?: Record<string, string>;
}

export interface K8sDaemonSetNodeData extends BaseNodeData {
  componentType: 'infrastructure-k8s-daemonset';
  name: string;
  namespace: string;
  nodeSelector?: Record<string, string>;
}

export interface K8sDeploymentNodeData extends BaseNodeData {
  componentType: 'infrastructure-k8s-deployment';
  name: string;
  namespace: string;
  replicas: number;
  resources?: {
    cpu: string;
    memory: string;
  };
}

export type InfrastructureNodeData =
  | HostNodeData
  | DockerNodeData
  | K8sNamespaceNodeData
  | K8sDaemonSetNodeData
  | K8sDeploymentNodeData;

export type EDOTNodeData =
  | SDKNodeData
  | CollectorNodeData
  | ElasticNodeData
  | InfrastructureNodeData;
```

**Files**: `app/otel-flow/types.ts`

---

### Step 2: Create Infrastructure Node Components

**Create 5 infrastructure components**:

#### 2.1 HostNode.tsx
```typescript
'use client';
import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Server } from 'lucide-react';
import type { HostNodeData } from '../../types';

export const HostNode = memo(({ data, selected }: NodeProps<HostNodeData>) => {
  const borderColor = '#f59e0b'; // Amber

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`
        relative px-4 py-3 rounded-xl bg-gray-900/70 backdrop-blur
        border-2 border-dashed min-w-[500px] min-h-[350px]
        ${selected ? 'ring-2 ring-blue-400/50' : ''}
      `}
      style={{ borderColor }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Server size={20} style={{ color: borderColor }} />
        <div>
          <div className="text-sm font-semibold text-white">{data.label}</div>
          <div className="text-xs text-gray-400">{data.hostname}</div>
        </div>
      </div>

      {/* OS Badge */}
      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-xs">
        {data.os.toUpperCase()}
      </div>

      {/* Container area for children */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        Drag EDOT components here
      </div>

      {/* No handles - children handle connections */}
    </motion.div>
  );
});

HostNode.displayName = 'HostNode';
```

#### 2.2 DockerNode.tsx
Similar structure, with Docker whale icon, container name, image info

#### 2.3 K8sNamespaceNode.tsx
Large container for grouping K8s resources, namespace label

#### 2.4 K8sDaemonSetNode.tsx
Container for EDOT agents, shows DaemonSet name and node selector

#### 2.5 K8sDeploymentNode.tsx
Container for EDOT gateways, shows replica count and resources

**Key differences from existing nodes**:
- **Dashed border** to indicate container
- **Semi-transparent background** to show children
- **Larger min dimensions** (500x350px)
- **No handles** (children have handles instead)
- **Container hint text** when empty

**Files**:
- `app/otel-flow/components/nodes/HostNode.tsx`
- `app/otel-flow/components/nodes/DockerNode.tsx`
- `app/otel-flow/components/nodes/K8sNamespaceNode.tsx`
- `app/otel-flow/components/nodes/K8sDaemonSetNode.tsx`
- `app/otel-flow/components/nodes/K8sDeploymentNode.tsx`

---

### Step 3: Register Node Types

Update `nodes/index.ts`:
```typescript
import { EDOTSDKNode } from './EDOTSDKNode';
import { CollectorNode } from './CollectorNode';
import { ElasticNode } from './ElasticNode';
import { HostNode } from './HostNode';
import { DockerNode } from './DockerNode';
import { K8sNamespaceNode } from './K8sNamespaceNode';
import { K8sDaemonSetNode } from './K8sDaemonSetNode';
import { K8sDeploymentNode } from './K8sDeploymentNode';

export const nodeTypes = {
  edotSdk: EDOTSDKNode,
  collector: CollectorNode,
  elasticApm: ElasticNode,
  host: HostNode,
  docker: DockerNode,
  k8sNamespace: K8sNamespaceNode,
  k8sDaemonSet: K8sDaemonSetNode,
  k8sDeployment: K8sDeploymentNode,
};

export {
  EDOTSDKNode,
  CollectorNode,
  ElasticNode,
  HostNode,
  DockerNode,
  K8sNamespaceNode,
  K8sDaemonSetNode,
  K8sDeploymentNode,
};
```

**Files**: `app/otel-flow/components/nodes/index.ts`

---

### Step 4: Add to Component Palette

Update `ComponentPalette.tsx`:

```typescript
const paletteItems: PaletteItem[] = [
  // Existing items...
  {
    type: 'edot-sdk',
    label: 'EDOT SDK',
    icon: '📦',
    description: 'Instrumented application',
    defaultData: { /* ... */ },
  },
  // ... existing collector, elastic

  // NEW: Infrastructure section
  {
    type: 'infrastructure-host',
    label: 'Host',
    icon: '🖥️',
    description: 'Physical or virtual machine',
    defaultData: {
      componentType: 'infrastructure-host',
      hostname: 'host-01',
      os: 'linux',
    },
  },
  {
    type: 'infrastructure-docker',
    label: 'Docker Container',
    icon: '🐳',
    description: 'Docker container runtime',
    defaultData: {
      componentType: 'infrastructure-docker',
      containerName: 'my-container',
      imageName: 'my-app',
      imageTag: 'latest',
    },
  },
  {
    type: 'infrastructure-k8s-namespace',
    label: 'K8s Namespace',
    icon: '🏷️',
    description: 'Kubernetes Namespace',
    defaultData: {
      componentType: 'infrastructure-k8s-namespace',
      name: 'observability',
    },
  },
  {
    type: 'infrastructure-k8s-daemonset',
    label: 'K8s DaemonSet',
    icon: '📡',
    description: 'Kubernetes DaemonSet (for EDOT agents)',
    defaultData: {
      componentType: 'infrastructure-k8s-daemonset',
      name: 'edot-agent',
      namespace: 'observability',
    },
  },
  {
    type: 'infrastructure-k8s-deployment',
    label: 'K8s Deployment',
    icon: '🌐',
    description: 'Kubernetes Deployment (for EDOT gateways)',
    defaultData: {
      componentType: 'infrastructure-k8s-deployment',
      name: 'edot-gateway',
      namespace: 'observability',
      replicas: 3,
    },
  },
];
```

Update type mapping in `onDrop`:
```typescript
const nodeType =
  item.type === 'edot-sdk' ? 'edotSdk' :
  item.type === 'elastic-apm' ? 'elasticApm' :
  item.type === 'infrastructure-host' ? 'host' :
  item.type === 'infrastructure-docker' ? 'docker' :
  item.type === 'infrastructure-k8s-namespace' ? 'k8sNamespace' :
  item.type === 'infrastructure-k8s-daemonset' ? 'k8sDaemonSet' :
  item.type === 'infrastructure-k8s-deployment' ? 'k8sDeployment' :
  'collector';
```

**Optional**: Add collapsible section headers for "EDOT Components" vs "Infrastructure"

**Files**: `app/otel-flow/components/panels/ComponentPalette.tsx`

---

### Step 5: Create Infrastructure-Aware Scenario

Add new scenario to `scenarios.ts`:

```typescript
// K8s Production with Infrastructure
const k8sInfraNodes: Node<EDOTNodeData>[] = [
  // Namespace container
  {
    id: 'ns-observability',
    type: 'k8sNamespace',
    position: { x: 50, y: 50 },
    style: { width: 900, height: 600 },
    data: {
      label: 'observability',
      componentType: 'infrastructure-k8s-namespace',
      name: 'observability',
    },
  },

  // DaemonSet container (inside namespace)
  {
    id: 'daemonset-agent',
    type: 'k8sDaemonSet',
    position: { x: 50, y: 100 }, // Relative to namespace
    parentNode: 'ns-observability',
    extent: 'parent',
    style: { width: 400, height: 200 },
    data: {
      label: 'EDOT Agent DaemonSet',
      componentType: 'infrastructure-k8s-daemonset',
      name: 'edot-agent',
      namespace: 'observability',
    },
  },

  // Collector inside DaemonSet
  {
    id: 'collector-agent-1',
    type: 'collector',
    position: { x: 50, y: 50 }, // Relative to DaemonSet
    parentNode: 'daemonset-agent',
    extent: 'parent',
    data: {
      label: 'Agent',
      componentType: 'collector-agent',
      config: agentCollectorConfig,
    },
  },

  // Deployment container
  {
    id: 'deployment-gateway',
    type: 'k8sDeployment',
    position: { x: 500, y: 100 },
    parentNode: 'ns-observability',
    extent: 'parent',
    style: { width: 350, height: 250 },
    data: {
      label: 'EDOT Gateway Deployment',
      componentType: 'infrastructure-k8s-deployment',
      name: 'edot-gateway',
      namespace: 'observability',
      replicas: 3,
    },
  },

  // Gateway collectors inside Deployment
  {
    id: 'collector-gateway-1',
    type: 'collector',
    position: { x: 50, y: 60 },
    parentNode: 'deployment-gateway',
    extent: 'parent',
    data: {
      label: 'Gateway 1',
      componentType: 'collector-gateway',
      config: gatewayCollectorConfig,
    },
  },
  // ... more gateway replicas

  // Elastic (outside namespace)
  {
    id: 'elastic-1',
    type: 'elasticApm',
    position: { x: 1000, y: 300 },
    data: { /* ... */ },
  },
];

const k8sInfraEdges: Edge<FlowEdgeData>[] = [
  // Agent to Gateway
  {
    id: 'e-agent-gw',
    source: 'collector-agent-1',
    target: 'collector-gateway-1',
    type: 'animated',
    data: { /* ... */ },
  },
  // Gateway to Elastic
  {
    id: 'e-gw-elastic',
    source: 'collector-gateway-1',
    target: 'elastic-1',
    type: 'animated',
    data: { /* ... */ },
  },
];

export const scenarios: Record<ScenarioId, Scenario> = {
  // ... existing scenarios
  k8sInfra: {
    id: 'k8sInfra',
    name: 'K8s Infrastructure',
    description: 'Kubernetes deployment with DaemonSet agents and Gateway deployment',
    icon: '☸️',
    nodes: k8sInfraNodes,
    edges: k8sInfraEdges,
  },
};
```

**Files**: `app/otel-flow/data/scenarios.ts`, `app/otel-flow/types.ts` (add ScenarioId)

---

### Step 6: Update Store for Parent-Child Operations

Add optional helper action in `flowStore.ts`:

```typescript
interface FlowStore {
  // ... existing

  // NEW: Add child node to parent
  addChildNode: (parentId: string, childNode: Node<EDOTNodeData>) => void;
}

// Implementation
addChildNode: (parentId, childNode) => {
  const parent = get().nodes.find(n => n.id === parentId);
  if (!parent) return;

  const nodeWithParent = {
    ...childNode,
    parentNode: parentId,
    extent: 'parent' as const,
    // Position relative to parent
    position: childNode.position || { x: 50, y: 50 },
  };

  set({
    nodes: [...get().nodes, nodeWithParent],
    scenario: 'custom',
  });
},
```

**Optional enhancement**: Validate parent-child relationships (e.g., SDK can only be child of Host/Docker/Pod)

**Files**: `app/otel-flow/store/flowStore.ts`

---

### Step 7: Docker Compose Generator

Create new file `lib/docker-compose-generator.ts`:

```typescript
import type { Node, Edge } from '@xyflow/react';
import type { EDOTNodeData, FlowEdgeData } from '../types';

interface DockerComposeService {
  image: string;
  container_name: string;
  environment?: Record<string, string>;
  ports?: string[];
  volumes?: string[];
  networks: string[];
  depends_on?: string[];
}

interface DockerCompose {
  version: string;
  networks: Record<string, { driver: string }>;
  services: Record<string, DockerComposeService>;
  volumes?: Record<string, unknown>;
}

export function generateDockerCompose(
  nodes: Node<EDOTNodeData>[],
  edges: Edge<FlowEdgeData>[]
): { yaml: string; envFile: string } {
  const compose: DockerCompose = {
    version: '3.8',
    networks: {
      'otel-network': { driver: 'bridge' },
    },
    services: {},
  };

  // Find all collectors
  const collectors = nodes.filter(
    n => n.data.componentType === 'collector-agent' ||
         n.data.componentType === 'collector-gateway'
  );

  // Generate collector services
  collectors.forEach(collector => {
    const serviceName = collector.id.replace('collector-', '');
    compose.services[serviceName] = {
      image: 'docker.elastic.co/observability/elastic-otel-collector:latest',
      container_name: serviceName,
      volumes: [`./${serviceName}-config.yaml:/etc/otelcol/config.yaml`],
      ports: ['4317:4317', '4318:4318', '13133:13133'],
      environment: {
        ELASTICSEARCH_ENDPOINT: '${ELASTICSEARCH_ENDPOINT}',
        ELASTICSEARCH_API_KEY: '${ELASTICSEARCH_API_KEY}',
        STORAGE_DIR: '/var/lib/otelcol',
        DEPLOYMENT_ENVIRONMENT: 'production',
      },
      networks: ['otel-network'],
    };
  });

  // Generate YAML string
  const yaml = `# Generated Docker Compose for EDOT Flow
version: "${compose.version}"

networks:
${Object.keys(compose.networks).map(net => `  ${net}:\n    driver: bridge`).join('\n')}

services:
${Object.entries(compose.services).map(([name, svc]) => `
  ${name}:
    image: ${svc.image}
    container_name: ${svc.container_name}
    ${svc.ports ? `ports:\n${svc.ports.map(p => `      - "${p}"`).join('\n')}` : ''}
    ${svc.volumes ? `volumes:\n${svc.volumes.map(v => `      - ${v}`).join('\n')}` : ''}
    ${svc.environment ? `environment:\n${Object.entries(svc.environment).map(([k,v]) => `      - ${k}=${v}`).join('\n')}` : ''}
    networks:
${svc.networks.map(n => `      - ${n}`).join('\n')}
`).join('')}
`;

  const envFile = `# Environment variables for EDOT Docker Compose
ELASTICSEARCH_ENDPOINT=https://your-cluster.es.cloud:443
ELASTICSEARCH_API_KEY=your-api-key-here
`;

  return { yaml, envFile };
}
```

**Files**: `app/otel-flow/lib/docker-compose-generator.ts`

---

### Step 8: K8s Manifest Generator

Create new file `lib/k8s-manifest-generator.ts`:

```typescript
import type { Node, Edge } from '@xyflow/react';
import type { EDOTNodeData, FlowEdgeData, K8sDaemonSetNodeData, K8sDeploymentNodeData } from '../types';
import { generateCollectorYAML } from './yaml-generator';

export function generateK8sManifests(
  nodes: Node<EDOTNodeData>[],
  edges: Edge<FlowEdgeData>[]
): string {
  const manifests: string[] = [];

  // 1. Namespace
  manifests.push(`---
apiVersion: v1
kind: Namespace
metadata:
  name: observability`);

  // 2. DaemonSets (agents)
  const daemonSets = nodes.filter(n => n.data.componentType === 'infrastructure-k8s-daemonset');
  daemonSets.forEach(ds => {
    const data = ds.data as K8sDaemonSetNodeData;

    // Find collector child
    const collectorChild = nodes.find(n => n.parentNode === ds.id);
    if (!collectorChild) return;

    const collectorYAML = generateCollectorYAML(collectorChild.data as any);

    manifests.push(`---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${data.name}-config
  namespace: ${data.namespace}
data:
  config.yaml: |
${collectorYAML.split('\n').map(line => '    ' + line).join('\n')}`);

    manifests.push(`---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: ${data.name}
  namespace: ${data.namespace}
spec:
  selector:
    matchLabels:
      app: ${data.name}
  template:
    metadata:
      labels:
        app: ${data.name}
    spec:
      containers:
      - name: otel-collector
        image: docker.elastic.co/observability/elastic-otel-collector:latest
        volumeMounts:
        - name: config
          mountPath: /etc/otelcol
        env:
        - name: ELASTICSEARCH_ENDPOINT
          valueFrom:
            secretKeyRef:
              name: elastic-credentials
              key: endpoint
        - name: ELASTICSEARCH_API_KEY
          valueFrom:
            secretKeyRef:
              name: elastic-credentials
              key: api-key
      volumes:
      - name: config
        configMap:
          name: ${data.name}-config`);
  });

  // 3. Deployments (gateways)
  const deployments = nodes.filter(n => n.data.componentType === 'infrastructure-k8s-deployment');
  deployments.forEach(dep => {
    const data = dep.data as K8sDeploymentNodeData;

    const collectorChild = nodes.find(n => n.parentNode === dep.id);
    if (!collectorChild) return;

    const collectorYAML = generateCollectorYAML(collectorChild.data as any);

    manifests.push(`---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${data.name}-config
  namespace: ${data.namespace}
data:
  config.yaml: |
${collectorYAML.split('\n').map(line => '    ' + line).join('\n')}`);

    manifests.push(`---
apiVersion: v1
kind: Service
metadata:
  name: ${data.name}
  namespace: ${data.namespace}
spec:
  selector:
    app: ${data.name}
  ports:
  - name: otlp-grpc
    port: 4317
    targetPort: 4317
  - name: otlp-http
    port: 4318
    targetPort: 4318`);

    manifests.push(`---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${data.name}
  namespace: ${data.namespace}
spec:
  replicas: ${data.replicas || 3}
  selector:
    matchLabels:
      app: ${data.name}
  template:
    metadata:
      labels:
        app: ${data.name}
    spec:
      containers:
      - name: otel-collector
        image: docker.elastic.co/observability/elastic-otel-collector:latest
        resources:
          requests:
            cpu: ${data.resources?.cpu || '200m'}
            memory: ${data.resources?.memory || '256Mi'}
          limits:
            cpu: 1000m
            memory: 512Mi
        volumeMounts:
        - name: config
          mountPath: /etc/otelcol
        env:
        - name: ELASTICSEARCH_ENDPOINT
          valueFrom:
            secretKeyRef:
              name: elastic-credentials
              key: endpoint
        - name: ELASTICSEARCH_API_KEY
          valueFrom:
            secretKeyRef:
              name: elastic-credentials
              key: api-key
      volumes:
      - name: config
        configMap:
          name: ${data.name}-config`);
  });

  // 4. Secret template
  manifests.push(`---
# IMPORTANT: Replace with actual values
apiVersion: v1
kind: Secret
metadata:
  name: elastic-credentials
  namespace: observability
type: Opaque
stringData:
  endpoint: "https://your-cluster.es.cloud:443"
  api-key: "your-api-key-here"`);

  return manifests.join('\n');
}
```

**Files**: `app/otel-flow/lib/k8s-manifest-generator.ts`

---

### Step 9: Update ConfigExportPanel

Add export format selector:

```typescript
import { generateDockerCompose } from '../../lib/docker-compose-generator';
import { generateK8sManifests } from '../../lib/k8s-manifest-generator';

type ExportFormat = 'collector-yaml' | 'docker-compose' | 'kubernetes';

export function ConfigExportPanel() {
  const [format, setFormat] = useState<ExportFormat>('collector-yaml');
  const { nodes, edges } = useFlowStore();

  // Detect infrastructure type
  const hasK8s = nodes.some(n =>
    n.data.componentType?.toString().startsWith('infrastructure-k8s')
  );
  const hasDocker = nodes.some(n =>
    n.data.componentType === 'infrastructure-docker'
  );

  const handleExport = () => {
    switch (format) {
      case 'docker-compose':
        const { yaml, envFile } = generateDockerCompose(nodes, edges);
        // Download both files or create ZIP
        break;

      case 'kubernetes':
        const manifests = generateK8sManifests(nodes, edges);
        downloadFile('k8s-manifests.yaml', manifests);
        break;

      case 'collector-yaml':
        // Existing single collector YAML export
        break;
    }
  };

  return (
    <div>
      {/* Format selector */}
      <select value={format} onChange={e => setFormat(e.target.value)}>
        <option value="collector-yaml">Collector YAML</option>
        {hasDocker && <option value="docker-compose">Docker Compose</option>}
        {hasK8s && <option value="kubernetes">Kubernetes Manifests</option>}
      </select>

      {/* Export button */}
      <button onClick={handleExport}>Export</button>
    </div>
  );
}
```

**Files**: `app/otel-flow/components/panels/ConfigExportPanel.tsx`

---

## Implementation Order (Phased Approach)

### Phase 3.1: Basic Infrastructure Nodes (Week 1)
- [ ] Step 1: Extend type system
- [ ] Step 2: Create 3 infrastructure node components (Host, Docker, K8sPod)
- [ ] Step 3: Register node types
- [ ] Step 4: Add to palette
- [ ] Test: Drag infrastructure nodes onto canvas, verify rendering

### Phase 3.2: Parent-Child Relationships (Week 1-2)
- [ ] Step 5: Create K8s infrastructure scenario with nested nodes
- [ ] Step 6: Update store for parent-child operations
- [ ] Test: Children constrained to parent, move together, delete cascade

### Phase 3.3: Docker Compose Export (Week 2)
- [ ] Step 7: Implement Docker Compose generator
- [ ] Step 9a: Add Docker Compose option to ConfigExportPanel
- [ ] Test: Generate valid docker-compose.yml from topology

### Phase 3.4: Kubernetes Export (Week 2-3)
- [ ] Step 8: Implement K8s manifest generator
- [ ] Step 9b: Add Kubernetes option to ConfigExportPanel
- [ ] Test: Generate valid K8s manifests, apply to cluster

### Phase 3.5: Polish & Documentation (Week 3)
- [ ] Add visual indicators when nodes are inside containers
- [ ] Improve drag-drop UX for adding children to parents
- [ ] Update CLAUDE.md with infrastructure patterns
- [ ] Create demo video showing K8s scenario

## Testing Strategy

1. **Visual Testing**:
   - Infrastructure nodes render correctly
   - Dashed borders, semi-transparent backgrounds
   - Children positioned correctly inside parents

2. **Interaction Testing**:
   - Drag EDOT node into infrastructure container → becomes child
   - Move parent → children move with it
   - Delete parent → children deleted too

3. **Export Testing**:
   - Docker Compose: `docker-compose config` validates YAML
   - Kubernetes: `kubectl apply --dry-run=client -f manifests.yaml` validates
   - Collector YAML: `otelcol validate --config=config.yaml` (existing)

4. **Scenario Testing**:
   - Load K8s Infrastructure scenario
   - All nodes appear correctly nested
   - Connections work between nested nodes

## Success Criteria

- [ ] Users can drag Host/Docker/K8s nodes onto canvas
- [ ] EDOT components can be placed inside infrastructure nodes
- [ ] Parent-child relationships visually clear (dashed borders)
- [ ] Export generates valid Docker Compose YAML
- [ ] Export generates valid K8s manifests (DaemonSet, Deployment, ConfigMap, Secret)
- [ ] K8s scenario demonstrates full production architecture
- [ ] Documentation updated with infrastructure patterns

## Risk Mitigation

**Risk**: React Flow parent-child complexity
**Mitigation**: Start with simple 2-level nesting (no grandchildren), expand later

**Risk**: YAML generation becomes too complex
**Mitigation**: Keep generators simple, use templates, add validation

**Risk**: UX confusion with nested nodes
**Mitigation**: Clear visual indicators, helpful empty state messages, tooltips

**Risk**: Breaking existing functionality
**Mitigation**: Phased rollout, comprehensive testing, feature flags

## Future Enhancements (Post Phase 3)

- Helm values generator for EDOT Helm chart
- Terraform generator for cloud resources
- Import from existing Docker Compose / K8s manifests
- Multi-level nesting (Namespace → Deployment → Pod → Container)
- Visual connection validation (prevent invalid connections)
- Infrastructure cost estimation

## Files to Create

New files (10):
1. `app/otel-flow/components/nodes/HostNode.tsx`
2. `app/otel-flow/components/nodes/DockerNode.tsx`
3. `app/otel-flow/components/nodes/K8sNamespaceNode.tsx`
4. `app/otel-flow/components/nodes/K8sDaemonSetNode.tsx`
5. `app/otel-flow/components/nodes/K8sDeploymentNode.tsx`
7. `app/otel-flow/lib/docker-compose-generator.ts`
8. `app/otel-flow/lib/k8s-manifest-generator.ts`
9. `app/otel-flow/lib/topology-analyzer.ts` (utility for graph analysis)
10. `app/otel-flow/lib/infrastructure-utils.ts` (shared helpers)
11. `PHASE_3_NOTES.md` (development notes)

## Files to Modify

Existing files (5):
1. `app/otel-flow/types.ts` - Add infrastructure types
2. `app/otel-flow/components/nodes/index.ts` - Register new nodes
3. `app/otel-flow/components/panels/ComponentPalette.tsx` - Add infrastructure items
4. `app/otel-flow/components/panels/ConfigExportPanel.tsx` - Add format selector
5. `app/otel-flow/data/scenarios.ts` - Add K8s infrastructure scenario
6. `app/otel-flow/store/flowStore.ts` - (Optional) Add parent-child helpers

---

## Ready for Implementation ✅

This plan provides a clear, phased approach to implementing Phase 3: Infrastructure Context. Each step builds on the previous one, with clear testing checkpoints and success criteria.
