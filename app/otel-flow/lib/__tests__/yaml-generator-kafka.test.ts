import { describe, it, expect } from 'vitest';
import { generateCollectorYAML } from '../yaml-generator';
import type { CollectorNodeData } from '../../types';

function makeCollectorWithKafkaExporter(): CollectorNodeData {
  return {
    label: 'EDOT Agent',
    componentType: 'collector-agent',
    config: {
      receivers: [{ type: 'otlp', enabled: true }],
      processors: [
        { type: 'memory_limiter', enabled: true },
        { type: 'batch', enabled: true },
      ],
      exporters: [
        { type: 'kafka', enabled: true },
      ],
    },
  };
}

function makeCollectorWithKafkaReceiver(): CollectorNodeData {
  return {
    label: 'EDOT Gateway',
    componentType: 'collector-gateway',
    config: {
      receivers: [
        { type: 'kafka', enabled: true },
      ],
      processors: [
        { type: 'memory_limiter', enabled: true },
        { type: 'batch', enabled: true },
      ],
      exporters: [
        { type: 'elasticsearch', enabled: true },
      ],
    },
  };
}

describe('yaml-generator: Kafka support', () => {
  describe('kafka exporter', () => {
    it('generates kafka exporter configuration', () => {
      const yaml = generateCollectorYAML(makeCollectorWithKafkaExporter(), {
        deploymentModel: 'self-managed',
      });

      expect(yaml).toContain('kafka:');
      expect(yaml).toContain('KAFKA_BROKERS');
      expect(yaml).toContain('otlp_spans');
      expect(yaml).toContain('otlp_metrics');
      expect(yaml).toContain('otlp_logs');
      expect(yaml).toContain('otlp_proto');
      expect(yaml).toContain('snappy');
    });

    it('includes kafka in env var documentation', () => {
      const yaml = generateCollectorYAML(makeCollectorWithKafkaExporter(), {
        deploymentModel: 'self-managed',
      });

      expect(yaml).toContain('KAFKA_BROKERS');
    });

    it('generates kafka exporter with proper topic structure', () => {
      const yaml = generateCollectorYAML(makeCollectorWithKafkaExporter(), {
        deploymentModel: 'self-managed',
      });

      // Should have separate topic configs for traces, metrics, logs
      expect(yaml).toContain('traces:');
      expect(yaml).toContain('metrics:');
      expect(yaml).toContain('logs:');
    });
  });

  describe('kafka receiver', () => {
    it('generates kafka receiver configuration', () => {
      const yaml = generateCollectorYAML(makeCollectorWithKafkaReceiver(), {
        deploymentModel: 'self-managed',
      });

      expect(yaml).toContain('kafka:');
      expect(yaml).toContain('KAFKA_BROKERS');
      expect(yaml).toContain('otlp_spans');
      expect(yaml).toContain('otlp_metrics');
      expect(yaml).toContain('otlp_logs');
      expect(yaml).toContain('otlp_proto');
      expect(yaml).toContain('group_id');
      expect(yaml).toContain('otel-collector');
    });

    it('generates kafka receiver with autocommit', () => {
      const yaml = generateCollectorYAML(makeCollectorWithKafkaReceiver(), {
        deploymentModel: 'self-managed',
      });

      expect(yaml).toContain('autocommit:');
    });
  });

  describe('combined kafka exporter + receiver', () => {
    it('generates both kafka exporter and receiver when both enabled', () => {
      const data: CollectorNodeData = {
        label: 'EDOT Gateway with Kafka',
        componentType: 'collector-gateway',
        config: {
          receivers: [
            { type: 'otlp', enabled: true },
            { type: 'kafka', enabled: true },
          ],
          processors: [
            { type: 'memory_limiter', enabled: true },
            { type: 'batch', enabled: true },
          ],
          exporters: [
            { type: 'kafka', enabled: true },
            { type: 'elasticsearch', enabled: true },
          ],
        },
      };

      const yaml = generateCollectorYAML(data, { deploymentModel: 'self-managed' });

      // Should contain both receiver and exporter kafka configs
      expect(yaml).toContain('KAFKA_BROKERS');
      expect(yaml).toContain('otlp_proto');
    });
  });
});
