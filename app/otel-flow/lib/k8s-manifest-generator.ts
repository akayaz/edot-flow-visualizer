import type { Node, Edge } from '@xyflow/react';
import type {
  EDOTNodeData,
  K8sNamespaceNodeData,
  K8sDaemonSetNodeData,
  K8sDeploymentNodeData,
  CollectorNodeData,
  SDKNodeData,
  KafkaNodeData,
  FlowEdgeData,
  DeploymentModel,
} from '../types';
import { EDOT_COLLECTOR_IMAGE } from './versions';
import { generateCollectorYAML } from './yaml-generator';

interface K8sGeneratorOptions {
  /** Namespace name (default: 'observability') */
  namespace?: string;
  /** Resource limits for collectors */
  resourceLimits?: { cpu: string; memory: string };
  /** Deployment model for collector YAML generation */
  deploymentModel?: DeploymentModel;
}

/**
 * Generates Kubernetes manifests from the current EDOT topology.
 * Now works WITHOUT K8s canvas nodes - generates from EDOT topology alone.
 * If K8s canvas nodes ARE present, uses their settings as overrides.
 */
export function generateK8sManifests(
  nodes: Node<EDOTNodeData>[],
  edges: Edge<FlowEdgeData>[] = [],
  options: K8sGeneratorOptions = {}
): string {
  const defaultNamespace = options.namespace || 'observability';
  const deploymentModel = options.deploymentModel || 'serverless';

  // Check for K8s canvas nodes (optional overrides)
  const namespaceNodes = nodes.filter(
    (node) => node.type === 'infrastructureK8sNamespace'
  ) as Node<K8sNamespaceNodeData>[];

  const daemonSetOverrides = nodes.filter(
    (n) => n.type === 'infrastructureK8sDaemonSet'
  ) as Node<K8sDaemonSetNodeData>[];

  const deploymentOverrides = nodes.filter(
    (n) => n.type === 'infrastructureK8sDeployment'
  ) as Node<K8sDeploymentNodeData>[];

  // Extract EDOT topology nodes
  const agentNodes = nodes.filter(
    (n) => n.data.componentType === 'collector-agent'
  ) as Node<CollectorNodeData>[];
  const gatewayNodes = nodes.filter(
    (n) => n.data.componentType === 'collector-gateway'
  ) as Node<CollectorNodeData>[];
  const sdkNodes = nodes.filter(
    (n) => n.data.componentType === 'edot-sdk'
  ) as Node<SDKNodeData>[];
  const kafkaNodes = nodes.filter(
    (n) => n.data.componentType === 'kafka-broker'
  ) as Node<KafkaNodeData>[];

  // If no EDOT components exist, check legacy K8s-only path
  if (agentNodes.length === 0 && gatewayNodes.length === 0 && sdkNodes.length === 0) {
    if (namespaceNodes.length === 0) {
      return `# No EDOT components or Kubernetes resources found in topology
# Add EDOT SDK, Collector Agent, or Collector Gateway nodes to generate K8s manifests
`;
    }
    // Legacy path for K8s-only nodes
    return generateLegacyK8sManifests(nodes);
  }

  // Determine namespace name (from canvas node or default)
  const namespaceName = namespaceNodes.length > 0
    ? namespaceNodes[0].data.name
    : defaultNamespace;

  const manifests: string[] = [];

  // 1. Namespace
  manifests.push(generateNamespaceManifest(namespaceName, namespaceNodes[0]?.data.labels));

  // 2. RBAC
  manifests.push(generateServiceAccount(namespaceName));
  manifests.push(generateClusterRole());
  manifests.push(generateClusterRoleBinding(namespaceName));

  // 3. Secret template
  manifests.push(generateSecretTemplate(namespaceName));

  // 4. Collector Agents → DaemonSets
  for (const agentNode of agentNodes) {
    const agentName = toK8sName(agentNode.data.label);
    
    // Find override from K8s canvas nodes
    const dsOverride = daemonSetOverrides.find(
      (ds) => ds.data.name === agentName || daemonSetOverrides.length === 1
    );

    // Generate actual collector YAML config
    const collectorYAML = generateCollectorYAML(agentNode.data, { deploymentModel });

    manifests.push(generateConfigMapForCollector(
      agentName,
      namespaceName,
      collectorYAML
    ));

    manifests.push(generateDaemonSetManifest(
      agentName,
      namespaceName,
      dsOverride?.data.nodeSelector,
      options.resourceLimits
    ));
  }

  // 5. Collector Gateways → Deployments + Services
  for (const gatewayNode of gatewayNodes) {
    const gatewayName = toK8sName(gatewayNode.data.label);
    
    // Find override from K8s canvas nodes
    const deployOverride = deploymentOverrides.find(
      (dep) => dep.data.name === gatewayName || deploymentOverrides.length === 1
    );

    // Generate actual collector YAML config
    const collectorYAML = generateCollectorYAML(gatewayNode.data, { deploymentModel });

    manifests.push(generateConfigMapForCollector(
      gatewayName,
      namespaceName,
      collectorYAML
    ));

    const replicas = deployOverride?.data.replicas || 2;
    const resources = deployOverride?.data.resources || options.resourceLimits || { cpu: '500m', memory: '1Gi' };

    manifests.push(generateDeploymentManifest(
      gatewayName,
      namespaceName,
      replicas,
      resources
    ));

    manifests.push(generateServiceManifest(
      gatewayName,
      namespaceName
    ));
  }

  // 6. SDK apps → Deployments + Services (optional)
  for (const sdkNode of sdkNodes) {
    const appName = toK8sName(sdkNode.data.serviceName || sdkNode.data.label);
    manifests.push(generateAppDeployment(
      appName,
      namespaceName,
      sdkNode.data,
      agentNodes.length > 0 ? toK8sName(agentNodes[0].data.label) : gatewayNodes.length > 0 ? toK8sName(gatewayNodes[0].data.label) : 'edot-collector'
    ));
    manifests.push(generateAppService(appName, namespaceName));
  }

  // 7. Kafka Broker → StatefulSet + Service (when Kafka nodes exist)
  for (const kafkaNode of kafkaNodes) {
    const kafkaName = toK8sName(kafkaNode.data.clusterName || kafkaNode.data.label);
    manifests.push(generateKafkaStatefulSet(kafkaName, namespaceName));
    manifests.push(generateKafkaService(kafkaName, namespaceName));
  }

  // Header
  const header = `# Kubernetes Manifests for EDOT Infrastructure
# Generated by EDOT Flow Visualizer
# https://github.com/elastic/opentelemetry
#
# EDOT Collector Image: ${EDOT_COLLECTOR_IMAGE}
#
# Prerequisites:
# 1. Set up Elastic Observability deployment
# 2. Create secret with APM credentials:
#    kubectl create secret generic elastic-apm \\
#      --from-literal=server-url='https://your-deployment.apm.elastic-cloud.com:443' \\
#      --from-literal=secret-token='your-secret-token' \\
#      -n ${namespaceName}
#
# Apply manifests:
# kubectl apply -f k8s-manifests.yaml

---
`;

  return header + manifests.join('\n---\n');
}

// ============================================
// Manifest Generators
// ============================================

function generateNamespaceManifest(
  name: string,
  labels?: Record<string, string>
): string {
  const labelLines = labels
    ? Object.entries(labels).map(([k, v]) => `    ${k}: "${v}"`).join('\n')
    : '';

  return `apiVersion: v1
kind: Namespace
metadata:
  name: ${name}${
    labelLines ? `\n  labels:\n${labelLines}` : ''
  }`;
}

function generateServiceAccount(namespace: string): string {
  return `apiVersion: v1
kind: ServiceAccount
metadata:
  name: edot-collector
  namespace: ${namespace}`;
}

function generateClusterRole(): string {
  return `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: edot-collector
rules:
- apiGroups: [""]
  resources: ["pods", "nodes", "services", "namespaces", "endpoints"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["replicasets", "deployments", "daemonsets", "statefulsets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["batch"]
  resources: ["jobs", "cronjobs"]
  verbs: ["get", "list", "watch"]`;
}

function generateClusterRoleBinding(namespace: string): string {
  return `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: edot-collector
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: edot-collector
subjects:
- kind: ServiceAccount
  name: edot-collector
  namespace: ${namespace}`;
}

function generateSecretTemplate(namespace: string): string {
  return `# Secret template - replace values with your Elastic credentials
# Or create via kubectl:
#   kubectl create secret generic elastic-apm \\
#     --from-literal=server-url='YOUR_URL' \\
#     --from-literal=secret-token='YOUR_TOKEN' \\
#     -n ${namespace}
apiVersion: v1
kind: Secret
metadata:
  name: elastic-apm
  namespace: ${namespace}
type: Opaque
stringData:
  server-url: "https://your-deployment.apm.elastic-cloud.com:443"
  secret-token: "your-secret-token"`;
}

function generateConfigMapForCollector(
  name: string,
  namespace: string,
  collectorYAML: string
): string {
  // Indent the collector YAML for embedding in ConfigMap
  const indentedYAML = collectorYAML
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');

  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${name}-config
  namespace: ${namespace}
data:
  collector.yaml: |
${indentedYAML}`;
}

function generateDaemonSetManifest(
  name: string,
  namespace: string,
  nodeSelector?: Record<string, string>,
  resourceLimits?: { cpu: string; memory: string }
): string {
  const limits = resourceLimits || { cpu: '500m', memory: '512Mi' };
  const nodeSelectorLines = nodeSelector
    ? Object.entries(nodeSelector).map(([k, v]) => `        ${k}: "${v}"`).join('\n')
    : '';

  return `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
    app: edot-collector
    component: agent
spec:
  selector:
    matchLabels:
      app: edot-collector
      component: agent
      collector-name: ${name}
  template:
    metadata:
      labels:
        app: edot-collector
        component: agent
        collector-name: ${name}
    spec:${
      nodeSelectorLines ? `\n      nodeSelector:\n${nodeSelectorLines}` : ''
    }
      containers:
      - name: edot-collector
        image: ${EDOT_COLLECTOR_IMAGE}
        command: ["elastic-agent", "otel", "--config", "/etc/otel-collector/collector.yaml"]
        env:
        - name: ELASTIC_APM_SERVER_URL
          valueFrom:
            secretKeyRef:
              name: elastic-apm
              key: server-url
        - name: ELASTIC_APM_SECRET_TOKEN
          valueFrom:
            secretKeyRef:
              name: elastic-apm
              key: secret-token
        ports:
        - containerPort: 4317
          name: otlp-grpc
          protocol: TCP
        - containerPort: 4318
          name: otlp-http
          protocol: TCP
        - containerPort: 8888
          name: metrics
          protocol: TCP
        resources:
          limits:
            memory: ${limits.memory}
            cpu: ${limits.cpu}
          requests:
            memory: 256Mi
            cpu: 200m
        volumeMounts:
        - name: config
          mountPath: /etc/otel-collector
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: ${name}-config
      serviceAccountName: edot-collector`;
}

function generateDeploymentManifest(
  name: string,
  namespace: string,
  replicas: number,
  resources: { cpu: string; memory: string }
): string {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
    app: edot-collector
    component: gateway
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: edot-collector
      component: gateway
      collector-name: ${name}
  template:
    metadata:
      labels:
        app: edot-collector
        component: gateway
        collector-name: ${name}
    spec:
      containers:
      - name: edot-collector
        image: ${EDOT_COLLECTOR_IMAGE}
        command: ["elastic-agent", "otel", "--config", "/etc/otel-collector/collector.yaml"]
        env:
        - name: ELASTIC_APM_SERVER_URL
          valueFrom:
            secretKeyRef:
              name: elastic-apm
              key: server-url
        - name: ELASTIC_APM_SECRET_TOKEN
          valueFrom:
            secretKeyRef:
              name: elastic-apm
              key: secret-token
        ports:
        - containerPort: 4317
          name: otlp-grpc
          protocol: TCP
        - containerPort: 4318
          name: otlp-http
          protocol: TCP
        - containerPort: 8888
          name: metrics
          protocol: TCP
        resources:
          limits:
            memory: ${resources.memory}
            cpu: ${resources.cpu}
          requests:
            memory: ${resources.memory}
            cpu: ${resources.cpu}
        volumeMounts:
        - name: config
          mountPath: /etc/otel-collector
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: ${name}-config
      serviceAccountName: edot-collector`;
}

function generateServiceManifest(name: string, namespace: string): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
    app: edot-collector
    component: gateway
spec:
  type: ClusterIP
  selector:
    app: edot-collector
    component: gateway
    collector-name: ${name}
  ports:
  - name: otlp-grpc
    port: 4317
    targetPort: 4317
    protocol: TCP
  - name: otlp-http
    port: 4318
    targetPort: 4318
    protocol: TCP
  - name: metrics
    port: 8888
    targetPort: 8888
    protocol: TCP`;
}

function generateAppDeployment(
  name: string,
  namespace: string,
  sdkData: SDKNodeData,
  collectorServiceName: string
): string {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
    app: ${name}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: ${name}
        image: ${name}:latest
        env:
        - name: OTEL_SERVICE_NAME
          value: "${sdkData.serviceName || name}"
        - name: OTEL_EXPORTER_OTLP_ENDPOINT
          value: "http://${collectorServiceName}:4318"
        - name: OTEL_EXPORTER_OTLP_PROTOCOL
          value: "http/protobuf"
        ports:
        - containerPort: 8080
          name: http
          protocol: TCP
        resources:
          limits:
            memory: 256Mi
            cpu: 250m
          requests:
            memory: 128Mi
            cpu: 100m`;
}

function generateAppService(name: string, namespace: string): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
    app: ${name}
spec:
  type: ClusterIP
  selector:
    app: ${name}
  ports:
  - name: http
    port: 80
    targetPort: 8080
    protocol: TCP`;
}

// ============================================
// Legacy K8s-only manifest generation
// ============================================

function generateLegacyK8sManifests(nodes: Node<EDOTNodeData>[]): string {
  const namespaceNodes = nodes.filter(
    (node) => node.type === 'infrastructureK8sNamespace'
  ) as Node<K8sNamespaceNodeData>[];

  if (namespaceNodes.length === 0) {
    return `# No Kubernetes resources found in topology
# Add K8s Namespace, DaemonSet, or Deployment nodes from the Infrastructure section
`;
  }

  const manifests: string[] = [];

  for (const nsNode of namespaceNodes) {
    const nsData = nsNode.data;

    manifests.push(generateNamespaceManifest(nsData.name, nsData.labels));

    // Find DaemonSets in this namespace
    const daemonSets = nodes.filter(
      (n) => n.parentId === nsNode.id && n.type === 'infrastructureK8sDaemonSet'
    ) as Node<K8sDaemonSetNodeData>[];

    for (const dsNode of daemonSets) {
      manifests.push(generateDaemonSetManifest(
        dsNode.data.name,
        dsNode.data.namespace,
        dsNode.data.nodeSelector
      ));
    }

    // Find Deployments in this namespace
    const deployments = nodes.filter(
      (n) => n.parentId === nsNode.id && n.type === 'infrastructureK8sDeployment'
    ) as Node<K8sDeploymentNodeData>[];

    for (const deployNode of deployments) {
      const resources = deployNode.data.resources || { cpu: '500m', memory: '1Gi' };
      manifests.push(generateDeploymentManifest(
        deployNode.data.name,
        deployNode.data.namespace,
        deployNode.data.replicas,
        resources
      ));
      manifests.push(generateServiceManifest(deployNode.data.name, deployNode.data.namespace));
    }

    // Generate ConfigMap with hardcoded config for legacy nodes
    manifests.push(generateConfigMapForCollector(
      'edot-collector',
      nsData.name,
      generateLegacyCollectorConfig()
    ));

    // RBAC
    manifests.push(generateServiceAccount(nsData.name));
    manifests.push(generateClusterRole());
    manifests.push(generateClusterRoleBinding(nsData.name));
  }

  const header = `# Kubernetes Manifests for EDOT Infrastructure
# Generated by EDOT Flow Visualizer
# https://github.com/elastic/opentelemetry
#
# EDOT Collector Image: ${EDOT_COLLECTOR_IMAGE}
#
# Prerequisites:
# 1. Set up Elastic Observability deployment
# 2. Create secret with APM credentials:
#    kubectl create secret generic elastic-apm \\
#      --from-literal=server-url='https://your-deployment.apm.elastic-cloud.com:443' \\
#      --from-literal=secret-token='your-secret-token' \\
#      -n observability
#
# Apply manifests:
# kubectl apply -f k8s-manifests.yaml

---
`;

  return header + manifests.join('\n---\n');
}

function generateLegacyCollectorConfig(): string {
  return `receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
  hostmetrics:
    collection_interval: 30s
    scrapers:
      cpu: {}
      memory: {}
      disk: {}
      network: {}

processors:
  memory_limiter:
    limit_mib: 512
    spike_limit_mib: 128
    check_interval: 5s
  batch:
    timeout: 10s
    send_batch_size: 1024

exporters:
  elasticsearch:
    endpoint: \${ELASTIC_APM_SERVER_URL}
    headers:
      Authorization: "Bearer \${ELASTIC_APM_SECRET_TOKEN}"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [elasticsearch]
    metrics:
      receivers: [otlp, hostmetrics]
      processors: [memory_limiter, batch]
      exporters: [elasticsearch]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [elasticsearch]`;
}

// ============================================
// Kafka Manifest Generators
// ============================================

function generateKafkaStatefulSet(name: string, namespace: string): string {
  return `
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
    app: ${name}
    component: kafka-broker
spec:
  serviceName: ${name}-headless
  replicas: 1
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
        component: kafka-broker
    spec:
      containers:
        - name: kafka
          image: confluentinc/cp-kafka:7.6.0
          ports:
            - containerPort: 9092
              name: client
            - containerPort: 29092
              name: internal
            - containerPort: 29093
              name: controller
          env:
            - name: KAFKA_NODE_ID
              value: "1"
            - name: KAFKA_LISTENER_SECURITY_PROTOCOL_MAP
              value: CONTROLLER:PLAINTEXT,INTERNAL:PLAINTEXT,CLIENT:PLAINTEXT
            - name: KAFKA_ADVERTISED_LISTENERS
              value: INTERNAL://${name}-0.${name}-headless.${namespace}.svc.cluster.local:29092,CLIENT://${name}.${namespace}.svc.cluster.local:9092
            - name: KAFKA_PROCESS_ROLES
              value: broker,controller
            - name: KAFKA_CONTROLLER_QUORUM_VOTERS
              value: 1@localhost:29093
            - name: KAFKA_LISTENERS
              value: INTERNAL://0.0.0.0:29092,CONTROLLER://0.0.0.0:29093,CLIENT://0.0.0.0:9092
            - name: KAFKA_INTER_BROKER_LISTENER_NAME
              value: INTERNAL
            - name: KAFKA_CONTROLLER_LISTENER_NAMES
              value: CONTROLLER
            - name: KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR
              value: "1"
            - name: KAFKA_AUTO_CREATE_TOPICS_ENABLE
              value: "true"
            - name: CLUSTER_ID
              value: edot-kafka-cluster-001
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 2Gi
          readinessProbe:
            exec:
              command:
                - kafka-topics
                - --bootstrap-server
                - localhost:9092
                - --list
            initialDelaySeconds: 30
            periodSeconds: 10
          volumeMounts:
            - name: kafka-data
              mountPath: /var/lib/kafka/data
  volumeClaimTemplates:
    - metadata:
        name: kafka-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi`;
}

function generateKafkaService(name: string, namespace: string): string {
  return `
apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
    app: ${name}
    component: kafka-broker
spec:
  type: ClusterIP
  ports:
    - port: 9092
      targetPort: 9092
      protocol: TCP
      name: client
  selector:
    app: ${name}
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}-headless
  namespace: ${namespace}
  labels:
    app: ${name}
    component: kafka-broker
spec:
  type: ClusterIP
  clusterIP: None
  ports:
    - port: 29092
      targetPort: 29092
      protocol: TCP
      name: internal
    - port: 29093
      targetPort: 29093
      protocol: TCP
      name: controller
  selector:
    app: ${name}`;
}

// ============================================
// Utilities
// ============================================

function toK8sName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'edot-collector';
}

/**
 * Downloads the k8s-manifests.yaml file
 */
export function downloadK8sManifests(content: string): void {
  const blob = new Blob([content], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'k8s-manifests.yaml';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
