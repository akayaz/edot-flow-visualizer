import type { Node, Edge } from '@xyflow/react';

// ============ Deployment Model Types ============

/**
 * Elastic deployment models determine valid connectivity patterns.
 * 
 * - serverless: Elastic Cloud Serverless with Managed OTLP Endpoint
 *               SDK/Collector can send directly, no gateway required
 * 
 * - ech: Elastic Cloud Hosted with Managed OTLP Endpoint
 *        Same as serverless - direct OTLP ingestion supported
 * 
 * - self-managed: Self-managed Elasticsearch deployment
 *                 Requires Gateway collector as ingestion layer
 *                 Gateway replaces APM Server for EDOT architecture
 */
export type DeploymentModel = 'serverless' | 'ech' | 'self-managed';

/**
 * Configuration for each deployment model
 */
export interface DeploymentModelConfig {
  id: DeploymentModel;
  label: string;
  description: string;
  icon: string;
  features: {
    managedOtlpEndpoint: boolean;
    gatewayRequired: boolean;
    supportsKafkaTier: boolean;
  };
  docsUrl: string;
}

/**
 * Deployment model configurations with their characteristics
 */
export const DEPLOYMENT_MODEL_CONFIG: Record<DeploymentModel, DeploymentModelConfig> = {
  serverless: {
    id: 'serverless',
    label: 'Serverless',
    description: 'Elastic Cloud Serverless with managed OTLP ingestion',
    icon: '☁️',
    features: {
      managedOtlpEndpoint: true,
      gatewayRequired: false,
      supportsKafkaTier: false,
    },
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms#elastic-cloud-serverless',
  },
  ech: {
    id: 'ech',
    label: 'Elastic Cloud Hosted',
    description: 'Elastic Cloud Hosted with managed OTLP endpoint',
    icon: '🏢',
    features: {
      managedOtlpEndpoint: true,
      gatewayRequired: false,
      supportsKafkaTier: false,
    },
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms#elastic-cloud-hosted',
  },
  'self-managed': {
    id: 'self-managed',
    label: 'Self-Managed',
    description: 'Self-managed Elasticsearch with Gateway collector as ingestion layer',
    icon: '🛠️',
    features: {
      managedOtlpEndpoint: false,
      gatewayRequired: true,
      supportsKafkaTier: true,
    },
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms#self-managed',
  },
};

// ============ Telemetry Types ============

export type TelemetryType = 'traces' | 'metrics' | 'logs';

export interface TelemetryEvent {
  id: string;
  type: TelemetryType;
  timestamp: number;
  sourceComponent: string;
  targetComponent?: string;
  metadata: {
    serviceName?: string;
    operationName?: string;
    spanId?: string;
    traceId?: string;
    metricName?: string;
    logLevel?: string;
    sdkLanguage?: SDKLanguage;
    resourceAttributes?: Record<string, string>;
  };
}

export interface ThroughputStats {
  componentId: string;
  window: '1s' | '10s' | '1m';
  traces: number;
  metrics: number;
  logs: number;
  lastUpdated: number;
}

// ============ EDOT Component Types ============

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
  | 'kafka-broker'
  | InfrastructureComponentType;

export type SDKLanguage = 'nodejs' | 'python' | 'java' | 'dotnet' | 'go' | 'php' | 'ruby' | 'android' | 'ios';

export const SDK_LANGUAGE_CONFIG: Record<SDKLanguage, { icon: string; color: string; label: string }> = {
  nodejs: { icon: '🟢', color: '#22c55e', label: 'Node.js' },
  python: { icon: '🐍', color: '#eab308', label: 'Python' },
  java: { icon: '☕', color: '#f97316', label: 'Java' },
  dotnet: { icon: '🔷', color: '#6366f1', label: '.NET' },
  go: { icon: '🔵', color: '#06b6d4', label: 'Go' },
  php: { icon: '🐘', color: '#8b5cf6', label: 'PHP' },
  ruby: { icon: '💎', color: '#dc2626', label: 'Ruby' },
  android: { icon: '🤖', color: '#10b981', label: 'Android' },
  ios: { icon: '📱', color: '#3b82f6', label: 'iOS' },
};

// ============ Collector Configuration ============

export type ReceiverType = 'otlp' | 'hostmetrics' | 'filelog' | 'prometheus' | 'jaeger' | 'zipkin' | 'k8s_cluster' | 'kubeletstats' | 'kafka';
export type ProcessorType = 'batch' | 'memory_limiter' | 'tail_sampling' | 'transform' | 'filter' | 'attributes' | 'resource' | 'resourcedetection' | 'elasticapm' | 'spanmetrics' | 'k8sattributes';
export type ExporterType = 'otlp' | 'elasticsearch' | 'debug' | 'file' | 'logging' | 'kafka';

export interface ReceiverConfig {
  type: ReceiverType;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface ProcessorConfig {
  type: ProcessorType;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface ExporterConfig {
  type: ExporterType;
  enabled: boolean;
  endpoint?: string;
  config?: Record<string, unknown>;
}

export interface CollectorConfig {
  receivers: ReceiverConfig[];
  processors: ProcessorConfig[];
  exporters: ExporterConfig[];
}

// ============ Node Data Types ============

export interface BaseNodeData extends Record<string, unknown> {
  label: string;
  componentType: EDOTComponentType;
  description?: string;
  throughput?: ThroughputStats;
}

export interface SDKNodeData extends BaseNodeData {
  componentType: 'edot-sdk';
  language: SDKLanguage;
  serviceName: string;
  autoInstrumented: boolean;
}

export interface CollectorNodeData extends BaseNodeData {
  componentType: 'collector-agent' | 'collector-gateway';
  config: CollectorConfig;
}

/**
 * Elastic endpoint type based on deployment model
 * 
 * - managed-otlp: Managed OTLP endpoint (Serverless/ECH)
 *                 Direct OTLP ingestion, no gateway required
 * 
 * - self-managed-es: Self-managed Elasticsearch
 *                    Requires Gateway collector for ingestion
 */
export type ElasticEndpointType = 'managed-otlp' | 'self-managed-es';

export interface ElasticNodeData extends BaseNodeData {
  componentType: 'elastic-apm';
  features: ('apm' | 'logs' | 'metrics' | 'profiling')[];
  /**
   * The type of Elastic endpoint based on deployment model.
   * Determines valid connection patterns.
   */
  endpointType?: ElasticEndpointType;
}

// ============ Kafka Node Data Types ============

/**
 * Kafka authentication methods supported by EDOT Collector
 */
export type KafkaAuthType = 'none' | 'sasl-plain' | 'sasl-scram256' | 'sasl-scram512' | 'tls' | 'kerberos';

/**
 * Kafka encoding types officially supported in EDOT Collector.
 * Only otlp_proto and otlp_json are supported.
 */
export type KafkaEncoding = 'otlp_proto' | 'otlp_json';

/**
 * Kafka compression types for the producer
 */
export type KafkaCompression = 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';

export interface KafkaNodeData extends BaseNodeData {
  componentType: 'kafka-broker';
  clusterName: string;
  brokers: string[];
  topics: {
    traces: string;    // default: 'otlp_spans'
    metrics: string;   // default: 'otlp_metrics'
    logs: string;      // default: 'otlp_logs'
  };
  encoding: KafkaEncoding;
  auth: KafkaAuthType;
  partitions?: number;
  replicationFactor?: number;
  protocolVersion?: string;
  compression?: KafkaCompression;
}

// ============ Infrastructure Node Data Types ============

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
  | KafkaNodeData
  | InfrastructureNodeData;

// ============ Edge Types ============

export interface FlowEdgeData extends Record<string, unknown> {
  telemetryTypes: TelemetryType[];
  animated: boolean;
  volume: number; // 1-10 scale
  protocol?: 'otlp-grpc' | 'otlp-http' | 'kafka';
  warning?: string; // Warning message for potentially problematic connections
}

// ============ Deployment Target Types ============

/**
 * Deployment target determines how EDOT components are deployed.
 * This is separate from DeploymentModel (which is about the Elastic backend).
 * 
 * - docker: Deploy using Docker Compose
 * - kubernetes: Deploy to Kubernetes cluster
 */
export type DeploymentTarget = 'docker' | 'kubernetes';

// ============ Scenario Types ============

export type ScenarioId = 'simple' | 'agent' | 'gateway' | 'production' | 'docker' | 'kubernetes';

export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  icon: string;
  nodes: Node<EDOTNodeData>[];
  edges: Edge<FlowEdgeData>[];
  /**
   * Deployment models this scenario is compatible with.
   * If not specified, the scenario works with all deployment models.
   */
  compatibleDeployments?: DeploymentModel[];
  /**
   * The recommended deployment model for this scenario.
   */
  recommendedDeployment?: DeploymentModel;
}

// ============ Store Types ============

export interface FlowState {
  // Deployment context
  deploymentModel: DeploymentModel;
  
  // Current topology
  scenario: ScenarioId | 'custom';
  nodes: Node<EDOTNodeData>[];
  edges: Edge<FlowEdgeData>[];
  
  // UI state
  selectedNodeId: string | null;
  isAnimating: boolean;
  isPaletteOpen: boolean;
  isConfigPanelOpen: boolean;
}

export interface TelemetryState {
  recentEvents: TelemetryEvent[];
  throughputStats: Map<string, ThroughputStats>;
  isConnected: boolean;
  isDemoMode: boolean;
  lastEventTime: number | null;
}

// ============ Palette Types ============

export interface PaletteItem {
  type: EDOTComponentType;
  label: string;
  icon: string;
  description: string;
  defaultData: Partial<EDOTNodeData>;
}

// ============ WebSocket/SSE Message Types ============

export type WSMessageType = 'telemetry' | 'throughput' | 'connected';

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
}

// ============ YAML Generation Types ============

export interface GeneratedConfig {
  yaml: string;
  filename: string;
  componentId: string;
}

// ============ Enhanced Validation Types ============

/**
 * Validation severity levels
 */
export type EnhancedValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Validation categories for grouping
 */
export type ValidationCategory =
  | 'connection'      // Edge/connection issues
  | 'configuration'   // Component config issues
  | 'best-practice'   // Recommended patterns
  | 'security'        // Security concerns
  | 'performance';    // Performance optimizations

/**
 * Enhanced validation result with full context
 */
export interface EnhancedValidationResult {
  id: string;
  code: string;                  // e.g., 'EDOT_001', 'CONN_002'
  severity: EnhancedValidationSeverity;
  category: ValidationCategory;
  message: string;
  suggestion?: string;           // How to fix
  component?: {
    nodeId?: string;
    edgeId?: string;
    componentType?: 'receiver' | 'processor' | 'exporter' | 'connection';
    componentName?: string;      // Specific component (e.g., 'memory_limiter')
  };
  docsUrl?: string;              // Link to EDOT docs
  autoFixable?: boolean;         // Can be auto-fixed
  metadata?: Record<string, unknown>; // Additional context
}

/**
 * Validation context for running validation rules
 */
export interface ValidationContext {
  nodes: Node<EDOTNodeData>[];
  edges: Edge<FlowEdgeData>[];
  selectedNodeId?: string;
  scenario?: ScenarioId | 'custom';
  /**
   * The deployment model affects which connections are valid.
   * Defaults to 'serverless' if not specified (most permissive).
   */
  deploymentModel?: DeploymentModel;
}

/**
 * Validation rule definition
 */
export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: ValidationCategory;
  severity: EnhancedValidationSeverity;
  enabled: boolean;
  validate: (context: ValidationContext) => EnhancedValidationResult[];
}

/**
 * Grouped validation results for display
 */
export interface GroupedValidationResults {
  errors: EnhancedValidationResult[];
  warnings: EnhancedValidationResult[];
  info: EnhancedValidationResult[];
  total: number;
  hasErrors: boolean;
  hasWarnings: boolean;
}
