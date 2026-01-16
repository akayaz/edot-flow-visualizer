import { nanoid } from 'nanoid';
import type { Node, Edge } from '@xyflow/react';
import type {
  EDOTNodeData,
  FlowEdgeData,
  SDKNodeData,
  CollectorNodeData,
  ElasticNodeData,
  TelemetryType,
  SDKLanguage,
} from '../../types';
import type {
  DetectionResult,
  DetectionWarning,
  TrafficAnalysisResult,
  DetectedService,
  DetectedConnection,
  InferredCollector,
} from './types';
import type { TrafficSnapshot, ServiceInfo, ConnectionInfo } from '@/lib/telemetry/processor';

/**
 * Traffic Analyzer
 *
 * Converts telemetry traffic patterns into a visual topology.
 * Analyzes service-to-service connections and infers collectors.
 */

// ============ Main Analysis Function ============

/**
 * Analyze a traffic snapshot and generate a detection result
 */
export function analyzeTrafficSnapshot(snapshot: TrafficSnapshot): DetectionResult {
  const warnings: DetectionWarning[] = [];

  // Convert snapshot to analysis result
  const analysisResult = convertSnapshotToAnalysisResult(snapshot);

  // Validate minimum data
  if (analysisResult.detectedServices.length === 0) {
    warnings.push({
      code: 'NO_SERVICES_DETECTED',
      message: 'No services detected from traffic. Make sure telemetry is flowing.',
      severity: 'error',
    });

    return {
      nodes: [],
      edges: [],
      warnings,
      confidence: 0,
      method: 'traffic',
      timestamp: Date.now(),
    };
  }

  // Generate nodes from detected services
  const nodes = generateNodesFromAnalysis(analysisResult, warnings);

  // Generate edges from detected connections
  const edges = generateEdgesFromAnalysis(analysisResult, nodes, warnings);

  // Calculate confidence
  const confidence = calculateConfidence(analysisResult, warnings);

  // Add informational warnings
  if (analysisResult.observationWindow.duration < 10000) {
    warnings.push({
      code: 'SHORT_OBSERVATION',
      message: 'Short observation window. Longer analysis may detect more services.',
      severity: 'info',
      suggestion: 'Run traffic analysis for at least 30 seconds for better results.',
    });
  }

  return {
    nodes,
    edges,
    warnings,
    confidence,
    method: 'traffic',
    timestamp: Date.now(),
  };
}

// ============ Snapshot Conversion ============

function convertSnapshotToAnalysisResult(snapshot: TrafficSnapshot): TrafficAnalysisResult {
  const detectedServices: DetectedService[] = [];
  const connections: DetectedConnection[] = [];
  const inferredCollectors: InferredCollector[] = [];

  // Convert services
  for (const [, serviceInfo] of snapshot.services) {
    detectedServices.push({
      serviceName: serviceInfo.serviceName,
      language: serviceInfo.language,
      resourceAttributes: serviceInfo.resourceAttributes,
      telemetryTypes: Array.from(serviceInfo.telemetryTypes),
      firstSeen: serviceInfo.firstSeen,
      lastSeen: serviceInfo.lastSeen,
      eventCount: serviceInfo.eventCount,
      spanCount: serviceInfo.traceCount,
      metricCount: serviceInfo.metricCount,
      logCount: serviceInfo.logCount,
      inferredAutoInstrumented: inferAutoInstrumentation(serviceInfo),
    });
  }

  // Convert connections
  for (const [, connInfo] of snapshot.connections) {
    connections.push({
      sourceId: connInfo.sourceId,
      targetId: connInfo.targetId,
      telemetryTypes: Array.from(connInfo.telemetryTypes),
      eventCount: connInfo.eventCount,
      volume: calculateVolume(connInfo.eventCount, snapshot.endTime - snapshot.startTime),
      confidence: 0.8, // Direct observation = high confidence
    });
  }

  // Use detected collectors from snapshot if available
  if (snapshot.collectors && snapshot.collectors.size > 0) {
    for (const [, collectorInfo] of snapshot.collectors) {
      inferredCollectors.push({
        id: collectorInfo.id,
        name: collectorInfo.name,
        mode: collectorInfo.type,
        indicators: [`Detected via User-Agent: ${collectorInfo.userAgent.substring(0, 50)}...`],
        connectedServices: detectedServices.map((s) => s.serviceName),
        confidence: 0.95, // High confidence - directly detected
      });
      console.log(`[Traffic Analyzer] Using detected collector: ${collectorInfo.name} (${collectorInfo.type})`);
    }
  } else {
    // Fall back to inferring collectors from traffic patterns
    inferredCollectors.push(...inferCollectorsFromTraffic(connections, detectedServices));
  }

  // Infer agents based on host attributes
  const inferredAgents = inferAgentsFromHostAttributes(detectedServices, inferredCollectors);
  if (inferredAgents.length > 0) {
    inferredCollectors.push(...inferredAgents);
    console.log(`[Traffic Analyzer] Inferred ${inferredAgents.length} agent(s) from host attributes`);
  }

  return {
    detectedServices,
    connections,
    inferredCollectors,
    observationWindow: {
      start: snapshot.startTime,
      end: snapshot.endTime,
      duration: snapshot.endTime - snapshot.startTime,
    },
    eventCount: {
      traces: detectedServices.reduce((sum, s) => sum + (s.spanCount || 0), 0),
      metrics: detectedServices.reduce((sum, s) => sum + (s.metricCount || 0), 0),
      logs: detectedServices.reduce((sum, s) => sum + (s.logCount || 0), 0),
      total: snapshot.totalEvents,
    },
    confidence: 0.7,
  };
}

// ============ Node Generation ============

function generateNodesFromAnalysis(
  analysis: TrafficAnalysisResult,
  warnings: DetectionWarning[]
): Node<EDOTNodeData>[] {
  const nodes: Node<EDOTNodeData>[] = [];
  const seenIds = new Set<string>();

  // Create SDK nodes for detected services
  let yOffset = 0;
  for (const service of analysis.detectedServices) {
    // Skip if this looks like a collector or elastic endpoint
    if (isCollectorService(service.serviceName) || isElasticService(service.serviceName)) {
      continue;
    }

    const nodeId = `sdk-${sanitizeId(service.serviceName)}`;
    if (seenIds.has(nodeId)) continue;
    seenIds.add(nodeId);

    const sdkNode: Node<SDKNodeData> = {
      id: nodeId,
      type: 'edotSdk',
      position: { x: 100, y: 100 + yOffset * 120 },
      data: {
        label: service.serviceName,
        componentType: 'edot-sdk',
        description: `Detected from traffic (${service.eventCount} events)`,
        language: service.language || 'nodejs',
        serviceName: service.serviceName,
        autoInstrumented: service.inferredAutoInstrumented || false,
      },
    };

    nodes.push(sdkNode);
    yOffset++;
  }

  // Create collector nodes for inferred collectors
  for (const collector of analysis.inferredCollectors) {
    const nodeId = collector.id;
    if (seenIds.has(nodeId)) continue;
    seenIds.add(nodeId);

    // Use the detected name if available, otherwise generate based on mode
    const collectorLabel = collector.name || (collector.mode === 'gateway' ? 'EDOT Gateway' : 'EDOT Agent');
    const isDetected = collector.confidence >= 0.9;
    
    // Agents export via OTLP (to gateway), Gateways export to Elasticsearch (to backend)
    // Per EDOT architecture: Agents never send directly to Elasticsearch
    const exporterType = collector.mode === 'agent' ? 'otlp' : 'elasticsearch';

    const collectorNode: Node<CollectorNodeData> = {
      id: nodeId,
      type: 'collector',
      position: { x: 400, y: 200 },
      data: {
        label: collectorLabel,
        componentType: collector.mode === 'gateway' ? 'collector-gateway' : 'collector-agent',
        description: isDetected 
          ? `Detected: ${collector.indicators[0] || 'via traffic analysis'}`
          : `Inferred: ${collector.indicators.join(', ')}`,
        config: {
          receivers: [{ type: 'otlp', enabled: true }],
          processors: [
            { type: 'memory_limiter', enabled: true },
            { type: 'batch', enabled: true },
          ],
          exporters: [{ type: exporterType, enabled: true }],
        },
      },
    };

    nodes.push(collectorNode);
  }

  // Check for elastic endpoint in connections
  const hasElasticConnection = analysis.connections.some(
    (c) => isElasticService(c.targetId) || isElasticService(c.sourceId)
  );

  // Create Elastic node if detected or if we have collectors
  if (hasElasticConnection || analysis.inferredCollectors.length > 0) {
    const elasticNode: Node<ElasticNodeData> = {
      id: 'elastic-detected',
      type: 'elasticApm',
      position: { x: 700, y: 200 },
      data: {
        label: 'Elastic Observability',
        componentType: 'elastic-apm',
        description: 'Detected destination',
        features: ['apm', 'logs', 'metrics'],
      },
    };

    nodes.push(elasticNode);
  }

  // Add warning if no SDK nodes created
  if (nodes.filter((n) => n.type === 'edotSdk').length === 0) {
    warnings.push({
      code: 'NO_SDK_NODES',
      message: 'No application services detected. Only infrastructure components found.',
      severity: 'warning',
    });
  }

  return nodes;
}

// ============ Edge Generation ============

function generateEdgesFromAnalysis(
  analysis: TrafficAnalysisResult,
  nodes: Node<EDOTNodeData>[],
  warnings: DetectionWarning[]
): Edge<FlowEdgeData>[] {
  const edges: Edge<FlowEdgeData>[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Create edges from detected connections
  for (const conn of analysis.connections) {
    const sourceId = normalizeNodeId(conn.sourceId, nodeIds);
    const targetId = normalizeNodeId(conn.targetId, nodeIds);

    // Skip if source or target not in nodes
    if (!sourceId || !targetId || sourceId === targetId) {
      continue;
    }

    const edgeId = `edge-${sourceId}-${targetId}`;

    // Check if edge already exists
    if (edges.some((e) => e.id === edgeId)) {
      continue;
    }

    edges.push({
      id: edgeId,
      source: sourceId,
      target: targetId,
      type: 'animated',
      data: {
        telemetryTypes: conn.telemetryTypes as TelemetryType[],
        animated: true,
        volume: conn.volume,
        protocol: 'otlp-grpc',
      },
    });
  }

  // Categorize collector nodes by type
  const sdkNodes = nodes.filter((n) => n.type === 'edotSdk');
  const collectorNodes = nodes.filter((n) => n.type === 'collector');
  const elasticNode = nodes.find((n) => n.type === 'elasticApm');
  
  // Separate agents and gateways
  const agentNodes = collectorNodes.filter((n) => {
    const data = n.data as CollectorNodeData;
    return data.componentType === 'collector-agent';
  });
  const gatewayNodes = collectorNodes.filter((n) => {
    const data = n.data as CollectorNodeData;
    return data.componentType === 'collector-gateway';
  });

  // Build proper edge chain: SDK → Agent → Gateway → Elastic
  // Case 1: We have both agents and gateways
  if (sdkNodes.length > 0 && agentNodes.length > 0 && gatewayNodes.length > 0) {
    // SDKs → Agent
    for (const sdk of sdkNodes) {
      const hasEdge = edges.some((e) => e.source === sdk.id);
      if (!hasEdge) {
        edges.push({
          id: `edge-${sdk.id}-${agentNodes[0].id}`,
          source: sdk.id,
          target: agentNodes[0].id,
          type: 'animated',
          data: {
            telemetryTypes: ['traces', 'metrics', 'logs'],
            animated: true,
            volume: 5,
            protocol: 'otlp-grpc',
          },
        });
      }
    }
    
    // Agent → Gateway
    for (const agent of agentNodes) {
      const hasEdge = edges.some((e) => e.source === agent.id && gatewayNodes.some(g => e.target === g.id));
      if (!hasEdge) {
        edges.push({
          id: `edge-${agent.id}-${gatewayNodes[0].id}`,
          source: agent.id,
          target: gatewayNodes[0].id,
          type: 'animated',
          data: {
            telemetryTypes: ['traces', 'metrics', 'logs'],
            animated: true,
            volume: 7,
            protocol: 'otlp-grpc',
          },
        });
      }
    }
    
    // Gateway → Elastic
    if (elasticNode) {
      for (const gateway of gatewayNodes) {
        const hasEdge = edges.some((e) => e.source === gateway.id && e.target === elasticNode.id);
        if (!hasEdge) {
          edges.push({
            id: `edge-${gateway.id}-${elasticNode.id}`,
            source: gateway.id,
            target: elasticNode.id,
            type: 'animated',
            data: {
              telemetryTypes: ['traces', 'metrics', 'logs'],
              animated: true,
              volume: 9,
              protocol: 'otlp-grpc',
            },
          });
        }
      }
    }
  }
  // Case 2: Only gateway (no agent)
  else if (sdkNodes.length > 0 && gatewayNodes.length > 0 && agentNodes.length === 0) {
    // SDKs → Gateway
    for (const sdk of sdkNodes) {
      const hasEdge = edges.some((e) => e.source === sdk.id);
      if (!hasEdge) {
        edges.push({
          id: `edge-${sdk.id}-${gatewayNodes[0].id}`,
          source: sdk.id,
          target: gatewayNodes[0].id,
          type: 'animated',
          data: {
            telemetryTypes: ['traces', 'metrics', 'logs'],
            animated: true,
            volume: 5,
            protocol: 'otlp-grpc',
          },
        });
      }
    }
    
    // Gateway → Elastic
    if (elasticNode) {
      for (const gateway of gatewayNodes) {
        const hasEdge = edges.some((e) => e.source === gateway.id && e.target === elasticNode.id);
        if (!hasEdge) {
          edges.push({
            id: `edge-${gateway.id}-${elasticNode.id}`,
            source: gateway.id,
            target: elasticNode.id,
            type: 'animated',
            data: {
              telemetryTypes: ['traces', 'metrics', 'logs'],
              animated: true,
              volume: 8,
              protocol: 'otlp-grpc',
            },
          });
        }
      }
    }
  }
  // Case 3: Only agent (no gateway)
  else if (sdkNodes.length > 0 && agentNodes.length > 0 && gatewayNodes.length === 0) {
    // SDKs → Agent
    for (const sdk of sdkNodes) {
      const hasEdge = edges.some((e) => e.source === sdk.id);
      if (!hasEdge) {
        edges.push({
          id: `edge-${sdk.id}-${agentNodes[0].id}`,
          source: sdk.id,
          target: agentNodes[0].id,
          type: 'animated',
          data: {
            telemetryTypes: ['traces', 'metrics', 'logs'],
            animated: true,
            volume: 5,
            protocol: 'otlp-grpc',
          },
        });
      }
    }
    
    // Agent → Elastic
    if (elasticNode) {
      for (const agent of agentNodes) {
        const hasEdge = edges.some((e) => e.source === agent.id && e.target === elasticNode.id);
        if (!hasEdge) {
          edges.push({
            id: `edge-${agent.id}-${elasticNode.id}`,
            source: agent.id,
            target: elasticNode.id,
            type: 'animated',
            data: {
              telemetryTypes: ['traces', 'metrics', 'logs'],
              animated: true,
              volume: 7,
              protocol: 'otlp-grpc',
            },
          });
        }
      }
    }
  }
  // Case 4: No collectors at all - direct SDK to Elastic
  else if (sdkNodes.length > 0 && collectorNodes.length === 0 && elasticNode) {
    for (const sdk of sdkNodes) {
      edges.push({
        id: `edge-${sdk.id}-${elasticNode.id}`,
        source: sdk.id,
        target: elasticNode.id,
        type: 'animated',
        data: {
          telemetryTypes: ['traces', 'metrics', 'logs'],
          animated: true,
          volume: 5,
          protocol: 'otlp-grpc',
        },
      });
    }
  }

  return edges;
}

// ============ Agent Inference from Host Attributes ============

/**
 * Infer agent collectors based on host attributes in services.
 * 
 * Logic:
 * - If services report host.name/host.id attributes
 * - And we have a gateway collector detected
 * - Then services must be going through an agent before reaching the gateway
 * 
 * This is because in a typical setup:
 *   SDKs → Agent (per-host) → Gateway (centralized) → Backend
 * 
 * If services have different hosts, we infer one agent per unique host.
 * If services have the same host or no host info, we infer a single agent.
 */
function inferAgentsFromHostAttributes(
  services: DetectedService[],
  existingCollectors: InferredCollector[]
): InferredCollector[] {
  const inferredAgents: InferredCollector[] = [];
  
  // Check if we already have a gateway
  const hasGateway = existingCollectors.some(c => c.mode === 'gateway');
  
  // Check if we already have an agent
  const hasAgent = existingCollectors.some(c => c.mode === 'agent');
  
  // If we already have an agent, don't infer another one
  if (hasAgent) {
    return [];
  }
  
  // If we don't have a gateway, we might not need an agent
  // (could be SDKs sending directly to backend)
  if (!hasGateway) {
    return [];
  }
  
  // Collect unique hosts from services
  const hostToServices = new Map<string, string[]>();
  let servicesWithoutHost = 0;
  
  for (const service of services) {
    const hostName = service.resourceAttributes['host.name'] || 
                     service.resourceAttributes['host.id'] ||
                     service.resourceAttributes['k8s.node.name'];
    
    if (hostName) {
      if (!hostToServices.has(hostName)) {
        hostToServices.set(hostName, []);
      }
      hostToServices.get(hostName)!.push(service.serviceName);
    } else {
      servicesWithoutHost++;
    }
  }
  
  console.log(`[Traffic Analyzer] Host analysis: ${hostToServices.size} unique hosts, ${servicesWithoutHost} services without host info`);
  
  // Decision logic:
  // 1. Multiple unique hosts → One agent per host (but we'll simplify to one agent for now)
  // 2. One unique host → One agent for that host  
  // 3. No host info but have gateway → Infer single agent (services likely on same host)
  
  if (hostToServices.size > 0) {
    // We have host information - infer agent(s)
    // For simplicity, we'll create one agent representing the "agent layer"
    // In a more sophisticated version, we could create one agent per host
    
    const hostNames = Array.from(hostToServices.keys());
    const allServices = services.map(s => s.serviceName);
    
    if (hostToServices.size === 1) {
      // Single host - one agent
      inferredAgents.push({
        id: 'collector-agent-inferred',
        name: 'EDOT Agent',
        mode: 'agent',
        indicators: [
          `Inferred from host: ${hostNames[0]}`,
          `Gateway detected, services have host attributes`,
        ],
        connectedServices: allServices,
        confidence: 0.75,
      });
    } else {
      // Multiple hosts - still create one agent node but note multiple hosts
      // In a production system, you might create one agent per host
      inferredAgents.push({
        id: 'collector-agent-inferred',
        name: 'EDOT Agent',
        mode: 'agent',
        indicators: [
          `Inferred from ${hostToServices.size} unique hosts`,
          `Hosts: ${hostNames.slice(0, 3).join(', ')}${hostNames.length > 3 ? '...' : ''}`,
          `Gateway detected, services distributed across hosts`,
        ],
        connectedServices: allServices,
        confidence: 0.7,
      });
    }
  } else if (services.length > 0 && hasGateway) {
    // No host info but we have services going to a gateway
    // This is the fallback case - infer agent with lower confidence
    inferredAgents.push({
      id: 'collector-agent-inferred',
      name: 'EDOT Agent',
      mode: 'agent',
      indicators: [
        'Inferred: Gateway detected with services',
        'Typical pattern: SDKs → Agent → Gateway',
        'No host.name attribute available for confirmation',
      ],
      connectedServices: services.map(s => s.serviceName),
      confidence: 0.5,
    });
  }
  
  return inferredAgents;
}

// ============ Collector Inference ============

function inferCollectorsFromTraffic(
  connections: DetectedConnection[],
  services: DetectedService[]
): InferredCollector[] {
  const collectors: InferredCollector[] = [];
  const indicators: string[] = [];

  // Check for OTLP receiver pattern
  const hasOtlpReceiver = connections.some(
    (c) => c.sourceId.includes('otlp') || c.targetId.includes('collector')
  );

  // Check for multiple services sending to same target
  const targetCounts = new Map<string, number>();
  for (const conn of connections) {
    targetCounts.set(conn.targetId, (targetCounts.get(conn.targetId) || 0) + 1);
  }

  // If multiple services -> one target, likely a collector
  for (const [targetId, count] of targetCounts) {
    if (count >= 2 && !isElasticService(targetId)) {
      indicators.push(`${count} services sending to ${targetId}`);

      // Determine mode based on patterns
      const isGateway = count >= 3 || targetId.includes('gateway');

      collectors.push({
        id: `collector-${sanitizeId(targetId)}`,
        mode: isGateway ? 'gateway' : 'agent',
        indicators,
        connectedServices: services.map((s) => s.serviceName),
        confidence: Math.min(0.9, 0.5 + count * 0.1),
      });
    }
  }

  // If no collectors detected but we have services, infer a default collector
  if (collectors.length === 0 && services.length > 0) {
    collectors.push({
      id: 'collector-inferred',
      mode: 'agent',
      indicators: ['Default inference from service traffic'],
      connectedServices: services.map((s) => s.serviceName),
      confidence: 0.5,
    });
  }

  return collectors;
}

// ============ Helper Functions ============

function inferAutoInstrumentation(service: ServiceInfo): boolean {
  // Services with high trace counts relative to metrics/logs likely have auto-instrumentation
  const traceRatio = service.traceCount / Math.max(service.eventCount, 1);
  return traceRatio > 0.5;
}

function calculateVolume(eventCount: number, durationMs: number): number {
  // Convert to events per second and scale to 1-10
  const eventsPerSecond = eventCount / Math.max(durationMs / 1000, 1);

  if (eventsPerSecond < 1) return 1;
  if (eventsPerSecond < 5) return 3;
  if (eventsPerSecond < 20) return 5;
  if (eventsPerSecond < 50) return 7;
  if (eventsPerSecond < 100) return 9;
  return 10;
}

function calculateConfidence(
  analysis: TrafficAnalysisResult,
  warnings: DetectionWarning[]
): number {
  let confidence = 0.7;

  // Increase confidence with more services
  confidence += Math.min(0.15, analysis.detectedServices.length * 0.03);

  // Increase confidence with more events
  confidence += Math.min(0.1, analysis.eventCount.total / 1000);

  // Decrease confidence for each warning
  for (const warning of warnings) {
    if (warning.severity === 'error') confidence -= 0.2;
    if (warning.severity === 'warning') confidence -= 0.05;
  }

  // Decrease confidence for short observation
  if (analysis.observationWindow.duration < 5000) {
    confidence -= 0.1;
  }

  return Math.max(0, Math.min(1, confidence));
}

function isCollectorService(name: string): boolean {
  const lowerName = name.toLowerCase();
  return (
    lowerName.includes('collector') ||
    lowerName.includes('otel') ||
    lowerName.includes('otlp') ||
    lowerName.includes('agent') ||
    lowerName.includes('gateway')
  );
}

function isElasticService(name: string): boolean {
  const lowerName = name.toLowerCase();
  return (
    lowerName.includes('elastic') ||
    lowerName.includes('apm') ||
    lowerName.includes('elasticsearch') ||
    lowerName.includes('kibana')
  );
}

function sanitizeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

function normalizeNodeId(id: string, existingIds: Set<string>): string | null {
  // Check if exact match exists
  if (existingIds.has(id)) {
    return id;
  }

  // Try SDK prefix
  const sdkId = `sdk-${sanitizeId(id)}`;
  if (existingIds.has(sdkId)) {
    return sdkId;
  }

  // Try collector prefix
  const collectorId = `collector-${sanitizeId(id)}`;
  if (existingIds.has(collectorId)) {
    return collectorId;
  }

  // Check for elastic
  if (isElasticService(id) && existingIds.has('elastic-detected')) {
    return 'elastic-detected';
  }

  return null;
}

// ============ Real-time Analysis ============

/**
 * Analyze traffic in real-time and update detection result
 */
export function analyzeTrafficRealtime(
  existingResult: DetectionResult,
  newSnapshot: TrafficSnapshot
): DetectionResult {
  // Merge with existing analysis
  const newAnalysis = analyzeTrafficSnapshot(newSnapshot);

  // Merge nodes (avoid duplicates)
  const existingNodeIds = new Set(existingResult.nodes.map((n) => n.id));
  const newNodes = newAnalysis.nodes.filter((n) => !existingNodeIds.has(n.id));

  // Merge edges (avoid duplicates)
  const existingEdgeIds = new Set(existingResult.edges.map((e) => e.id));
  const newEdges = newAnalysis.edges.filter((e) => !existingEdgeIds.has(e.id));

  // Merge warnings (avoid duplicate codes)
  const existingCodes = new Set(existingResult.warnings.map((w) => w.code));
  const newWarnings = newAnalysis.warnings.filter((w) => !existingCodes.has(w.code));

  return {
    nodes: [...existingResult.nodes, ...newNodes],
    edges: [...existingResult.edges, ...newEdges],
    warnings: [...existingResult.warnings, ...newWarnings],
    confidence: Math.max(existingResult.confidence, newAnalysis.confidence),
    method: 'traffic',
    timestamp: Date.now(),
  };
}
