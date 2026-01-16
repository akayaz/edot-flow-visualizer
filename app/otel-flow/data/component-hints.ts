/**
 * Educational hints for EDOT components
 * 
 * These hints explain the purpose, best practices, and deployment-specific
 * recommendations for each component type in the EDOT architecture.
 */

import type { DeploymentModel, EDOTComponentType } from '../types';

export interface ComponentHint {
  title: string;
  description: string;
  purpose: string;
  bestPractices: string[];
  deploymentNotes: Partial<Record<DeploymentModel, string>>;
  docsUrl: string;
  telemetryTypes: ('traces' | 'metrics' | 'logs')[];
}

/**
 * Component hints based on EDOT Reference Architecture
 * Source: https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms
 * 
 * Key Rules:
 * - Serverless/ECH: Uses Managed OTLP Endpoint, Gateway is OPTIONAL
 * - Self-Managed: Gateway is REQUIRED (replaces APM Server as ingestion layer)
 */
export const COMPONENT_HINTS: Record<EDOTComponentType, ComponentHint> = {
  'edot-sdk': {
    title: 'EDOT SDK',
    description: 'Elastic Distribution of OpenTelemetry SDK for automatic instrumentation of your applications.',
    purpose: 'Instruments your application code to generate traces, metrics, and logs without code changes.',
    bestPractices: [
      'Use auto-instrumentation for fastest setup',
      'Configure service.name and service.version',
      'Set resource attributes for better correlation',
      'Export to a local collector for reliability',
    ],
    deploymentNotes: {
      'serverless': 'Can send directly to Managed OTLP Endpoint. No collectors required.',
      'ech': 'Can send directly to Managed OTLP Endpoint, or via Agent for host metrics.',
      'self-managed': 'Send to Agent (recommended) or Gateway. Gateway is required for ingestion.',
    },
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/edot-sdks',
    telemetryTypes: ['traces', 'metrics', 'logs'],
  },

  'collector-agent': {
    title: 'Collector Agent',
    description: 'Per-host/sidecar collector that runs alongside your applications.',
    purpose: 'Collects host metrics, enriches telemetry with resource attributes, and provides local buffering.',
    bestPractices: [
      'Deploy one agent per host/VM or as sidecar',
      'Enable hostmetrics receiver for infrastructure data',
      'Use memory_limiter processor first',
      'Configure file_storage for persistence',
    ],
    deploymentNotes: {
      'serverless': 'Optional. Provides host metrics and local buffering. Sends to Managed OTLP Endpoint.',
      'ech': 'Recommended for host metrics. Sends to Managed OTLP Endpoint.',
      'self-managed': 'Sends to Gateway (not directly to ES). Gateway handles ingestion.',
    },
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/edot-collector/modes',
    telemetryTypes: ['traces', 'metrics', 'logs'],
  },

  'collector-gateway': {
    title: 'Collector Gateway',
    description: 'Centralized collector for aggregation, processing, and routing.',
    purpose: 'Provides a single egress point for telemetry with advanced processing like tail-based sampling.',
    bestPractices: [
      'Deploy as a scalable service (K8s Deployment)',
      'Use tail_sampling for intelligent trace sampling',
      'Enable elasticapm processor for APM enrichment',
      'Configure HA with multiple replicas',
    ],
    deploymentNotes: {
      'serverless': 'OPTIONAL. Only needed for tail sampling or advanced processing.',
      'ech': 'OPTIONAL. Only needed for tail sampling or data transformation.',
      'self-managed': 'REQUIRED. Replaces APM Server as the ingestion layer to Elasticsearch.',
    },
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/edot-collector/modes#gateway',
    telemetryTypes: ['traces', 'metrics', 'logs'],
  },

  'elastic-apm': {
    title: 'Elastic Observability',
    description: 'The Elastic Observability backend for storing and visualizing telemetry.',
    purpose: 'Provides unified observability with APM, logs, metrics, and infrastructure monitoring.',
    bestPractices: [
      'Use OTLP protocol for ingestion',
      'Configure data streams for optimal storage',
      'Set up index lifecycle policies',
      'Enable APM UI for trace visualization',
    ],
    deploymentNotes: {
      'serverless': 'Managed OTLP Endpoint. SDK/Agent can send directly.',
      'ech': 'Managed OTLP Endpoint. SDK/Agent can send directly.',
      'self-managed': 'Elasticsearch. Requires Gateway collector for OTLP ingestion (replaces APM Server).',
    },
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry',
    telemetryTypes: ['traces', 'metrics', 'logs'],
  },

  'infrastructure-host': {
    title: 'Host/VM',
    description: 'A physical or virtual machine running your applications.',
    purpose: 'Visual container representing the infrastructure context for your services.',
    bestPractices: [
      'Place SDK nodes inside to show service location',
      'Add Agent collector for host-level telemetry',
      'Use consistent naming for multi-host setups',
    ],
    deploymentNotes: {
      'serverless': 'Optional visual grouping',
      'ech': 'Helps visualize deployment topology',
      'self-managed': 'Important for understanding infrastructure layout',
    },
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms',
    telemetryTypes: [],
  },

  'infrastructure-docker': {
    title: 'Docker Container',
    description: 'A containerized environment for your applications.',
    purpose: 'Visual container representing Docker deployment context.',
    bestPractices: [
      'Use container resource attributes',
      'Mount collector config as volume',
      'Set appropriate resource limits',
    ],
    deploymentNotes: {
      'serverless': 'Container context for cloud deployments',
      'ech': 'Docker deployment pattern',
      'self-managed': 'Container-based deployment',
    },
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry',
    telemetryTypes: [],
  },

  'infrastructure-k8s-namespace': {
    title: 'Kubernetes Namespace',
    description: 'A Kubernetes namespace for organizing workloads.',
    purpose: 'Visual container representing K8s namespace isolation.',
    bestPractices: [
      'Group related services in same namespace',
      'Use namespace for RBAC boundaries',
      'Apply consistent labeling',
    ],
    deploymentNotes: {
      'serverless': 'K8s namespace context',
      'ech': 'Namespace organization',
      'self-managed': 'Namespace isolation for multi-tenant',
    },
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/kubernetes',
    telemetryTypes: [],
  },

  'infrastructure-k8s-daemonset': {
    title: 'Kubernetes DaemonSet',
    description: 'A K8s DaemonSet that runs on every node.',
    purpose: 'Deploy Agent collectors on every K8s node for host-level metrics.',
    bestPractices: [
      'Use for per-node collectors only',
      'Mount hostPath for node metrics',
      'Configure tolerations for all nodes',
    ],
    deploymentNotes: {
      'serverless': 'Per-node agent deployment',
      'ech': 'DaemonSet for node-level collection',
      'self-managed': 'Required for complete node coverage',
    },
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/kubernetes',
    telemetryTypes: [],
  },

  'infrastructure-k8s-deployment': {
    title: 'Kubernetes Deployment',
    description: 'A K8s Deployment for scalable workloads.',
    purpose: 'Deploy Gateway collectors or applications as scalable pods.',
    bestPractices: [
      'Use for Gateway collectors (scalable)',
      'Set appropriate replica count',
      'Configure HPA for auto-scaling',
    ],
    deploymentNotes: {
      'serverless': 'Scalable pod deployment',
      'ech': 'Deployment for Gateway or apps',
      'self-managed': 'Required for HA Gateway setup',
    },
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/kubernetes',
    telemetryTypes: [],
  },
};

/**
 * Get hint for a component type
 */
export function getComponentHint(componentType: EDOTComponentType): ComponentHint {
  return COMPONENT_HINTS[componentType];
}

/**
 * Get deployment-specific note for a component
 */
export function getDeploymentNote(
  componentType: EDOTComponentType,
  deploymentModel: DeploymentModel
): string | undefined {
  return COMPONENT_HINTS[componentType]?.deploymentNotes[deploymentModel];
}

