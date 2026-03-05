import { describe, it, expect } from 'vitest';
import { yamlToCollectorConfig, validateYamlSyntax } from '../yaml-to-collector-config';
import { generateCollectorYAML } from '../yaml-generator';
import type { CollectorNodeData, ReceiverType, ProcessorType, ExporterType } from '../../types';

// ============ Helper Factories ============

function makeAgentNodeData(overrides?: Partial<CollectorNodeData>): CollectorNodeData {
  return {
    label: 'EDOT Agent',
    componentType: 'collector-agent',
    config: {
      receivers: [
        { type: 'otlp', enabled: true },
        { type: 'hostmetrics', enabled: true },
      ],
      processors: [
        { type: 'memory_limiter', enabled: true },
        { type: 'batch', enabled: true },
      ],
      exporters: [
        { type: 'otlp', enabled: true },
      ],
    },
    ...overrides,
  };
}

function makeGatewayNodeData(overrides?: Partial<CollectorNodeData>): CollectorNodeData {
  return {
    label: 'EDOT Gateway',
    componentType: 'collector-gateway',
    config: {
      receivers: [
        { type: 'otlp', enabled: true },
      ],
      processors: [
        { type: 'memory_limiter', enabled: true },
        { type: 'batch', enabled: true },
        { type: 'elasticapm', enabled: true },
      ],
      exporters: [
        { type: 'elasticsearch', enabled: true },
      ],
    },
    ...overrides,
  };
}

// ============ Tests ============

describe('yamlToCollectorConfig', () => {
  describe('roundtrip: generate → parse → compare', () => {
    it('should roundtrip an Agent config preserving receiver types', () => {
      const nodeData = makeAgentNodeData();
      const yaml = generateCollectorYAML(nodeData, { deploymentModel: 'self-managed' });
      const result = yamlToCollectorConfig(yaml);

      expect(result.errors).toHaveLength(0);
      expect(result.config).not.toBeNull();

      const receiverTypes = result.config!.receivers.map((r) => r.type).sort();
      expect(receiverTypes).toContain('otlp');
      expect(receiverTypes).toContain('hostmetrics');
    });

    it('should roundtrip a Gateway config preserving receiver/processor/exporter types', () => {
      const nodeData = makeGatewayNodeData();
      const yaml = generateCollectorYAML(nodeData, { deploymentModel: 'self-managed' });
      const result = yamlToCollectorConfig(yaml);

      expect(result.errors).toHaveLength(0);
      expect(result.config).not.toBeNull();

      const receiverTypes = result.config!.receivers.map((r) => r.type);
      expect(receiverTypes).toContain('otlp');

      const processorTypes = result.config!.processors.map((p) => p.type);
      expect(processorTypes).toContain('memory_limiter');
      expect(processorTypes).toContain('batch');
      expect(processorTypes).toContain('elasticapm');

      const exporterTypes = result.config!.exporters.map((e) => e.type);
      expect(exporterTypes).toContain('elasticsearch');
    });

    it('should roundtrip a Serverless/ECH config with OTLP exporter', () => {
      const nodeData = makeAgentNodeData({
        config: {
          receivers: [{ type: 'otlp', enabled: true }],
          processors: [
            { type: 'memory_limiter', enabled: true },
            { type: 'batch', enabled: true },
          ],
          exporters: [{ type: 'otlp', enabled: true }],
        },
      });
      const yaml = generateCollectorYAML(nodeData, { deploymentModel: 'serverless' });
      const result = yamlToCollectorConfig(yaml);

      expect(result.errors).toHaveLength(0);
      expect(result.config).not.toBeNull();
      expect(result.config!.exporters.some((e) => e.type === 'otlp')).toBe(true);
    });

    it('should roundtrip with filelog receiver', () => {
      const nodeData = makeAgentNodeData({
        config: {
          receivers: [
            { type: 'otlp', enabled: true },
            { type: 'filelog', enabled: true },
          ],
          processors: [
            { type: 'memory_limiter', enabled: true },
            { type: 'batch', enabled: true },
          ],
          exporters: [{ type: 'otlp', enabled: true }],
        },
      });
      const yaml = generateCollectorYAML(nodeData, { deploymentModel: 'self-managed' });
      const result = yamlToCollectorConfig(yaml);

      expect(result.errors).toHaveLength(0);
      expect(result.config!.receivers.some((r) => r.type === 'filelog')).toBe(true);
    });

    it('should roundtrip with Kafka receiver and exporter', () => {
      const nodeData = makeGatewayNodeData({
        config: {
          receivers: [{ type: 'kafka', enabled: true }],
          processors: [
            { type: 'memory_limiter', enabled: true },
            { type: 'batch', enabled: true },
          ],
          exporters: [{ type: 'kafka', enabled: true }],
        },
      });
      const yaml = generateCollectorYAML(nodeData, { deploymentModel: 'self-managed' });
      const result = yamlToCollectorConfig(yaml);

      expect(result.errors).toHaveLength(0);
      expect(result.config!.receivers.some((r) => r.type === 'kafka')).toBe(true);
      expect(result.config!.exporters.some((e) => e.type === 'kafka')).toBe(true);
    });
  });

  describe('self-telemetry filtering', () => {
    it('should filter out filelog/collector-logs and prometheus/collector-metrics receivers', () => {
      const yaml = `
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }
  filelog/collector-logs:
    include: ["/var/log/collector.log"]
  prometheus/collector-metrics:
    config:
      scrape_configs: []
processors:
  memory_limiter:
    check_interval: 1s
exporters:
  otlp/elastic:
    endpoint: "https://example.com"
`;
      const result = yamlToCollectorConfig(yaml);

      expect(result.errors).toHaveLength(0);
      expect(result.config!.receivers).toHaveLength(1);
      expect(result.config!.receivers[0].type).toBe('otlp');
    });

    it('should filter out resource/collector-telemetry processor', () => {
      const yaml = `
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }
processors:
  memory_limiter:
    check_interval: 1s
  resource/collector-telemetry:
    attributes:
      - key: service.name
        value: test
        action: upsert
exporters:
  debug:
    verbosity: basic
`;
      const result = yamlToCollectorConfig(yaml);

      expect(result.errors).toHaveLength(0);
      expect(result.config!.processors).toHaveLength(1);
      expect(result.config!.processors[0].type).toBe('memory_limiter');
    });

    it('should filter out auto-generated pipeline plumbing processors', () => {
      const yaml = `
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }
processors:
  memory_limiter:
    check_interval: 1s
  batch:
    send_batch_size: 1000
  batch/metrics:
    send_batch_max_size: 0
  resource/process:
    attributes: []
  attributes/dataset:
    actions: []
  elasticinframetrics: {}
exporters:
  elasticsearch/otel:
    endpoints: ["https://es.example.com"]
`;
      const result = yamlToCollectorConfig(yaml);

      expect(result.errors).toHaveLength(0);
      // Only memory_limiter and batch should remain (batch/metrics, resource/process, etc. filtered)
      const types = result.config!.processors.map((p) => p.type);
      expect(types).toContain('memory_limiter');
      expect(types).toContain('batch');
      expect(types).not.toContain('elasticinframetrics' as ProcessorType);
    });
  });

  describe('unknown/custom types produce warnings', () => {
    it('should warn about unknown receiver types', () => {
      const yaml = `
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }
  my_custom_receiver:
    setting: value
processors:
  batch: {}
exporters:
  debug: {}
`;
      const result = yamlToCollectorConfig(yaml);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes('Unknown receiver "my_custom_receiver"'))).toBe(true);
      // Known receiver still parsed
      expect(result.config!.receivers.some((r) => r.type === 'otlp')).toBe(true);
    });

    it('should warn about unknown exporter types', () => {
      const yaml = `
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }
processors:
  batch: {}
exporters:
  datadog:
    api_key: secret
`;
      const result = yamlToCollectorConfig(yaml);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes('Unknown exporter "datadog"'))).toBe(true);
    });
  });

  describe('invalid YAML handling', () => {
    it('should return a syntax error for invalid YAML', () => {
      const badYaml = `
receivers:
  otlp:
    protocols
      grpc: { endpoint: "broken
`;
      const result = yamlToCollectorConfig(badYaml);

      expect(result.config).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('YAML syntax error');
    });

    it('should error when YAML is not an object', () => {
      const result = yamlToCollectorConfig('just a string');

      expect(result.config).toBeNull();
      expect(result.errors.some((e) => e.includes('mapping'))).toBe(true);
    });

    it('should error on empty string (parses to null)', () => {
      const result = yamlToCollectorConfig('');

      expect(result.config).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('missing sections', () => {
    it('should error when both receivers and exporters are missing', () => {
      const yaml = `
processors:
  batch: {}
service:
  pipelines: {}
`;
      const result = yamlToCollectorConfig(yaml);

      expect(result.errors.some((e) => e.includes('receivers'))).toBe(true);
      expect(result.errors.some((e) => e.includes('exporters'))).toBe(true);
    });

    it('should parse successfully with only receivers (no processors)', () => {
      const yaml = `
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }
exporters:
  debug: {}
`;
      const result = yamlToCollectorConfig(yaml);

      // Should still parse — processors are optional
      expect(result.config).not.toBeNull();
      expect(result.config!.receivers).toHaveLength(1);
      expect(result.config!.processors).toHaveLength(0);
      expect(result.config!.exporters).toHaveLength(1);
    });

    it('should report error for missing exporters but still parse receivers', () => {
      const yaml = `
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }
processors:
  batch: {}
`;
      const result = yamlToCollectorConfig(yaml);

      expect(result.errors.some((e) => e.includes('exporters'))).toBe(true);
      // But receivers still parsed (partial success)
      expect(result.config).not.toBeNull();
      expect(result.config!.receivers).toHaveLength(1);
    });
  });

  describe('deduplication', () => {
    it('should not produce duplicate receiver types from qualified names', () => {
      const yaml = `
receivers:
  filelog:
    include: ["/var/log/*.log"]
  filelog/platformlogs:
    include: ["/var/log/platform/*.log"]
processors:
  batch: {}
exporters:
  debug: {}
`;
      const result = yamlToCollectorConfig(yaml);

      expect(result.config).not.toBeNull();
      const filelogReceivers = result.config!.receivers.filter((r) => r.type === 'filelog');
      expect(filelogReceivers).toHaveLength(1);
    });

    it('should not produce duplicate exporter types from qualified names', () => {
      const yaml = `
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }
processors:
  batch: {}
exporters:
  elasticsearch/otel:
    endpoints: ["https://es1.example.com"]
  elasticsearch/ecs:
    endpoints: ["https://es2.example.com"]
`;
      const result = yamlToCollectorConfig(yaml);

      expect(result.config).not.toBeNull();
      const esExporters = result.config!.exporters.filter((e) => e.type === 'elasticsearch');
      expect(esExporters).toHaveLength(1);
    });
  });

  describe('endpoint extraction', () => {
    it('should extract endpoint from exporter config', () => {
      const yaml = `
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }
processors:
  batch: {}
exporters:
  otlp/elastic:
    endpoint: "https://my-endpoint.example.com:443"
`;
      const result = yamlToCollectorConfig(yaml);

      expect(result.config).not.toBeNull();
      const otlpExporter = result.config!.exporters.find((e) => e.type === 'otlp');
      expect(otlpExporter?.endpoint).toBe('https://my-endpoint.example.com:443');
    });

    it('should extract endpoint from endpoints array', () => {
      const yaml = `
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }
processors:
  batch: {}
exporters:
  elasticsearch/otel:
    endpoints:
      - "https://es.example.com:443"
    mapping:
      mode: otel
`;
      const result = yamlToCollectorConfig(yaml);

      expect(result.config).not.toBeNull();
      const esExporter = result.config!.exporters.find((e) => e.type === 'elasticsearch');
      expect(esExporter?.endpoint).toBe('https://es.example.com:443');
    });
  });
});

describe('validateYamlSyntax', () => {
  it('should return null for valid YAML', () => {
    expect(validateYamlSyntax('key: value')).toBeNull();
  });

  it('should return an error message for invalid YAML', () => {
    const result = validateYamlSyntax('key: {broken: "no close');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('should return null for empty string', () => {
    // Empty string parses to null in YAML, which is valid syntax
    expect(validateYamlSyntax('')).toBeNull();
  });
});
