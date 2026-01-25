import type { Node, Edge } from '@xyflow/react';
import type { Scenario, ScenarioId, EDOTNodeData, FlowEdgeData, SDKNodeData, CollectorNodeData, ElasticNodeData } from '../types';

// Default collector configurations
// Both OTLP and Elasticsearch exporters are available in all configs
// Agent: OTLP enabled by default (forwards to Gateway)
// Gateway: Elasticsearch enabled by default (sends to Elastic)
const agentCollectorConfig = {
  receivers: [
    { type: 'otlp' as const, enabled: true },
    { type: 'hostmetrics' as const, enabled: true },
    { type: 'filelog' as const, enabled: true },
  ],
  processors: [
    { type: 'memory_limiter' as const, enabled: true },
    { type: 'resourcedetection' as const, enabled: true },
    { type: 'batch' as const, enabled: true },
  ],
  exporters: [
    { type: 'otlp' as const, enabled: true },
    { type: 'elasticsearch' as const, enabled: false },
  ],
};

// Gateway config for direct Elasticsearch ingestion
// Per EDOT best practices: elasticapm processor should be LAST
const gatewayCollectorConfig = {
  receivers: [
    { type: 'otlp' as const, enabled: true },
  ],
  processors: [
    { type: 'memory_limiter' as const, enabled: true },
    { type: 'resourcedetection' as const, enabled: true },
    { type: 'batch' as const, enabled: true },
    { type: 'elasticapm' as const, enabled: true }, // Must be LAST - required for Elastic APM UIs
  ],
  exporters: [
    { type: 'otlp' as const, enabled: false },
    { type: 'elasticsearch' as const, enabled: true },
  ],
};

// K8s-specific agent configuration with k8sattributes
const k8sAgentCollectorConfig = {
  receivers: [
    { type: 'otlp' as const, enabled: true },
    { type: 'hostmetrics' as const, enabled: true },
    { type: 'filelog' as const, enabled: true },
    { type: 'kubeletstats' as const, enabled: true },
  ],
  processors: [
    { type: 'memory_limiter' as const, enabled: true },
    { type: 'k8sattributes' as const, enabled: true },
    { type: 'batch' as const, enabled: true },
  ],
  exporters: [
    { type: 'otlp' as const, enabled: true },
    { type: 'elasticsearch' as const, enabled: false },
  ],
};

// K8s-specific gateway configuration for direct Elasticsearch ingestion
// Per EDOT best practices: elasticapm processor should be LAST
const k8sGatewayCollectorConfig = {
  receivers: [
    { type: 'otlp' as const, enabled: true },
    { type: 'k8s_cluster' as const, enabled: true },
  ],
  processors: [
    { type: 'memory_limiter' as const, enabled: true },
    { type: 'resourcedetection' as const, enabled: true },
    { type: 'k8sattributes' as const, enabled: true },
    { type: 'batch' as const, enabled: true },
    { type: 'elasticapm' as const, enabled: true }, // Must be LAST - required for Elastic APM UIs
  ],
  exporters: [
    { type: 'otlp' as const, enabled: false },
    { type: 'elasticsearch' as const, enabled: true },
  ],
};

// ============ SCENARIO: Simple ============
const simpleNodes: Node<EDOTNodeData>[] = [
  {
    id: 'sdk-1',
    type: 'edotSdk',
    position: { x: 100, y: 200 },
    data: {
      label: 'My Application',
      componentType: 'edot-sdk',
      language: 'nodejs',
      serviceName: 'my-app',
      autoInstrumented: true,
      description: 'Node.js application instrumented with EDOT SDK',
    } as SDKNodeData,
  },
  {
    id: 'elastic-1',
    type: 'elasticApm',
    position: { x: 500, y: 200 },
    data: {
      label: 'Elastic Observability',
      componentType: 'elastic-apm',
      features: ['apm', 'logs', 'metrics'],
      description: 'Elastic Observability receives telemetry directly via OTLP',
    } as ElasticNodeData,
  },
];

const simpleEdges: Edge<FlowEdgeData>[] = [
  {
    id: 'e-sdk1-elastic',
    source: 'sdk-1',
    target: 'elastic-1',
    type: 'animated',
    data: {
      telemetryTypes: ['traces', 'metrics', 'logs'],
      animated: true,
      volume: 5,
      protocol: 'otlp-http',
    },
  },
];

// ============ SCENARIO: Agent ============
const agentNodes: Node<EDOTNodeData>[] = [
  {
    id: 'sdk-1',
    type: 'edotSdk',
    position: { x: 100, y: 200 },
    data: {
      label: 'My Application',
      componentType: 'edot-sdk',
      language: 'python',
      serviceName: 'my-app',
      autoInstrumented: true,
      description: 'Python application with EDOT SDK',
    } as SDKNodeData,
  },
  {
    id: 'collector-agent',
    type: 'collector',
    position: { x: 350, y: 200 },
    data: {
      label: 'EDOT Collector',
      componentType: 'collector-agent',
      config: k8sAgentCollectorConfig,
      description: 'Agent mode: Runs per-host, collects infrastructure metrics',
    } as CollectorNodeData,
  },
  {
    id: 'elastic-1',
    type: 'elasticApm',
    position: { x: 650, y: 200 },
    data: {
      label: 'Elastic Observability',
      componentType: 'elastic-apm',
      features: ['apm', 'logs', 'metrics', 'profiling'],
      description: 'Receives processed telemetry from Collector',
    } as ElasticNodeData,
  },
];

const agentEdges: Edge<FlowEdgeData>[] = [
  {
    id: 'e-sdk1-agent',
    source: 'sdk-1',
    target: 'collector-agent',
    type: 'animated',
    data: {
      telemetryTypes: ['traces', 'metrics', 'logs'],
      animated: true,
      volume: 6,
      protocol: 'otlp-grpc',
    },
  },
  {
    id: 'e-agent-elastic',
    source: 'collector-agent',
    target: 'elastic-1',
    type: 'animated',
    data: {
      telemetryTypes: ['traces', 'metrics', 'logs'],
      animated: true,
      volume: 8,
      protocol: 'otlp-http',
    },
  },
];

// ============ SCENARIO: Gateway ============
const gatewayNodes: Node<EDOTNodeData>[] = [
  {
    id: 'sdk-1',
    type: 'edotSdk',
    position: { x: 50, y: 100 },
    data: {
      label: 'Frontend (Node.js)',
      componentType: 'edot-sdk',
      language: 'nodejs',
      serviceName: 'frontend',
      autoInstrumented: true,
    } as SDKNodeData,
  },
  {
    id: 'sdk-2',
    type: 'edotSdk',
    position: { x: 50, y: 250 },
    data: {
      label: 'API Service (Java)',
      componentType: 'edot-sdk',
      language: 'java',
      serviceName: 'api-service',
      autoInstrumented: true,
    } as SDKNodeData,
  },
  {
    id: 'sdk-3',
    type: 'edotSdk',
    position: { x: 50, y: 400 },
    data: {
      label: 'Worker (Python)',
      componentType: 'edot-sdk',
      language: 'python',
      serviceName: 'worker',
      autoInstrumented: true,
    } as SDKNodeData,
  },
  {
    id: 'collector-gateway',
    type: 'collector',
    position: { x: 350, y: 250 },
    data: {
      label: 'EDOT Gateway',
      componentType: 'collector-gateway',
      config: gatewayCollectorConfig,
      description: 'Centralized gateway: Sampling, transformation, routing',
    } as CollectorNodeData,
  },
  {
    id: 'elastic-1',
    type: 'elasticApm',
    position: { x: 650, y: 250 },
    data: {
      label: 'Elastic Observability',
      componentType: 'elastic-apm',
      features: ['apm', 'logs', 'metrics', 'profiling'],
    } as ElasticNodeData,
  },
];

const gatewayEdges: Edge<FlowEdgeData>[] = [
  {
    id: 'e-sdk1-gw',
    source: 'sdk-1',
    target: 'collector-gateway',
    type: 'animated',
    data: { telemetryTypes: ['traces', 'metrics'], animated: true, volume: 4 },
  },
  {
    id: 'e-sdk2-gw',
    source: 'sdk-2',
    target: 'collector-gateway',
    type: 'animated',
    data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 7 },
  },
  {
    id: 'e-sdk3-gw',
    source: 'sdk-3',
    target: 'collector-gateway',
    type: 'animated',
    data: { telemetryTypes: ['traces', 'logs'], animated: true, volume: 3 },
  },
  {
    id: 'e-gw-elastic',
    source: 'collector-gateway',
    target: 'elastic-1',
    type: 'animated',
    data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 10 },
  },
];

// ============ SCENARIO: Production ============
const productionNodes: Node<EDOTNodeData>[] = [
  // Services with agents
  {
    id: 'sdk-frontend',
    type: 'edotSdk',
    position: { x: 50, y: 50 },
    data: {
      label: 'Frontend',
      componentType: 'edot-sdk',
      language: 'nodejs',
      serviceName: 'frontend',
      autoInstrumented: true,
    } as SDKNodeData,
  },
  {
    id: 'agent-frontend',
    type: 'collector',
    position: { x: 250, y: 50 },
    data: {
      label: 'Agent',
      componentType: 'collector-agent',
      config: k8sAgentCollectorConfig,
    } as CollectorNodeData,
  },
  {
    id: 'sdk-api',
    type: 'edotSdk',
    position: { x: 50, y: 180 },
    data: {
      label: 'API Gateway',
      componentType: 'edot-sdk',
      language: 'java',
      serviceName: 'api-gateway',
      autoInstrumented: true,
    } as SDKNodeData,
  },
  {
    id: 'agent-api',
    type: 'collector',
    position: { x: 250, y: 180 },
    data: {
      label: 'Agent',
      componentType: 'collector-agent',
      config: k8sAgentCollectorConfig,
    } as CollectorNodeData,
  },
  {
    id: 'sdk-orders',
    type: 'edotSdk',
    position: { x: 50, y: 310 },
    data: {
      label: 'Order Service',
      componentType: 'edot-sdk',
      language: 'dotnet',
      serviceName: 'orders',
      autoInstrumented: true,
    } as SDKNodeData,
  },
  {
    id: 'agent-orders',
    type: 'collector',
    position: { x: 250, y: 310 },
    data: {
      label: 'Agent',
      componentType: 'collector-agent',
      config: k8sAgentCollectorConfig,
    } as CollectorNodeData,
  },
  {
    id: 'sdk-payments',
    type: 'edotSdk',
    position: { x: 50, y: 440 },
    data: {
      label: 'Payment Service',
      componentType: 'edot-sdk',
      language: 'go',
      serviceName: 'payments',
      autoInstrumented: true,
    } as SDKNodeData,
  },
  {
    id: 'agent-payments',
    type: 'collector',
    position: { x: 250, y: 440 },
    data: {
      label: 'Agent',
      componentType: 'collector-agent',
      config: k8sAgentCollectorConfig,
    } as CollectorNodeData,
  },
  // Gateways (load balanced)
  {
    id: 'gateway-1',
    type: 'collector',
    position: { x: 480, y: 130 },
    data: {
      label: 'Gateway 1',
      componentType: 'collector-gateway',
      config: gatewayCollectorConfig,
    } as CollectorNodeData,
  },
  {
    id: 'gateway-2',
    type: 'collector',
    position: { x: 480, y: 350 },
    data: {
      label: 'Gateway 2',
      componentType: 'collector-gateway',
      config: gatewayCollectorConfig,
    } as CollectorNodeData,
  },
  // Elastic
  {
    id: 'elastic-1',
    type: 'elasticApm',
    position: { x: 720, y: 240 },
    data: {
      label: 'Elastic Observability',
      componentType: 'elastic-apm',
      features: ['apm', 'logs', 'metrics', 'profiling'],
    } as ElasticNodeData,
  },
];

const productionEdges: Edge<FlowEdgeData>[] = [
  // SDK to Agents
  { id: 'e-fe-ag', source: 'sdk-frontend', target: 'agent-frontend', type: 'animated', data: { telemetryTypes: ['traces', 'metrics'], animated: true, volume: 5 } },
  { id: 'e-api-ag', source: 'sdk-api', target: 'agent-api', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 8 } },
  { id: 'e-ord-ag', source: 'sdk-orders', target: 'agent-orders', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 6 } },
  { id: 'e-pay-ag', source: 'sdk-payments', target: 'agent-payments', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 4 } },
  // Agents to Gateways (load balanced)
  { id: 'e-agfe-gw1', source: 'agent-frontend', target: 'gateway-1', type: 'animated', data: { telemetryTypes: ['traces', 'metrics'], animated: true, volume: 5 } },
  { id: 'e-agapi-gw1', source: 'agent-api', target: 'gateway-1', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 8 } },
  { id: 'e-agord-gw2', source: 'agent-orders', target: 'gateway-2', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 6 } },
  { id: 'e-agpay-gw2', source: 'agent-payments', target: 'gateway-2', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 4 } },
  // Gateways to Elastic
  { id: 'e-gw1-el', source: 'gateway-1', target: 'elastic-1', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 10 } },
  { id: 'e-gw2-el', source: 'gateway-2', target: 'elastic-1', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 8 } },
];

// ============ SCENARIO: Docker ============
const dockerNodes: Node<EDOTNodeData>[] = [
  // Host container
  {
    id: 'host-1',
    type: 'infrastructureHost',
    position: { x: 50, y: 50 },
    style: { width: 500, height: 350 },
    data: {
      label: 'Production Server',
      componentType: 'infrastructure-host',
      hostname: 'prod-server-01',
      os: 'linux',
      ipAddress: '10.0.1.100',
      description: 'Linux host running Docker containers',
    },
  },
  // Docker container for app
  {
    id: 'docker-app',
    type: 'infrastructureDocker',
    position: { x: 75, y: 100 },
    style: { width: 300, height: 150 },
    parentId: 'host-1',
    extent: 'parent' as const,
    expandParent: true,
    data: {
      label: 'App Container',
      componentType: 'infrastructure-docker',
      containerName: 'my-app',
      imageName: 'my-app',
      imageTag: 'v1.2.3',
      networkMode: 'bridge',
      ports: [{ host: 8080, container: 8080 }],
      description: 'Containerized Node.js application',
    },
  },
  // SDK inside Docker container
  {
    id: 'sdk-1',
    type: 'edotSdk',
    position: { x: 100, y: 50 },
    parentId: 'docker-app',
    extent: 'parent' as const,
    expandParent: true,
    data: {
      label: 'Node.js App',
      componentType: 'edot-sdk',
      language: 'nodejs',
      serviceName: 'my-app',
      autoInstrumented: true,
      description: 'EDOT SDK running inside container',
    } as SDKNodeData,
  },
  // Collector agent in Docker
  {
    id: 'docker-collector',
    type: 'infrastructureDocker',
    position: { x: 75, y: 270 },
    style: { width: 300, height: 120 },
    parentId: 'host-1',
    extent: 'parent' as const,
    expandParent: true,
    data: {
      label: 'Collector Container',
      componentType: 'infrastructure-docker',
      containerName: 'edot-collector',
      imageName: 'docker.elastic.co/edot/collector',
      imageTag: 'latest',
      networkMode: 'host',
      description: 'EDOT Collector in agent mode',
    },
  },
  {
    id: 'collector-1',
    type: 'collector',
    position: { x: 100, y: 50 },
    parentId: 'docker-collector',
    extent: 'parent' as const,
    expandParent: true,
    data: {
      label: 'EDOT Agent',
      componentType: 'collector-agent',
      config: k8sAgentCollectorConfig,
      description: 'Collects from app and host metrics',
    } as CollectorNodeData,
  },
  // Elastic
  {
    id: 'elastic-1',
    type: 'elasticApm',
    position: { x: 700, y: 200 },
    data: {
      label: 'Elastic Observability',
      componentType: 'elastic-apm',
      features: ['apm', 'logs', 'metrics'],
      description: 'Elastic Cloud deployment',
    } as ElasticNodeData,
  },
];

const dockerEdges: Edge<FlowEdgeData>[] = [
  {
    id: 'e-sdk-collector',
    source: 'sdk-1',
    target: 'collector-1',
    type: 'animated',
    data: {
      telemetryTypes: ['traces', 'metrics', 'logs'],
      animated: true,
      volume: 6,
      protocol: 'otlp-grpc',
    },
  },
  {
    id: 'e-collector-elastic',
    source: 'collector-1',
    target: 'elastic-1',
    type: 'animated',
    data: {
      telemetryTypes: ['traces', 'metrics', 'logs'],
      animated: true,
      volume: 8,
      protocol: 'otlp-http',
    },
  },
];

// ============ SCENARIO: Kubernetes ============
const k8sNodes: Node<EDOTNodeData>[] = [
  // Namespace container
  {
    id: 'ns-observability',
    type: 'infrastructureK8sNamespace',
    position: { x: 50, y: 50 },
    style: { width: 900, height: 600 },
    data: {
      label: 'Observability Namespace',
      componentType: 'infrastructure-k8s-namespace',
      name: 'observability',
      labels: { team: 'platform', env: 'production' },
      description: 'Dedicated namespace for EDOT infrastructure',
    },
  },
  // DaemonSet for agents
  {
    id: 'ds-agent',
    type: 'infrastructureK8sDaemonSet',
    position: { x: 75, y: 100 },
    style: { width: 400, height: 200 },
    parentId: 'ns-observability',
    extent: 'parent' as const,
    expandParent: true,
    data: {
      label: 'EDOT Agent DaemonSet',
      componentType: 'infrastructure-k8s-daemonset',
      name: 'edot-agent',
      namespace: 'observability',
      nodeSelector: { 'node-role': 'worker' },
      description: 'One agent per worker node',
    },
  },
  // Agent collectors (simulating 3 nodes)
  {
    id: 'agent-1',
    type: 'collector',
    position: { x: 50, y: 70 },
    parentId: 'ds-agent',
    extent: 'parent' as const,
    expandParent: true,
    data: {
      label: 'Agent (node-1)',
      componentType: 'collector-agent',
      config: k8sAgentCollectorConfig,
      description: 'Agent on worker node 1',
    } as CollectorNodeData,
  },
  {
    id: 'agent-2',
    type: 'collector',
    position: { x: 150, y: 70 },
    parentId: 'ds-agent',
    extent: 'parent' as const,
    expandParent: true,
    data: {
      label: 'Agent (node-2)',
      componentType: 'collector-agent',
      config: k8sAgentCollectorConfig,
      description: 'Agent on worker node 2',
    } as CollectorNodeData,
  },
  {
    id: 'agent-3',
    type: 'collector',
    position: { x: 250, y: 70 },
    parentId: 'ds-agent',
    extent: 'parent' as const,
    expandParent: true,
    data: {
      label: 'Agent (node-3)',
      componentType: 'collector-agent',
      config: k8sAgentCollectorConfig,
      description: 'Agent on worker node 3',
    } as CollectorNodeData,
  },
  // Deployment for gateway
  {
    id: 'deploy-gateway',
    type: 'infrastructureK8sDeployment',
    position: { x: 75, y: 360 },
    style: { width: 400, height: 200 },
    parentId: 'ns-observability',
    extent: 'parent' as const,
    expandParent: true,
    data: {
      label: 'EDOT Gateway Deployment',
      componentType: 'infrastructure-k8s-deployment',
      name: 'edot-gateway',
      namespace: 'observability',
      replicas: 3,
      resources: { cpu: '500m', memory: '1Gi' },
      description: 'Horizontally scaled gateways',
    },
  },
  // Gateway collectors (3 replicas)
  {
    id: 'gateway-1',
    type: 'collector',
    position: { x: 50, y: 70 },
    parentId: 'deploy-gateway',
    extent: 'parent' as const,
    expandParent: true,
    data: {
      label: 'Gateway 1',
      componentType: 'collector-gateway',
      config: k8sGatewayCollectorConfig,
      description: 'Gateway replica 1',
    } as CollectorNodeData,
  },
  {
    id: 'gateway-2',
    type: 'collector',
    position: { x: 150, y: 70 },
    parentId: 'deploy-gateway',
    extent: 'parent' as const,
    expandParent: true,
    data: {
      label: 'Gateway 2',
      componentType: 'collector-gateway',
      config: k8sGatewayCollectorConfig,
      description: 'Gateway replica 2',
    } as CollectorNodeData,
  },
  {
    id: 'gateway-3',
    type: 'collector',
    position: { x: 250, y: 70 },
    parentId: 'deploy-gateway',
    extent: 'parent' as const,
    expandParent: true,
    data: {
      label: 'Gateway 3',
      componentType: 'collector-gateway',
      config: k8sGatewayCollectorConfig,
      description: 'Gateway replica 3',
    } as CollectorNodeData,
  },
  // Elastic
  {
    id: 'elastic-1',
    type: 'elasticApm',
    position: { x: 1100, y: 350 },
    data: {
      label: 'Elastic Observability',
      componentType: 'elastic-apm',
      features: ['apm', 'logs', 'metrics', 'profiling'],
      description: 'Elastic Cloud (ECE)',
    } as ElasticNodeData,
  },
];

const k8sEdges: Edge<FlowEdgeData>[] = [
  // Agents to Gateways
  { id: 'e-ag1-gw1', source: 'agent-1', target: 'gateway-1', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 6 } },
  { id: 'e-ag2-gw2', source: 'agent-2', target: 'gateway-2', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 7 } },
  { id: 'e-ag3-gw3', source: 'agent-3', target: 'gateway-3', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 5 } },
  // Gateways to Elastic
  { id: 'e-gw1-el', source: 'gateway-1', target: 'elastic-1', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 8 } },
  { id: 'e-gw2-el', source: 'gateway-2', target: 'elastic-1', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 9 } },
  { id: 'e-gw3-el', source: 'gateway-3', target: 'elastic-1', type: 'animated', data: { telemetryTypes: ['traces', 'metrics', 'logs'], animated: true, volume: 7 } },
];

// ============ EXPORT ALL SCENARIOS ============

export const scenarios: Record<ScenarioId, Scenario> = {
  simple: {
    id: 'simple',
    name: 'Simple',
    description: 'Direct SDK to Elastic. Best for Serverless/ECH with Managed OTLP Endpoint.',
    icon: '1️⃣',
    nodes: simpleNodes,
    edges: simpleEdges,
    // Direct SDK→Elastic is ideal for managed endpoints
    compatibleDeployments: ['serverless', 'ech'],
    recommendedDeployment: 'serverless',
  },
  agent: {
    id: 'agent',
    name: 'With Agent',
    description: 'SDK → Agent Collector → Elastic. Adds host metrics and local processing.',
    icon: '📡',
    nodes: agentNodes,
    edges: agentEdges,
    // Agent pattern works everywhere
    compatibleDeployments: ['serverless', 'ech', 'self-managed'],
    recommendedDeployment: 'ech',
  },
  gateway: {
    id: 'gateway',
    name: 'Gateway',
    description: 'Multiple SDKs → Central Gateway → Elastic. Centralized sampling and transformation.',
    icon: '🌐',
    nodes: gatewayNodes,
    edges: gatewayEdges,
    // Gateway pattern is especially important for self-managed
    compatibleDeployments: ['serverless', 'ech', 'self-managed'],
    recommendedDeployment: 'self-managed',
  },
  production: {
    id: 'production',
    name: 'Production',
    description: 'Full HA setup: Agents per service + Load-balanced Gateways. Recommended for self-managed.',
    icon: '🏭',
    nodes: productionNodes,
    edges: productionEdges,
    // Production pattern with Gateways is ideal for self-managed
    compatibleDeployments: ['serverless', 'ech', 'self-managed'],
    recommendedDeployment: 'self-managed',
  },
  docker: {
    id: 'docker',
    name: 'Docker',
    description: 'Containerized app + EDOT Collector on a single host with Docker.',
    icon: '🐳',
    nodes: dockerNodes,
    edges: dockerEdges,
    // Docker works with all deployments
    compatibleDeployments: ['serverless', 'ech', 'self-managed'],
  },
  kubernetes: {
    id: 'kubernetes',
    name: 'Kubernetes',
    description: 'K8s deployment: DaemonSet agents + Deployment gateways in dedicated namespace.',
    icon: '☸️',
    nodes: k8sNodes,
    edges: k8sEdges,
    // K8s pattern with Gateway is recommended for self-managed
    compatibleDeployments: ['serverless', 'ech', 'self-managed'],
    recommendedDeployment: 'self-managed',
  },
};

export const scenarioList = Object.values(scenarios);
