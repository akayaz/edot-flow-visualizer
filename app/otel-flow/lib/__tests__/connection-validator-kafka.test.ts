import { describe, it, expect } from 'vitest';
import { validateConnection, isValidConnectionType } from '../connection-validator';
import type { Node } from '@xyflow/react';
import type { EDOTNodeData, SDKNodeData, CollectorNodeData, ElasticNodeData, KafkaNodeData } from '../../types';

function makeSDKNode(id: string): Node<EDOTNodeData> {
  return {
    id,
    type: 'edotSdk',
    position: { x: 0, y: 0 },
    data: {
      label: 'Test SDK',
      componentType: 'edot-sdk',
      language: 'nodejs',
      serviceName: 'test-service',
      autoInstrumented: true,
    } as SDKNodeData,
  };
}

function makeCollectorNode(id: string, type: 'collector-agent' | 'collector-gateway'): Node<EDOTNodeData> {
  return {
    id,
    type: 'collector',
    position: { x: 200, y: 0 },
    data: {
      label: type === 'collector-agent' ? 'Agent' : 'Gateway',
      componentType: type,
      config: {
        receivers: [{ type: 'otlp', enabled: true }],
        processors: [{ type: 'memory_limiter', enabled: true }],
        exporters: [{ type: 'otlp', enabled: true }],
      },
    } as CollectorNodeData,
  };
}

function makeElasticNode(id: string): Node<EDOTNodeData> {
  return {
    id,
    type: 'elasticApm',
    position: { x: 400, y: 0 },
    data: {
      label: 'Elastic',
      componentType: 'elastic-apm',
      features: ['apm', 'logs', 'metrics'],
    } as ElasticNodeData,
  };
}

function makeKafkaNode(id: string): Node<EDOTNodeData> {
  return {
    id,
    type: 'kafkaBroker',
    position: { x: 300, y: 0 },
    data: {
      label: 'Kafka Broker',
      componentType: 'kafka-broker',
      clusterName: 'kafka-cluster',
      brokers: ['localhost:9092'],
      topics: {
        traces: 'otlp_spans',
        metrics: 'otlp_metrics',
        logs: 'otlp_logs',
      },
      encoding: 'otlp_proto',
      auth: 'none',
    } as KafkaNodeData,
  };
}

describe('connection-validator: Kafka rules', () => {
  // ===== INVALID CONNECTIONS =====

  describe('invalid Kafka connections', () => {
    it('rejects SDK → Kafka (SDKs cannot speak Kafka)', () => {
      const result = validateConnection(makeSDKNode('sdk1'), makeKafkaNode('kafka1'));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('cannot send telemetry directly to Kafka');
      }
    });

    it('rejects Kafka → SDK (backwards flow)', () => {
      const result = validateConnection(makeKafkaNode('kafka1'), makeSDKNode('sdk1'));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('cannot send telemetry back to SDKs');
      }
    });

    it('rejects Kafka → Elastic (Elastic cannot read from Kafka)', () => {
      const result = validateConnection(makeKafkaNode('kafka1'), makeElasticNode('elastic1'));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('cannot consume directly from Kafka');
      }
    });
  });

  // ===== VALID CONNECTIONS =====

  describe('valid Kafka connections', () => {
    it('allows Collector Agent → Kafka', () => {
      const result = validateConnection(
        makeCollectorNode('agent1', 'collector-agent'),
        makeKafkaNode('kafka1')
      );
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.info).toContain('kafkaexporter');
      }
    });

    it('allows Collector Gateway → Kafka', () => {
      const result = validateConnection(
        makeCollectorNode('gw1', 'collector-gateway'),
        makeKafkaNode('kafka1')
      );
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.info).toContain('kafkaexporter');
      }
    });

    it('allows Kafka → Collector Gateway (recommended HA pattern)', () => {
      const result = validateConnection(
        makeKafkaNode('kafka1'),
        makeCollectorNode('gw1', 'collector-gateway')
      );
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.info).toContain('kafkareceiver');
      }
    });

    it('allows Kafka → Collector Agent', () => {
      const result = validateConnection(
        makeKafkaNode('kafka1'),
        makeCollectorNode('agent1', 'collector-agent')
      );
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.info).toContain('kafkareceiver');
      }
    });
  });

  // ===== WARNING CONNECTIONS =====

  describe('Kafka connections with warnings', () => {
    it('allows Kafka → Kafka with warning (multi-cluster mirroring)', () => {
      const result = validateConnection(makeKafkaNode('kafka1'), makeKafkaNode('kafka2'));
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warning).toContain('cross-cluster mirroring');
      }
    });
  });

  // ===== SIMPLIFIED isValidConnectionType =====

  describe('isValidConnectionType with Kafka', () => {
    it('returns false for SDK → Kafka', () => {
      expect(isValidConnectionType('edot-sdk', 'kafka-broker')).toBe(false);
    });

    it('returns false for Kafka → SDK', () => {
      expect(isValidConnectionType('kafka-broker', 'edot-sdk')).toBe(false);
    });

    it('returns false for Kafka → Elastic', () => {
      expect(isValidConnectionType('kafka-broker', 'elastic-apm')).toBe(false);
    });

    it('returns true for Agent → Kafka', () => {
      expect(isValidConnectionType('collector-agent', 'kafka-broker')).toBe(true);
    });

    it('returns true for Gateway → Kafka', () => {
      expect(isValidConnectionType('collector-gateway', 'kafka-broker')).toBe(true);
    });

    it('returns true for Kafka → Agent', () => {
      expect(isValidConnectionType('kafka-broker', 'collector-agent')).toBe(true);
    });

    it('returns true for Kafka → Gateway', () => {
      expect(isValidConnectionType('kafka-broker', 'collector-gateway')).toBe(true);
    });

    it('returns true for Kafka → Kafka', () => {
      expect(isValidConnectionType('kafka-broker', 'kafka-broker')).toBe(true);
    });
  });
});
