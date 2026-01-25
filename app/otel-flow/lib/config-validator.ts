import type { Node, Edge } from '@xyflow/react';
import type {
  CollectorNodeData,
  EDOTNodeData,
  ProcessorType,
  ReceiverType,
  ExporterType,
  DeploymentModel,
} from '../types';

// ============ Validation Result Types ============

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
  affectedComponent?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

// ============ Collector Config Validation ============

/**
 * Validates a collector configuration and returns issues.
 */
export function validateCollectorConfig(data: CollectorNodeData): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  const isGateway = data.componentType === 'collector-gateway';
  const enabledReceivers = data.config.receivers.filter((r) => r.enabled);
  const enabledProcessors = data.config.processors.filter((p) => p.enabled);
  const enabledExporters = data.config.exporters.filter((e) => e.enabled);

  // ===== ERRORS (Critical issues that would prevent config from working) =====

  // Error: No receivers enabled
  if (enabledReceivers.length === 0) {
    errors.push({
      id: 'no-receivers',
      severity: 'error',
      message: 'No receivers enabled',
      suggestion: 'Enable at least one receiver (e.g., OTLP) to collect telemetry',
    });
  }

  // Error: No exporters enabled
  if (enabledExporters.length === 0) {
    errors.push({
      id: 'no-exporters',
      severity: 'error',
      message: 'No exporters enabled',
      suggestion: 'Enable at least one exporter (e.g., Elasticsearch) to send telemetry',
    });
  }

  // ===== WARNINGS (Best practice violations) =====

  // Warning: memory_limiter should be first processor
  const memoryLimiterIndex = enabledProcessors.findIndex((p) => p.type === 'memory_limiter');
  if (memoryLimiterIndex > 0) {
    warnings.push({
      id: 'memory-limiter-not-first',
      severity: 'warning',
      message: 'memory_limiter should be the first processor',
      suggestion: 'Move memory_limiter to the beginning of the processor pipeline to prevent OOM',
    });
  }

  // Warning: memory_limiter not enabled
  if (memoryLimiterIndex === -1) {
    warnings.push({
      id: 'no-memory-limiter',
      severity: 'warning',
      message: 'memory_limiter is not enabled',
      suggestion: 'Enable memory_limiter to prevent out-of-memory crashes under high load',
    });
  }

  // Per EDOT docs: elasticapm processor should ALWAYS be the LAST processor in Gateway mode
  // https://www.elastic.co/docs/reference/edot-collector/components/elasticapmprocessor
  const batchIndex = enabledProcessors.findIndex((p) => p.type === 'batch');
  const elasticApmIndex = enabledProcessors.findIndex((p) => p.type === 'elasticapm');
  
  // For Gateway mode with elasticapm: elasticapm must be LAST
  if (isGateway && elasticApmIndex !== -1) {
    // Check if elasticapm is the last processor
    if (elasticApmIndex !== enabledProcessors.length - 1) {
      warnings.push({
        id: 'elasticapm-not-last',
        severity: 'warning',
        message: 'elasticapm processor must be the LAST processor',
        suggestion: 'Per EDOT docs: elasticapm should always be the last processor in the chain. Move it to the end.',
      });
    }
    // Check if batch comes before elasticapm
    if (batchIndex !== -1 && batchIndex > elasticApmIndex) {
      warnings.push({
        id: 'batch-after-elasticapm',
        severity: 'warning',
        message: 'batch processor should come BEFORE elasticapm',
        suggestion: 'Correct order: memory_limiter → ... → batch → elasticapm (last)',
      });
    }
  } else if (batchIndex !== -1 && batchIndex < enabledProcessors.length - 1) {
    // For non-Gateway or no elasticapm: batch should generally be last (traditional approach)
    const processorsAfterBatch = enabledProcessors.slice(batchIndex + 1);
    const hasNonElasticProcessor = processorsAfterBatch.some(
      (p) => !['elasticapm', 'spanmetrics'].includes(p.type)
    );
    if (hasNonElasticProcessor) {
      info.push({
        id: 'batch-not-last',
        severity: 'info',
        message: 'batch processor is not the last processor',
        suggestion: 'For Agent mode, batch typically comes last. For Gateway with elasticapm, elasticapm must be last.',
      });
    }
  }

  // Warning: tail_sampling on Agent mode
  const hasTailSampling = enabledProcessors.some((p) => p.type === 'tail_sampling');
  if (hasTailSampling && !isGateway) {
    warnings.push({
      id: 'tail-sampling-on-agent',
      severity: 'warning',
      message: 'tail_sampling is enabled in Agent mode',
      suggestion: 'Tail sampling works best in Gateway mode where all traces are available for decision making',
    });
  }

  // Warning: Gateway with Elasticsearch exporter should have elasticapm processor
  // Required for Elastic APM UIs to work properly
  const hasElasticsearchExporter = enabledExporters.some((e) => e.type === 'elasticsearch');
  const hasElasticApmProcessor = enabledProcessors.some((p) => p.type === 'elasticapm');
  if (isGateway && hasElasticsearchExporter && !hasElasticApmProcessor) {
    warnings.push({
      id: 'gateway-no-elasticapm',
      severity: 'warning',
      message: 'Gateway with Elasticsearch exporter missing elasticapm processor',
      suggestion: 'Enable elasticapm processor for Elastic APM UIs to work properly. It enriches traces and generates APM metrics.',
    });
  }

  // Warning: No batch processor (performance)
  if (batchIndex === -1) {
    warnings.push({
      id: 'no-batch-processor',
      severity: 'warning',
      message: 'batch processor is not enabled',
      suggestion: 'Enable batch processor for better performance and reduced network overhead',
    });
  }

  // Warning: hostmetrics on Gateway (unusual)
  const hasHostMetrics = enabledReceivers.some((r) => r.type === 'hostmetrics');
  if (hasHostMetrics && isGateway) {
    info.push({
      id: 'hostmetrics-on-gateway',
      severity: 'info',
      message: 'hostmetrics enabled on Gateway',
      suggestion: 'Host metrics are typically collected by Agents. Gateway usually only receives OTLP.',
    });
  }

  // Warning: K8s receivers without k8sattributes processor
  const hasK8sReceivers = enabledReceivers.some((r) => 
    ['k8s_cluster', 'kubeletstats'].includes(r.type)
  );
  const hasK8sAttributes = enabledProcessors.some((p) => p.type === 'k8sattributes');
  if (hasK8sReceivers && !hasK8sAttributes) {
    info.push({
      id: 'k8s-receivers-no-attributes',
      severity: 'info',
      message: 'K8s receivers without k8sattributes processor',
      suggestion: 'Consider enabling k8sattributes processor to enrich telemetry with Kubernetes metadata',
    });
  }

  // Info: resourcedetection recommended
  const hasResourceDetection = enabledProcessors.some((p) => p.type === 'resourcedetection');
  if (!hasResourceDetection && !isGateway) {
    info.push({
      id: 'no-resource-detection',
      severity: 'info',
      message: 'resourcedetection processor not enabled',
      suggestion: 'Enable resourcedetection to automatically detect host, cloud, and container information',
    });
  }

  // Info: Debug exporter in production
  const hasDebugExporter = enabledExporters.some((e) => 
    ['debug', 'logging'].includes(e.type)
  );
  if (hasDebugExporter && enabledExporters.length === 1) {
    warnings.push({
      id: 'only-debug-exporter',
      severity: 'warning',
      message: 'Only debug/logging exporter enabled',
      suggestion: 'Add a production exporter (Elasticsearch, OTLP) to actually send telemetry',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    info,
  };
}

// ============ Topology Validation ============

/**
 * Options for topology validation
 */
export interface TopologyValidationOptions {
  /**
   * The deployment model affects which patterns are recommended.
   * - serverless/ech: Gateway is optional, direct OTLP to Managed Endpoint is valid
   * - self-managed: Gateway is recommended as ingestion layer
   */
  deploymentModel?: DeploymentModel;
}

/**
 * Validates the entire topology for architectural issues.
 * 
 * @param nodes - All nodes in the topology
 * @param edges - All edges in the topology
 * @param options - Validation options including deployment model
 * @returns ValidationResult with deployment-aware messages
 */
export function validateTopology(
  nodes: Node<EDOTNodeData>[],
  edges: Edge[],
  options: TopologyValidationOptions = {}
): ValidationResult {
  const { deploymentModel = 'serverless' } = options;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  const isManagedEndpoint = deploymentModel === 'serverless' || deploymentModel === 'ech';
  const isSelfManaged = deploymentModel === 'self-managed';

  // Count node types
  const sdkNodes = nodes.filter((n) => n.data.componentType === 'edot-sdk');
  const agentNodes = nodes.filter((n) => n.data.componentType === 'collector-agent');
  const gatewayNodes = nodes.filter((n) => n.data.componentType === 'collector-gateway');
  const elasticNodes = nodes.filter((n) => n.data.componentType === 'elastic-apm');

  // Error: No destination (Elastic)
  if (elasticNodes.length === 0 && sdkNodes.length > 0) {
    errors.push({
      id: 'no-destination',
      severity: 'error',
      message: 'No Elastic Observability destination',
      suggestion: isManagedEndpoint 
        ? 'Add an Elastic node representing the Managed OTLP Endpoint'
        : 'Add an Elastic node representing your Elasticsearch deployment',
    });
  }

  // ===== DEPLOYMENT-SPECIFIC: Gateway requirement =====
  
  // Self-Managed: Gateway is strongly recommended
  if (isSelfManaged && gatewayNodes.length === 0 && sdkNodes.length > 0) {
    warnings.push({
      id: 'self-managed-no-gateway',
      severity: 'warning',
      message: 'Self-managed deployment without Gateway collector',
      suggestion: 'For self-managed deployments, add a Gateway collector as the ingestion layer. Gateway replaces APM Server in EDOT architecture.',
    });
  }

  // Serverless/ECH: Gateway is optional but helpful for many services
  if (isManagedEndpoint && sdkNodes.length > 5 && gatewayNodes.length === 0) {
    info.push({
      id: 'many-sdks-no-gateway',
      severity: 'info',
      message: `${sdkNodes.length} services without a Gateway collector`,
      suggestion: 'Consider adding a Gateway for centralized sampling and transformation when managing many services',
    });
  }

  // ===== DEPLOYMENT-SPECIFIC: SDK direct to Elastic patterns =====

  const sdkDirectToElastic = edges.filter((e) => {
    const source = nodes.find((n) => n.id === e.source);
    const target = nodes.find((n) => n.id === e.target);
    return source?.data.componentType === 'edot-sdk' && 
           target?.data.componentType === 'elastic-apm';
  });

  if (sdkDirectToElastic.length > 0) {
    if (isSelfManaged) {
      // Self-Managed: SDK→ES direct is not recommended
      warnings.push({
        id: 'sdk-direct-to-elastic-self-managed',
        severity: 'warning',
        message: `${sdkDirectToElastic.length} SDK(s) sending directly to Elasticsearch`,
        suggestion: 'For self-managed: Route through Gateway (SDK → Agent → Gateway → ES). Gateway provides processing and replaces APM Server.',
      });
    } else if (sdkDirectToElastic.length > 0 && agentNodes.length === 0) {
      // Serverless/ECH: Valid but Agent adds value
      info.push({
        id: 'sdk-direct-no-agent',
        severity: 'info',
        message: 'SDKs sending directly to Managed Endpoint without Agent collectors',
        suggestion: 'Adding Agent collectors provides host metrics collection and resource attribute enrichment',
      });
    }
  }

  // ===== DEPLOYMENT-SPECIFIC: Agent → Elastic without Gateway (self-managed) =====

  if (isSelfManaged) {
    const agentDirectToElastic = edges.filter((e) => {
      const source = nodes.find((n) => n.id === e.source);
      const target = nodes.find((n) => n.id === e.target);
      return source?.data.componentType === 'collector-agent' && 
             target?.data.componentType === 'elastic-apm';
    });

    if (agentDirectToElastic.length > 0) {
      warnings.push({
        id: 'agent-direct-to-elastic-self-managed',
        severity: 'warning',
        message: `${agentDirectToElastic.length} Agent(s) sending directly to Elasticsearch`,
        suggestion: 'For self-managed: Route Agents through Gateway for centralized processing (Agent → Gateway → ES)',
      });
    }
  }

  // ===== UNIVERSAL CHECKS =====

  // Info: Multiple Gateways (load balancing consideration)
  if (gatewayNodes.length > 1) {
    info.push({
      id: 'multiple-gateways',
      severity: 'info',
      message: `${gatewayNodes.length} Gateway collectors configured`,
      suggestion: 'Ensure load balancing is configured in front of multiple Gateways for high availability',
    });
  }

  // Warning: Disconnected nodes (no edges)
  const connectedNodeIds = new Set([
    ...edges.map((e) => e.source),
    ...edges.map((e) => e.target),
  ]);
  const disconnectedNodes = nodes.filter(
    (n) => !connectedNodeIds.has(n.id) && 
           !n.data.componentType.startsWith('infrastructure-')
  );
  if (disconnectedNodes.length > 0) {
    warnings.push({
      id: 'disconnected-nodes',
      severity: 'warning',
      message: `${disconnectedNodes.length} node(s) not connected`,
      suggestion: `Connect ${disconnectedNodes.map((n) => n.data.label).join(', ')} to the telemetry pipeline`,
    });
  }

  // Info: Agent without incoming connections (may be collecting host metrics only)
  const agentsWithoutIncomingEdges = agentNodes.filter((agent) => {
    const hasIncoming = edges.some((e) => e.target === agent.id);
    return !hasIncoming;
  });
  if (agentsWithoutIncomingEdges.length > 0) {
    info.push({
      id: 'agent-no-sdk',
      severity: 'info',
      message: `${agentsWithoutIncomingEdges.length} Agent collector(s) without incoming connections`,
      suggestion: 'Agents without SDK connections may still collect host metrics. Connect SDKs if application telemetry is needed.',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    info,
  };
}

// ============ Combined Validation ============

/**
 * Validates a specific collector node and returns all issues.
 */
export function validateNode(
  node: Node<EDOTNodeData>,
  allNodes: Node<EDOTNodeData>[],
  allEdges: Edge[]
): ValidationResult {
  if (
    node.data.componentType === 'collector-agent' ||
    node.data.componentType === 'collector-gateway'
  ) {
    return validateCollectorConfig(node.data as CollectorNodeData);
  }

  // For non-collector nodes, return empty validation
  return {
    isValid: true,
    errors: [],
    warnings: [],
    info: [],
  };
}

/**
 * Get a count summary of validation issues.
 */
export function getValidationSummary(result: ValidationResult): string {
  const parts: string[] = [];
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`);
  }
  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}`);
  }
  if (result.info.length > 0) {
    parts.push(`${result.info.length} suggestion${result.info.length > 1 ? 's' : ''}`);
  }
  return parts.join(', ') || 'No issues';
}

