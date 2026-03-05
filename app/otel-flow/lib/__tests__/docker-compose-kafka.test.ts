import { describe, it, expect } from 'vitest';
import { generateDockerCompose } from '../docker-compose-generator';
import type { Node, Edge } from '@xyflow/react';
import type { EDOTNodeData, FlowEdgeData, CollectorNodeData, KafkaNodeData } from '../../types';

function makeCollectorNode(id: string, label: string, type: 'collector-agent' | 'collector-gateway'): Node<EDOTNodeData> {
  return {
    id,
    type: 'collector',
    position: { x: 200, y: 0 },
    data: {
      label,
      componentType: type,
      config: {
        receivers: [{ type: 'otlp', enabled: true }],
        processors: [
          { type: 'memory_limiter', enabled: true },
          { type: 'batch', enabled: true },
        ],
        exporters: [{ type: 'otlp', enabled: true }],
      },
    } as CollectorNodeData,
  };
}

function makeKafkaNode(id: string, clusterName: string = 'kafka-cluster'): Node<EDOTNodeData> {
  return {
    id,
    type: 'kafkaBroker',
    position: { x: 300, y: 0 },
    data: {
      label: 'Kafka Broker',
      componentType: 'kafka-broker',
      clusterName,
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

function makeEdge(source: string, target: string): Edge<FlowEdgeData> {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    data: {
      telemetryTypes: ['traces', 'metrics', 'logs'],
      animated: true,
      volume: 5,
    },
  };
}

describe('docker-compose-generator: Kafka support', () => {
  it('generates Kafka service when Kafka node is present', () => {
    const nodes: Node<EDOTNodeData>[] = [
      makeCollectorNode('agent1', 'EDOT Agent', 'collector-agent'),
      makeKafkaNode('kafka1'),
      makeCollectorNode('gw1', 'EDOT Gateway', 'collector-gateway'),
    ];
    const edges: Edge<FlowEdgeData>[] = [
      makeEdge('agent1', 'kafka1'),
      makeEdge('kafka1', 'gw1'),
    ];

    const yaml = generateDockerCompose(nodes, edges, 'self-managed');

    expect(yaml).toContain('kafka-cluster');
    expect(yaml).toContain('confluentinc/cp-kafka:7.6.0');
    expect(yaml).toContain('9092:9092');
  });

  it('adds KAFKA_BROKERS env var to upstream collectors', () => {
    const nodes: Node<EDOTNodeData>[] = [
      makeCollectorNode('agent1', 'EDOT Agent', 'collector-agent'),
      makeKafkaNode('kafka1'),
    ];
    const edges: Edge<FlowEdgeData>[] = [
      makeEdge('agent1', 'kafka1'),
    ];

    const yaml = generateDockerCompose(nodes, edges, 'self-managed');

    expect(yaml).toContain('KAFKA_BROKERS');
  });

  it('adds depends_on for collectors connected to Kafka', () => {
    const nodes: Node<EDOTNodeData>[] = [
      makeCollectorNode('agent1', 'EDOT Agent', 'collector-agent'),
      makeKafkaNode('kafka1'),
    ];
    const edges: Edge<FlowEdgeData>[] = [
      makeEdge('agent1', 'kafka1'),
    ];

    const yaml = generateDockerCompose(nodes, edges, 'self-managed');

    expect(yaml).toContain('depends_on:');
    expect(yaml).toContain('kafka-cluster');
  });

  it('configures KRaft mode (no Zookeeper)', () => {
    const nodes: Node<EDOTNodeData>[] = [
      makeKafkaNode('kafka1'),
    ];

    const yaml = generateDockerCompose(nodes, [], 'self-managed');

    expect(yaml).toContain('KAFKA_PROCESS_ROLES');
    expect(yaml).toContain('broker,controller');
    // KRaft mode should NOT need zookeeper
    expect(yaml).not.toContain('zookeeper');
  });

  it('wires downstream collector depends_on Kafka', () => {
    const nodes: Node<EDOTNodeData>[] = [
      makeKafkaNode('kafka1'),
      makeCollectorNode('gw1', 'EDOT Gateway', 'collector-gateway'),
    ];
    const edges: Edge<FlowEdgeData>[] = [
      makeEdge('kafka1', 'gw1'),
    ];

    const yaml = generateDockerCompose(nodes, edges, 'self-managed');

    expect(yaml).toContain('KAFKA_BROKERS');
  });
});
