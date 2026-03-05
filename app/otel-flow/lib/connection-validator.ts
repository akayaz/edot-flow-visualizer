import type { Node } from '@xyflow/react';
import type { EDOTNodeData, EDOTComponentType, DeploymentModel } from '../types';

/**
 * Result of connection validation
 */
export type ValidationResult =
  | { valid: true; warning?: string; info?: string }
  | { valid: false; reason: string };

/**
 * Options for connection validation
 */
export interface ConnectionValidationOptions {
  /**
   * The deployment model affects which connections are valid.
   * - serverless/ech: SDK→Elastic direct is valid (Managed OTLP Endpoint)
   * - self-managed: Gateway is recommended as ingestion layer
   */
  deploymentModel?: DeploymentModel;
}

/**
 * Infrastructure node types that are containers, not data endpoints
 */
const INFRASTRUCTURE_NODE_TYPES: EDOTComponentType[] = [
  'infrastructure-host',
  'infrastructure-docker',
  'infrastructure-k8s-namespace',
  'infrastructure-k8s-daemonset',
  'infrastructure-k8s-deployment',
];

/**
 * Check if a component type is an infrastructure container node
 */
export function isInfrastructureNode(componentType: EDOTComponentType): boolean {
  return INFRASTRUCTURE_NODE_TYPES.includes(componentType);
}

/**
 * Get a human-readable name for a component type
 */
function getComponentDisplayName(componentType: EDOTComponentType): string {
  const displayNames: Record<EDOTComponentType, string> = {
    'edot-sdk': 'EDOT SDK',
    'collector-agent': 'Collector Agent',
    'collector-gateway': 'Collector Gateway',
    'elastic-apm': 'Elastic Observability',
    'kafka-broker': 'Kafka Broker',
    'infrastructure-host': 'Host',
    'infrastructure-docker': 'Docker Container',
    'infrastructure-k8s-namespace': 'K8s Namespace',
    'infrastructure-k8s-daemonset': 'K8s DaemonSet',
    'infrastructure-k8s-deployment': 'K8s Deployment',
  };
  return displayNames[componentType] || componentType;
}

/**
 * Validates a connection between two nodes based on EDOT telemetry flow rules.
 * 
 * Valid flow patterns depend on deployment model:
 * 
 * **Serverless / ECH (Managed OTLP Endpoint):**
 * - SDK → Managed Endpoint ✅ (direct, no collector needed)
 * - SDK → Collector Agent → Managed Endpoint ✅
 * - SDK → Collector Gateway → Managed Endpoint ✅
 * - Collector Agent → Managed Endpoint ✅
 * - Gateway is OPTIONAL (for processing/sampling)
 * 
 * **Self-Managed:**
 * - SDK → Collector Agent → Gateway → ES ✅ (recommended)
 * - SDK → Gateway → ES ✅ (acceptable)
 * - SDK → ES direct ⚠️ (valid but not recommended)
 * - Gateway is RECOMMENDED as ingestion layer (replaces APM Server)
 * 
 * @param sourceNode - The node where the connection originates
 * @param targetNode - The node where the connection terminates
 * @param options - Validation options including deployment model
 * @returns ValidationResult indicating if connection is valid, invalid, or has warnings
 */
export function validateConnection(
  sourceNode: Node<EDOTNodeData>,
  targetNode: Node<EDOTNodeData>,
  options: ConnectionValidationOptions = {}
): ValidationResult {
  const { deploymentModel = 'serverless' } = options;
  const sourceType = sourceNode.data.componentType;
  const targetType = targetNode.data.componentType;

  // ===== UNIVERSAL RULES (apply to all deployment models) =====

  // Rule 1: Self-connections are invalid
  if (sourceNode.id === targetNode.id) {
    return {
      valid: false,
      reason: 'Cannot connect a node to itself',
    };
  }

  // Rule 2: Infrastructure nodes cannot have data connections
  if (isInfrastructureNode(sourceType)) {
    return {
      valid: false,
      reason: `${getComponentDisplayName(sourceType)} is a container, not a data source`,
    };
  }

  if (isInfrastructureNode(targetType)) {
    return {
      valid: false,
      reason: `${getComponentDisplayName(targetType)} is a container, not a data destination`,
    };
  }

  // Rule 3: Elastic is a sink - no outbound connections
  if (sourceType === 'elastic-apm') {
    return {
      valid: false,
      reason: 'Elastic Observability is a data sink and cannot send telemetry to other components',
    };
  }

  // Rule 4: Backwards flow - Collectors cannot send to SDKs
  if (
    (sourceType === 'collector-agent' || sourceType === 'collector-gateway') &&
    targetType === 'edot-sdk'
  ) {
    return {
      valid: false,
      reason: 'Telemetry flows from SDKs to Collectors, not the other way around',
    };
  }

  // ===== KAFKA-SPECIFIC RULES =====

  // Kafka → SDK: Invalid (backwards flow)
  if (sourceType === 'kafka-broker' && targetType === 'edot-sdk') {
    return {
      valid: false,
      reason: 'Kafka cannot send telemetry back to SDKs. Telemetry flows from SDKs through Collectors to Kafka.',
    };
  }

  // SDK → Kafka: Invalid (SDKs don't speak Kafka protocol)
  if (sourceType === 'edot-sdk' && targetType === 'kafka-broker') {
    return {
      valid: false,
      reason: 'SDKs cannot send telemetry directly to Kafka. Route through a Collector with kafkaexporter instead.',
    };
  }

  // Kafka → Elastic: Invalid (Elastic can't consume from Kafka directly)
  if (sourceType === 'kafka-broker' && targetType === 'elastic-apm') {
    return {
      valid: false,
      reason: 'Elastic cannot consume directly from Kafka. Use a Collector with kafkareceiver between Kafka and Elastic.',
    };
  }

  // Collector Agent → Kafka: Valid (Agent uses kafkaexporter)
  if (sourceType === 'collector-agent' && targetType === 'kafka-broker') {
    return {
      valid: true,
      info: 'Agent will use kafkaexporter to produce telemetry to Kafka topics for buffered delivery.',
    };
  }

  // Collector Gateway → Kafka: Valid (Gateway uses kafkaexporter)
  if (sourceType === 'collector-gateway' && targetType === 'kafka-broker') {
    return {
      valid: true,
      info: 'Gateway will use kafkaexporter to produce telemetry to Kafka topics.',
    };
  }

  // Kafka → Collector Gateway: Valid and recommended
  if (sourceType === 'kafka-broker' && targetType === 'collector-gateway') {
    return {
      valid: true,
      info: 'Gateway will use kafkareceiver to consume telemetry from Kafka. This is the recommended HA pattern.',
    };
  }

  // Kafka → Collector Agent: Valid
  if (sourceType === 'kafka-broker' && targetType === 'collector-agent') {
    return {
      valid: true,
      info: 'Agent will use kafkareceiver to consume telemetry from Kafka.',
    };
  }

  // Kafka → Kafka: Valid with warning (multi-cluster mirroring)
  if (sourceType === 'kafka-broker' && targetType === 'kafka-broker') {
    return {
      valid: true,
      warning: 'Kafka-to-Kafka connections represent cross-cluster mirroring, which is unusual for telemetry pipelines.',
    };
  }

  // ===== DEPLOYMENT-SPECIFIC RULES =====

  const isManagedEndpoint = deploymentModel === 'serverless' || deploymentModel === 'ech';
  const isSelfManaged = deploymentModel === 'self-managed';

  // SDK → Elastic direct connection
  if (sourceType === 'edot-sdk' && targetType === 'elastic-apm') {
    if (isManagedEndpoint) {
      // Serverless/ECH: Direct connection to Managed OTLP Endpoint is valid
      return {
        valid: true,
        info: 'Direct OTLP connection to Managed Endpoint. Consider adding an Agent collector for host metrics collection.',
      };
    } else {
      // Self-Managed: Direct connection is valid but not recommended
      return {
        valid: true,
        warning: 'For self-managed deployments, a Gateway collector is recommended as the ingestion layer. Gateway replaces APM Server in EDOT architecture.',
      };
    }
  }

  // Collector Agent → Elastic direct (without Gateway)
  if (sourceType === 'collector-agent' && targetType === 'elastic-apm') {
    if (isManagedEndpoint) {
      // Serverless/ECH: Agent can send directly to Managed Endpoint
      return { valid: true };
    } else {
      // Self-Managed: Agent should send to Gateway, not directly to ES
      return {
        valid: true,
        warning: 'For self-managed deployments, Agents should send to a Gateway collector. The Gateway provides centralized processing and replaces APM Server.',
      };
    }
  }

  // Collector Gateway → Elastic (recommended for self-managed)
  if (sourceType === 'collector-gateway' && targetType === 'elastic-apm') {
    if (isSelfManaged) {
      return {
        valid: true,
        info: 'Gateway to Elasticsearch is the recommended pattern for self-managed deployments.',
      };
    }
    return { valid: true };
  }

  // ===== WARNING CASES (apply to all deployment models) =====

  // Warning: SDK to SDK connections are unusual
  if (sourceType === 'edot-sdk' && targetType === 'edot-sdk') {
    return {
      valid: true,
      warning: 'SDK-to-SDK connections are unusual. SDKs typically send telemetry to Collectors or Elastic.',
    };
  }

  // Warning: Agent to Agent chaining is unusual
  if (sourceType === 'collector-agent' && targetType === 'collector-agent') {
    return {
      valid: true,
      warning: 'Agent-to-Agent chaining is uncommon. Agents typically send to Gateways or directly to Elastic.',
    };
  }

  // Gateway to Gateway chaining - valid for multi-tier/HA patterns in self-managed
  if (sourceType === 'collector-gateway' && targetType === 'collector-gateway') {
    if (isSelfManaged) {
      return {
        valid: true,
        info: 'Gateway-to-Gateway chaining can be used for multi-tier processing or Kafka buffering in HA setups.',
      };
    }
    return {
      valid: true,
      warning: 'Gateway-to-Gateway chaining is unusual. Consider if this is the intended routing pattern.',
    };
  }

  // Warning: Gateway to Agent (unusual reverse hierarchy)
  if (sourceType === 'collector-gateway' && targetType === 'collector-agent') {
    return {
      valid: true,
      warning: 'Gateway-to-Agent is an unusual pattern. Typically Agents send to Gateways, not the reverse.',
    };
  }

  // ===== VALID PATTERNS =====
  // All remaining connections are valid:
  // - SDK → Collector Agent ✅
  // - SDK → Collector Gateway ✅
  // - Collector Agent → Collector Gateway ✅

  // SDK → Agent: Recommended pattern for host metrics
  if (sourceType === 'edot-sdk' && targetType === 'collector-agent') {
    return {
      valid: true,
      info: 'SDK to Agent is the recommended pattern. The Agent collects host metrics and enriches telemetry with resource attributes.',
    };
  }

  // Agent → Gateway: Recommended for self-managed
  if (sourceType === 'collector-agent' && targetType === 'collector-gateway') {
    if (isSelfManaged) {
      return {
        valid: true,
        info: 'Agent to Gateway is the recommended pattern for self-managed. Gateway provides centralized processing.',
      };
    }
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Check if a connection between two component types is valid
 * (simplified version without node context)
 * 
 * @param sourceType - Source component type
 * @param targetType - Target component type
 * @param deploymentModel - Optional deployment model for context-aware validation
 * @returns true if the connection is valid (may still have warnings)
 */
export function isValidConnectionType(
  sourceType: EDOTComponentType,
  targetType: EDOTComponentType,
  deploymentModel?: DeploymentModel
): boolean {
  // Infrastructure nodes cannot connect
  if (isInfrastructureNode(sourceType) || isInfrastructureNode(targetType)) {
    return false;
  }

  // Elastic cannot be a source
  if (sourceType === 'elastic-apm') {
    return false;
  }

  // Collectors cannot send to SDKs
  if (
    (sourceType === 'collector-agent' || sourceType === 'collector-gateway') &&
    targetType === 'edot-sdk'
  ) {
    return false;
  }

  // Kafka cannot send to SDKs (backwards flow)
  if (sourceType === 'kafka-broker' && targetType === 'edot-sdk') {
    return false;
  }

  // SDKs cannot send directly to Kafka (need a Collector with kafkaexporter)
  if (sourceType === 'edot-sdk' && targetType === 'kafka-broker') {
    return false;
  }

  // Kafka cannot send directly to Elastic (need a Collector with kafkareceiver)
  if (sourceType === 'kafka-broker' && targetType === 'elastic-apm') {
    return false;
  }

  // Note: All other connections are technically valid
  // Warnings/recommendations are handled by validateConnection()
  return true;
}

/**
 * Get deployment-specific connection recommendation
 */
export function getConnectionRecommendation(
  sourceType: EDOTComponentType,
  targetType: EDOTComponentType,
  deploymentModel: DeploymentModel
): string | null {
  const isManagedEndpoint = deploymentModel === 'serverless' || deploymentModel === 'ech';
  const isSelfManaged = deploymentModel === 'self-managed';

  // SDK → Elastic recommendations
  if (sourceType === 'edot-sdk' && targetType === 'elastic-apm') {
    if (isManagedEndpoint) {
      return 'Consider adding an Agent collector for host metrics and resource enrichment.';
    }
    return 'For self-managed, use Gateway as the ingestion layer. Pattern: SDK → Agent → Gateway → ES';
  }

  // Agent → Elastic recommendations for self-managed
  if (sourceType === 'collector-agent' && targetType === 'elastic-apm' && isSelfManaged) {
    return 'For self-managed, route through Gateway for centralized processing: Agent → Gateway → ES';
  }

  return null;
}

