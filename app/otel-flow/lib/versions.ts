/** Single source of truth for EDOT/Elastic component versions */
export const EDOT_VERSIONS = {
  /** docker.elastic.co/beats/elastic-agent */
  collector: '9.0.0',
  /** docker.elastic.co/elasticsearch/elasticsearch */
  elasticsearch: '9.0.0',
  /** docker.elastic.co/kibana/kibana */
  kibana: '9.0.0',
  /** co.elastic.otel:elastic-otel-javaagent */
  javaAgent: '1.8.0',
  /** EDOT Node.js SDK package name */
  nodePackage: '@elastic/opentelemetry-node',
  /** EDOT Python SDK package name */
  pythonPackage: 'elastic-opentelemetry',
  /** EDOT .NET SDK package name */
  dotnetPackage: 'Elastic.OpenTelemetry',
} as const;

/** EDOT Collector Docker image */
export const EDOT_COLLECTOR_IMAGE = `docker.elastic.co/beats/elastic-agent:${EDOT_VERSIONS.collector}`;

/** Elasticsearch Docker image */
export const ELASTICSEARCH_IMAGE = `docker.elastic.co/elasticsearch/elasticsearch:${EDOT_VERSIONS.elasticsearch}`;

/** Kibana Docker image */
export const KIBANA_IMAGE = `docker.elastic.co/kibana/kibana:${EDOT_VERSIONS.kibana}`;

/** EDOT Java Agent Maven coordinates */
export const EDOT_JAVA_AGENT_URL = `https://repo1.maven.org/maven2/co/elastic/otel/elastic-otel-javaagent/${EDOT_VERSIONS.javaAgent}/elastic-otel-javaagent-${EDOT_VERSIONS.javaAgent}.jar`;
