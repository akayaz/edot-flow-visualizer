import YAML from 'yaml';
import type { CollectorNodeData } from '../types';

/**
 * EDOT Collector YAML Generator
 * 
 * Based on official Elastic documentation:
 * - https://www.elastic.co/docs/reference/edot-collector/config/default-config-standalone
 * - https://www.elastic.co/docs/reference/edot-collector/modes
 * - https://www.elastic.co/docs/reference/edot-collector/config/tail-based-sampling
 * 
 * Key EDOT-specific components (EDOT Collector 9.2.0+):
 * - elasticapm processor: Enriches trace data for Elastic APM UIs
 * - elasticapm connector: Generates pre-aggregated APM metrics from traces
 * - elasticsearch exporter: Direct ingestion with mapping.mode: otel
 * 
 * Processor order is critical:
 * - memory_limiter should be first to prevent OOM
 * - batch should typically be last before export
 */

interface EDOTConfig {
  extensions: Record<string, unknown>;
  receivers: Record<string, unknown>;
  processors: Record<string, unknown>;
  connectors?: Record<string, unknown>;
  exporters: Record<string, unknown>;
  service: {
    extensions: string[];
    pipelines: Record<string, { receivers: string[]; processors: string[]; exporters: string[] }>;
    telemetry?: Record<string, unknown>;
  };
}

export function generateCollectorYAML(nodeData: CollectorNodeData): string {
  const config = nodeData.config;
  const isGateway = nodeData.componentType === 'collector-gateway';

  // Defensive checks for missing config
  if (!config) {
    return `# Error: Collector configuration is missing\n# Please configure receivers, processors, and exporters`;
  }
  
  const receivers = config.receivers || [];
  const processors = config.processors || [];
  const exporters = config.exporters || [];

  const yamlConfig: EDOTConfig = {
    extensions: {},
    receivers: {},
    processors: {},
    exporters: {},
    service: {
      extensions: [],
      pipelines: {},
    },
  };

  // ============================================
  // EXTENSIONS
  // ============================================
  
  // File storage extension for persistence (prevents data loss on restart)
  yamlConfig.extensions['file_storage/filelogreceiver'] = {
    directory: '${env:STORAGE_DIR}',
    create_directory: true,
  };
  yamlConfig.service.extensions.push('file_storage/filelogreceiver');

  // Health check extension
  yamlConfig.extensions['health_check'] = {
    endpoint: '0.0.0.0:13133',
  };
  yamlConfig.service.extensions.push('health_check');

  // ============================================
  // RECEIVERS
  // ============================================
  
  for (const receiver of receivers.filter((r) => r.enabled)) {
    switch (receiver.type) {
      case 'otlp':
        // Standard OTLP receiver for SDK data
        yamlConfig.receivers['otlp'] = {
          protocols: {
            grpc: { endpoint: '0.0.0.0:4317' },
            http: { endpoint: '0.0.0.0:4318' },
          },
        };
        break;
      case 'hostmetrics':
        // Host metrics receiver for infrastructure monitoring
        yamlConfig.receivers['hostmetrics'] = {
          collection_interval: '30s',
          scrapers: {
            cpu: {},
            memory: {},
            disk: {},
            filesystem: {},
            network: {},
            process: {
              mute_process_exe_error: true,
              mute_process_io_error: true,
              mute_process_user_error: true,
            },
          },
        };
        break;
      case 'filelog':
        // Filelog receiver for log collection with persistence
        yamlConfig.receivers['filelog/platformlogs'] = {
          include: ['/var/log/*.log'],
          start_at: 'beginning',
          storage: 'file_storage/filelogreceiver',
        };
        break;
      case 'prometheus':
        // Prometheus receiver for metrics scraping
        yamlConfig.receivers['prometheus'] = {
          config: {
            scrape_configs: [
              {
                job_name: 'otel-collector',
                scrape_interval: '30s',
                static_configs: [{ targets: ['localhost:8888'] }],
              },
            ],
          },
        };
        break;
      case 'k8s_cluster':
        // Kubernetes cluster metrics receiver
        yamlConfig.receivers['k8s_cluster'] = {
          auth_type: 'serviceAccount',
          collection_interval: '30s',
          node_conditions_to_report: ['Ready', 'MemoryPressure', 'DiskPressure', 'NetworkUnavailable'],
          allocatable_types_to_report: ['cpu', 'memory', 'storage'],
        };
        break;
      case 'kubeletstats':
        // Kubelet stats receiver for pod/container metrics
        yamlConfig.receivers['kubeletstats'] = {
          auth_type: 'serviceAccount',
          collection_interval: '30s',
          endpoint: 'https://${env:K8S_NODE_NAME}:10250',
          insecure_skip_verify: true,
          metric_groups: ['pod', 'container', 'node', 'volume'],
        };
        break;
      case 'jaeger':
        // Jaeger receiver for legacy compatibility
        yamlConfig.receivers['jaeger'] = {
          protocols: {
            grpc: { endpoint: '0.0.0.0:14250' },
            thrift_http: { endpoint: '0.0.0.0:14268' },
            thrift_compact: { endpoint: '0.0.0.0:6831' },
          },
        };
        break;
      case 'zipkin':
        // Zipkin receiver for legacy compatibility
        yamlConfig.receivers['zipkin'] = {
          endpoint: '0.0.0.0:9411',
        };
        break;
    }
  }

  // ============================================
  // PROCESSORS (order matters!)
  // ============================================
  
  const processorOrder: string[] = [];

  // memory_limiter MUST be first to prevent OOM
  if (processors.some((p) => p.type === 'memory_limiter' && p.enabled)) {
    yamlConfig.processors['memory_limiter'] = {
      check_interval: '1s',
      limit_mib: 512,
      spike_limit_mib: 128,
    };
    processorOrder.push('memory_limiter');
  }

  // Resource detection processor
  yamlConfig.processors['resourcedetection'] = {
    detectors: ['env', 'system'],
    system: {
      hostname_sources: ['os'],
      resource_attributes: {
        'host.id': { enabled: true },
        'host.name': { enabled: true },
        'os.type': { enabled: true },
      },
    },
  };
  processorOrder.push('resourcedetection');

  // Resource processor for adding attributes
  yamlConfig.processors['resource'] = {
    attributes: [
      {
        key: 'deployment.environment',
        value: '${env:DEPLOYMENT_ENVIRONMENT}',
        action: 'upsert',
      },
    ],
  };
  processorOrder.push('resource');

  // elasticapm processor for Gateway mode (EDOT 9.2.0+)
  // Enriches trace data with additional attributes for Elastic APM UIs
  if (isGateway) {
    yamlConfig.processors['elasticapm'] = {};
    // Note: elasticapm processor goes in traces pipeline only
  }

  // Other processors from config
  for (const processor of processors.filter((p) => p.enabled && !['memory_limiter', 'batch'].includes(p.type))) {
    switch (processor.type) {
      case 'tail_sampling':
        // Tail-based sampling (Gateway mode recommended)
        yamlConfig.processors['tail_sampling'] = {
          decision_wait: '10s',
          num_traces: 100,
          expected_new_traces_per_sec: 10,
          policies: [
            {
              name: 'errors-policy',
              type: 'status_code',
              status_code: { status_codes: ['ERROR'] },
            },
            {
              name: 'latency-policy',
              type: 'latency',
              latency: { threshold_ms: 5000 },
            },
            {
              name: 'probabilistic-policy',
              type: 'probabilistic',
              probabilistic: { sampling_percentage: 10 },
            },
          ],
        };
        processorOrder.push('tail_sampling');
        break;
      case 'transform':
        yamlConfig.processors['transform'] = {
          trace_statements: [
            {
              context: 'span',
              statements: [
                'set(attributes["processed_by"], "edot-collector")',
              ],
            },
          ],
        };
        processorOrder.push('transform');
        break;
      case 'filter':
        yamlConfig.processors['filter'] = {
          traces: {
            span: ['attributes["http.route"] == "/health"', 'attributes["http.route"] == "/ready"'],
          },
        };
        processorOrder.push('filter');
        break;
      case 'attributes':
        yamlConfig.processors['attributes'] = {
          actions: [
            { key: 'environment', value: 'production', action: 'upsert' },
          ],
        };
        processorOrder.push('attributes');
        break;
      case 'k8sattributes':
        // Kubernetes attributes processor - enriches telemetry with K8s metadata
        yamlConfig.processors['k8sattributes'] = {
          auth_type: 'serviceAccount',
          passthrough: false,
          extract: {
            metadata: [
              'k8s.namespace.name',
              'k8s.deployment.name',
              'k8s.statefulset.name',
              'k8s.daemonset.name',
              'k8s.cronjob.name',
              'k8s.job.name',
              'k8s.pod.name',
              'k8s.pod.uid',
              'k8s.node.name',
            ],
            labels: [
              { tag_name: 'app', key: 'app', from: 'pod' },
              { tag_name: 'version', key: 'version', from: 'pod' },
            ],
          },
          pod_association: [
            { sources: [{ from: 'resource_attribute', name: 'k8s.pod.ip' }] },
            { sources: [{ from: 'resource_attribute', name: 'k8s.pod.uid' }] },
            { sources: [{ from: 'connection' }] },
          ],
        };
        processorOrder.push('k8sattributes');
        break;
    }
  }

  // batch processor should be last (for efficiency before export)
  if (processors.some((p) => p.type === 'batch' && p.enabled)) {
    yamlConfig.processors['batch'] = {
      timeout: '1s',
      send_batch_size: 1024,
    };
    processorOrder.push('batch');
  }

  // ============================================
  // CONNECTORS (EDOT 9.2.0+)
  // ============================================
  
  // elasticapm connector for Gateway mode
  // Generates pre-aggregated APM metrics from trace data
  if (isGateway) {
    yamlConfig.connectors = {
      elasticapm: {},
    };
  }

  // ============================================
  // EXPORTERS
  // ============================================
  
  const exporterNames: string[] = [];
  let hasElasticsearchExporter = false;

  for (const exporter of exporters.filter((e) => e.enabled)) {
    switch (exporter.type) {
      case 'otlp':
        // OTLP exporter for forwarding to Gateway or managed endpoint
        yamlConfig.exporters['otlp/gateway'] = {
          endpoint: exporter.endpoint || '${env:GATEWAY_ENDPOINT}',
          tls: { insecure: true },
        };
        exporterNames.push('otlp/gateway');
        break;
      case 'elasticsearch':
        // Elasticsearch exporter for direct ingestion (self-managed)
        // Using OTel-native mode (recommended for EDOT)
        yamlConfig.exporters['elasticsearch/otel'] = {
          endpoints: ['${env:ELASTICSEARCH_ENDPOINT}'],
          api_key: '${env:ELASTICSEARCH_API_KEY}',
          mapping: {
            mode: 'otel', // OTel-native format preserves attribute names/semantics
          },
          logs_dynamic_index: { enabled: true },
          traces_dynamic_index: { enabled: true },
        };
        exporterNames.push('elasticsearch/otel');
        hasElasticsearchExporter = true;
        break;
      case 'logging':
        yamlConfig.exporters['logging'] = {
          verbosity: 'detailed',
          sampling_initial: 5,
          sampling_thereafter: 200,
        };
        exporterNames.push('logging');
        break;
      case 'debug':
        yamlConfig.exporters['debug'] = {
          verbosity: 'basic',
        };
        exporterNames.push('debug');
        break;
      case 'file':
        yamlConfig.exporters['file'] = {
          path: '/var/log/otel/telemetry.json',
          rotation: {
            max_megabytes: 100,
            max_days: 7,
          },
        };
        exporterNames.push('file');
        break;
    }
  }

  // ============================================
  // SERVICE PIPELINES
  // ============================================
  
  const receiverNames = Object.keys(yamlConfig.receivers);

  if (isGateway && hasElasticsearchExporter) {
    // Gateway mode with Elasticsearch: Use elasticapm processor and connector
    // This is required for Elastic APM UIs to work properly
    
    // Traces pipeline with elasticapm enrichment
    yamlConfig.service.pipelines['traces/application'] = {
      receivers: receiverNames.filter((r) => r === 'otlp'),
      processors: ['elasticapm', ...processorOrder.filter(p => p !== 'tail_sampling')],
      exporters: ['elasticapm', ...exporterNames.filter(e => e === 'elasticsearch/otel')],
    };

    // APM metrics pipeline (receives from elasticapm connector)
    yamlConfig.service.pipelines['metrics/apm'] = {
      receivers: ['elasticapm'],
      processors: processorOrder.filter((p) => !['tail_sampling', 'elasticapm'].includes(p)),
      exporters: exporterNames.filter(e => e === 'elasticsearch/otel'),
    };

    // Standard metrics pipeline
    yamlConfig.service.pipelines['metrics'] = {
      receivers: receiverNames.filter((r) => r !== 'filelog/platformlogs'),
      processors: processorOrder.filter((p) => p !== 'tail_sampling'),
      exporters: exporterNames,
    };

    // Logs pipeline
    yamlConfig.service.pipelines['logs'] = {
      receivers: receiverNames.filter((r) => !['hostmetrics', 'prometheus'].includes(r)),
      processors: processorOrder.filter((p) => p !== 'tail_sampling'),
      exporters: exporterNames,
    };
  } else {
    // Agent mode or managed OTLP endpoint: simpler pipelines
    
    // Traces pipeline
    yamlConfig.service.pipelines['traces'] = {
      receivers: receiverNames.filter((r) => r === 'otlp'),
      processors: processorOrder,
      exporters: exporterNames,
    };

    // Metrics pipeline (no tail_sampling)
    yamlConfig.service.pipelines['metrics'] = {
      receivers: receiverNames.filter((r) => !['filelog/platformlogs'].includes(r)),
      processors: processorOrder.filter((p) => p !== 'tail_sampling'),
      exporters: exporterNames,
    };

    // Logs pipeline (no tail_sampling)
    yamlConfig.service.pipelines['logs'] = {
      receivers: receiverNames.filter((r) => !['hostmetrics', 'prometheus'].includes(r)),
      processors: processorOrder.filter((p) => p !== 'tail_sampling'),
      exporters: exporterNames,
    };
  }

  // Telemetry for the collector itself
  yamlConfig.service.telemetry = {
    logs: {
      level: 'info',
    },
    metrics: {
      address: '0.0.0.0:8888',
    },
  };

  // ============================================
  // GENERATE YAML OUTPUT
  // ============================================
  
  // Remove connectors if empty
  if (!yamlConfig.connectors || Object.keys(yamlConfig.connectors).length === 0) {
    delete yamlConfig.connectors;
  }

  const header = `# EDOT Collector Configuration
# Mode: ${isGateway ? 'Gateway (centralized processing)' : 'Agent (per-host collection)'}
# Generated by EDOT Flow Visualizer
#
# Documentation: https://www.elastic.co/docs/reference/edot-collector
#
# Required environment variables:
#   ELASTICSEARCH_ENDPOINT  - Your Elasticsearch endpoint (e.g., https://your-cluster.es.cloud:443)
#   ELASTICSEARCH_API_KEY   - API key for authentication
#   STORAGE_DIR             - Directory for persistent storage (e.g., /var/lib/otelcol)
#   DEPLOYMENT_ENVIRONMENT  - Environment name (e.g., production, staging)
${!isGateway ? '#   GATEWAY_ENDPOINT       - Gateway collector endpoint (e.g., gateway:4317)\n' : ''}#
# Run with: ./elastic-agent otel --config otel.yml
#
# Key EDOT components used:
${isGateway ? `#   - elasticapm processor: Enriches traces for Elastic APM UIs
#   - elasticapm connector: Generates pre-aggregated APM metrics
` : ''}#   - elasticsearch exporter: Direct ingestion with OTel-native format
#   - file_storage extension: Persistence for log checkpoints
#

`;

  return header + YAML.stringify(yamlConfig, { indent: 2, lineWidth: 100 });
}
