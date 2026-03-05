import { describe, it, expect } from 'vitest';
import { generateK8sManifests } from '../k8s-manifest-generator';
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

describe('k8s-manifest-generator: Kafka support', () => {
  it('generates Kafka StatefulSet when Kafka node is present', () => {
    const nodes: Node<EDOTNodeData>[] = [
      makeCollectorNode('agent1', 'EDOT Agent', 'collector-agent'),
      makeKafkaNode('kafka1'),
      makeCollectorNode('gw1', 'EDOT Gateway', 'collector-gateway'),
    ];
    const edges: Edge<FlowEdgeData>[] = [
      makeEdge('agent1', 'kafka1'),
      makeEdge('kafka1', 'gw1'),
    ];

    const yaml = generateK8sManifests(nodes, edges, {
      deploymentModel: 'self-managed',
    });

    expect(yaml).toContain('kind: StatefulSet');
    expect(yaml).toContain('kafka-cluster');
    expect(yaml).toContain('confluentinc/cp-kafka:7.6.0');
  });

  it('generates Kafka Service for client access', () => {
    const nodes: Node<EDOTNodeData>[] = [
      makeCollectorNode('agent1', 'EDOT Agent', 'collector-agent'),
      makeKafkaNode('kafka1'),
    ];

    const yaml = generateK8sManifests(nodes, [], {
      deploymentModel: 'self-managed',
    });

    expect(yaml).toContain('kind: Service');
    expect(yaml).toContain('component: kafka-broker');
    expect(yaml).toContain('port: 9092');
  });

  it('generates headless Service for StatefulSet', () => {
    const nodes: Node<EDOTNodeData>[] = [
      makeCollectorNode('agent1', 'EDOT Agent', 'collector-agent'),
      makeKafkaNode('kafka1'),
    ];

    const yaml = generateK8sManifests(nodes, [], {
      deploymentModel: 'self-managed',
    });

    expect(yaml).toContain('kafka-cluster-headless');
    expect(yaml).toContain('clusterIP: None');
  });

  it('includes PersistentVolumeClaim template', () => {
    const nodes: Node<EDOTNodeData>[] = [
      makeCollectorNode('agent1', 'EDOT Agent', 'collector-agent'),
      makeKafkaNode('kafka1'),
    ];

    const yaml = generateK8sManifests(nodes, [], {
      deploymentModel: 'self-managed',
    });

    expect(yaml).toContain('volumeClaimTemplates');
    expect(yaml).toContain('kafka-data');
    expect(yaml).toContain('ReadWriteOnce');
  });

  it('uses custom cluster name from node data', () => {
    const nodes: Node<EDOTNodeData>[] = [
      makeCollectorNode('agent1', 'EDOT Agent', 'collector-agent'),
      makeKafkaNode('kafka1', 'my-kafka-cluster'),
    ];

    const yaml = generateK8sManifests(nodes, [], {
      deploymentModel: 'self-managed',
    });

    expect(yaml).toContain('my-kafka-cluster');
  });
});
