import YAML from 'yaml';
import type { CollectorNodeData, DeploymentModel } from '../types';

/**
 * EDOT Collector YAML Generator
 * 
 * Based on official Elastic documentation (EDOT Collector 9.2.0+):
 * - https://www.elastic.co/docs/reference/edot-collector/config/default-config-standalone
 * - https://www.elastic.co/docs/reference/edot-collector/components/elasticapmprocessor
 * - https://www.elastic.co/docs/reference/edot-collector/components/elasticapmconnector
 * - https://www.elastic.co/docs/reference/edot-collector/config/tail-based-sampling
 * 
 * Key EDOT-specific components:
 * - elasticapm processor: Enriches trace data for Elastic APM UIs
 * - elasticapm connector: Generates pre-aggregated APM metrics from traces
 * - elasticsearch exporter: Direct ingestion with mapping.mode: otel
 * - elasticinframetrics processor: ECS compatibility for host metrics
 * 
 * Critical Best Practices (Processor Order for Gateway):
 * - memory_limiter MUST be FIRST processor (prevents OOM)
 * - elasticapm processor MUST be LAST processor (enriches traces for APM UIs)
 * - Recommended order: memory_limiter → resourcedetection → resource → batch → elasticapm
 * - elasticapm processor + connector are REQUIRED for Elastic APM UIs
 * - Forward connector needed when combining tail_sampling with elasticapm
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

export interface GeneratorOptions {
  /** Deployment model affects exporter configuration */
  deploymentModel?: DeploymentModel;
  /** Include comments in output */
  includeComments?: boolean;
}

/**
 * Generates an EDOT Collector YAML configuration based on node data.
 * Follows official Elastic EDOT best practices and documentation.
 */
export function generateCollectorYAML(
  nodeData: CollectorNodeData,
  options: GeneratorOptions = {}
): string {
  const config = nodeData.config;
  const isGateway = nodeData.componentType === 'collector-gateway';
  const deploymentModel = options.deploymentModel || 'self-managed';

  // Defensive checks for missing config
  if (!config) {
    return `# Error: Collector configuration is missing\n# Please configure receivers, processors, and exporters`;
  }

  const receivers = config.receivers || [];
  const processors = config.processors || [];
  const exporters = config.exporters || [];

  // Determine what exporters are enabled
  const hasElasticsearchExporter = exporters.some(
    (e) => e.type === 'elasticsearch' && e.enabled
  );
  const hasOtlpExporter = exporters.some((e) => e.type === 'otlp' && e.enabled);
  const hasKafkaExporter = exporters.some((e) => e.type === 'kafka' && e.enabled);
  const hasKafkaReceiver = receivers.some((r) => r.type === 'kafka' && r.enabled);
  const hasTailSampling = processors.some(
    (p) => p.type === 'tail_sampling' && p.enabled
  );
  const hasHostMetrics = receivers.some(
    (r) => r.type === 'hostmetrics' && r.enabled
  );
  const hasK8sReceivers = receivers.some(
    (r) => (r.type === 'k8s_cluster' || r.type === 'kubeletstats') && r.enabled
  );

  // For managed OTLP endpoints (Serverless/ECH), use OTLP exporter
  const useManagedOtlpEndpoint =
    deploymentModel === 'serverless' || deploymentModel === 'ech';

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
        // Process metrics are off by default to avoid high cardinality
        yamlConfig.receivers['hostmetrics'] = {
          collection_interval: '30s',
          scrapers: {
            cpu: {},
            memory: {},
            disk: {},
            filesystem: {},
            network: {},
            // Uncomment to enable process metrics (high cardinality warning)
            // process: {
            //   mute_process_exe_error: true,
            //   mute_process_io_error: true,
            //   mute_process_user_error: true,
            // },
          },
        };
        break;

      case 'filelog':
        // Filelog receiver for log collection with persistence
        yamlConfig.receivers['filelog/platformlogs'] = {
          include: ['/var/log/*.log', '/var/log/**/*.log'],
          exclude: ['/var/log/pods/**'],
          start_at: 'beginning',
          storage: 'file_storage/filelogreceiver',
          operators: [
            {
              type: 'regex_parser',
              if: 'body matches "^(?P<time>[^ ]+) (?P<stream>stdout|stderr) (?P<flags>[^ ]*) (?P<content>.*)$"',
              regex: '^(?P<time>[^ ]+) (?P<stream>stdout|stderr) (?P<flags>[^ ]*) (?P<content>.*)$',
              timestamp: {
                parse_from: 'attributes.time',
                layout: '%Y-%m-%dT%H:%M:%S.%LZ',
              },
            },
          ],
        };
        break;

      case 'prometheus':
        // Prometheus receiver for self-monitoring
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
        // Kubernetes cluster receiver for cluster-level metrics
        yamlConfig.receivers['k8s_cluster'] = {
          auth_type: 'serviceAccount',
          collection_interval: '30s',
          node_conditions_to_report: [
            'Ready',
            'MemoryPressure',
            'DiskPressure',
            'NetworkUnavailable',
          ],
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

      case 'kafka':
        // Kafka receiver for consuming telemetry from Kafka topics
        // Uses franz-go client (default in EDOT Collector)
        // Only otlp_proto and otlp_json encodings are officially supported
        yamlConfig.receivers['kafka'] = {
          brokers: ['${env:KAFKA_BROKERS}'],
          protocol_version: '3.2.0',
          traces: {
            topics: ['otlp_spans'],
            encoding: 'otlp_proto',
          },
          metrics: {
            topics: ['otlp_metrics'],
            encoding: 'otlp_proto',
          },
          logs: {
            topics: ['otlp_logs'],
            encoding: 'otlp_proto',
          },
          group_id: 'otel-collector',
          initial_offset: 'latest',
          autocommit: {
            enable: true,
            interval: '1s',
          },
        };
        break;
    }
  }

  // ============================================
  // PROCESSORS
  // ============================================

  // Build processor configuration following EDOT best practices

  // memory_limiter MUST be first to prevent OOM
  if (processors.some((p) => p.type === 'memory_limiter' && p.enabled)) {
    yamlConfig.processors['memory_limiter'] = {
      check_interval: '1s',
      limit_mib: 512,
      spike_limit_mib: 128,
    };
  }

  // Resource detection processor - enriches with host/cloud metadata
  yamlConfig.processors['resourcedetection'] = {
    detectors: hasK8sReceivers
      ? ['env', 'system', 'gcp', 'ecs', 'eks', 'azure', 'aks']
      : ['env', 'system'],
    system: {
      hostname_sources: ['os'],
      resource_attributes: {
        'host.id': { enabled: true },
        'host.name': { enabled: true },
        'os.type': { enabled: true },
      },
    },
    timeout: '5s',
    override: false,
  };

  // Resource processor for deployment environment
  yamlConfig.processors['resource'] = {
    attributes: [
      {
        key: 'deployment.environment',
        value: '${env:DEPLOYMENT_ENVIRONMENT}',
        action: 'upsert',
      },
    ],
  };

  // K8s attributes processor for enriching telemetry with K8s metadata
  if (
    processors.some((p) => p.type === 'k8sattributes' && p.enabled) ||
    hasK8sReceivers
  ) {
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
          'k8s.container.name',
        ],
        labels: [
          { tag_name: 'app.kubernetes.io/name', key: 'app.kubernetes.io/name', from: 'pod' },
          { tag_name: 'app.kubernetes.io/version', key: 'app.kubernetes.io/version', from: 'pod' },
        ],
      },
      pod_association: [
        { sources: [{ from: 'resource_attribute', name: 'k8s.pod.ip' }] },
        { sources: [{ from: 'resource_attribute', name: 'k8s.pod.uid' }] },
        { sources: [{ from: 'connection' }] },
      ],
    };
  }

  // Attributes processor for dataset routing (Gateway mode)
  if (isGateway && hasElasticsearchExporter) {
    yamlConfig.processors['attributes/dataset'] = {
      actions: [
        {
          key: 'event.dataset',
          from_attribute: 'data_stream.dataset',
          action: 'upsert',
        },
      ],
    };
  }

  // Transform processor (optional)
  if (processors.some((p) => p.type === 'transform' && p.enabled)) {
    yamlConfig.processors['transform'] = {
      error_mode: 'ignore',
      trace_statements: [
        {
          context: 'span',
          statements: [
            'set(attributes["processed_by"], "edot-collector")',
          ],
        },
      ],
    };
  }

  // Filter processor (optional)
  if (processors.some((p) => p.type === 'filter' && p.enabled)) {
    yamlConfig.processors['filter'] = {
      error_mode: 'ignore',
      traces: {
        span: [
          'attributes["http.route"] == "/health"',
          'attributes["http.route"] == "/ready"',
          'attributes["http.route"] == "/healthz"',
        ],
      },
    };
  }

  // Batch processor - CRITICAL: must come BEFORE elasticapm for traces
  if (processors.some((p) => p.type === 'batch' && p.enabled)) {
    yamlConfig.processors['batch'] = {
      send_batch_size: 1000,
      timeout: '1s',
      send_batch_max_size: 1500,
    };

    // Separate batch for metrics (prevents request splitting)
    yamlConfig.processors['batch/metrics'] = {
      send_batch_max_size: 0, // Prevents splitting metrics requests
      timeout: '1s',
    };
  }

  // Resource processor for process cleanup (Gateway mode)
  if (isGateway) {
    yamlConfig.processors['resource/process'] = {
      attributes: [
        { key: 'process.executable.name', action: 'delete' },
        { key: 'process.executable.path', action: 'delete' },
      ],
    };
  }

  // elasticapm processor - REQUIRED for Elastic APM UIs
  // Per docs: "Place after batching in the pipeline"
  if (
    isGateway &&
    hasElasticsearchExporter &&
    processors.some((p) => p.type === 'elasticapm' && p.enabled)
  ) {
    yamlConfig.processors['elasticapm'] = {};
  }

  // elasticinframetrics processor for host metrics ECS compatibility
  // Deprecated but retained for backwards compatibility with Elastic Stack 8.x
  if (hasHostMetrics && hasElasticsearchExporter) {
    yamlConfig.processors['elasticinframetrics'] = {};
  }

  // ============================================
  // CONNECTORS
  // ============================================

  if (isGateway && hasElasticsearchExporter) {
    yamlConfig.connectors = {};

    // elasticapm connector - generates pre-aggregated APM metrics from traces
    // Acts as exporter in traces pipeline and receiver in metrics pipeline
    if (processors.some((p) => p.type === 'elasticapm' && p.enabled)) {
      yamlConfig.connectors['elasticapm'] = {};
    }

    // Forward connector - needed for tail-based sampling with elasticapm
    // Splits traces pipeline: process first, then sample
    if (hasTailSampling) {
      yamlConfig.connectors['forward'] = {};

      // Tail sampling processor configuration
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
            name: 'latency-5000ms-10000ms',
            type: 'latency',
            latency: { threshold_ms: 5000, upper_threshold_ms: 10000 },
          },
          {
            name: 'probabilistic-policy',
            type: 'probabilistic',
            probabilistic: { sampling_percentage: 10 },
          },
        ],
      };
    }

    // Routing connector for separating infrastructure metrics from OTel metrics
    if (hasHostMetrics) {
      yamlConfig.connectors['routing'] = {
        default_pipelines: ['metrics/otel'],
        error_mode: 'ignore',
        table: [
          {
            context: 'metric',
            condition: 'resource.attributes["data_stream.dataset"] != nil',
            pipelines: ['metrics/ecs'],
          },
        ],
      };
    }
  }

  // ============================================
  // EXPORTERS
  // ============================================

  for (const exporter of exporters.filter((e) => e.enabled)) {
    switch (exporter.type) {
      case 'otlp':
        if (useManagedOtlpEndpoint) {
          // Managed OTLP endpoint (Serverless/ECH) - recommended batch settings
          yamlConfig.exporters['otlp/elastic'] = {
            endpoint: '${env:ELASTIC_OTLP_ENDPOINT}',
            headers: {
              Authorization: 'ApiKey ${env:ELASTIC_API_KEY}',
            },
            sending_queue: {
              enabled: true,
              sizer: 'bytes',
              queue_size: 50000000, // 50MB uncompressed
              block_on_overflow: true,
            },
            batch: {
              flush_timeout: '1s',
              min_size: 1000000, // 1MB uncompressed
              max_size: 4000000, // 4MB uncompressed
            },
          };
        } else {
          // Agent mode: forward to Gateway
          yamlConfig.exporters['otlp/gateway'] = {
            endpoint: exporter.endpoint || '${env:OTLP_EXPORTER_ENDPOINT}',
            tls: {
              insecure: '${env:OTLP_EXPORTER_INSECURE:-true}',
            },
          };
        }
        break;

      case 'elasticsearch':
        // Elasticsearch exporter for direct ingestion (self-managed or ECH)
        // OTel-native mode preserves attribute names and semantics
        yamlConfig.exporters['elasticsearch/otel'] = {
          endpoints: ['${env:ELASTICSEARCH_ENDPOINT}'],
          api_key: '${env:ELASTICSEARCH_API_KEY}',
          mapping: {
            mode: 'otel',
          },
          logs_dynamic_index: { enabled: true },
          traces_dynamic_index: { enabled: true },
        };

        // ECS-compatible exporter for host metrics (backwards compatibility)
        if (hasHostMetrics) {
          yamlConfig.exporters['elasticsearch/ecs'] = {
            endpoints: ['${env:ELASTICSEARCH_ENDPOINT}'],
            api_key: '${env:ELASTICSEARCH_API_KEY}',
            mapping: {
              mode: 'ecs',
            },
          };
        }
        break;

      case 'debug':
        yamlConfig.exporters['debug'] = {
          verbosity: 'basic',
        };
        break;

      case 'logging':
        yamlConfig.exporters['logging'] = {
          verbosity: 'detailed',
          sampling_initial: 5,
          sampling_thereafter: 200,
        };
        break;

      case 'file':
        yamlConfig.exporters['file'] = {
          path: '/var/log/otel/telemetry.json',
          rotation: {
            max_megabytes: 100,
            max_days: 7,
          },
        };
        break;

      case 'kafka':
        // Kafka exporter for producing telemetry to Kafka topics
        // Uses synchronous producer - pair with batch processor for throughput
        // Only otlp_proto and otlp_json encodings are officially supported in EDOT
        yamlConfig.exporters['kafka'] = {
          brokers: ['${env:KAFKA_BROKERS}'],
          protocol_version: '3.2.0',
          traces: {
            topic: 'otlp_spans',
            encoding: 'otlp_proto',
          },
          metrics: {
            topic: 'otlp_metrics',
            encoding: 'otlp_proto',
          },
          logs: {
            topic: 'otlp_logs',
            encoding: 'otlp_proto',
          },
          producer: {
            compression: 'snappy',
            flush_max_messages: 10000,
          },
          retry_on_failure: {
            enabled: true,
            initial_interval: '5s',
            max_interval: '30s',
            max_elapsed_time: '300s',
          },
        };
        break;
    }
  }

  // ============================================
  // SERVICE PIPELINES
  // ============================================

  const receiverNames = Object.keys(yamlConfig.receivers);
  const hasOtlpReceiver = receiverNames.includes('otlp');

  if (isGateway && hasElasticsearchExporter) {
    // Gateway mode with Elasticsearch: Full EDOT pipeline architecture
    buildGatewayPipelines(yamlConfig, {
      hasTailSampling,
      hasHostMetrics,
      hasElasticApm: processors.some((p) => p.type === 'elasticapm' && p.enabled),
      hasK8sReceivers,
      receiverNames,
    });
  } else if (useManagedOtlpEndpoint && hasOtlpExporter) {
    // Managed OTLP Endpoint (Serverless/ECH): Simplified pipeline
    // No Elastic-specific enrichment needed - happens at endpoint
    buildManagedOtlpPipelines(yamlConfig, {
      hasHostMetrics,
      hasK8sReceivers,
      receiverNames,
    });
  } else {
    // Agent mode: Forward to Gateway or external OTLP endpoint
    buildAgentPipelines(yamlConfig, {
      hasHostMetrics,
      hasK8sReceivers,
      receiverNames,
      exporterTarget: hasOtlpExporter ? 'otlp/gateway' : 'elasticsearch/otel',
    });
  }

  // ============================================
  // COLLECTOR SELF-TELEMETRY
  // ============================================
  // Configure the collector to export its own logs and metrics to Elastic
  // This enables monitoring of the collector itself in Kibana Observability UI
  
  buildSelfTelemetryConfig(yamlConfig, nodeData, {
    isGateway,
    useManagedOtlpEndpoint,
    hasElasticsearchExporter,
    hasOtlpExporter,
  });

  // ============================================
  // GENERATE YAML OUTPUT
  // ============================================

  // Remove empty connectors
  if (!yamlConfig.connectors || Object.keys(yamlConfig.connectors).length === 0) {
    delete yamlConfig.connectors;
  }

  const header = generateHeader(nodeData, options, {
    hasElasticsearchExporter,
    hasOtlpExporter,
    hasKafkaExporter,
    hasKafkaReceiver,
    useManagedOtlpEndpoint,
    hasTailSampling,
    hasHostMetrics,
  });

  return header + YAML.stringify(yamlConfig, { indent: 2, lineWidth: 100 });
}

/**
 * Build pipelines for Gateway mode with direct Elasticsearch ingestion.
 * Follows official EDOT Gateway configuration.
 */
function buildGatewayPipelines(
  config: EDOTConfig,
  options: {
    hasTailSampling: boolean;
    hasHostMetrics: boolean;
    hasElasticApm: boolean;
    hasK8sReceivers: boolean;
    receiverNames: string[];
  }
): void {
  const {
    hasTailSampling,
    hasHostMetrics,
    hasElasticApm,
    hasK8sReceivers,
    receiverNames,
  } = options;

  const hasOtlpReceiver = receiverNames.includes('otlp');

  // Base processor chain (order matters!)
  const baseProcessors = ['memory_limiter', 'resourcedetection', 'resource'];
  if (hasK8sReceivers) {
    baseProcessors.push('k8sattributes');
  }

  if (hasTailSampling && hasElasticApm) {
    // Two-step trace pipeline for tail-based sampling with elasticapm
    // Step 1: Process traces with elasticapm, output to connector
    config.service.pipelines['traces/1-process-elastic'] = {
      receivers: hasOtlpReceiver ? ['otlp'] : receiverNames,
      processors: [...baseProcessors, 'batch', 'elasticapm'],
      exporters: ['elasticapm', 'forward'],
    };

    // Step 2: Apply tail sampling, then export
    config.service.pipelines['traces/2-process-tbs'] = {
      receivers: ['forward'],
      processors: ['tail_sampling'],
      exporters: ['elasticsearch/otel'],
    };
  } else if (hasElasticApm) {
    // Standard traces pipeline with elasticapm
    config.service.pipelines['traces'] = {
      receivers: hasOtlpReceiver ? ['otlp'] : receiverNames,
      processors: [...baseProcessors, 'batch', 'elasticapm'],
      exporters: ['elasticapm', 'elasticsearch/otel'],
    };
  } else {
    // Fallback traces pipeline without elasticapm
    config.service.pipelines['traces'] = {
      receivers: hasOtlpReceiver ? ['otlp'] : receiverNames.filter(r => !r.includes('hostmetrics')),
      processors: [...baseProcessors, 'batch'],
      exporters: ['elasticsearch/otel'],
    };
  }

  // APM metrics pipeline (receives from elasticapm connector)
  if (hasElasticApm) {
    config.service.pipelines['metrics/apm'] = {
      receivers: ['elasticapm'],
      processors: [],
      exporters: ['elasticsearch/otel'],
    };
  }

  // Host metrics pipeline with ECS compatibility
  if (hasHostMetrics) {
    // OTel metrics to routing connector
    config.service.pipelines['metrics/otel'] = {
      receivers: receiverNames.filter((r) => r !== 'filelog/platformlogs'),
      processors: [...baseProcessors, 'attributes/dataset', 'batch/metrics'],
      exporters: ['routing'],
    };

    // ECS-formatted infrastructure metrics
    config.service.pipelines['metrics/ecs'] = {
      receivers: ['routing'],
      processors: ['elasticinframetrics'],
      exporters: ['elasticsearch/ecs'],
    };

    // Standard OTel metrics (from routing)
    config.service.pipelines['metrics/otel-out'] = {
      receivers: ['routing'],
      processors: [],
      exporters: ['elasticsearch/otel'],
    };
  } else {
    // Standard metrics pipeline without host metrics
    config.service.pipelines['metrics'] = {
      receivers: receiverNames.filter(
        (r) => !r.includes('filelog') && r !== 'otlp'
      ),
      processors: [...baseProcessors, 'batch/metrics'],
      exporters: ['elasticsearch/otel'],
    };

    // Add OTLP metrics if receiver exists
    if (hasOtlpReceiver) {
      config.service.pipelines['metrics/application'] = {
        receivers: ['otlp'],
        processors: [...baseProcessors, 'batch/metrics'],
        exporters: ['elasticsearch/otel'],
      };
    }
  }

  // Logs pipeline
  const logReceivers = receiverNames.filter(
    (r) => r.includes('filelog') || r === 'otlp'
  );
  if (logReceivers.length > 0) {
    config.service.pipelines['logs'] = {
      receivers: logReceivers,
      processors: [...baseProcessors, 'batch'],
      exporters: ['elasticsearch/otel'],
    };
  }
}

/**
 * Build pipelines for Managed OTLP Endpoint (Serverless/ECH).
 * No Elastic-specific enrichment needed - happens at endpoint.
 */
function buildManagedOtlpPipelines(
  config: EDOTConfig,
  options: {
    hasHostMetrics: boolean;
    hasK8sReceivers: boolean;
    receiverNames: string[];
  }
): void {
  const { hasHostMetrics, hasK8sReceivers, receiverNames } = options;

  const baseProcessors = ['memory_limiter', 'resourcedetection', 'resource'];
  if (hasK8sReceivers) {
    baseProcessors.push('k8sattributes');
  }
  baseProcessors.push('batch');

  const hasOtlpReceiver = receiverNames.includes('otlp');

  // Traces pipeline - simple passthrough
  if (hasOtlpReceiver) {
    config.service.pipelines['traces'] = {
      receivers: ['otlp'],
      processors: baseProcessors,
      exporters: ['otlp/elastic'],
    };
  }

  // Metrics pipeline
  const metricsReceivers = receiverNames.filter(
    (r) => !r.includes('filelog')
  );
  if (metricsReceivers.length > 0) {
    config.service.pipelines['metrics'] = {
      receivers: metricsReceivers,
      processors: baseProcessors,
      exporters: ['otlp/elastic'],
    };
  }

  // Logs pipeline
  const logReceivers = receiverNames.filter(
    (r) => r.includes('filelog') || r === 'otlp'
  );
  if (logReceivers.length > 0) {
    config.service.pipelines['logs'] = {
      receivers: logReceivers,
      processors: baseProcessors,
      exporters: ['otlp/elastic'],
    };
  }
}

/**
 * Build pipelines for Agent mode (forwards to Gateway or external endpoint).
 */
function buildAgentPipelines(
  config: EDOTConfig,
  options: {
    hasHostMetrics: boolean;
    hasK8sReceivers: boolean;
    receiverNames: string[];
    exporterTarget: string;
  }
): void {
  const { hasHostMetrics, hasK8sReceivers, receiverNames, exporterTarget } = options;

  const baseProcessors = ['memory_limiter', 'resourcedetection', 'resource'];
  if (hasK8sReceivers) {
    baseProcessors.push('k8sattributes');
  }
  baseProcessors.push('batch');

  const hasOtlpReceiver = receiverNames.includes('otlp');

  // Traces pipeline
  if (hasOtlpReceiver) {
    config.service.pipelines['traces'] = {
      receivers: ['otlp'],
      processors: baseProcessors,
      exporters: [exporterTarget],
    };
  }

  // Metrics pipeline
  const metricsReceivers = receiverNames.filter(
    (r) => !r.includes('filelog')
  );
  if (metricsReceivers.length > 0) {
    config.service.pipelines['metrics'] = {
      receivers: metricsReceivers,
      processors: baseProcessors,
      exporters: [exporterTarget],
    };
  }

  // Logs pipeline
  const logReceivers = receiverNames.filter(
    (r) => r.includes('filelog') || r === 'otlp'
  );
  if (logReceivers.length > 0) {
    config.service.pipelines['logs'] = {
      receivers: logReceivers,
      processors: baseProcessors,
      exporters: [exporterTarget],
    };
  }
}

/**
 * Build self-telemetry configuration for the collector.
 * Configures the collector to export its own logs and metrics to Elastic.
 * 
 * This enables:
 * - Collector logs visible in Kibana Discover (logs-otel.collector-*)
 * - Collector metrics visible in Kibana Metrics Explorer
 * - Collector health monitoring in Observability UI
 * 
 * Architecture:
 * - Logs: Written to file, collected via filelog receiver, exported to Elastic
 * - Metrics: Exposed on :8888, scraped via prometheus receiver, exported to Elastic
 * - This approach avoids self-referential OTLP loops and is reliable across versions
 * 
 * References:
 * - https://opentelemetry.io/docs/collector/configuration/#telemetry
 * - https://www.elastic.co/docs/reference/edot-collector/config
 */
function buildSelfTelemetryConfig(
  config: EDOTConfig,
  nodeData: CollectorNodeData,
  options: {
    isGateway: boolean;
    useManagedOtlpEndpoint: boolean;
    hasElasticsearchExporter: boolean;
    hasOtlpExporter: boolean;
  }
): void {
  const { isGateway, useManagedOtlpEndpoint, hasElasticsearchExporter, hasOtlpExporter } = options;
  
  // Determine collector service name based on mode
  const collectorServiceName = isGateway ? 'edot-collector-gateway' : 'edot-collector-agent';
  
  // Determine the target exporter for self-telemetry
  let selfTelemetryExporter: string;
  if (useManagedOtlpEndpoint && hasOtlpExporter) {
    selfTelemetryExporter = 'otlp/elastic';
  } else if (hasElasticsearchExporter) {
    selfTelemetryExporter = 'elasticsearch/otel';
  } else if (hasOtlpExporter) {
    selfTelemetryExporter = 'otlp/gateway';
  } else {
    selfTelemetryExporter = 'debug';
  }
  
  // ============================================
  // ADD SELF-TELEMETRY RECEIVERS
  // ============================================
  
  // Filelog receiver for collector's own logs
  // Collector logs are written to a file and collected by this receiver
  config.receivers['filelog/collector-logs'] = {
    include: ['${env:COLLECTOR_LOG_PATH:-/var/log/edot-collector/collector.log}'],
    start_at: 'end',
    include_file_path: true,
    include_file_name: true,
    operators: [
      {
        type: 'json_parser',
        timestamp: {
          parse_from: 'attributes.ts',
          layout: '%Y-%m-%dT%H:%M:%S.%fZ',
        },
      },
      // Add resource attributes for identification
      {
        type: 'add',
        field: 'resource.service.name',
        value: collectorServiceName,
      },
      {
        type: 'add',
        field: 'resource.service.namespace',
        value: 'edot-infrastructure',
      },
      {
        type: 'add',
        field: 'resource.telemetry.sdk.name',
        value: 'edot-collector',
      },
      // Map log level to severity
      {
        type: 'severity_parser',
        parse_from: 'attributes.level',
        mapping: {
          debug: 'debug',
          info: 'info',
          warn: 'warn',
          error: 'error',
          fatal: 'fatal',
        },
      },
    ],
  };
  
  // Prometheus receiver for collector's own metrics
  // Scrapes the collector's internal metrics endpoint
  config.receivers['prometheus/collector-metrics'] = {
    config: {
      scrape_configs: [
        {
          job_name: 'edot-collector-self',
          scrape_interval: '30s',
          static_configs: [
            {
              targets: ['localhost:8888'],
              labels: {
                'service.name': collectorServiceName,
                'service.namespace': 'edot-infrastructure',
              },
            },
          ],
          // Add metric relabeling to add resource attributes
          metric_relabel_configs: [
            {
              source_labels: ['__name__'],
              regex: 'otelcol_(.*)',
              target_label: 'collector_component',
              replacement: '$1',
            },
          ],
        },
      ],
    },
  };
  
  // ============================================
  // ADD SELF-TELEMETRY PROCESSOR
  // ============================================
  
  // Resource processor to add collector identification attributes
  config.processors['resource/collector-telemetry'] = {
    attributes: [
      {
        key: 'service.name',
        value: collectorServiceName,
        action: 'upsert',
      },
      {
        key: 'service.version',
        value: '${env:COLLECTOR_VERSION:-1.0.0}',
        action: 'upsert',
      },
      {
        key: 'service.namespace',
        value: 'edot-infrastructure',
        action: 'upsert',
      },
      {
        key: 'deployment.environment',
        value: '${env:DEPLOYMENT_ENVIRONMENT}',
        action: 'upsert',
      },
      {
        key: 'telemetry.sdk.name',
        value: 'edot-collector',
        action: 'upsert',
      },
      // Data stream attributes for Elastic indexing
      {
        key: 'data_stream.dataset',
        value: 'otel.collector',
        action: 'upsert',
      },
      {
        key: 'data_stream.namespace',
        value: '${env:DATA_STREAM_NAMESPACE:-default}',
        action: 'upsert',
      },
    ],
  };
  
  // ============================================
  // ADD SELF-TELEMETRY PIPELINES
  // ============================================
  
  // Pipeline for collector's own logs
  config.service.pipelines['logs/collector-self'] = {
    receivers: ['filelog/collector-logs'],
    processors: ['resource/collector-telemetry', 'batch'],
    exporters: [selfTelemetryExporter],
  };
  
  // Pipeline for collector's own metrics
  config.service.pipelines['metrics/collector-self'] = {
    receivers: ['prometheus/collector-metrics'],
    processors: ['resource/collector-telemetry', 'batch/metrics'],
    exporters: [selfTelemetryExporter],
  };
  
  // ============================================
  // CONFIGURE SERVICE TELEMETRY OUTPUT
  // ============================================
  
  // Configure the collector to output logs to a file for the filelog receiver
  // and expose metrics on the standard endpoint for prometheus scraping
  config.service.telemetry = {
    resource: {
      'service.name': collectorServiceName,
      'service.version': '${env:COLLECTOR_VERSION:-1.0.0}',
      'deployment.environment': '${env:DEPLOYMENT_ENVIRONMENT}',
    },
    logs: {
      level: 'info',
      development: false,
      encoding: 'json',
      // Output to file for collection by filelog receiver
      output_paths: [
        '${env:COLLECTOR_LOG_PATH:-/var/log/edot-collector/collector.log}',
      ],
      error_output_paths: [
        '${env:COLLECTOR_LOG_PATH:-/var/log/edot-collector/collector.log}',
      ],
      // Also output to stdout for container environments
      initial_fields: {
        'service.name': collectorServiceName,
      },
    },
    metrics: {
      level: 'detailed',
      // Expose metrics for prometheus scraping
      address: '0.0.0.0:8888',
    },
  };
}

/**
 * Generate the configuration header with documentation.
 */
function generateHeader(
  nodeData: CollectorNodeData,
  options: GeneratorOptions,
  context: {
    hasElasticsearchExporter: boolean;
    hasOtlpExporter: boolean;
    hasKafkaExporter: boolean;
    hasKafkaReceiver: boolean;
    useManagedOtlpEndpoint: boolean;
    hasTailSampling: boolean;
    hasHostMetrics: boolean;
  }
): string {
  const isGateway = nodeData.componentType === 'collector-gateway';
  const {
    hasElasticsearchExporter,
    hasOtlpExporter,
    hasKafkaExporter,
    hasKafkaReceiver,
    useManagedOtlpEndpoint,
    hasTailSampling,
    hasHostMetrics,
  } = context;

  let header = `# EDOT Collector Configuration
# Mode: ${isGateway ? 'Gateway (centralized processing)' : 'Agent (per-host collection)'}
# Generated by EDOT Flow Visualizer
#
# Documentation:
#   - Configuration: https://www.elastic.co/docs/reference/edot-collector/config
#   - elasticapm processor: https://www.elastic.co/docs/reference/edot-collector/components/elasticapmprocessor
#   - elasticapm connector: https://www.elastic.co/docs/reference/edot-collector/components/elasticapmconnector
#   - Self-telemetry: https://opentelemetry.io/docs/collector/configuration/#telemetry
#
# Run with: ./elastic-agent otel --config otel.yml
#
# ============================================
# Required Environment Variables
# ============================================
#
#   STORAGE_DIR             - Directory for persistent storage (e.g., /var/lib/otelcol)
#   DEPLOYMENT_ENVIRONMENT  - Environment name (e.g., production, staging)
#
# Collector Self-Telemetry:
#   COLLECTOR_VERSION       - Collector version for identification (default: 1.0.0)
#   COLLECTOR_LOG_PATH      - Path to collector log file (default: /var/log/edot-collector/collector.log)
#   DATA_STREAM_NAMESPACE   - Data stream namespace for Elastic (default: default)
`;

  if (useManagedOtlpEndpoint && hasOtlpExporter) {
    header += `#
# For Elastic Managed OTLP Endpoint (Serverless/ECH):
#   ELASTIC_OTLP_ENDPOINT   - Managed OTLP endpoint URL
#   ELASTIC_API_KEY         - API key for authentication (base64 encoded id:key)
`;
  }

  if (!useManagedOtlpEndpoint && hasOtlpExporter) {
    header += `#
# For OTLP exporter (Agent → Gateway):
#   OTLP_EXPORTER_ENDPOINT  - Gateway endpoint (e.g., gateway:4317)
#   OTLP_EXPORTER_INSECURE  - Set to false for TLS (default: true)
`;
  }

  if (hasElasticsearchExporter) {
    header += `#
# For Elasticsearch exporter (direct ingestion):
#   ELASTICSEARCH_ENDPOINT  - Elasticsearch endpoint (e.g., https://cluster.es.cloud:443)
#   ELASTICSEARCH_API_KEY   - API key for authentication
`;
  }

  if (hasKafkaExporter || hasKafkaReceiver) {
    header += `#
# For Kafka integration:
#   KAFKA_BROKERS           - Comma-separated broker list (e.g., broker1:9092,broker2:9092)
`;
  }

  header += `#
# ============================================
# EDOT Components Used
# ============================================
`;

  if (isGateway && hasElasticsearchExporter) {
    header += `#
#   - elasticapm processor: Enriches traces for Elastic APM UIs
#   - elasticapm connector: Generates pre-aggregated APM metrics
#   - elasticsearch exporter: Direct ingestion with OTel-native format
`;
    if (hasTailSampling) {
      header += `#   - forward connector: Enables tail-based sampling with elasticapm
#   - tail_sampling processor: Intelligent trace sampling decisions
`;
    }
    if (hasHostMetrics) {
      header += `#   - elasticinframetrics processor: ECS compatibility for host metrics
#   - routing connector: Separates infra metrics from application metrics
`;
    }
  } else if (useManagedOtlpEndpoint) {
    header += `#
#   - No Elastic-specific processors needed
#   - Enrichment happens at the Managed OTLP Endpoint
#   - Configuration is vendor-agnostic
`;
  } else {
    header += `#
#   - otlp exporter: Forward telemetry to Gateway or managed endpoint
`;
  }

  header += `#   - file_storage extension: Persistence for log checkpoints
#   - health_check extension: Health endpoint at :13133
#
# ============================================
# Collector Self-Telemetry
# ============================================
#
# This collector exports its own logs and metrics to Elastic:
#
#   Architecture:
#     - Logs: Written to file → filelog receiver → logs/collector-self pipeline → Elastic
#     - Metrics: Exposed on :8888 → prometheus receiver → metrics/collector-self pipeline → Elastic
#
#   Logs:
#     - Index pattern: logs-otel.collector-*
#     - View in: Kibana Discover, Logs Explorer
#     - Filter by: service.name = ${isGateway ? 'edot-collector-gateway' : 'edot-collector-agent'}
#     - Log path: \${COLLECTOR_LOG_PATH:-/var/log/edot-collector/collector.log}
#
#   Metrics:
#     - Index pattern: metrics-otel.collector-*
#     - View in: Kibana Metrics Explorer, Infrastructure UI
#     - Key metrics: otelcol_receiver_*, otelcol_processor_*, otelcol_exporter_*
#     - Scraped from: localhost:8888
#
#   Resource Attributes:
#     - service.name: ${isGateway ? 'edot-collector-gateway' : 'edot-collector-agent'}
#     - service.namespace: edot-infrastructure
#     - data_stream.dataset: otel.collector
#
# ============================================
# Best Practices Applied
# ============================================
#
#   ✓ memory_limiter is FIRST processor (prevents OOM)
#   ✓ batch processor optimizes throughput
#   ✓ Collector self-telemetry exported to Elastic
`;

  if (isGateway && hasElasticsearchExporter) {
    header += `#   ✓ elasticapm processor is LAST (required for Elastic APM UIs)
#   ✓ Processor order: memory_limiter → resourcedetection → batch → elasticapm
#   ✓ elasticapm connector generates APM metrics for Elastic UIs
`;
    if (hasTailSampling) {
      header += `#   ✓ forward connector splits pipeline for tail-based sampling
`;
    }
  }

  header += `#
# ============================================
# Configuration
# ============================================

`;

  return header;
}
