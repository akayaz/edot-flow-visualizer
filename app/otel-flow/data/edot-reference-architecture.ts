/**
 * EDOT Reference Architecture Rules
 * 
 * Source: https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms
 * 
 * This file defines the official connectivity rules and recommended patterns
 * for EDOT (Elastic Distribution of OpenTelemetry) based on deployment model.
 */

import type { DeploymentModel } from '../types';

// ============================================================================
// DEPLOYMENT MODEL DEFINITIONS
// ============================================================================

export interface DeploymentArchitecture {
  model: DeploymentModel;
  name: string;
  description: string;
  endpoint: 'managed-otlp' | 'self-managed-es';
  gatewayRequired: boolean;
  recommendedPatterns: ArchitecturePattern[];
  validPatterns: ArchitecturePattern[];
  invalidPatterns: string[];
  docsUrl: string;
}

export interface ArchitecturePattern {
  id: string;
  name: string;
  flow: string;
  description: string;
  isRecommended: boolean;
  useCase: string;
}

// ============================================================================
// SERVERLESS DEPLOYMENT
// ============================================================================

export const SERVERLESS_ARCHITECTURE: DeploymentArchitecture = {
  model: 'serverless',
  name: 'Elastic Cloud Serverless',
  description: 'Fully managed Elastic Cloud with Managed OTLP Endpoint. No infrastructure to manage.',
  endpoint: 'managed-otlp',
  gatewayRequired: false,
  recommendedPatterns: [
    {
      id: 'serverless-direct',
      name: 'Direct Ingestion',
      flow: 'SDK → Elastic (Managed OTLP Endpoint)',
      description: 'SDK sends telemetry directly to Managed OTLP Endpoint. Simplest setup.',
      isRecommended: true,
      useCase: 'Getting started, simple applications, minimal infrastructure',
    },
    {
      id: 'serverless-with-agent',
      name: 'With Agent Collector',
      flow: 'SDK → Agent → Elastic (Managed OTLP Endpoint)',
      description: 'Agent collector provides host metrics and local buffering.',
      isRecommended: true,
      useCase: 'Need host/infrastructure metrics, want local reliability',
    },
  ],
  validPatterns: [
    {
      id: 'serverless-with-gateway',
      name: 'With Gateway (Optional)',
      flow: 'SDK → Agent → Gateway → Elastic',
      description: 'Gateway for advanced processing. Not required for Serverless.',
      isRecommended: false,
      useCase: 'Tail-based sampling, data transformation, multi-tenant routing',
    },
  ],
  invalidPatterns: [],
  docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms',
};

// ============================================================================
// ELASTIC CLOUD HOSTED (ECH) DEPLOYMENT
// ============================================================================

export const ECH_ARCHITECTURE: DeploymentArchitecture = {
  model: 'ech',
  name: 'Elastic Cloud Hosted',
  description: 'Elastic Cloud Hosted deployment with Managed OTLP Endpoint.',
  endpoint: 'managed-otlp',
  gatewayRequired: false,
  recommendedPatterns: [
    {
      id: 'ech-direct',
      name: 'Direct Ingestion',
      flow: 'SDK → Elastic (Managed OTLP Endpoint)',
      description: 'SDK sends telemetry directly to Managed OTLP Endpoint.',
      isRecommended: true,
      useCase: 'Simple applications, quick setup',
    },
    {
      id: 'ech-with-agent',
      name: 'With Agent Collector',
      flow: 'SDK → Agent → Elastic (Managed OTLP Endpoint)',
      description: 'Agent collector for host metrics and enrichment.',
      isRecommended: true,
      useCase: 'Infrastructure monitoring, reliability',
    },
  ],
  validPatterns: [
    {
      id: 'ech-with-gateway',
      name: 'With Gateway (Optional)',
      flow: 'SDK → Agent → Gateway → Elastic',
      description: 'Gateway for centralized processing. Optional for ECH.',
      isRecommended: false,
      useCase: 'Tail sampling, complex routing, data transformation',
    },
  ],
  invalidPatterns: [],
  docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms',
};

// ============================================================================
// SELF-MANAGED DEPLOYMENT
// ============================================================================

export const SELF_MANAGED_ARCHITECTURE: DeploymentArchitecture = {
  model: 'self-managed',
  name: 'Self-Managed Elasticsearch',
  description: 'On-premise or self-hosted Elasticsearch. Gateway collector is REQUIRED as ingestion layer (replaces APM Server).',
  endpoint: 'self-managed-es',
  gatewayRequired: true,
  recommendedPatterns: [
    {
      id: 'self-managed-full',
      name: 'Full Pipeline (Recommended)',
      flow: 'SDK → Agent → Gateway → Elasticsearch',
      description: 'Complete EDOT pipeline with Agent for host metrics and Gateway for ingestion.',
      isRecommended: true,
      useCase: 'Production deployments, full observability',
    },
    {
      id: 'self-managed-gateway-only',
      name: 'Gateway Only',
      flow: 'SDK → Gateway → Elasticsearch',
      description: 'SDK sends directly to Gateway. No host metrics.',
      isRecommended: true,
      useCase: 'Containerized apps where host metrics come from elsewhere',
    },
  ],
  validPatterns: [
    {
      id: 'self-managed-direct',
      name: 'Direct to ES (Not Recommended)',
      flow: 'SDK → Elasticsearch',
      description: 'SDK sends directly to Elasticsearch. Missing Gateway ingestion layer.',
      isRecommended: false,
      useCase: 'Development/testing only - NOT for production',
    },
  ],
  invalidPatterns: [
    'Agent → Elasticsearch (Agent should send to Gateway, not directly to ES)',
  ],
  docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms',
};

// ============================================================================
// COMBINED REFERENCE
// ============================================================================

export const DEPLOYMENT_ARCHITECTURES: Record<DeploymentModel, DeploymentArchitecture> = {
  'serverless': SERVERLESS_ARCHITECTURE,
  'ech': ECH_ARCHITECTURE,
  'self-managed': SELF_MANAGED_ARCHITECTURE,
};

/**
 * Get the architecture definition for a deployment model
 */
export function getDeploymentArchitecture(model: DeploymentModel): DeploymentArchitecture {
  return DEPLOYMENT_ARCHITECTURES[model];
}

/**
 * Check if a pattern is valid for a deployment model
 */
export function isPatternValid(
  pattern: 'sdk-direct' | 'sdk-agent' | 'sdk-gateway' | 'sdk-agent-gateway',
  model: DeploymentModel
): { valid: boolean; recommended: boolean; warning?: string } {
  const arch = DEPLOYMENT_ARCHITECTURES[model];
  
  switch (pattern) {
    case 'sdk-direct':
      if (model === 'self-managed') {
        return { 
          valid: true, 
          recommended: false, 
          warning: 'Gateway is required for self-managed. Direct SDK→ES is not recommended for production.' 
        };
      }
      return { valid: true, recommended: true };
      
    case 'sdk-agent':
      if (model === 'self-managed') {
        return { 
          valid: true, 
          recommended: false, 
          warning: 'Agent should send to Gateway, not directly to Elasticsearch.' 
        };
      }
      return { valid: true, recommended: true };
      
    case 'sdk-gateway':
      return { valid: true, recommended: model === 'self-managed' };
      
    case 'sdk-agent-gateway':
      return { valid: true, recommended: model === 'self-managed' };
      
    default:
      return { valid: false, recommended: false };
  }
}

// ============================================================================
// CONNECTIVITY RULES
// ============================================================================

export interface ConnectivityRule {
  source: string;
  target: string;
  serverless: 'valid' | 'warning' | 'invalid';
  ech: 'valid' | 'warning' | 'invalid';
  selfManaged: 'valid' | 'warning' | 'invalid';
  note: string;
}

export const CONNECTIVITY_RULES: ConnectivityRule[] = [
  {
    source: 'EDOT SDK',
    target: 'Elastic (Managed OTLP Endpoint)',
    serverless: 'valid',
    ech: 'valid',
    selfManaged: 'warning',
    note: 'Direct to Managed Endpoint is valid for Serverless/ECH. For self-managed, use Gateway.',
  },
  {
    source: 'EDOT SDK',
    target: 'Collector Agent',
    serverless: 'valid',
    ech: 'valid',
    selfManaged: 'valid',
    note: 'SDK to Agent is always valid. Agent provides host metrics and buffering.',
  },
  {
    source: 'EDOT SDK',
    target: 'Collector Gateway',
    serverless: 'valid',
    ech: 'valid',
    selfManaged: 'valid',
    note: 'SDK to Gateway is valid. Skips Agent (no host metrics from Agent).',
  },
  {
    source: 'Collector Agent',
    target: 'Elastic (Managed OTLP Endpoint)',
    serverless: 'valid',
    ech: 'valid',
    selfManaged: 'warning',
    note: 'Agent to Managed Endpoint is valid for Serverless/ECH. For self-managed, Agent should send to Gateway.',
  },
  {
    source: 'Collector Agent',
    target: 'Collector Gateway',
    serverless: 'valid',
    ech: 'valid',
    selfManaged: 'valid',
    note: 'Agent to Gateway is the recommended pattern for self-managed deployments.',
  },
  {
    source: 'Collector Gateway',
    target: 'Elastic/Elasticsearch',
    serverless: 'valid',
    ech: 'valid',
    selfManaged: 'valid',
    note: 'Gateway to Elastic is always valid. Required for self-managed.',
  },
];

