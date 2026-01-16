import { nanoid } from 'nanoid';
import type { TelemetryEvent, TelemetryType, ThroughputStats, SDKLanguage } from '@/app/otel-flow/types';

// ============ Traffic Analysis Types ============

export interface ServiceInfo {
  serviceName: string;
  language?: SDKLanguage;
  resourceAttributes: Record<string, string>;
  telemetryTypes: Set<TelemetryType>;
  firstSeen: number;
  lastSeen: number;
  eventCount: number;
  traceCount: number;
  metricCount: number;
  logCount: number;
}

export interface ConnectionInfo {
  sourceId: string;
  targetId: string;
  telemetryTypes: Set<TelemetryType>;
  eventCount: number;
  firstSeen: number;
  lastSeen: number;
}

export interface DetectedCollectorInfo {
  id: string;
  name: string;
  type: 'agent' | 'gateway';
  userAgent: string;
  firstSeen: number;
  lastSeen: number;
  eventCount: number;
}

export interface TrafficSnapshot {
  services: Map<string, ServiceInfo>;
  connections: Map<string, ConnectionInfo>;
  collectors: Map<string, DetectedCollectorInfo>;
  startTime: number;
  endTime: number;
  totalEvents: number;
}

// In-memory telemetry buffer (in production, use Redis or similar)
class TelemetryBuffer {
  private events: TelemetryEvent[] = [];
  private maxSize = 1000;
  private listeners: Set<(events: TelemetryEvent[]) => void> = new Set();
  private throughputCounters: Map<string, { traces: number; metrics: number; logs: number; lastReset: number }> = new Map();
  
  // Sliding window for accurate per-second rates (stores timestamps of recent events)
  private slidingWindow: Map<string, { traces: number[]; metrics: number[]; logs: number[] }> = new Map();
  private readonly WINDOW_SIZE_MS = 1000; // 1 second window

  // Traffic analysis state
  private isAnalyzing = false;
  private analysisStartTime: number | null = null;
  private analysisEvents: TelemetryEvent[] = [];
  private serviceRegistry: Map<string, ServiceInfo> = new Map();
  private connectionRegistry: Map<string, ConnectionInfo> = new Map();
  private collectorRegistry: Map<string, DetectedCollectorInfo> = new Map();

  addEvent(event: TelemetryEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxSize) {
      this.events = this.events.slice(-this.maxSize);
    }

    const now = Date.now();
    const counterId = event.sourceComponent;
    
    // Update cumulative throughput counters (for legacy/average stats)
    let counter = this.throughputCounters.get(counterId);
    if (!counter) {
      counter = { traces: 0, metrics: 0, logs: 0, lastReset: now };
      this.throughputCounters.set(counterId, counter);
    }
    counter[event.type]++;

    // Update sliding window for accurate per-second rates
    let window = this.slidingWindow.get(counterId);
    if (!window) {
      window = { traces: [], metrics: [], logs: [] };
      this.slidingWindow.set(counterId, window);
    }
    window[event.type].push(now);

    // Track for traffic analysis if active
    if (this.isAnalyzing) {
      this.analysisEvents.push(event);
      this.updateServiceRegistry(event);
      this.updateConnectionRegistry(event);
    }

    // Notify listeners
    this.notifyListeners([event]);
  }

  addEvents(events: TelemetryEvent[]): void {
    events.forEach((e) => this.addEvent(e));
  }

  subscribe(callback: (events: TelemetryEvent[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(events: TelemetryEvent[]): void {
    this.listeners.forEach((callback) => callback(events));
  }

  getRecentEvents(limit = 100): TelemetryEvent[] {
    return this.events.slice(-limit);
  }

  getAllEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  getThroughputStats(): ThroughputStats[] {
    const now = Date.now();
    const cutoff = now - this.WINDOW_SIZE_MS;
    const stats: ThroughputStats[] = [];

    // Use sliding window for accurate per-second rates
    this.slidingWindow.forEach((window, componentId) => {
      // Filter to only events within the window and update arrays
      window.traces = window.traces.filter(t => t > cutoff);
      window.metrics = window.metrics.filter(t => t > cutoff);
      window.logs = window.logs.filter(t => t > cutoff);

      // Only include components that have recent activity or are registered
      const hasActivity = window.traces.length > 0 || window.metrics.length > 0 || window.logs.length > 0;
      const isRegistered = this.throughputCounters.has(componentId);
      
      if (hasActivity || isRegistered) {
        stats.push({
          componentId,
          window: '1s',
          traces: window.traces.length,
          metrics: window.metrics.length,
          logs: window.logs.length,
          lastUpdated: now,
        });
      }
    });

    return stats;
  }

  resetCounters(): void {
    const now = Date.now();
    this.throughputCounters.forEach((counter) => {
      counter.traces = 0;
      counter.metrics = 0;
      counter.logs = 0;
      counter.lastReset = now;
    });
    // Clear sliding window as well
    this.slidingWindow.clear();
  }

  // ============ Traffic Analysis Methods ============

  /**
   * Start traffic analysis session
   */
  startAnalysis(): void {
    this.isAnalyzing = true;
    this.analysisStartTime = Date.now();
    this.analysisEvents = [];
    this.serviceRegistry.clear();
    this.connectionRegistry.clear();
    this.collectorRegistry.clear();
  }

  /**
   * Register a detected collector from request headers
   */
  registerCollector(userAgent: string): void {
    if (!this.isAnalyzing) return;
    
    // Parse User-Agent to identify collector type
    const lowerUA = userAgent.toLowerCase();
    let collectorType: 'agent' | 'gateway' = 'agent';
    let collectorName = 'Unknown Collector';
    let collectorId = 'collector-unknown';
    
    // Detect Elastic distribution of OpenTelemetry Collector (EDOT)
    // User-Agent example: "Elastic opentelemetry-collector distribution/9.2.3 (linux/arm64)"
    if (lowerUA.includes('elastic') && lowerUA.includes('opentelemetry-collector')) {
      collectorName = 'EDOT Gateway';
      collectorType = 'gateway';
      collectorId = 'collector-edot-gateway';
    } else if (lowerUA.includes('elastic-agent') || lowerUA.includes('edot')) {
      collectorName = 'EDOT Agent';
      collectorType = 'agent';
      collectorId = 'collector-edot-agent';
    } else if (lowerUA.includes('otel-collector') || lowerUA.includes('opentelemetry-collector')) {
      // Standard OTel Collector
      if (lowerUA.includes('gateway')) {
        collectorName = 'OTel Gateway';
        collectorType = 'gateway';
        collectorId = 'collector-otel-gateway';
      } else {
        collectorName = 'OTel Collector';
        collectorType = 'agent';
        collectorId = 'collector-otel';
      }
    } else if (lowerUA.includes('collector')) {
      collectorName = 'Collector';
      collectorId = 'collector-generic';
    }
    
    const now = Date.now();
    
    if (!this.collectorRegistry.has(collectorId)) {
      this.collectorRegistry.set(collectorId, {
        id: collectorId,
        name: collectorName,
        type: collectorType,
        userAgent,
        firstSeen: now,
        lastSeen: now,
        eventCount: 1,
      });
      console.log(`[Collector Detection] Detected ${collectorType}: ${collectorName} (User-Agent: ${userAgent})`);
    } else {
      const existing = this.collectorRegistry.get(collectorId)!;
      existing.lastSeen = now;
      existing.eventCount++;
    }
  }

  /**
   * Stop traffic analysis and return snapshot
   */
  stopAnalysis(): TrafficSnapshot {
    this.isAnalyzing = false;
    const endTime = Date.now();

    const snapshot: TrafficSnapshot = {
      services: new Map(this.serviceRegistry),
      connections: new Map(this.connectionRegistry),
      collectors: new Map(this.collectorRegistry),
      startTime: this.analysisStartTime || endTime,
      endTime,
      totalEvents: this.analysisEvents.length,
    };

    return snapshot;
  }

  /**
   * Check if analysis is currently active
   */
  isAnalysisActive(): boolean {
    return this.isAnalyzing;
  }

  /**
   * Get current analysis progress
   */
  getAnalysisProgress(): {
    isActive: boolean;
    duration: number;
    eventCount: number;
    serviceCount: number;
    connectionCount: number;
  } {
    return {
      isActive: this.isAnalyzing,
      duration: this.analysisStartTime ? Date.now() - this.analysisStartTime : 0,
      eventCount: this.analysisEvents.length,
      serviceCount: this.serviceRegistry.size,
      connectionCount: this.connectionRegistry.size,
    };
  }

  /**
   * Get events grouped by service name
   */
  getEventsByService(): Map<string, TelemetryEvent[]> {
    const byService = new Map<string, TelemetryEvent[]>();

    for (const event of this.events) {
      const serviceName = event.metadata.serviceName || 'unknown';
      if (!byService.has(serviceName)) {
        byService.set(serviceName, []);
      }
      byService.get(serviceName)!.push(event);
    }

    return byService;
  }

  /**
   * Get connection statistics between components
   */
  getConnectionStats(): Array<{
    source: string;
    target: string;
    eventCount: number;
    telemetryTypes: TelemetryType[];
  }> {
    const connections = new Map<string, { source: string; target: string; count: number; types: Set<TelemetryType> }>();

    for (const event of this.events) {
      if (event.targetComponent) {
        const key = `${event.sourceComponent}:${event.targetComponent}`;
        if (!connections.has(key)) {
          connections.set(key, {
            source: event.sourceComponent,
            target: event.targetComponent,
            count: 0,
            types: new Set(),
          });
        }
        const conn = connections.get(key)!;
        conn.count++;
        conn.types.add(event.type);
      }
    }

    return Array.from(connections.values()).map((c) => ({
      source: c.source,
      target: c.target,
      eventCount: c.count,
      telemetryTypes: Array.from(c.types),
    }));
  }

  /**
   * Analyze existing events to detect topology (without starting a new session)
   */
  analyzeExistingEvents(): TrafficSnapshot {
    const startTime = this.events.length > 0 ? this.events[0].timestamp : Date.now();
    const endTime = this.events.length > 0 ? this.events[this.events.length - 1].timestamp : Date.now();

    const services = new Map<string, ServiceInfo>();
    const connections = new Map<string, ConnectionInfo>();

    for (const event of this.events) {
      // Update service info
      const serviceName = event.metadata.serviceName || event.sourceComponent;
      if (!services.has(serviceName)) {
        services.set(serviceName, {
          serviceName,
          language: this.detectLanguage(event),
          resourceAttributes: {},
          telemetryTypes: new Set(),
          firstSeen: event.timestamp,
          lastSeen: event.timestamp,
          eventCount: 0,
          traceCount: 0,
          metricCount: 0,
          logCount: 0,
        });
      }
      const service = services.get(serviceName)!;
      service.telemetryTypes.add(event.type);
      service.lastSeen = Math.max(service.lastSeen, event.timestamp);
      service.eventCount++;
      if (event.type === 'traces') service.traceCount++;
      if (event.type === 'metrics') service.metricCount++;
      if (event.type === 'logs') service.logCount++;

      // Update connection info
      if (event.targetComponent) {
        const connKey = `${event.sourceComponent}:${event.targetComponent}`;
        if (!connections.has(connKey)) {
          connections.set(connKey, {
            sourceId: event.sourceComponent,
            targetId: event.targetComponent,
            telemetryTypes: new Set(),
            eventCount: 0,
            firstSeen: event.timestamp,
            lastSeen: event.timestamp,
          });
        }
        const conn = connections.get(connKey)!;
        conn.telemetryTypes.add(event.type);
        conn.eventCount++;
        conn.lastSeen = Math.max(conn.lastSeen, event.timestamp);
      }
    }

    return {
      services,
      connections,
      collectors: new Map(this.collectorRegistry),
      startTime,
      endTime,
      totalEvents: this.events.length,
    };
  }

  // ============ Private Analysis Helpers ============

  private updateServiceRegistry(event: TelemetryEvent): void {
    const serviceName = event.metadata.serviceName || event.sourceComponent;

    if (!this.serviceRegistry.has(serviceName)) {
      this.serviceRegistry.set(serviceName, {
        serviceName,
        language: this.detectLanguage(event),
        resourceAttributes: {},
        telemetryTypes: new Set(),
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        eventCount: 0,
        traceCount: 0,
        metricCount: 0,
        logCount: 0,
      });
    }

    const service = this.serviceRegistry.get(serviceName)!;
    service.telemetryTypes.add(event.type);
    service.lastSeen = event.timestamp;
    service.eventCount++;
    if (event.type === 'traces') service.traceCount++;
    if (event.type === 'metrics') service.metricCount++;
    if (event.type === 'logs') service.logCount++;
    
    // Capture resource attributes (merge with existing, prioritizing newer values)
    if (event.metadata.resourceAttributes) {
      service.resourceAttributes = {
        ...service.resourceAttributes,
        ...event.metadata.resourceAttributes,
      };
    }
    
    // Update language if detected from SDK telemetry
    if (event.metadata.sdkLanguage && !service.language) {
      service.language = event.metadata.sdkLanguage;
    }
  }

  private updateConnectionRegistry(event: TelemetryEvent): void {
    if (!event.targetComponent) return;

    const connKey = `${event.sourceComponent}:${event.targetComponent}`;

    if (!this.connectionRegistry.has(connKey)) {
      this.connectionRegistry.set(connKey, {
        sourceId: event.sourceComponent,
        targetId: event.targetComponent,
        telemetryTypes: new Set(),
        eventCount: 0,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
      });
    }

    const conn = this.connectionRegistry.get(connKey)!;
    conn.telemetryTypes.add(event.type);
    conn.eventCount++;
    conn.lastSeen = event.timestamp;
  }

  private detectLanguage(event: TelemetryEvent): SDKLanguage | undefined {
    // Try to detect language from resource attributes or service name patterns
    const serviceName = event.metadata.serviceName?.toLowerCase() || '';

    // Common language indicators in service names
    if (serviceName.includes('node') || serviceName.includes('express') || serviceName.includes('next')) {
      return 'nodejs';
    }
    if (serviceName.includes('python') || serviceName.includes('django') || serviceName.includes('flask')) {
      return 'python';
    }
    if (serviceName.includes('java') || serviceName.includes('spring') || serviceName.includes('quarkus')) {
      return 'java';
    }
    if (serviceName.includes('go') || serviceName.includes('gin') || serviceName.includes('fiber')) {
      return 'go';
    }
    if (serviceName.includes('dotnet') || serviceName.includes('aspnet') || serviceName.includes('csharp')) {
      return 'dotnet';
    }

    return undefined;
  }

  /**
   * Clear all events and reset state
   */
  clear(): void {
    this.events = [];
    this.throughputCounters.clear();
    this.slidingWindow.clear();
    this.analysisEvents = [];
    this.serviceRegistry.clear();
    this.connectionRegistry.clear();
    this.collectorRegistry.clear();
    this.isAnalyzing = false;
    this.analysisStartTime = null;
  }
}

// Singleton buffer instance - use globalThis to persist across hot reloads in dev mode
const globalForTelemetry = globalThis as unknown as {
  telemetryBuffer: TelemetryBuffer | undefined;
  telemetryBufferVersion: number | undefined;
};

// Version to force refresh when code changes (increment this when making changes)
const BUFFER_VERSION = 6;

// Create new instance if version changed or doesn't exist
const needsRefresh = !globalForTelemetry.telemetryBuffer || 
  globalForTelemetry.telemetryBufferVersion !== BUFFER_VERSION;

// Ensure telemetryBuffer is always defined (use existing or create new)
export const telemetryBuffer: TelemetryBuffer = needsRefresh 
  ? new TelemetryBuffer() 
  : globalForTelemetry.telemetryBuffer!;

if (process.env.NODE_ENV !== 'production') {
  globalForTelemetry.telemetryBuffer = telemetryBuffer;
  globalForTelemetry.telemetryBufferVersion = BUFFER_VERSION;
}

// Type for resource attributes array
type ResourceAttributes = Array<{ key: string; value?: { stringValue?: string; intValue?: string | number } }>;

// Helper to extract all relevant resource attributes
function extractResourceAttributes(resource: unknown): Record<string, string> {
  const res = resource as { attributes?: ResourceAttributes };
  const attrs: Record<string, string> = {};
  
  if (!res?.attributes) return attrs;
  
  // List of attributes we want to capture
  const relevantKeys = [
    'service.name',
    'service.namespace',
    'service.instance.id',
    'host.name',
    'host.id',
    'host.arch',
    'os.type',
    'telemetry.sdk.language',
    'telemetry.sdk.name',
    'telemetry.distro.name',
    'container.id',
    'k8s.node.name',
    'k8s.pod.name',
    'k8s.namespace.name',
    'deployment.environment',
  ];
  
  for (const attr of res.attributes) {
    if (relevantKeys.includes(attr.key)) {
      const value = attr.value?.stringValue || 
                    (attr.value?.intValue !== undefined ? String(attr.value.intValue) : undefined);
      if (value) {
        attrs[attr.key] = value;
      }
    }
  }
  
  return attrs;
}

// Helper to extract service name from OTLP resource attributes
function extractServiceName(resource: unknown): string {
  const res = resource as { attributes?: ResourceAttributes };
  const serviceAttr = res?.attributes?.find((attr) => attr.key === 'service.name');
  return serviceAttr?.value?.stringValue || 'unknown-service';
}

// Helper to extract SDK language from resource attributes
function extractSdkLanguage(resource: unknown): SDKLanguage | undefined {
  const res = resource as { attributes?: ResourceAttributes };
  const sdkLang = res?.attributes?.find((attr) => attr.key === 'telemetry.sdk.language');
  const langValue = sdkLang?.value?.stringValue?.toLowerCase();
  
  if (!langValue) return undefined;
  
  if (langValue === 'nodejs' || langValue === 'node' || langValue === 'javascript') return 'nodejs';
  if (langValue === 'python') return 'python';
  if (langValue === 'java') return 'java';
  if (langValue === 'go') return 'go';
  if (langValue === 'dotnet' || langValue === '.net' || langValue === 'csharp') return 'dotnet';
  
  return undefined;
}

// Parse OTLP trace data
export function parseOTLPTraces(data: unknown): TelemetryEvent[] {
  const events: TelemetryEvent[] = [];
  
  try {
    const payload = data as { 
      resourceSpans?: Array<{ 
        resource?: unknown;
        scopeSpans?: Array<{ spans?: Array<unknown> }> 
      }> 
    };
    
    payload.resourceSpans?.forEach((resourceSpan) => {
      const serviceName = extractServiceName(resourceSpan.resource);
      const sdkLanguage = extractSdkLanguage(resourceSpan.resource);
      const resourceAttrs = extractResourceAttributes(resourceSpan.resource);
      
      resourceSpan.scopeSpans?.forEach((scopeSpan) => {
        scopeSpan.spans?.forEach((span: unknown) => {
          const s = span as { traceId?: string; spanId?: string; name?: string };
          events.push({
            id: nanoid(),
            type: 'traces',
            timestamp: Date.now(),
            sourceComponent: serviceName,
            metadata: {
              traceId: s.traceId,
              spanId: s.spanId,
              operationName: s.name,
              serviceName,
              sdkLanguage,
              resourceAttributes: resourceAttrs,
            },
          });
        });
      });
    });
    
    console.log(`[OTLP] Parsed ${events.length} trace events from ${new Set(events.map(e => e.sourceComponent)).size} service(s)`);
  } catch (error) {
    console.error('Failed to parse OTLP traces:', error);
  }

  return events;
}

// Parse OTLP metrics data
export function parseOTLPMetrics(data: unknown): TelemetryEvent[] {
  const events: TelemetryEvent[] = [];
  
  try {
    const payload = data as { 
      resourceMetrics?: Array<{ 
        resource?: unknown;
        scopeMetrics?: Array<{ metrics?: Array<unknown> }> 
      }> 
    };
    
    payload.resourceMetrics?.forEach((resourceMetric) => {
      const serviceName = extractServiceName(resourceMetric.resource);
      const sdkLanguage = extractSdkLanguage(resourceMetric.resource);
      const resourceAttrs = extractResourceAttributes(resourceMetric.resource);
      
      resourceMetric.scopeMetrics?.forEach((scopeMetric) => {
        scopeMetric.metrics?.forEach((metric: unknown) => {
          const m = metric as { name?: string };
          events.push({
            id: nanoid(),
            type: 'metrics',
            timestamp: Date.now(),
            sourceComponent: serviceName,
            metadata: {
              metricName: m.name,
              serviceName,
              sdkLanguage,
              resourceAttributes: resourceAttrs,
            },
          });
        });
      });
    });
    
    console.log(`[OTLP] Parsed ${events.length} metric events from ${new Set(events.map(e => e.sourceComponent)).size} service(s)`);
  } catch (error) {
    console.error('Failed to parse OTLP metrics:', error);
  }

  return events;
}

// Parse OTLP logs data
export function parseOTLPLogs(data: unknown): TelemetryEvent[] {
  const events: TelemetryEvent[] = [];
  
  try {
    const payload = data as { 
      resourceLogs?: Array<{ 
        resource?: unknown;
        scopeLogs?: Array<{ logRecords?: Array<unknown> }> 
      }> 
    };
    
    payload.resourceLogs?.forEach((resourceLog) => {
      const serviceName = extractServiceName(resourceLog.resource);
      const sdkLanguage = extractSdkLanguage(resourceLog.resource);
      const resourceAttrs = extractResourceAttributes(resourceLog.resource);
      
      resourceLog.scopeLogs?.forEach((scopeLog) => {
        scopeLog.logRecords?.forEach((log: unknown) => {
          const l = log as { severityText?: string };
          events.push({
            id: nanoid(),
            type: 'logs',
            timestamp: Date.now(),
            sourceComponent: serviceName,
            metadata: {
              logLevel: l.severityText,
              serviceName,
              sdkLanguage,
              resourceAttributes: resourceAttrs,
            },
          });
        });
      });
    });
    
    console.log(`[OTLP] Parsed ${events.length} log events from ${new Set(events.map(e => e.sourceComponent)).size} service(s)`);
  } catch (error) {
    console.error('Failed to parse OTLP logs:', error);
  }

  return events;
}

// Demo data generator
export class DemoDataGenerator {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  private serviceNames = ['frontend', 'api-gateway', 'order-service', 'payment-service', 'inventory-service'];
  private operations = ['GET /api/orders', 'POST /api/checkout', 'GET /api/products', 'PUT /api/cart', 'DELETE /api/session'];
  private metricNames = ['http_request_duration_seconds', 'http_requests_total', 'process_cpu_seconds_total', 'process_memory_bytes'];
  private logLevels = ['INFO', 'DEBUG', 'WARN', 'ERROR'];

  start(topology: { nodes: Array<{ id: string; data: { componentType: string } }> }): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Find SDK nodes as sources
    const sdkNodes = topology.nodes.filter((n) => n.data.componentType === 'edot-sdk');
    const collectorNodes = topology.nodes.filter((n) => 
      n.data.componentType === 'collector-agent' || n.data.componentType === 'collector-gateway'
    );

    this.intervalId = setInterval(() => {
      const events: TelemetryEvent[] = [];
      const now = Date.now();

      // Generate events from each SDK
      sdkNodes.forEach((sdk) => {
        // Find connected collector or elastic
        const targetNode = collectorNodes.find((c) => c.id) || { id: 'elastic-1' };

        // Random telemetry mix
        const eventCount = Math.floor(Math.random() * 5) + 1;
        
        for (let i = 0; i < eventCount; i++) {
          const types: TelemetryType[] = ['traces', 'metrics', 'logs'];
          const type = types[Math.floor(Math.random() * types.length)];

          events.push({
            id: nanoid(),
            type,
            timestamp: now,
            sourceComponent: sdk.id,
            targetComponent: targetNode.id,
            metadata: this.generateMetadata(type, sdk.id),
          });
        }
      });

      // Also generate events from collectors to Elastic
      collectorNodes.forEach((collector) => {
        const eventCount = Math.floor(Math.random() * 8) + 2;
        
        for (let i = 0; i < eventCount; i++) {
          const types: TelemetryType[] = ['traces', 'metrics', 'logs'];
          const type = types[Math.floor(Math.random() * types.length)];

          events.push({
            id: nanoid(),
            type,
            timestamp: now,
            sourceComponent: collector.id,
            targetComponent: 'elastic-1',
            metadata: this.generateMetadata(type, collector.id),
          });
        }
      });

      telemetryBuffer.addEvents(events);
    }, 200); // Generate events every 200ms
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  private generateMetadata(type: TelemetryType, sourceId: string): TelemetryEvent['metadata'] {
    switch (type) {
      case 'traces':
        return {
          serviceName: this.serviceNames[Math.floor(Math.random() * this.serviceNames.length)],
          operationName: this.operations[Math.floor(Math.random() * this.operations.length)],
          traceId: nanoid(32),
          spanId: nanoid(16),
        };
      case 'metrics':
        return {
          metricName: this.metricNames[Math.floor(Math.random() * this.metricNames.length)],
          serviceName: sourceId,
        };
      case 'logs':
        return {
          logLevel: this.logLevels[Math.floor(Math.random() * this.logLevels.length)],
          serviceName: sourceId,
        };
    }
  }
}

export const demoGenerator = new DemoDataGenerator();
