import type { Node, Edge } from '@xyflow/react';
import type { 
  EDOTNodeData, 
  SDKNodeData, 
  CollectorNodeData, 
  ElasticNodeData,
  KafkaNodeData,
  DockerNodeData,
  FlowEdgeData,
  SDKLanguage,
  DeploymentModel
} from '../types';
import { EDOT_VERSIONS, EDOT_COLLECTOR_IMAGE, ELASTICSEARCH_IMAGE, KIBANA_IMAGE } from './versions';

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

// Port allocation tracker for auto-incrementing host ports
let nextAppPort = 8080;

function resetPortAllocation(): void {
  nextAppPort = 8080;
}

function allocateAppPort(): number {
  return nextAppPort++;
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
 * Now uses EDOT SDK packages and includes ports + healthcheck
 */
function generateSDKService(
  node: Node<SDKNodeData>,
  collectorEndpoint: string,
  hostPort: number
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

  // Add EDOT language-specific environment variables
  if (node.data.language === 'nodejs') {
    // EDOT Node.js SDK - NOT upstream @opentelemetry/auto-instrumentations-node
    environment.NODE_OPTIONS = `--require ${EDOT_VERSIONS.nodePackage}/start`;
  } else if (node.data.language === 'python') {
    environment.PYTHONPATH = '/app';
  } else if (node.data.language === 'java') {
    // EDOT Java Agent - NOT upstream opentelemetry-javaagent.jar
    environment.JAVA_TOOL_OPTIONS = '-javaagent:/otel/elastic-otel-javaagent.jar';
  }
  
  return {
    build: { context: `./apps/${serviceName}`, dockerfile: 'Dockerfile' },
    container_name: serviceName,
    environment,
    ports: [`${hostPort}:8080`],
    depends_on: ['edot-collector'],
    restart: 'unless-stopped',
    networks: ['edot-network'],
    healthcheck: {
      test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:8080/health'],
      interval: '30s',
      timeout: '10s',
      retries: 3,
    },
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
    command: ['elastic-agent', 'otel', '--config', '/etc/otelcol/config.yaml'],
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
    command: ['elastic-agent', 'otel', '--config', '/etc/otelcol/config.yaml'],
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
    image: ELASTICSEARCH_IMAGE,
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
    image: KIBANA_IMAGE,
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
 * Generate Kafka Broker service configuration (KRaft mode, no Zookeeper)
 */
function generateKafkaService(
  node: Node<KafkaNodeData>
): DockerService {
  const serviceName = toServiceName(node.data.clusterName || node.data.label);

  return {
    image: 'confluentinc/cp-kafka:7.6.0',
    container_name: serviceName,
    environment: {
      KAFKA_NODE_ID: '1',
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT',
      KAFKA_ADVERTISED_LISTENERS: `PLAINTEXT://${serviceName}:29092,PLAINTEXT_HOST://localhost:9092`,
      KAFKA_PROCESS_ROLES: 'broker,controller',
      KAFKA_CONTROLLER_QUORUM_VOTERS: '1@localhost:29093',
      KAFKA_LISTENERS: 'PLAINTEXT://0.0.0.0:29092,CONTROLLER://0.0.0.0:29093,PLAINTEXT_HOST://0.0.0.0:9092',
      KAFKA_INTER_BROKER_LISTENER_NAME: 'PLAINTEXT',
      KAFKA_CONTROLLER_LISTENER_NAMES: 'CONTROLLER',
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true',
      CLUSTER_ID: 'edot-kafka-cluster-001',
    },
    ports: [
      '9092:9092',    // Host access
    ],
    restart: 'unless-stopped',
    networks: ['edot-network'],
    healthcheck: {
      test: ['CMD-SHELL', 'kafka-topics --bootstrap-server localhost:9092 --list'],
      interval: '30s',
      timeout: '10s',
      retries: 5,
    },
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
  // Reset port allocation for each generation
  resetPortAllocation();

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
  const kafkaNodes = nodes.filter((n) => n.data.componentType === 'kafka-broker') as Node<KafkaNodeData>[];

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

  // Generate SDK services with auto-incrementing ports
  for (const sdkNode of sdkNodes) {
    const connectedCollectors = findConnectedCollectors(sdkNode.id, nodes, edges);
    const endpoint = connectedCollectors.length > 0 
      ? `http://${toServiceName(connectedCollectors[0].data.label)}:4318`
      : sdkCollectorEndpoint;
    
    const serviceName = toServiceName(sdkNode.data.serviceName || sdkNode.data.label);
    const hostPort = allocateAppPort();
    config.services[serviceName] = generateSDKService(sdkNode, endpoint, hostPort);
    
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

  // Generate Kafka Broker services
  for (const kafkaNode of kafkaNodes) {
    const serviceName = toServiceName(kafkaNode.data.clusterName || kafkaNode.data.label);
    config.services[serviceName] = generateKafkaService(kafkaNode);

    // Wire depends_on for collectors that export to Kafka
    // Find collectors with edges TO this Kafka node
    const upstreamEdges = edges.filter((e) => e.target === kafkaNode.id);
    for (const edge of upstreamEdges) {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (sourceNode && (sourceNode.data.componentType === 'collector-agent' || sourceNode.data.componentType === 'collector-gateway')) {
        const sourceServiceName = toServiceName(sourceNode.data.label);
        if (config.services[sourceServiceName]) {
          const deps = config.services[sourceServiceName].depends_on || [];
          if (!deps.includes(serviceName)) {
            deps.push(serviceName);
          }
          config.services[sourceServiceName].depends_on = deps;
          // Add KAFKA_BROKERS env var
          const env = config.services[sourceServiceName].environment || {};
          env.KAFKA_BROKERS = `${serviceName}:29092`;
          config.services[sourceServiceName].environment = env;
        }
      }
    }

    // Wire depends_on for collectors that receive from Kafka
    // Find collectors with edges FROM this Kafka node
    const downstreamEdges = edges.filter((e) => e.source === kafkaNode.id);
    for (const edge of downstreamEdges) {
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (targetNode && (targetNode.data.componentType === 'collector-agent' || targetNode.data.componentType === 'collector-gateway')) {
        const targetServiceName = toServiceName(targetNode.data.label);
        if (config.services[targetServiceName]) {
          const deps = config.services[targetServiceName].depends_on || [];
          if (!deps.includes(serviceName)) {
            deps.push(serviceName);
          }
          config.services[targetServiceName].depends_on = deps;
          // Add KAFKA_BROKERS env var
          const env = config.services[targetServiceName].environment || {};
          env.KAFKA_BROKERS = `${serviceName}:29092`;
          config.services[targetServiceName].environment = env;
        }
      }
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
    `# EDOT Collector Image: ${EDOT_COLLECTOR_IMAGE}`,
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

    if (service.command && service.command.length > 0) {
      lines.push(`    command: ${JSON.stringify(service.command)}`);
    }
    
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
