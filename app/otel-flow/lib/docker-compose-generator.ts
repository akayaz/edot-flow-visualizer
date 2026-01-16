import type { Node, Edge } from '@xyflow/react';
import type { 
  EDOTNodeData, 
  SDKNodeData, 
  CollectorNodeData, 
  ElasticNodeData,
  DockerNodeData,
  FlowEdgeData,
  SDKLanguage,
  DeploymentModel
} from '../types';

// SDK language to Docker base image mapping (for reference in build context)
const SDK_DOCKER_IMAGES: Record<SDKLanguage, { baseImage: string; comment: string }> = {
  nodejs: { baseImage: 'node:20-alpine', comment: 'Node.js application' },
  python: { baseImage: 'python:3.11-slim', comment: 'Python application' },
  java: { baseImage: 'eclipse-temurin:21-jre', comment: 'Java application' },
  dotnet: { baseImage: 'mcr.microsoft.com/dotnet/aspnet:8.0', comment: '.NET application' },
  go: { baseImage: 'golang:1.22-alpine', comment: 'Go application' },
  php: { baseImage: 'php:8.3-apache', comment: 'PHP application' },
  ruby: { baseImage: 'ruby:3.3-slim', comment: 'Ruby application' },
  android: { baseImage: 'node:20-alpine', comment: 'Android (placeholder)' },
  ios: { baseImage: 'node:20-alpine', comment: 'iOS (placeholder)' },
};

// Export for use in other generators
export { SDK_DOCKER_IMAGES };

// EDOT Collector image
const EDOT_COLLECTOR_IMAGE = 'docker.elastic.co/beats/elastic-agent:9.0.0';

interface DockerService {
  image?: string;
  build?: { context: string; dockerfile?: string };
  container_name: string;
  environment?: Record<string, string>;
  ports?: string[];
  volumes?: string[];
  depends_on?: string[];
  restart?: string;
  networks?: string[];
  command?: string[];
  healthcheck?: {
    test: string[];
    interval: string;
    timeout: string;
    retries: number;
  };
}

interface DockerComposeConfig {
  version: string;
  services: Record<string, DockerService>;
  networks?: Record<string, { driver: string }>;
  volumes?: Record<string, Record<string, unknown>>;
}

/**
 * Find connected collectors for a given source node
 */
function findConnectedCollectors(
  sourceId: string,
  nodes: Node<EDOTNodeData>[],
  edges: Edge<FlowEdgeData>[]
): Node<CollectorNodeData>[] {
  const connectedEdges = edges.filter((e) => e.source === sourceId);
  const connectedNodeIds = connectedEdges.map((e) => e.target);
  
  return nodes.filter(
    (n) => connectedNodeIds.includes(n.id) && 
    (n.data.componentType === 'collector-agent' || n.data.componentType === 'collector-gateway')
  ) as Node<CollectorNodeData>[];
}

/**
 * Find the target collector/elastic for a collector
 */
function findCollectorTarget(
  collectorId: string,
  nodes: Node<EDOTNodeData>[],
  edges: Edge<FlowEdgeData>[]
): Node<EDOTNodeData> | undefined {
  const connectedEdges = edges.filter((e) => e.source === collectorId);
  const connectedNodeIds = connectedEdges.map((e) => e.target);
  
  return nodes.find(
    (n) => connectedNodeIds.includes(n.id) && 
    (n.data.componentType === 'collector-gateway' || n.data.componentType === 'elastic-apm')
  );
}

/**
 * Generate a valid service name from node label
 */
function toServiceName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'service';
}

/**
 * Generate SDK service configuration
 */
function generateSDKService(
  node: Node<SDKNodeData>,
  collectorEndpoint: string
): DockerService {
  const serviceName = toServiceName(node.data.serviceName || node.data.label);
  
  // Base environment variables
  const environment: Record<string, string> = {
    OTEL_SERVICE_NAME: node.data.serviceName || serviceName,
    OTEL_EXPORTER_OTLP_ENDPOINT: collectorEndpoint,
    OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
    OTEL_TRACES_EXPORTER: 'otlp',
    OTEL_METRICS_EXPORTER: 'otlp',
    OTEL_LOGS_EXPORTER: 'otlp',
  };

  // Add language-specific environment variables
  if (node.data.language === 'nodejs') {
    environment.NODE_OPTIONS = '--require @opentelemetry/auto-instrumentations-node/register';
  } else if (node.data.language === 'python') {
    environment.PYTHONPATH = '/app';
  } else if (node.data.language === 'java') {
    environment.JAVA_TOOL_OPTIONS = '-javaagent:/otel/opentelemetry-javaagent.jar';
  }
  
  return {
    build: { context: `./${serviceName}` },
    container_name: serviceName,
    environment,
    depends_on: ['edot-collector'],
    restart: 'unless-stopped',
    networks: ['edot-network'],
  };
}

/**
 * Generate Collector Agent service configuration
 */
function generateCollectorAgentService(
  node: Node<CollectorNodeData>,
  targetEndpoint: string | undefined,
  isGatewayTarget: boolean
): DockerService {
  const serviceName = toServiceName(node.data.label);
  
  const environment: Record<string, string> = {};
  
  if (isGatewayTarget) {
    environment.OTEL_EXPORTER_OTLP_ENDPOINT = targetEndpoint || 'http://edot-gateway:4317';
  } else {
    environment.ELASTIC_APM_SERVER_URL = '${ELASTIC_APM_SERVER_URL}';
    environment.ELASTIC_APM_SECRET_TOKEN = '${ELASTIC_APM_SECRET_TOKEN}';
  }
  
  return {
    image: EDOT_COLLECTOR_IMAGE,
    container_name: serviceName,
    environment,
    ports: [
      '4317:4317',   // OTLP gRPC
      '4318:4318',   // OTLP HTTP
      '8888:8888',   // Metrics endpoint
    ],
    volumes: [
      `./configs/${serviceName}-config.yaml:/etc/otelcol/config.yaml:ro`,
    ],
    restart: 'unless-stopped',
    networks: ['edot-network'],
    healthcheck: {
      test: ['CMD', 'curl', '-f', 'http://localhost:8888/metrics'],
      interval: '30s',
      timeout: '10s',
      retries: 3,
    },
  };
}

/**
 * Generate Collector Gateway service configuration
 */
function generateCollectorGatewayService(
  node: Node<CollectorNodeData>
): DockerService {
  const serviceName = toServiceName(node.data.label);
  
  return {
    image: EDOT_COLLECTOR_IMAGE,
    container_name: serviceName,
    environment: {
      ELASTIC_APM_SERVER_URL: '${ELASTIC_APM_SERVER_URL}',
      ELASTIC_APM_SECRET_TOKEN: '${ELASTIC_APM_SECRET_TOKEN}',
    },
    ports: [
      '14317:4317',   // OTLP gRPC (different host port to avoid conflict)
      '14318:4318',   // OTLP HTTP
      '18888:8888',   // Metrics endpoint
    ],
    volumes: [
      `./configs/${serviceName}-config.yaml:/etc/otelcol/config.yaml:ro`,
    ],
    restart: 'unless-stopped',
    networks: ['edot-network'],
    healthcheck: {
      test: ['CMD', 'curl', '-f', 'http://localhost:8888/metrics'],
      interval: '30s',
      timeout: '10s',
      retries: 3,
    },
  };
}

/**
 * Generate Elasticsearch service for self-managed deployments
 */
function generateElasticsearchService(): DockerService {
  return {
    image: 'docker.elastic.co/elasticsearch/elasticsearch:8.17.0',
    container_name: 'elasticsearch',
    environment: {
      'discovery.type': 'single-node',
      'xpack.security.enabled': 'true',
      'xpack.security.http.ssl.enabled': 'false',
      'ELASTIC_PASSWORD': '${ELASTIC_PASSWORD:-changeme}',
      'ES_JAVA_OPTS': '-Xms1g -Xmx1g',
    },
    ports: ['9200:9200'],
    volumes: ['es-data:/usr/share/elasticsearch/data'],
    restart: 'unless-stopped',
    networks: ['edot-network'],
    healthcheck: {
      test: ['CMD-SHELL', 'curl -s http://localhost:9200 >/dev/null || exit 1'],
      interval: '30s',
      timeout: '10s',
      retries: 5,
    },
  };
}

/**
 * Generate Kibana service for self-managed deployments
 */
function generateKibanaService(): DockerService {
  return {
    image: 'docker.elastic.co/kibana/kibana:8.17.0',
    container_name: 'kibana',
    environment: {
      ELASTICSEARCH_HOSTS: 'http://elasticsearch:9200',
      ELASTICSEARCH_USERNAME: 'kibana_system',
      ELASTICSEARCH_PASSWORD: '${KIBANA_PASSWORD:-changeme}',
    },
    ports: ['5601:5601'],
    depends_on: ['elasticsearch'],
    restart: 'unless-stopped',
    networks: ['edot-network'],
  };
}

/**
 * Legacy: Process Docker container nodes (for backward compatibility)
 */
function processDockerContainerNodes(
  nodes: Node<EDOTNodeData>[],
  services: Record<string, DockerService>
): void {
  const dockerNodes = nodes.filter(
    (node) => node.type === 'infrastructureDocker'
  ) as Node<DockerNodeData>[];

  for (const dockerNode of dockerNodes) {
    const containerData = dockerNode.data;
    const serviceName = toServiceName(containerData.containerName);

    // Find children of this Docker container
    const children = nodes.filter((n) => n.parentId === dockerNode.id);

    const service: DockerService = {
      image: `${containerData.imageName}:${containerData.imageTag}`,
      container_name: containerData.containerName,
      restart: 'unless-stopped',
      networks: ['edot-network'],
    };

    // Add network mode
    if (containerData.networkMode) {
      service.networks = undefined;
      // Note: network_mode would need to be added to DockerService interface
    }

    // Add port mappings
    if (containerData.ports && containerData.ports.length > 0) {
      service.ports = containerData.ports.map(
        (p) => `${p.host}:${p.container}`
      );
    }

    // Add environment variables
    const envVars: Record<string, string> = { ...containerData.environment };

    // Check if container has EDOT SDK child
    const sdkChild = children.find((c) => c.type === 'edotSdk') as
      | Node<SDKNodeData>
      | undefined;
    if (sdkChild) {
      envVars.OTEL_SERVICE_NAME = sdkChild.data.serviceName;
      envVars.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://edot-collector:4318';
      envVars.OTEL_EXPORTER_OTLP_PROTOCOL = 'http/protobuf';
    }

    // Check if container has Collector child
    const collectorChild = children.find((c) => c.type === 'collector') as
      | Node<CollectorNodeData>
      | undefined;
    if (collectorChild) {
      envVars.ELASTIC_APM_SERVER_URL = '${ELASTIC_APM_SERVER_URL}';
      envVars.ELASTIC_APM_SECRET_TOKEN = '${ELASTIC_APM_SECRET_TOKEN}';

      if (!service.ports) service.ports = [];
      service.ports.push('4317:4317');
      service.ports.push('4318:4318');
      service.ports.push('8888:8888');
    }

    if (Object.keys(envVars).length > 0) {
      service.environment = envVars;
    }

    services[serviceName] = service;
  }
}

/**
 * Generates a docker-compose.yml file from the current topology
 */
export function generateDockerCompose(
  nodes: Node<EDOTNodeData>[],
  edges: Edge<FlowEdgeData>[] = [],
  deploymentModel: DeploymentModel = 'serverless'
): string {
  const config: DockerComposeConfig = {
    version: '3.8',
    services: {},
    networks: {
      'edot-network': { driver: 'bridge' },
    },
    volumes: {},
  };

  // Extract nodes by type
  const sdkNodes = nodes.filter((n) => n.data.componentType === 'edot-sdk') as Node<SDKNodeData>[];
  const agentNodes = nodes.filter((n) => n.data.componentType === 'collector-agent') as Node<CollectorNodeData>[];
  const gatewayNodes = nodes.filter((n) => n.data.componentType === 'collector-gateway') as Node<CollectorNodeData>[];
  const elasticNodes = nodes.filter((n) => n.data.componentType === 'elastic-apm') as Node<ElasticNodeData>[];

  // Check if we should include self-managed Elasticsearch
  const includeSelfManagedES = deploymentModel === 'self-managed' && 
    elasticNodes.some((n) => n.data.endpointType === 'self-managed-es');

  // Determine collector endpoint for SDKs
  let sdkCollectorEndpoint = 'http://edot-collector:4318';
  if (agentNodes.length > 0) {
    sdkCollectorEndpoint = `http://${toServiceName(agentNodes[0].data.label)}:4318`;
  } else if (gatewayNodes.length > 0) {
    sdkCollectorEndpoint = `http://${toServiceName(gatewayNodes[0].data.label)}:4318`;
  }

  // Generate SDK services
  for (const sdkNode of sdkNodes) {
    const connectedCollectors = findConnectedCollectors(sdkNode.id, nodes, edges);
    const endpoint = connectedCollectors.length > 0 
      ? `http://${toServiceName(connectedCollectors[0].data.label)}:4318`
      : sdkCollectorEndpoint;
    
    const serviceName = toServiceName(sdkNode.data.serviceName || sdkNode.data.label);
    config.services[serviceName] = generateSDKService(sdkNode, endpoint);
    
    // Update depends_on based on actual collector
    if (connectedCollectors.length > 0) {
      config.services[serviceName].depends_on = [toServiceName(connectedCollectors[0].data.label)];
    }
  }

  // Generate Collector Agent services
  for (const agentNode of agentNodes) {
    const target = findCollectorTarget(agentNode.id, nodes, edges);
    const isGatewayTarget = target?.data.componentType === 'collector-gateway';
    const targetEndpoint = target && isGatewayTarget 
      ? `http://${toServiceName(target.data.label)}:4317`
      : undefined;
    
    const serviceName = toServiceName(agentNode.data.label);
    config.services[serviceName] = generateCollectorAgentService(agentNode, targetEndpoint, isGatewayTarget);
    
    // Add dependency on gateway if target is gateway
    if (isGatewayTarget && target) {
      config.services[serviceName].depends_on = [toServiceName(target.data.label)];
    }
  }

  // Generate Collector Gateway services
  for (const gatewayNode of gatewayNodes) {
    const serviceName = toServiceName(gatewayNode.data.label);
    config.services[serviceName] = generateCollectorGatewayService(gatewayNode);
    
    // Add dependency on Elasticsearch for self-managed
    if (includeSelfManagedES) {
      config.services[serviceName].depends_on = ['elasticsearch'];
    }
  }

  // Add self-managed Elasticsearch stack if needed
  if (includeSelfManagedES) {
    config.services['elasticsearch'] = generateElasticsearchService();
    config.services['kibana'] = generateKibanaService();
    config.volumes = { 'es-data': {} };
  }

  // Legacy: Process Docker container nodes
  processDockerContainerNodes(nodes, config.services);

  // If no services generated, return empty template
  if (Object.keys(config.services).length === 0) {
    return `# No services found in topology
# Add EDOT SDK, Collector, or Docker Container nodes to generate services

version: '3.8'
services: {}
`;
  }

  // Build YAML output
  return buildDockerComposeYAML(config, deploymentModel, includeSelfManagedES);
}

/**
 * Build the docker-compose.yml YAML string
 */
function buildDockerComposeYAML(
  config: DockerComposeConfig,
  deploymentModel: DeploymentModel,
  includeSelfManagedES: boolean
): string {
  const lines: string[] = [
    '# Docker Compose configuration',
    '# Generated by EDOT Flow Visualizer',
    '# https://github.com/elastic/opentelemetry',
    '#',
    `# Deployment Model: ${deploymentModel}`,
    '',
    "version: '3.8'",
    '',
    'services:',
  ];

  for (const [name, service] of Object.entries(config.services)) {
    lines.push(`  ${name}:`);
    
    if (service.image) {
      lines.push(`    image: ${service.image}`);
    }
    if (service.build) {
      lines.push(`    build:`);
      lines.push(`      context: ${service.build.context}`);
      if (service.build.dockerfile) {
        lines.push(`      dockerfile: ${service.build.dockerfile}`);
      }
    }
    lines.push(`    container_name: ${service.container_name}`);
    
    if (service.environment && Object.keys(service.environment).length > 0) {
      lines.push(`    environment:`);
      for (const [key, value] of Object.entries(service.environment)) {
        if (value !== undefined) {
          lines.push(`      ${key}: ${value}`);
        }
      }
    }
    
    if (service.ports && service.ports.length > 0) {
      lines.push(`    ports:`);
      for (const port of service.ports) {
        lines.push(`      - "${port}"`);
      }
    }
    
    if (service.volumes && service.volumes.length > 0) {
      lines.push(`    volumes:`);
      for (const volume of service.volumes) {
        lines.push(`      - ${volume}`);
      }
    }
    
    if (service.depends_on && service.depends_on.length > 0) {
      lines.push(`    depends_on:`);
      for (const dep of service.depends_on) {
        lines.push(`      - ${dep}`);
      }
    }
    
    if (service.healthcheck) {
      lines.push(`    healthcheck:`);
      lines.push(`      test: ${JSON.stringify(service.healthcheck.test)}`);
      lines.push(`      interval: ${service.healthcheck.interval}`);
      lines.push(`      timeout: ${service.healthcheck.timeout}`);
      lines.push(`      retries: ${service.healthcheck.retries}`);
    }
    
    if (service.restart) {
      lines.push(`    restart: ${service.restart}`);
    }
    
    if (service.networks && service.networks.length > 0) {
      lines.push(`    networks:`);
      for (const network of service.networks) {
        lines.push(`      - ${network}`);
      }
    }
    
    lines.push('');
  }

  // Networks
  if (config.networks && Object.keys(config.networks).length > 0) {
    lines.push('networks:');
    for (const [name, net] of Object.entries(config.networks)) {
      lines.push(`  ${name}:`);
      lines.push(`    driver: ${net.driver}`);
    }
    lines.push('');
  }

  // Volumes
  if (config.volumes && Object.keys(config.volumes).length > 0) {
    lines.push('volumes:');
    for (const name of Object.keys(config.volumes)) {
      lines.push(`  ${name}:`);
    }
    lines.push('');
  }

  // Usage instructions
  lines.push('# Usage:');
  
  if (includeSelfManagedES) {
    lines.push('# 1. Set environment variables:');
    lines.push('#    export ELASTIC_PASSWORD="your-elasticsearch-password"');
    lines.push('#    export KIBANA_PASSWORD="your-kibana-password"');
    lines.push('#');
    lines.push('# 2. Start Elasticsearch first:');
    lines.push('#    docker-compose up -d elasticsearch');
    lines.push('#    (wait for it to be healthy)');
    lines.push('#');
    lines.push('# 3. Start remaining services:');
    lines.push('#    docker-compose up -d');
    lines.push('#');
    lines.push('# 4. Access Kibana at http://localhost:5601');
  } else {
    lines.push('# 1. Set environment variables:');
    lines.push('#    export ELASTIC_APM_SERVER_URL="https://your-deployment.apm.elastic-cloud.com:443"');
    lines.push('#    export ELASTIC_APM_SECRET_TOKEN="your-secret-token"');
    lines.push('#');
    lines.push('# 2. Start services:');
    lines.push('#    docker-compose up -d');
  }
  lines.push('#');
  lines.push('# 3. View logs:');
  lines.push('#    docker-compose logs -f');

  return lines.join('\n');
}

/**
 * Downloads the docker-compose.yml file
 */
export function downloadDockerCompose(content: string): void {
  const blob = new Blob([content], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'docker-compose.yml';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
