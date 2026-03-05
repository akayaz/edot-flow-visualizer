import YAML from 'yaml';
import type {
  CollectorConfig,
  ReceiverConfig,
  ProcessorConfig,
  ExporterConfig,
  ReceiverType,
  ProcessorType,
  ExporterType,
} from '../types';

// ============ Result Types ============

export interface YamlParseResult {
  /** The parsed collector config, or null if parsing failed entirely */
  config: CollectorConfig | null;
  /** Errors that prevent the config from being applied */
  errors: string[];
  /** Warnings about skipped/unrecognized sections (non-blocking) */
  warnings: string[];
}

// ============ Type Mappings ============

/** Known receiver base types mapped to ReceiverType enum */
const KNOWN_RECEIVERS: Record<string, ReceiverType> = {
  otlp: 'otlp',
  hostmetrics: 'hostmetrics',
  filelog: 'filelog',
  prometheus: 'prometheus',
  jaeger: 'jaeger',
  zipkin: 'zipkin',
  k8s_cluster: 'k8s_cluster',
  kubeletstats: 'kubeletstats',
  kafka: 'kafka',
};

/** Known processor base types mapped to ProcessorType enum */
const KNOWN_PROCESSORS: Record<string, ProcessorType> = {
  batch: 'batch',
  memory_limiter: 'memory_limiter',
  tail_sampling: 'tail_sampling',
  transform: 'transform',
  filter: 'filter',
  attributes: 'attributes',
  resource: 'resource',
  resourcedetection: 'resourcedetection',
  elasticapm: 'elasticapm',
  spanmetrics: 'spanmetrics',
  k8sattributes: 'k8sattributes',
};

/** Known exporter base types mapped to ExporterType enum */
const KNOWN_EXPORTERS: Record<string, ExporterType> = {
  otlp: 'otlp',
  elasticsearch: 'elasticsearch',
  debug: 'debug',
  file: 'file',
  logging: 'logging',
  kafka: 'kafka',
};

/**
 * Auto-generated self-telemetry keys that should be skipped during reverse parsing.
 * These are re-injected by generateCollectorYAML() automatically, so including them
 * would cause duplicates after roundtrip.
 */
const SELF_TELEMETRY_RECEIVERS = new Set([
  'filelog/collector-logs',
  'prometheus/collector-metrics',
]);

const SELF_TELEMETRY_PROCESSORS = new Set([
  'resource/collector-telemetry',
]);

/**
 * Auto-generated pipeline-plumbing processors that are always added by the generator.
 * Skipping them avoids duplicates on roundtrip.
 */
const AUTO_GENERATED_PROCESSORS = new Set([
  'batch/metrics',
  'resource/process',
  'attributes/dataset',
  'elasticinframetrics',
]);

// ============ Helpers ============

/**
 * Extract the base type from a qualified YAML key.
 * e.g. "elasticsearch/otel" → "elasticsearch", "otlp" → "otlp"
 */
function extractBaseType(name: string): string {
  const slashIndex = name.indexOf('/');
  return slashIndex > 0 ? name.substring(0, slashIndex) : name;
}

/**
 * Extract endpoint from an exporter config object.
 */
function extractEndpoint(config: unknown): string | undefined {
  if (config && typeof config === 'object') {
    const obj = config as Record<string, unknown>;
    if (typeof obj.endpoint === 'string') return obj.endpoint;
    if (Array.isArray(obj.endpoints) && typeof obj.endpoints[0] === 'string') {
      return obj.endpoints[0];
    }
  }
  return undefined;
}

// ============ Main Function ============

/**
 * Converts an edited YAML string back to a CollectorConfig.
 *
 * Algorithm:
 * 1. YAML.parse() — syntax check
 * 2. Validate structure has receivers / processors / exporters sections
 * 3. For each key, extract base type, filter self-telemetry, map to enum
 * 4. Return { config, warnings }
 *
 * @param yamlString - The YAML configuration string to parse
 * @returns YamlParseResult with config (or null), errors, and warnings
 */
export function yamlToCollectorConfig(yamlString: string): YamlParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Step 1: Parse YAML syntax
  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlString);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown parse error';
    return {
      config: null,
      errors: [`YAML syntax error: ${message}`],
      warnings: [],
    };
  }

  // Must be a non-null object
  if (!parsed || typeof parsed !== 'object') {
    return {
      config: null,
      errors: ['YAML must be a mapping (object) at the top level'],
      warnings: [],
    };
  }

  const doc = parsed as Record<string, unknown>;

  // Step 2: Validate required sections exist
  const receiversSection = doc.receivers;
  const processorsSection = doc.processors;
  const exportersSection = doc.exporters;

  if (!receiversSection || typeof receiversSection !== 'object') {
    errors.push('Missing or invalid "receivers" section');
  }
  if (!exportersSection || typeof exportersSection !== 'object') {
    errors.push('Missing or invalid "exporters" section');
  }
  // Processors section is optional (a valid config can have zero processors)
  if (processorsSection && typeof processorsSection !== 'object') {
    errors.push('"processors" section must be a mapping');
  }

  // If critical sections are missing, return early
  if (errors.length > 0 && !receiversSection && !exportersSection) {
    return { config: null, errors, warnings };
  }

  // Step 3: Parse each section
  const receivers: ReceiverConfig[] = [];
  const processors: ProcessorConfig[] = [];
  const exporters: ExporterConfig[] = [];

  // --- Receivers ---
  if (receiversSection && typeof receiversSection === 'object') {
    for (const key of Object.keys(receiversSection as Record<string, unknown>)) {
      // Skip self-telemetry receivers
      if (SELF_TELEMETRY_RECEIVERS.has(key)) {
        continue;
      }

      const baseType = extractBaseType(key);
      const receiverType = KNOWN_RECEIVERS[baseType];

      if (receiverType) {
        // Avoid duplicates (e.g. "filelog" and "filelog/platformlogs" both map to "filelog")
        if (!receivers.some((r) => r.type === receiverType)) {
          const rawConfig = (receiversSection as Record<string, unknown>)[key];
          receivers.push({
            type: receiverType,
            enabled: true,
            config: rawConfig && typeof rawConfig === 'object'
              ? rawConfig as Record<string, unknown>
              : undefined,
          });
        }
      } else {
        warnings.push(`Unknown receiver "${key}" — skipped`);
      }
    }
  }

  // --- Processors ---
  if (processorsSection && typeof processorsSection === 'object') {
    for (const key of Object.keys(processorsSection as Record<string, unknown>)) {
      // Skip self-telemetry and auto-generated processors
      if (SELF_TELEMETRY_PROCESSORS.has(key) || AUTO_GENERATED_PROCESSORS.has(key)) {
        continue;
      }

      const baseType = extractBaseType(key);
      const processorType = KNOWN_PROCESSORS[baseType];

      if (processorType) {
        // Avoid duplicates
        if (!processors.some((p) => p.type === processorType)) {
          const rawConfig = (processorsSection as Record<string, unknown>)[key];
          processors.push({
            type: processorType,
            enabled: true,
            config: rawConfig && typeof rawConfig === 'object'
              ? rawConfig as Record<string, unknown>
              : undefined,
          });
        }
      } else {
        warnings.push(`Unknown processor "${key}" — skipped`);
      }
    }
  }

  // --- Exporters ---
  if (exportersSection && typeof exportersSection === 'object') {
    for (const key of Object.keys(exportersSection as Record<string, unknown>)) {
      const baseType = extractBaseType(key);
      const exporterType = KNOWN_EXPORTERS[baseType];

      if (exporterType) {
        // Avoid duplicates
        if (!exporters.some((e) => e.type === exporterType)) {
          const rawConfig = (exportersSection as Record<string, unknown>)[key];
          const endpoint = extractEndpoint(rawConfig);
          exporters.push({
            type: exporterType,
            enabled: true,
            endpoint,
            config: rawConfig && typeof rawConfig === 'object'
              ? rawConfig as Record<string, unknown>
              : undefined,
          });
        }
      } else {
        warnings.push(`Unknown exporter "${key}" — skipped`);
      }
    }
  }

  // Warn if no receivers or exporters were parsed (but YAML was valid)
  if (receivers.length === 0 && receiversSection) {
    warnings.push('No recognized receivers found in the "receivers" section');
  }
  if (exporters.length === 0 && exportersSection) {
    warnings.push('No recognized exporters found in the "exporters" section');
  }

  return {
    config: {
      receivers,
      processors,
      exporters,
    },
    errors,
    warnings,
  };
}

/**
 * Quick validation that only checks YAML syntax (no structural validation).
 * Useful for real-time feedback during typing.
 *
 * @param yamlString - The YAML string to validate
 * @returns null if valid, or an error message string
 */
export function validateYamlSyntax(yamlString: string): string | null {
  try {
    YAML.parse(yamlString);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid YAML syntax';
  }
}
