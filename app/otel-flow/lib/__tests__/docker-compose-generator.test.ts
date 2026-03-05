import { describe, it, expect } from 'vitest';
import { generateDockerCompose } from '../docker-compose-generator';
import { EDOT_VERSIONS, EDOT_COLLECTOR_IMAGE, ELASTICSEARCH_IMAGE, KIBANA_IMAGE } from '../versions';
import { assertEdotCollectorImage, assertElasticStackVersion, assertNoUpstreamOTelReferences } from './edot-assertions';
import type { Node, Edge } from '@xyflow/react';
import type { EDOTNodeData, FlowEdgeData, SDKNodeData, CollectorNodeData, ElasticNodeData } from '../../types';

function makeSDKNode(id: string, language: string, serviceName: string): Node<EDOTNodeData> {
  return {
    id,
    type: 'edotSdk',
    position: { x: 0, y: 0 },
    data: {
      label: serviceName,
      componentType: 'edot-sdk',
      language: language as SDKNodeData['language'],
      serviceName,
      autoInstrumented: true,
    } as SDKNodeData,
  };
}

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

function makeElasticNode(id: string, endpointType?: 'managed-otlp' | 'self-managed-es'): Node<EDOTNodeData> {
  return {
    id,
    type: 'elasticApm',
    position: { x: 400, y: 0 },
    data: {
      label: 'Elastic Observability',
      componentType: 'elastic-apm',
      features: ['apm', 'logs', 'metrics'],
      endpointType,
    } as ElasticNodeData,
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

describe('docker-compose-generator', () => {
  describe('basic generation', () => {
    it('generates valid YAML with services', () => {
      const nodes = [
        makeSDKNode('sdk1', 'nodejs', 'node-app'),
        makeCollectorNode('col1', 'Collector Agent', 'collector-agent'),
      ];
      const edges = [makeEdge('sdk1', 'col1')];
      
      const output = generateDockerCompose(nodes, edges);
      expect(output).toContain("version: '3.8'");
      expect(output).toContain('services:');
      expect(output).toContain('networks:');
    });

    it('returns empty template when no nodes', () => {
      const output = generateDockerCompose([], []);
      expect(output).toContain('No services found');
    });
  });

  describe('SDK services', () => {
    it('has build.context pointing to apps/<service-name>', () => {
      const nodes = [makeSDKNode('sdk1', 'nodejs', 'node-app')];
      const output = generateDockerCompose(nodes);
      
      expect(output).toContain('context: ./apps/node-app');
      expect(output).toContain('dockerfile: Dockerfile');
    });

    it('has port mappings', () => {
      const nodes = [makeSDKNode('sdk1', 'nodejs', 'node-app')];
      const output = generateDockerCompose(nodes);
      
      expect(output).toContain('8080:8080');
    });

    it('auto-increments ports for multiple SDKs', () => {
      const nodes = [
        makeSDKNode('sdk1', 'nodejs', 'node-app'),
        makeSDKNode('sdk2', 'python', 'python-app'),
        makeSDKNode('sdk3', 'java', 'java-app'),
      ];
      const output = generateDockerCompose(nodes);
      
      expect(output).toContain('8080:8080');
      expect(output).toContain('8081:8080');
      expect(output).toContain('8082:8080');
    });

    it('includes healthcheck', () => {
      const nodes = [makeSDKNode('sdk1', 'nodejs', 'node-app')];
      const output = generateDockerCompose(nodes);
      
      expect(output).toContain('healthcheck:');
      expect(output).toContain('/health');
    });

    it('uses EDOT Node.js SDK env var (not upstream)', () => {
      const nodes = [makeSDKNode('sdk1', 'nodejs', 'node-app')];
      const output = generateDockerCompose(nodes);
      
      expect(output).toContain(EDOT_VERSIONS.nodePackage);
      assertNoUpstreamOTelReferences(output, 'nodejs');
    });

    it('uses EDOT Java agent env var (not upstream)', () => {
      const nodes = [makeSDKNode('sdk1', 'java', 'java-app')];
      const output = generateDockerCompose(nodes);
      
      expect(output).toContain('elastic-otel-javaagent.jar');
      expect(output).not.toContain('opentelemetry-javaagent.jar');
    });
  });

  describe('Collector services', () => {
    it('uses EDOT Collector image', () => {
      const nodes = [makeCollectorNode('col1', 'Collector Agent', 'collector-agent')];
      const output = generateDockerCompose(nodes);
      
      assertEdotCollectorImage(output);
      expect(output).toContain(EDOT_COLLECTOR_IMAGE);
    });

    it('has elastic-agent otel command', () => {
      const nodes = [makeCollectorNode('col1', 'Collector Agent', 'collector-agent')];
      const output = generateDockerCompose(nodes);
      
      expect(output).toContain('elastic-agent');
      expect(output).toContain('otel');
    });

    it('has config volume mount', () => {
      const nodes = [makeCollectorNode('col1', 'Collector Agent', 'collector-agent')];
      const output = generateDockerCompose(nodes);
      
      expect(output).toContain('configs/');
      expect(output).toContain('config.yaml');
    });
  });

  describe('depends_on chain', () => {
    it('SDK depends on connected collector', () => {
      const nodes = [
        makeSDKNode('sdk1', 'nodejs', 'node-app'),
        makeCollectorNode('col1', 'Collector Agent', 'collector-agent'),
      ];
      const edges = [makeEdge('sdk1', 'col1')];
      
      const output = generateDockerCompose(nodes, edges);
      expect(output).toContain('depends_on:');
      expect(output).toContain('collector-agent');
    });

    it('collector depends on gateway when connected', () => {
      const nodes = [
        makeCollectorNode('col1', 'Collector Agent', 'collector-agent'),
        makeCollectorNode('gw1', 'Collector Gateway', 'collector-gateway'),
      ];
      const edges = [makeEdge('col1', 'gw1')];
      
      const output = generateDockerCompose(nodes, edges);
      expect(output).toContain('depends_on:');
    });
  });

  describe('self-managed deployment', () => {
    it('includes Elasticsearch and Kibana services', () => {
      const nodes = [
        makeCollectorNode('col1', 'Collector Gateway', 'collector-gateway'),
        makeElasticNode('elastic1', 'self-managed-es'),
      ];
      const edges = [makeEdge('col1', 'elastic1')];
      
      const output = generateDockerCompose(nodes, edges, 'self-managed');
      
      expect(output).toContain('elasticsearch:');
      expect(output).toContain('kibana:');
      assertElasticStackVersion(output);
    });

    it('uses correct Elasticsearch image version', () => {
      const nodes = [
        makeCollectorNode('col1', 'Collector Gateway', 'collector-gateway'),
        makeElasticNode('elastic1', 'self-managed-es'),
      ];
      const edges = [makeEdge('col1', 'elastic1')];
      
      const output = generateDockerCompose(nodes, edges, 'self-managed');
      expect(output).toContain(ELASTICSEARCH_IMAGE);
      expect(output).toContain(KIBANA_IMAGE);
    });
  });

  describe('network', () => {
    it('defines edot-network', () => {
      const nodes = [makeSDKNode('sdk1', 'nodejs', 'node-app')];
      const output = generateDockerCompose(nodes);
      
      expect(output).toContain('edot-network');
      expect(output).toContain('driver: bridge');
    });
  });

  describe('regression', () => {
    it('handles single SDK + single collector', () => {
      const nodes = [
        makeSDKNode('sdk1', 'nodejs', 'node-app'),
        makeCollectorNode('col1', 'Collector Agent', 'collector-agent'),
      ];
      const edges = [makeEdge('sdk1', 'col1')];
      
      const output = generateDockerCompose(nodes, edges);
      expect(output).toContain('node-app:');
      expect(output).toContain('collector-agent:');
    });

    it('handles no SDKs (collectors only)', () => {
      const nodes = [makeCollectorNode('col1', 'Collector Agent', 'collector-agent')];
      const output = generateDockerCompose(nodes);
      
      expect(output).toContain('collector-agent:');
      expect(output).not.toContain('context: ./apps');
    });
  });
});
