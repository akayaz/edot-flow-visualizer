import { expect } from 'vitest';
import { EDOT_VERSIONS, EDOT_COLLECTOR_IMAGE } from '../versions';

/**
 * Fail if any generated content references upstream OTel packages.
 * Go and PHP/Ruby are exceptions (no EDOT SDK yet).
 */
export function assertNoUpstreamOTelReferences(content: string, language?: string): void {
  // Skip check for Go, PHP, Ruby - no EDOT SDK exists yet
  if (language === 'go' || language === 'php' || language === 'ruby') return;

  expect(content).not.toContain('@opentelemetry/auto-instrumentations-node');
  expect(content).not.toContain('opentelemetry-javaagent.jar');
  expect(content).not.toContain('opentelemetry-distro');
  expect(content).not.toContain('otel/opentelemetry-collector-contrib');
}

/**
 * Verify EDOT Collector image is current.
 */
export function assertEdotCollectorImage(content: string): void {
  expect(content).toContain('docker.elastic.co/beats/elastic-agent');
  expect(content).not.toContain('elastic-agent:8.11.0');
}

/**
 * Verify Elastic Stack version is current.
 */
export function assertElasticStackVersion(content: string): void {
  if (content.includes('elasticsearch/elasticsearch:')) {
    expect(content).toContain(`elasticsearch:${EDOT_VERSIONS.elasticsearch}`);
  }
  if (content.includes('kibana/kibana:')) {
    expect(content).toContain(`kibana:${EDOT_VERSIONS.kibana}`);
  }
}
