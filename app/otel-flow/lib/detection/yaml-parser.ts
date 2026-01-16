import YAML from 'yaml';
import { nanoid } from 'nanoid';
import type { Node, Edge } from '@xyflow/react';
import type {
  EDOTNodeData,
  FlowEdgeData,
  CollectorNodeData,
  SDKNodeData,
  ElasticNodeData,
  ReceiverConfig,
  ProcessorConfig,
  ExporterConfig,
  TelemetryType,
  ReceiverType,
  ProcessorType,
  ExporterType,
} from '../../types';
import type {
  DetectionResult,
  DetectionWarning,
  RawOTelConfig,
  ParsedCollectorConfig,
  ParsedReceiverConfig,
  ParsedProcessorConfig,
  ParsedExporterConfig,
  ParsedPipelineConfig,
  InferredSource,
  InferredTarget,
} from './types';

/**
 * EDOT Collector YAML Parser
 *
 * Parses OpenTelemetry Collector YAML configurations and reconstructs
 * the topology as nodes and edges for visualization.
 *
 * This is the reverse operation of yaml-generator.ts
 */

// ============ Type Detection Helpers ============

const RECEIVER_TYPES: Record<string, ReceiverType> = {
  otlp: 'otlp',
  hostmetrics: 'hostmetrics',
  filelog: 'filelog',
  prometheus: 'prometheus',
  jaeger: 'jaeger',
  zipkin: 'zipkin',
  k8s_cluster: 'k8s_cluster',
  kubeletstats: 'kubeletstats',
};

const PROCESSOR_TYPES: Record<string, ProcessorType> = {
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

const EXPORTER_TYPES: Record<string, ExporterType> = {
  otlp: 'otlp',
  elasticsearch: 'elasticsearch',
  debug: 'debug',
  file: 'file',
  logging: 'logging',
};

// ============ Main Parser Function ============

/**
 * Parse OTel Collector YAML content and generate topology
 */
export function parseOtelCollectorYaml(yamlContent: string): DetectionResult {
  const warnings: DetectionWarning[] = [];
  let confidence = 1.0;

  // Parse YAML
  let rawConfig: RawOTelConfig;
  try {
    rawConfig = YAML.parse(yamlContent) as RawOTelConfig;
  } catch (error) {
    return {
      nodes: [],
      edges: [],
      warnings: [{
        code: 'YAML_PARSE_ERROR',
        message: `Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      }],
      confidence: 0,
      method: 'yaml',
      timestamp: Date.now(),
    };
  }

  // Validate basic structure
  if (!rawConfig || typeof rawConfig !== 'object') {
    return {
      nodes: [],
      edges: [],
      warnings: [{
        code: 'INVALID_CONFIG',
        message: 'YAML content is not a valid OpenTelemetry Collector configuration',
        severity: 'error',
      }],
      confidence: 0,
      method: 'yaml',
      timestamp: Date.now(),
    };
  }

  // Parse configuration components
  const parsedConfig = parseCollectorConfig(rawConfig, warnings);

  // Determine collector mode
  const collectorMode = detectCollectorMode(parsedConfig);
  if (collectorMode.confidence < 0.8) {
    warnings.push({
      code: 'MODE_UNCERTAIN',
      message: `Collector mode detection uncertain (${Math.round(collectorMode.confidence * 100)}% confidence). Detected as ${collectorMode.mode}.`,
      severity: 'warning',
      suggestion: collectorMode.indicators.join(', '),
    });
  }

  // Generate nodes and edges
  const nodes: Node<EDOTNodeData>[] = [];
  const edges: Edge<FlowEdgeData>[] = [];

  // Create collector node
  const collectorId = `collector-${nanoid(6)}`;
  const collectorNode = createCollectorNode(collectorId, parsedConfig, collectorMode.mode);
  nodes.push(collectorNode);

  // Infer and create source nodes (SDKs)
  const sourceNodes = inferSourceNodes(parsedConfig, warnings);
  nodes.push(...sourceNodes);

  // Create edges from sources to collector
  for (const sourceNode of sourceNodes) {
    const edge = createEdge(sourceNode.id, collectorId, parsedConfig);
    edges.push(edge);
  }

  // Infer and create target nodes (Elastic, Gateway, etc.)
  const targetNodes = inferTargetNodes(parsedConfig, warnings);
  nodes.push(...targetNodes);

  // Create edges from collector to targets
  for (const targetNode of targetNodes) {
    const edge = createEdge(collectorId, targetNode.id, parsedConfig);
    edges.push(edge);
  }

  // Calculate overall confidence
  confidence = calculateOverallConfidence(parsedConfig, warnings);

  return {
    nodes,
    edges,
    warnings,
    confidence,
    method: 'yaml',
    timestamp: Date.now(),
  };
}

// ============ Configuration Parsing ============

function parseCollectorConfig(
  rawConfig: RawOTelConfig,
  warnings: DetectionWarning[]
): ParsedCollectorConfig {
  const receivers = parseReceivers(rawConfig.receivers || {}, warnings);
  const processors = parseProcessors(rawConfig.processors || {}, warnings);
  const exporters = parseExporters(rawConfig.exporters || {}, warnings);
  const pipelines = parsePipelines(rawConfig.service?.pipelines || {}, warnings);
  const extensions = rawConfig.service?.extensions || [];

  return {
    mode: 'agent', // Will be determined by detectCollectorMode
    receivers,
    processors,
    exporters,
    pipelines,
    extensions,
    confidence: 1.0,
    rawConfig,
  };
}

function parseReceivers(
  receivers: Record<string, unknown>,
  warnings: DetectionWarning[]
): ParsedReceiverConfig[] {
  const parsed: ParsedReceiverConfig[] = [];

  for (const [name, config] of Object.entries(receivers)) {
    const baseType = extractBaseType(name);
    const receiverType = RECEIVER_TYPES[baseType] || baseType;

    const parsedReceiver: ParsedReceiverConfig = {
      name,
      type: receiverType as ReceiverType,
      enabled: true,
      config: (config as Record<string, unknown>) || {},
      inferredSources: inferSourcesFromReceiver(name, config as Record<string, unknown>),
    };

    parsed.push(parsedReceiver);
  }

  return parsed;
}

function parseProcessors(
  processors: Record<string, unknown>,
  warnings: DetectionWarning[]
): ParsedProcessorConfig[] {
  const parsed: ParsedProcessorConfig[] = [];
  let order = 0;

  for (const [name, config] of Object.entries(processors)) {
    const baseType = extractBaseType(name);
    const processorType = PROCESSOR_TYPES[baseType] || baseType;

    const parsedProcessor: ParsedProcessorConfig = {
      name,
      type: processorType as ProcessorType,
      enabled: true,
      config: (config as Record<string, unknown>) || {},
      order: order++,
    };

    parsed.push(parsedProcessor);
  }

  return parsed;
}

function parseExporters(
  exporters: Record<string, unknown>,
  warnings: DetectionWarning[]
): ParsedExporterConfig[] {
  const parsed: ParsedExporterConfig[] = [];

  for (const [name, config] of Object.entries(exporters)) {
    const baseType = extractBaseType(name);
    const exporterType = EXPORTER_TYPES[baseType] || baseType;
    const configObj = (config as Record<string, unknown>) || {};

    const parsedExporter: ParsedExporterConfig = {
      name,
      type: exporterType as ExporterType,
      enabled: true,
      endpoint: extractEndpoint(configObj),
      config: configObj,
      inferredTarget: inferTargetFromExporter(name, configObj),
    };

    parsed.push(parsedExporter);
  }

  return parsed;
}

function parsePipelines(
  pipelines: Record<string, { receivers?: string[]; processors?: string[]; exporters?: string[] }>,
  warnings: DetectionWarning[]
): ParsedPipelineConfig[] {
  const parsed: ParsedPipelineConfig[] = [];

  for (const [name, config] of Object.entries(pipelines)) {
    const pipelineType = extractPipelineType(name);

    const parsedPipeline: ParsedPipelineConfig = {
      name,
      type: pipelineType,
      receivers: config.receivers || [],
      processors: config.processors || [],
      exporters: config.exporters || [],
    };

    parsed.push(parsedPipeline);
  }

  return parsed;
}

// ============ Mode Detection ============

interface ModeDetectionResult {
  mode: 'agent' | 'gateway';
  confidence: number;
  indicators: string[];
}

function detectCollectorMode(config: ParsedCollectorConfig): ModeDetectionResult {
  let agentScore = 0;
  let gatewayScore = 0;
  const indicators: string[] = [];

  // Check receivers
  for (const receiver of config.receivers) {
    if (['hostmetrics', 'kubeletstats', 'filelog'].includes(receiver.type)) {
      agentScore += 2;
      indicators.push(`Agent: ${receiver.type} receiver`);
    }
    if (receiver.type === 'k8s_cluster') {
      gatewayScore += 1;
      indicators.push(`Gateway: k8s_cluster receiver`);
    }
  }

  // Check processors
  for (const processor of config.processors) {
    if (processor.type === 'tail_sampling') {
      gatewayScore += 3;
      indicators.push('Gateway: tail_sampling processor');
    }
    if (processor.type === 'elasticapm') {
      gatewayScore += 2;
      indicators.push('Gateway: elasticapm processor');
    }
  }

  // Check exporters
  for (const exporter of config.exporters) {
    // Exporting to another collector suggests Agent mode
    if (exporter.name.includes('gateway') || exporter.name.includes('collector')) {
      agentScore += 2;
      indicators.push('Agent: forwards to gateway');
    }
    // Direct to Elasticsearch suggests Gateway mode
    if (exporter.type === 'elasticsearch') {
      gatewayScore += 1;
      indicators.push('Gateway: direct Elasticsearch export');
    }
  }

  // Check connectors (elasticapm connector indicates Gateway)
  if (config.rawConfig.connectors?.elasticapm) {
    gatewayScore += 3;
    indicators.push('Gateway: elasticapm connector');
  }

  const totalScore = agentScore + gatewayScore;
  const mode = gatewayScore > agentScore ? 'gateway' : 'agent';
  const confidence = totalScore > 0 ? Math.max(agentScore, gatewayScore) / totalScore : 0.5;

  return { mode, confidence, indicators };
}

// ============ Node Creation ============

function createCollectorNode(
  id: string,
  config: ParsedCollectorConfig,
  mode: 'agent' | 'gateway'
): Node<CollectorNodeData> {
  const componentType = mode === 'gateway' ? 'collector-gateway' : 'collector-agent';

  const collectorConfig = {
    receivers: config.receivers.map((r) => ({
      type: r.type as ReceiverType,
      enabled: r.enabled,
      config: r.config,
    })),
    processors: config.processors.map((p) => ({
      type: p.type as ProcessorType,
      enabled: p.enabled,
      config: p.config,
    })),
    exporters: config.exporters.map((e) => ({
      type: e.type as ExporterType,
      enabled: e.enabled,
      endpoint: e.endpoint,
      config: e.config,
    })),
  };

  return {
    id,
    type: 'collector',
    position: { x: 400, y: 200 }, // Will be repositioned by layout engine
    data: {
      label: mode === 'gateway' ? 'EDOT Gateway' : 'EDOT Agent',
      componentType,
      description: mode === 'gateway'
        ? 'Centralized collector for sampling and transformation'
        : 'Per-host collector for local telemetry',
      config: collectorConfig,
    },
  };
}

function inferSourceNodes(
  config: ParsedCollectorConfig,
  warnings: DetectionWarning[]
): Node<SDKNodeData>[] {
  const nodes: Node<SDKNodeData>[] = [];
  const seenServices = new Set<string>();

  // Check for OTLP receiver - indicates SDK sources
  const hasOtlpReceiver = config.receivers.some((r) => r.type === 'otlp');

  if (hasOtlpReceiver) {
    // Create a generic SDK node since we can't determine specific services from YAML
    const sdkId = `sdk-${nanoid(6)}`;
    nodes.push({
      id: sdkId,
      type: 'edotSdk',
      position: { x: 100, y: 200 },
      data: {
        label: 'Application',
        componentType: 'edot-sdk',
        description: 'Application instrumented with EDOT SDK',
        language: 'nodejs', // Default, could be any
        serviceName: 'application',
        autoInstrumented: true,
      },
    });

    warnings.push({
      code: 'INFERRED_SDK',
      message: 'SDK source inferred from OTLP receiver. Actual services will be detected from live traffic.',
      severity: 'info',
      suggestion: 'Use traffic analysis for more accurate service detection.',
    });
  }

  // Check for Jaeger/Zipkin receivers - indicates legacy instrumentation
  const hasJaeger = config.receivers.some((r) => r.type === 'jaeger');
  const hasZipkin = config.receivers.some((r) => r.type === 'zipkin');

  if (hasJaeger) {
    nodes.push({
      id: `sdk-jaeger-${nanoid(6)}`,
      type: 'edotSdk',
      position: { x: 100, y: 100 },
      data: {
        label: 'Jaeger Client',
        componentType: 'edot-sdk',
        description: 'Legacy Jaeger instrumented application',
        language: 'java',
        serviceName: 'jaeger-app',
        autoInstrumented: false,
      },
    });
  }

  if (hasZipkin) {
    nodes.push({
      id: `sdk-zipkin-${nanoid(6)}`,
      type: 'edotSdk',
      position: { x: 100, y: 300 },
      data: {
        label: 'Zipkin Client',
        componentType: 'edot-sdk',
        description: 'Legacy Zipkin instrumented application',
        language: 'java',
        serviceName: 'zipkin-app',
        autoInstrumented: false,
      },
    });
  }

  return nodes;
}

function inferTargetNodes(
  config: ParsedCollectorConfig,
  warnings: DetectionWarning[]
): Node<EDOTNodeData>[] {
  const nodes: Node<EDOTNodeData>[] = [];

  for (const exporter of config.exporters) {
    if (exporter.type === 'elasticsearch') {
      // Elasticsearch exporter -> Elastic Observability node
      nodes.push({
        id: `elastic-${nanoid(6)}`,
        type: 'elasticApm',
        position: { x: 700, y: 200 },
        data: {
          label: 'Elastic Observability',
          componentType: 'elastic-apm',
          description: 'Elastic Observability backend',
          features: ['apm', 'logs', 'metrics'],
        } as ElasticNodeData,
      });
    } else if (exporter.type === 'otlp') {
      // OTLP exporter could be to Gateway or managed endpoint
      const isGateway = exporter.name.includes('gateway') ||
        exporter.endpoint?.includes('gateway') ||
        exporter.endpoint?.includes('4317');

      if (isGateway) {
        nodes.push({
          id: `gateway-${nanoid(6)}`,
          type: 'collector',
          position: { x: 700, y: 200 },
          data: {
            label: 'EDOT Gateway',
            componentType: 'collector-gateway',
            description: 'Centralized gateway collector',
            config: {
              receivers: [{ type: 'otlp', enabled: true }],
              processors: [
                { type: 'memory_limiter', enabled: true },
                { type: 'batch', enabled: true },
              ],
              exporters: [{ type: 'elasticsearch', enabled: true }],
            },
          } as CollectorNodeData,
        });
      } else {
        // Generic OTLP endpoint - could be Elastic managed
        nodes.push({
          id: `elastic-${nanoid(6)}`,
          type: 'elasticApm',
          position: { x: 700, y: 200 },
          data: {
            label: 'Elastic Cloud',
            componentType: 'elastic-apm',
            description: 'Elastic Cloud managed endpoint',
            features: ['apm', 'logs', 'metrics'],
          } as ElasticNodeData,
        });
      }
    }
  }

  // If no target nodes created, add a warning
  if (nodes.length === 0) {
    warnings.push({
      code: 'NO_TARGET_DETECTED',
      message: 'No export destination detected. Check exporter configuration.',
      severity: 'warning',
      suggestion: 'Add an elasticsearch or otlp exporter to define the destination.',
    });
  }

  return nodes;
}

function createEdge(
  sourceId: string,
  targetId: string,
  config: ParsedCollectorConfig
): Edge<FlowEdgeData> {
  // Determine telemetry types from pipelines
  const telemetryTypes: TelemetryType[] = [];
  for (const pipeline of config.pipelines) {
    if (!telemetryTypes.includes(pipeline.type)) {
      telemetryTypes.push(pipeline.type);
    }
  }

  // Default to all types if no pipelines
  if (telemetryTypes.length === 0) {
    telemetryTypes.push('traces', 'metrics', 'logs');
  }

  return {
    id: `edge-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    type: 'animated',
    data: {
      telemetryTypes,
      animated: true,
      volume: 5,
      protocol: 'otlp-grpc',
    },
  };
}

// ============ Helper Functions ============

function extractBaseType(name: string): string {
  // Extract base type from names like "otlp", "filelog/platformlogs", "elasticsearch/otel"
  const slashIndex = name.indexOf('/');
  return slashIndex > 0 ? name.substring(0, slashIndex) : name;
}

function extractEndpoint(config: Record<string, unknown>): string | undefined {
  if (typeof config.endpoint === 'string') {
    return config.endpoint;
  }
  if (Array.isArray(config.endpoints) && config.endpoints.length > 0) {
    return config.endpoints[0] as string;
  }
  return undefined;
}

function extractPipelineType(name: string): TelemetryType {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('traces') || lowerName.includes('trace')) {
    return 'traces';
  }
  if (lowerName.includes('metrics') || lowerName.includes('metric')) {
    return 'metrics';
  }
  if (lowerName.includes('logs') || lowerName.includes('log')) {
    return 'logs';
  }
  return 'traces'; // Default
}

function inferSourcesFromReceiver(
  name: string,
  config: Record<string, unknown>
): InferredSource[] {
  const sources: InferredSource[] = [];
  const baseType = extractBaseType(name);

  if (baseType === 'otlp') {
    // OTLP receiver accepts SDK telemetry
    const protocols = config?.protocols as { grpc?: unknown; http?: unknown } | undefined;
    sources.push({
      type: 'sdk',
      protocol: protocols?.grpc ? 'otlp-grpc' : 'otlp-http',
      confidence: 0.8,
    });
  } else if (baseType === 'jaeger' || baseType === 'zipkin') {
    // Legacy receivers
    sources.push({
      type: 'sdk',
      protocol: 'otlp-http',
      confidence: 0.9,
    });
  }

  return sources;
}

function inferTargetFromExporter(
  name: string,
  config: Record<string, unknown>
): InferredTarget {
  const baseType = extractBaseType(name);

  if (baseType === 'elasticsearch') {
    return {
      type: 'elastic',
      endpoint: extractEndpoint(config),
      confidence: 1.0,
    };
  }

  if (baseType === 'otlp') {
    const endpoint = extractEndpoint(config);
    const isGateway = name.includes('gateway') || endpoint?.includes('gateway');

    return {
      type: isGateway ? 'collector' : 'elastic',
      endpoint,
      isGateway,
      confidence: 0.7,
    };
  }

  return {
    type: 'other',
    endpoint: extractEndpoint(config),
    confidence: 0.5,
  };
}

function calculateOverallConfidence(
  config: ParsedCollectorConfig,
  warnings: DetectionWarning[]
): number {
  let confidence = 1.0;

  // Reduce confidence for each warning
  for (const warning of warnings) {
    if (warning.severity === 'error') {
      confidence -= 0.3;
    } else if (warning.severity === 'warning') {
      confidence -= 0.1;
    }
  }

  // Reduce confidence if no exporters
  if (config.exporters.length === 0) {
    confidence -= 0.2;
  }

  // Reduce confidence if no receivers
  if (config.receivers.length === 0) {
    confidence -= 0.2;
  }

  return Math.max(0, Math.min(1, confidence));
}

// ============ Multi-Document YAML Support ============

/**
 * Parse YAML content that may contain multiple documents (e.g., K8s manifests)
 */
export function parseMultiDocumentYaml(yamlContent: string): DetectionResult {
  const documents = YAML.parseAllDocuments(yamlContent);
  const allNodes: Node<EDOTNodeData>[] = [];
  const allEdges: Edge<FlowEdgeData>[] = [];
  const allWarnings: DetectionWarning[] = [];
  let totalConfidence = 0;
  let docCount = 0;

  for (const doc of documents) {
    if (doc.errors.length > 0) {
      allWarnings.push({
        code: 'YAML_DOC_ERROR',
        message: `Document ${docCount + 1} has errors: ${doc.errors.map(e => e.message).join(', ')}`,
        severity: 'warning',
      });
      continue;
    }

    const content = doc.toJSON();
    if (!content) continue;

    // Check if this is an OTel Collector config
    if (content.receivers || content.processors || content.exporters || content.service) {
      const result = parseOtelCollectorYaml(YAML.stringify(content));
      allNodes.push(...result.nodes);
      allEdges.push(...result.edges);
      allWarnings.push(...result.warnings);
      totalConfidence += result.confidence;
      docCount++;
    }
  }

  return {
    nodes: allNodes,
    edges: allEdges,
    warnings: allWarnings,
    confidence: docCount > 0 ? totalConfidence / docCount : 0,
    method: 'yaml',
    timestamp: Date.now(),
  };
}

// ============ Validation ============

/**
 * Validate that YAML content is a valid OTel Collector configuration
 */
export function validateOtelYaml(yamlContent: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const config = YAML.parse(yamlContent) as RawOTelConfig;

    if (!config || typeof config !== 'object') {
      errors.push('YAML content is not a valid object');
      return { isValid: false, errors, warnings };
    }

    // Check for required sections
    if (!config.receivers && !config.processors && !config.exporters) {
      errors.push('No receivers, processors, or exporters defined');
    }

    if (!config.service?.pipelines) {
      warnings.push('No service pipelines defined');
    }

    // Check for common issues
    if (config.processors) {
      const processorNames = Object.keys(config.processors);
      const hasMemoryLimiter = processorNames.some((p) => p.startsWith('memory_limiter'));
      if (!hasMemoryLimiter) {
        warnings.push('memory_limiter processor not found (recommended)');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`YAML parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { isValid: false, errors, warnings };
  }
}
