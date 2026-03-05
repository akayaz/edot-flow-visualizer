import { describe, it, expect } from 'vitest';
import { previewBundleContents } from '../config-bundle-generator';
import { EDOT_VERSIONS } from '../versions';
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

describe('config-bundle-generator', () => {
  describe('bundle file structure', () => {
    it('contains expected files for SDK + Collector topology', () => {
      const nodes = [
        makeSDKNode('sdk1', 'nodejs', 'node-app'),
        makeCollectorNode('col1', 'Collector Agent', 'collector-agent'),
      ];
      const edges = [makeEdge('sdk1', 'col1')];
      
      const preview = previewBundleContents(nodes, edges, 'serverless');
      const paths = preview.map((f) => f.path);
      
      // Should have collector config
      expect(paths).toContain('configs/collector-agent-config.yaml');
      
      // Should have app files
      expect(paths.some((p) => p.startsWith('apps/node-app/'))).toBe(true);
      expect(paths.some((p) => p.includes('Dockerfile'))).toBe(true);
      
      // Should have docker-compose
      expect(paths).toContain('docker-compose.yml');
      
      // Should have K8s manifests
      expect(paths).toContain('kubernetes/manifests.yaml');
      
      // Should have README, .env, Makefile
      expect(paths).toContain('README.md');
      expect(paths).toContain('.env.example');
      expect(paths).toContain('Makefile');
      
      // Should have docs
      expect(paths).toContain('docs/architecture.md');
    });

    it('includes app source files for each SDK', () => {
      const nodes = [
        makeSDKNode('sdk1', 'nodejs', 'node-app'),
        makeSDKNode('sdk2', 'python', 'python-app'),
      ];
      
      const preview = previewBundleContents(nodes, [], 'serverless');
      const paths = preview.map((f) => f.path);
      
      // Node.js app
      expect(paths.some((p) => p.includes('apps/node-app/package.json'))).toBe(true);
      expect(paths.some((p) => p.includes('apps/node-app/app.js'))).toBe(true);
      expect(paths.some((p) => p.includes('apps/node-app/Dockerfile'))).toBe(true);
      
      // Python app
      expect(paths.some((p) => p.includes('apps/python-app/requirements.txt'))).toBe(true);
      expect(paths.some((p) => p.includes('apps/python-app/app.py'))).toBe(true);
      expect(paths.some((p) => p.includes('apps/python-app/Dockerfile'))).toBe(true);
    });

    it('generates collector configs from actual generateCollectorYAML()', () => {
      const nodes = [
        makeCollectorNode('col1', 'Collector Agent', 'collector-agent'),
        makeCollectorNode('gw1', 'Collector Gateway', 'collector-gateway'),
      ];
      
      const preview = previewBundleContents(nodes, [], 'serverless');
      const paths = preview.map((f) => f.path);
      
      expect(paths).toContain('configs/collector-agent-config.yaml');
      expect(paths).toContain('configs/collector-gateway-config.yaml');
      
      // Configs should have actual content (non-zero size)
      const agentConfig = preview.find((f) => f.path === 'configs/collector-agent-config.yaml');
      expect(agentConfig!.size).toBeGreaterThan(100);
    });
  });

  describe('no files are empty', () => {
    it('all files have content', () => {
      const nodes = [
        makeSDKNode('sdk1', 'nodejs', 'node-app'),
        makeCollectorNode('col1', 'Collector Agent', 'collector-agent'),
      ];
      const edges = [makeEdge('sdk1', 'col1')];
      
      const preview = previewBundleContents(nodes, edges, 'serverless');
      
      for (const file of preview) {
        expect(file.size).toBeGreaterThan(0);
      }
    });
  });

  describe('multiple SDK languages', () => {
    it('generates files for each language', () => {
      const nodes = [
        makeSDKNode('sdk1', 'nodejs', 'node-app'),
        makeSDKNode('sdk2', 'python', 'python-app'),
        makeSDKNode('sdk3', 'java', 'java-app'),
        makeSDKNode('sdk4', 'dotnet', 'dotnet-app'),
        makeSDKNode('sdk5', 'go', 'go-app'),
      ];
      
      const preview = previewBundleContents(nodes, [], 'serverless');
      const paths = preview.map((f) => f.path);
      
      // Each app should have a Dockerfile
      expect(paths.filter((p) => p.includes('Dockerfile')).length).toBe(5);
    });
  });

  describe('deployment model affects output', () => {
    it('includes .env.example for all deployment models', () => {
      for (const model of ['serverless', 'ech', 'self-managed'] as const) {
        const nodes = [makeCollectorNode('col1', 'Collector Agent', 'collector-agent')];
        const preview = previewBundleContents(nodes, [], model);
        const paths = preview.map((f) => f.path);
        
        expect(paths).toContain('.env.example');
      }
    });
  });
});
