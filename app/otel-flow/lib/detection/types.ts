import type { Node, Edge } from '@xyflow/react';
import type {
  EDOTNodeData,
  FlowEdgeData,
  SDKLanguage,
  ReceiverType,
  ProcessorType,
  ExporterType,
  ReceiverConfig,
  ProcessorConfig,
  ExporterConfig,
  TelemetryType,
  TelemetryEvent,
} from '../../types';

// ============ Detection Method Types ============

export type DetectionMethod = 'yaml' | 'traffic' | 'code';

export type DetectionStatus = 'idle' | 'detecting' | 'completed' | 'error';

// ============ Detection Result Types ============

/**
 * Base detection result returned by any detection method
 */
export interface DetectionResult {
  nodes: Node<EDOTNodeData>[];
  edges: Edge<FlowEdgeData>[];
  warnings: DetectionWarning[];
  confidence: number; // 0-1 scale
  method: DetectionMethod;
  timestamp: number;
}

/**
 * Warning generated during detection
 */
export interface DetectionWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  nodeId?: string;
  edgeId?: string;
  suggestion?: string;
}

// ============ YAML Parser Types ============

/**
 * Raw YAML configuration structure for OTel Collector
 */
export interface RawOTelConfig {
  extensions?: Record<string, unknown>;
  receivers?: Record<string, unknown>;
  processors?: Record<string, unknown>;
  connectors?: Record<string, unknown>;
  exporters?: Record<string, unknown>;
  service?: {
    extensions?: string[];
    pipelines?: Record<string, RawPipelineConfig>;
    telemetry?: Record<string, unknown>;
  };
}

export interface RawPipelineConfig {
  receivers?: string[];
  processors?: string[];
  exporters?: string[];
}

/**
 * Parsed collector configuration from YAML
 */
export interface ParsedCollectorConfig {
  mode: 'agent' | 'gateway';
  receivers: ParsedReceiverConfig[];
  processors: ParsedProcessorConfig[];
  exporters: ParsedExporterConfig[];
  pipelines: ParsedPipelineConfig[];
  extensions: string[];
  confidence: number;
  rawConfig: RawOTelConfig;
}

export interface ParsedReceiverConfig {
  name: string; // Full name including suffix (e.g., "otlp", "filelog/platformlogs")
  type: ReceiverType | string; // Base type
  enabled: boolean;
  config: Record<string, unknown>;
  inferredSources?: InferredSource[]; // Inferred SDK/service sources
}

export interface ParsedProcessorConfig {
  name: string;
  type: ProcessorType | string;
  enabled: boolean;
  config: Record<string, unknown>;
  order: number;
}

export interface ParsedExporterConfig {
  name: string; // Full name (e.g., "elasticsearch/otel", "otlp/gateway")
  type: ExporterType | string;
  enabled: boolean;
  endpoint?: string;
  config: Record<string, unknown>;
  inferredTarget?: InferredTarget;
}

export interface ParsedPipelineConfig {
  name: string; // e.g., "traces", "metrics/apm"
  type: TelemetryType;
  receivers: string[];
  processors: string[];
  exporters: string[];
}

/**
 * Inferred source from receiver configuration
 */
export interface InferredSource {
  type: 'sdk' | 'collector' | 'infrastructure';
  serviceName?: string;
  language?: SDKLanguage;
  protocol?: 'otlp-grpc' | 'otlp-http';
  confidence: number;
}

/**
 * Inferred target from exporter configuration
 */
export interface InferredTarget {
  type: 'elastic' | 'collector' | 'other';
  endpoint?: string;
  isGateway?: boolean;
  confidence: number;
}

// ============ Docker Compose Parser Types ============

export interface ParsedDockerCompose {
  version?: string;
  services: ParsedDockerService[];
  networks?: Record<string, unknown>;
  volumes?: Record<string, unknown>;
}

export interface ParsedDockerService {
  name: string;
  image: string;
  imageTag?: string;
  containerName?: string;
  ports?: { host: number; container: number; protocol?: string }[];
  environment?: Record<string, string>;
  volumes?: string[];
  dependsOn?: string[];
  networks?: string[];
  command?: string | string[];
  labels?: Record<string, string>;
  // Inferred OTEL properties
  inferredType?: 'sdk' | 'collector' | 'elastic' | 'other';
  inferredLanguage?: SDKLanguage;
  otelEndpoint?: string;
  serviceName?: string;
}

// ============ Kubernetes Manifest Parser Types ============

export interface ParsedK8sManifest {
  apiVersion: string;
  kind: K8sResourceKind;
  metadata: K8sMetadata;
  spec?: Record<string, unknown>;
}

export type K8sResourceKind =
  | 'Namespace'
  | 'DaemonSet'
  | 'Deployment'
  | 'StatefulSet'
  | 'ConfigMap'
  | 'Service'
  | 'ServiceAccount'
  | 'ClusterRole'
  | 'ClusterRoleBinding';

export interface K8sMetadata {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface ParsedK8sWorkload {
  kind: 'DaemonSet' | 'Deployment' | 'StatefulSet';
  name: string;
  namespace: string;
  replicas?: number;
  containers: ParsedK8sContainer[];
  volumes?: ParsedK8sVolume[];
  serviceAccount?: string;
  nodeSelector?: Record<string, string>;
  inferredType?: 'collector-agent' | 'collector-gateway' | 'sdk';
}

export interface ParsedK8sContainer {
  name: string;
  image: string;
  ports?: { containerPort: number; protocol?: string }[];
  env?: Record<string, string>;
  volumeMounts?: { name: string; mountPath: string }[];
  resources?: { cpu?: string; memory?: string };
  command?: string[];
  args?: string[];
}

export interface ParsedK8sVolume {
  name: string;
  configMap?: { name: string };
  secret?: { name: string };
  hostPath?: { path: string };
  emptyDir?: Record<string, unknown>;
}

// ============ Traffic Analyzer Types ============

/**
 * Result of traffic pattern analysis
 */
export interface TrafficAnalysisResult {
  detectedServices: DetectedService[];
  connections: DetectedConnection[];
  inferredCollectors: InferredCollector[];
  observationWindow: {
    start: number;
    end: number;
    duration: number;
  };
  eventCount: {
    traces: number;
    metrics: number;
    logs: number;
    total: number;
  };
  confidence: number;
}

/**
 * Service detected from telemetry traffic
 */
export interface DetectedService {
  serviceName: string;
  language?: SDKLanguage;
  resourceAttributes: Record<string, string>;
  telemetryTypes: TelemetryType[];
  firstSeen: number;
  lastSeen: number;
  eventCount: number;
  spanCount?: number;
  metricCount?: number;
  logCount?: number;
  inferredAutoInstrumented?: boolean;
}

/**
 * Connection inferred from telemetry flow
 */
export interface DetectedConnection {
  sourceId: string;
  targetId: string;
  protocol?: 'otlp-grpc' | 'otlp-http';
  telemetryTypes: TelemetryType[];
  eventCount: number;
  volume: number; // 1-10 scale
  confidence: number;
}

/**
 * Collector inferred from traffic patterns
 */
export interface InferredCollector {
  id: string;
  name?: string; // Display name for the collector
  mode: 'agent' | 'gateway';
  indicators: string[];
  connectedServices: string[];
  confidence: number;
}

// ============ Code Scanner Types ============

/**
 * Result of repository code scanning
 */
export interface CodeScanResult {
  detectedSDKs: DetectedSDK[];
  instrumentedServices: InstrumentedService[];
  configFiles: FoundConfigFile[];
  dependencies: DetectedDependency[];
  confidence: number;
}

/**
 * SDK detected in source code
 */
export interface DetectedSDK {
  language: SDKLanguage;
  packageName: string;
  version?: string;
  filePath: string;
  autoInstrumented: boolean;
  isElasticDistribution: boolean;
  confidence: number;
}

/**
 * Service with instrumentation detected
 */
export interface InstrumentedService {
  serviceName?: string;
  language: SDKLanguage;
  entryPoints: string[];
  exporterEndpoint?: string;
  exporterType?: 'otlp-grpc' | 'otlp-http' | 'elasticsearch';
  resourceAttributes?: Record<string, string>;
  autoInstrumented: boolean;
  configSource?: 'code' | 'env' | 'config-file';
}

/**
 * Configuration file found in repository
 */
export interface FoundConfigFile {
  path: string;
  type: 'otel-yaml' | 'docker-compose' | 'k8s-manifest' | 'env-file' | 'package-json' | 'requirements-txt' | 'pom-xml' | 'build-gradle' | 'go-mod' | 'csproj';
  content?: string;
}

/**
 * Dependency detected in project files
 */
export interface DetectedDependency {
  name: string;
  version?: string;
  language: SDKLanguage;
  isOTel: boolean;
  isElastic: boolean;
  filePath: string;
}

// ============ Detection Aggregator Types ============

/**
 * Aggregated detection result from multiple methods
 */
export interface AggregatedDetection {
  nodes: Node<EDOTNodeData>[];
  edges: Edge<FlowEdgeData>[];
  sources: DetectionMethod[];
  conflicts: DetectionConflict[];
  warnings: DetectionWarning[];
  overallConfidence: number;
  detectionSummary: DetectionSummary;
}

/**
 * Conflict between detection methods
 */
export interface DetectionConflict {
  id: string;
  type: 'node_mismatch' | 'edge_mismatch' | 'config_mismatch' | 'mode_mismatch';
  sources: DetectionMethod[];
  description: string;
  affectedNodes?: string[];
  affectedEdges?: string[];
  resolutionOptions: ConflictResolution[];
  recommendedResolution?: ConflictResolution;
}

export interface ConflictResolution {
  id: string;
  label: string;
  description: string;
  source: DetectionMethod;
  apply: () => void;
}

/**
 * Summary of what was detected
 */
export interface DetectionSummary {
  sdkCount: number;
  collectorCount: number;
  agentCount: number;
  gatewayCount: number;
  elasticNodeCount: number;
  infrastructureCount: number;
  connectionCount: number;
  languages: SDKLanguage[];
  telemetryTypes: TelemetryType[];
}

// ============ Layout Engine Types ============

export type LayoutDirection = 'LR' | 'TB' | 'RL' | 'BT';

export interface LayoutOptions {
  direction: LayoutDirection;
  nodeSpacing: { x: number; y: number };
  layerSpacing: number;
  groupByInfrastructure: boolean;
  fitView: boolean;
  animate: boolean;
}

export interface LayoutResult {
  nodes: Node<EDOTNodeData>[];
  edges: Edge<FlowEdgeData>[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface NodeLayer {
  depth: number;
  nodes: Node<EDOTNodeData>[];
  type: 'source' | 'collector' | 'gateway' | 'destination' | 'infrastructure';
}

// ============ Detection Store Types ============

export interface DetectionState {
  // Detection status
  status: DetectionStatus;
  method: DetectionMethod | 'combined' | null;
  progress: number; // 0-100
  error: string | null;

  // Detection inputs
  yamlContent: string | null;
  repositoryUrl: string | null;
  isTrafficListening: boolean;
  trafficDuration: number; // ms

  // Detection results
  yamlResult: DetectionResult | null;
  trafficResult: DetectionResult | null;
  codeResult: DetectionResult | null;
  aggregatedResult: AggregatedDetection | null;

  // Conflicts & resolutions
  pendingConflicts: DetectionConflict[];
  resolvedConflicts: string[];

  // Actions
  startYamlDetection: (yamlContent: string) => Promise<DetectionResult>;
  startTrafficDetection: (durationMs: number) => Promise<DetectionResult>;
  startCodeScan: (repositoryUrl: string) => Promise<DetectionResult>;
  startCombinedDetection: (options: CombinedDetectionOptions) => Promise<AggregatedDetection>;
  resolveConflict: (conflictId: string, resolutionId: string) => void;
  applyDetection: () => void;
  clearDetection: () => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
}

export interface CombinedDetectionOptions {
  yaml?: string;
  repositoryUrl?: string;
  trafficDuration?: number;
  enableYaml?: boolean;
  enableTraffic?: boolean;
  enableCode?: boolean;
}

// ============ Language Scanner Patterns ============

export interface LanguageScannerPattern {
  language: SDKLanguage;
  filePatterns: string[];
  dependencyFiles: string[];
  otelPackages: RegExp[];
  elasticPackages: RegExp[];
  autoInstrumentationIndicators: RegExp[];
  serviceNameExtractors: RegExp[];
  endpointExtractors: RegExp[];
}

export const LANGUAGE_SCANNER_PATTERNS: Record<SDKLanguage, LanguageScannerPattern> = {
  nodejs: {
    language: 'nodejs',
    filePatterns: ['**/*.js', '**/*.ts', '**/*.mjs', '**/*.cjs'],
    dependencyFiles: ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
    otelPackages: [
      /@opentelemetry\/sdk-node/,
      /@opentelemetry\/api/,
      /@opentelemetry\/auto-instrumentations-node/,
      /@opentelemetry\/exporter-trace-otlp-grpc/,
      /@opentelemetry\/exporter-trace-otlp-http/,
    ],
    elasticPackages: [
      /@elastic\/apm-rum/,
      /@elastic\/apm-rum-core/,
      /elastic-apm-node/,
    ],
    autoInstrumentationIndicators: [
      /require\(['"]@opentelemetry\/auto-instrumentations-node['"]\)/,
      /-r\s+@opentelemetry\/auto-instrumentations-node/,
      /--require\s+@opentelemetry\/auto-instrumentations-node/,
      /registerInstrumentations\s*\(/,
    ],
    serviceNameExtractors: [
      /OTEL_SERVICE_NAME['":\s=]+['"]?([^'"}\s,]+)/,
      /serviceName['":\s]+['"]([^'"]+)/,
    ],
    endpointExtractors: [
      /OTEL_EXPORTER_OTLP_ENDPOINT['":\s=]+['"]?([^'"}\s,]+)/,
      /endpoint['":\s]+['"]([^'"]+)/,
    ],
  },
  python: {
    language: 'python',
    filePatterns: ['**/*.py'],
    dependencyFiles: ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile', 'poetry.lock'],
    otelPackages: [
      /opentelemetry-sdk/,
      /opentelemetry-api/,
      /opentelemetry-instrumentation/,
      /opentelemetry-exporter-otlp/,
    ],
    elasticPackages: [
      /elastic-apm/,
      /elasticapm/,
    ],
    autoInstrumentationIndicators: [
      /opentelemetry-instrument/,
      /from opentelemetry\.instrumentation import/,
      /opentelemetry\.instrumentation\./,
    ],
    serviceNameExtractors: [
      /OTEL_SERVICE_NAME['":\s=]+['"]?([^'"}\s,]+)/,
      /service\.name['":\s]+['"]([^'"]+)/,
    ],
    endpointExtractors: [
      /OTEL_EXPORTER_OTLP_ENDPOINT['":\s=]+['"]?([^'"}\s,]+)/,
      /endpoint['":\s=]+['"]([^'"]+)/,
    ],
  },
  java: {
    language: 'java',
    filePatterns: ['**/*.java', '**/*.kt', '**/*.scala'],
    dependencyFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle'],
    otelPackages: [
      /io\.opentelemetry:opentelemetry-sdk/,
      /io\.opentelemetry:opentelemetry-api/,
      /io\.opentelemetry\.instrumentation/,
      /io\.opentelemetry:opentelemetry-exporter-otlp/,
    ],
    elasticPackages: [
      /co\.elastic\.apm:apm-agent-api/,
      /co\.elastic\.apm:elastic-apm-agent/,
    ],
    autoInstrumentationIndicators: [
      /-javaagent:.*opentelemetry-javaagent/,
      /-javaagent:.*elastic-apm-agent/,
      /JAVA_TOOL_OPTIONS.*-javaagent/,
    ],
    serviceNameExtractors: [
      /OTEL_SERVICE_NAME['":\s=]+['"]?([^'"}\s,]+)/,
      /otel\.service\.name['":\s=]+['"]?([^'"}\s,]+)/,
    ],
    endpointExtractors: [
      /OTEL_EXPORTER_OTLP_ENDPOINT['":\s=]+['"]?([^'"}\s,]+)/,
    ],
  },
  go: {
    language: 'go',
    filePatterns: ['**/*.go'],
    dependencyFiles: ['go.mod', 'go.sum'],
    otelPackages: [
      /go\.opentelemetry\.io\/otel/,
      /go\.opentelemetry\.io\/otel\/sdk/,
      /go\.opentelemetry\.io\/otel\/exporters\/otlp/,
    ],
    elasticPackages: [
      /go\.elastic\.co\/apm/,
    ],
    autoInstrumentationIndicators: [
      /otelhttp\.NewHandler/,
      /otelgrpc\.UnaryServerInterceptor/,
      /otelsql\.Open/,
    ],
    serviceNameExtractors: [
      /OTEL_SERVICE_NAME['":\s=]+['"]?([^'"}\s,]+)/,
      /resource\.StringDetector.*service\.name/,
    ],
    endpointExtractors: [
      /OTEL_EXPORTER_OTLP_ENDPOINT['":\s=]+['"]?([^'"}\s,]+)/,
    ],
  },
  dotnet: {
    language: 'dotnet',
    filePatterns: ['**/*.cs', '**/*.fs', '**/*.vb'],
    dependencyFiles: ['*.csproj', '*.fsproj', '*.vbproj', 'packages.config', 'Directory.Build.props'],
    otelPackages: [
      /OpenTelemetry/,
      /OpenTelemetry\.Extensions\.Hosting/,
      /OpenTelemetry\.Exporter\.OpenTelemetryProtocol/,
      /OpenTelemetry\.Instrumentation/,
    ],
    elasticPackages: [
      /Elastic\.Apm/,
      /Elastic\.Apm\.NetCoreAll/,
    ],
    autoInstrumentationIndicators: [
      /AddOpenTelemetry\s*\(/,
      /UseElasticApm\s*\(/,
      /WithTracing\s*\(/,
    ],
    serviceNameExtractors: [
      /OTEL_SERVICE_NAME['":\s=]+['"]?([^'"}\s,]+)/,
      /SetResourceBuilder.*ServiceName\s*\(\s*['"]([^'"]+)/,
    ],
    endpointExtractors: [
      /OTEL_EXPORTER_OTLP_ENDPOINT['":\s=]+['"]?([^'"}\s,]+)/,
    ],
  },
  php: {
    language: 'php',
    filePatterns: ['**/*.php'],
    dependencyFiles: ['composer.json', 'composer.lock'],
    otelPackages: [
      /open-telemetry\/sdk/,
      /open-telemetry\/api/,
      /open-telemetry\/exporter-otlp/,
    ],
    elasticPackages: [
      /elastic\/apm-agent/,
    ],
    autoInstrumentationIndicators: [
      /use OpenTelemetry/,
      /SdkAutoloader/,
    ],
    serviceNameExtractors: [
      /OTEL_SERVICE_NAME['":\s=]+['"]?([^'"}\s,]+)/,
    ],
    endpointExtractors: [
      /OTEL_EXPORTER_OTLP_ENDPOINT['":\s=]+['"]?([^'"}\s,]+)/,
    ],
  },
  ruby: {
    language: 'ruby',
    filePatterns: ['**/*.rb'],
    dependencyFiles: ['Gemfile', 'Gemfile.lock', '*.gemspec'],
    otelPackages: [
      /opentelemetry-sdk/,
      /opentelemetry-api/,
      /opentelemetry-exporter-otlp/,
    ],
    elasticPackages: [
      /elastic-apm/,
    ],
    autoInstrumentationIndicators: [
      /OpenTelemetry::SDK\.configure/,
      /use_all_instrumentations/,
    ],
    serviceNameExtractors: [
      /OTEL_SERVICE_NAME['":\s=]+['"]?([^'"}\s,]+)/,
      /service\.name['":\s=]+['"]([^'"]+)/,
    ],
    endpointExtractors: [
      /OTEL_EXPORTER_OTLP_ENDPOINT['":\s=]+['"]?([^'"}\s,]+)/,
    ],
  },
  android: {
    language: 'android',
    filePatterns: ['**/*.java', '**/*.kt'],
    dependencyFiles: ['build.gradle', 'build.gradle.kts', 'settings.gradle'],
    otelPackages: [
      /io\.opentelemetry\.android/,
      /io\.opentelemetry:opentelemetry-android/,
    ],
    elasticPackages: [
      /co\.elastic\.apm:android-sdk/,
    ],
    autoInstrumentationIndicators: [
      /AndroidInstrumentation/,
      /OtelRumConfig/,
    ],
    serviceNameExtractors: [
      /OTEL_SERVICE_NAME['":\s=]+['"]?([^'"}\s,]+)/,
      /setApplicationName\s*\(\s*['"]([^'"]+)/,
    ],
    endpointExtractors: [
      /OTEL_EXPORTER_OTLP_ENDPOINT['":\s=]+['"]?([^'"}\s,]+)/,
      /setEndpoint\s*\(\s*['"]([^'"]+)/,
    ],
  },
  ios: {
    language: 'ios',
    filePatterns: ['**/*.swift', '**/*.m', '**/*.mm'],
    dependencyFiles: ['Package.swift', 'Podfile', 'Podfile.lock', '*.podspec'],
    otelPackages: [
      /opentelemetry-swift/,
      /OpenTelemetryApi/,
      /OpenTelemetrySdk/,
    ],
    elasticPackages: [
      /apm-agent-ios/,
      /ElasticApm/,
    ],
    autoInstrumentationIndicators: [
      /OpenTelemetry\.instance/,
      /TracerProviderBuilder/,
    ],
    serviceNameExtractors: [
      /OTEL_SERVICE_NAME['":\s=]+['"]?([^'"}\s,]+)/,
      /serviceName:\s*['"]([^'"]+)/,
    ],
    endpointExtractors: [
      /OTEL_EXPORTER_OTLP_ENDPOINT['":\s=]+['"]?([^'"}\s,]+)/,
      /endpoint:\s*['"]([^'"]+)/,
    ],
  },
};

// ============ Receiver Type Detection Patterns ============

export const RECEIVER_TYPE_PATTERNS: Record<string, ReceiverType> = {
  otlp: 'otlp',
  hostmetrics: 'hostmetrics',
  filelog: 'filelog',
  prometheus: 'prometheus',
  jaeger: 'jaeger',
  zipkin: 'zipkin',
  k8s_cluster: 'k8s_cluster',
  kubeletstats: 'kubeletstats',
};

export const PROCESSOR_TYPE_PATTERNS: Record<string, ProcessorType> = {
  batch: 'batch',
  memory_limiter: 'memory_limiter',
  tail_sampling: 'tail_sampling',
  transform: 'transform',
  filter: 'filter',
  attributes: 'attributes',
  resource: 'resource',
  resourcedetection: 'resourcedetection',
  elasticapm: 'elasticapm',
  spanmetrics: 'spanmetrics',
  k8sattributes: 'k8sattributes',
};

export const EXPORTER_TYPE_PATTERNS: Record<string, ExporterType> = {
  otlp: 'otlp',
  elasticsearch: 'elasticsearch',
  debug: 'debug',
  file: 'file',
  logging: 'logging',
};

// ============ Collector Mode Detection ============

export interface CollectorModeIndicators {
  agentIndicators: string[];
  gatewayIndicators: string[];
}

export const COLLECTOR_MODE_INDICATORS: CollectorModeIndicators = {
  agentIndicators: [
    'hostmetrics',
    'kubeletstats',
    'filelog',
    'DaemonSet',
    'daemonset',
    'agent',
    'per-host',
  ],
  gatewayIndicators: [
    'tail_sampling',
    'elasticapm',
    'Deployment',
    'gateway',
    'centralized',
    'loadbalancer',
  ],
};
