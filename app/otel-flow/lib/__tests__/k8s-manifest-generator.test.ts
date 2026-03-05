import { describe, it, expect } from 'vitest';
import { generateK8sManifests } from '../k8s-manifest-generator';
import { EDOT_COLLECTOR_IMAGE } from '../versions';
import { assertEdotCollectorImage } from './edot-assertions';
import type { Node, Edge } from '@xyflow/react';
import type { EDOTNodeData, FlowEdgeData, SDKNodeData, CollectorNodeData } from '../../types';

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

describe('k8s-manifest-generator', () => {
  describe('works without K8s canvas nodes', () => {
    it('generates manifests from EDOT topology alone', () => {
      const nodes = [
        makeSDKNode('sdk1', 'nodejs', 'node-app'),
        makeCollectorNode('col1', 'Collector Agent', 'collector-agent'),
      ];
      const edges = [makeEdge('sdk1', 'col1')];
      
      const output = generateK8sManifests(nodes, edges);
      
      expect(output).toContain('kind: Namespace');
      expect(output).toContain('kind: DaemonSet');
      expect(output).toContain('kind: ServiceAccount');
      expect(output).toContain('kind: ClusterRole');
      expect(output).toContain('kind: ClusterRoleBinding');
    });

    it('returns empty message when no EDOT components', () => {
      const output = generateK8sManifests([], []);
      expect(output).toContain('No EDOT components');
    });
  });

  describe('Collector Agents produce DaemonSets', () => {
    it('generates DaemonSet for each agent', () => {
      const nodes = [
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
      ];
      
      const output = generateK8sManifests(nodes);
      expect(output).toContain('kind: DaemonSet');
      expect(output).toContain('component: agent');
    });
  });

  describe('Collector Gateways produce Deployments', () => {
    it('generates Deployment + Service for each gateway', () => {
      const nodes = [
        makeCollectorNode('gw1', 'edot-gateway', 'collector-gateway'),
      ];
      
      const output = generateK8sManifests(nodes);
      expect(output).toContain('kind: Deployment');
      expect(output).toContain('kind: Service');
      expect(output).toContain('component: gateway');
    });
  });

  describe('EDOT Collector image', () => {
    it('uses current EDOT Collector image (not outdated)', () => {
      const nodes = [
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
      ];
      
      const output = generateK8sManifests(nodes);
      assertEdotCollectorImage(output);
      expect(output).toContain(EDOT_COLLECTOR_IMAGE);
    });

    it('does not use upstream opentelemetry-collector image', () => {
      const nodes = [
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
      ];
      
      const output = generateK8sManifests(nodes);
      expect(output).not.toContain('otel/opentelemetry-collector');
    });
  });

  describe('ConfigMap contains actual collector config', () => {
    it('uses real collector YAML from generateCollectorYAML()', () => {
      const nodes = [
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
      ];
      
      const output = generateK8sManifests(nodes);
      expect(output).toContain('kind: ConfigMap');
      // Actual collector config should contain memory_limiter (not hardcoded placeholder)
      expect(output).toContain('memory_limiter');
    });
  });

  describe('RBAC resources', () => {
    it('generates ServiceAccount', () => {
      const nodes = [
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
      ];
      
      const output = generateK8sManifests(nodes);
      expect(output).toContain('kind: ServiceAccount');
      expect(output).toContain('name: edot-collector');
    });

    it('generates ClusterRole with correct permissions', () => {
      const nodes = [
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
      ];
      
      const output = generateK8sManifests(nodes);
      expect(output).toContain('kind: ClusterRole');
      expect(output).toContain('pods');
      expect(output).toContain('nodes');
    });

    it('generates ClusterRoleBinding', () => {
      const nodes = [
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
      ];
      
      const output = generateK8sManifests(nodes);
      expect(output).toContain('kind: ClusterRoleBinding');
    });
  });

  describe('namespace configuration', () => {
    it('uses default namespace when none specified', () => {
      const nodes = [
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
      ];
      
      const output = generateK8sManifests(nodes);
      expect(output).toContain('name: observability');
    });

    it('uses custom namespace when specified', () => {
      const nodes = [
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
      ];
      
      const output = generateK8sManifests(nodes, [], { namespace: 'monitoring' });
      expect(output).toContain('name: monitoring');
    });
  });

  describe('elastic-agent otel command', () => {
    it('uses EDOT run command', () => {
      const nodes = [
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
      ];
      
      const output = generateK8sManifests(nodes);
      expect(output).toContain('elastic-agent');
      expect(output).toContain('otel');
    });
  });

  describe('Secret template', () => {
    it('generates Secret template for credentials', () => {
      const nodes = [
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
      ];
      
      const output = generateK8sManifests(nodes);
      expect(output).toContain('kind: Secret');
      expect(output).toContain('elastic-apm');
    });
  });

  describe('SDK apps generate Deployments', () => {
    it('generates app Deployment + Service', () => {
      const nodes = [
        makeSDKNode('sdk1', 'nodejs', 'node-app'),
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
      ];
      const edges = [makeEdge('sdk1', 'col1')];
      
      const output = generateK8sManifests(nodes, edges);
      expect(output).toContain('name: node-app');
      expect(output).toContain('OTEL_SERVICE_NAME');
      expect(output).toContain('OTEL_EXPORTER_OTLP_ENDPOINT');
    });
  });

  describe('mixed topology', () => {
    it('handles agent + gateway + SDKs', () => {
      const nodes = [
        makeSDKNode('sdk1', 'nodejs', 'node-app'),
        makeSDKNode('sdk2', 'python', 'python-app'),
        makeCollectorNode('col1', 'edot-agent', 'collector-agent'),
        makeCollectorNode('gw1', 'edot-gateway', 'collector-gateway'),
      ];
      const edges = [
        makeEdge('sdk1', 'col1'),
        makeEdge('sdk2', 'col1'),
        makeEdge('col1', 'gw1'),
      ];
      
      const output = generateK8sManifests(nodes, edges);
      
      // Should have DaemonSet for agent
      expect(output).toContain('kind: DaemonSet');
      // Should have Deployment for gateway
      expect(output).toContain('kind: Deployment');
      // Should have ConfigMaps for both collectors
      const configMapCount = (output.match(/kind: ConfigMap/g) || []).length;
      expect(configMapCount).toBe(2);
    });
  });
});
