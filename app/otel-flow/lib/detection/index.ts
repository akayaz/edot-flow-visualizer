/**
 * Detection Module
 *
 * Provides functionality to detect and reconstruct telemetry topologies from:
 * - YAML configuration files (OTel Collector, Docker Compose, K8s manifests)
 * - Live traffic analysis
 * - Source code scanning
 */

// Types
export type {
  DetectionMethod,
  DetectionStatus,
  DetectionResult,
  DetectionWarning,
  RawOTelConfig,
  ParsedCollectorConfig,
  ParsedReceiverConfig,
  ParsedProcessorConfig,
  ParsedExporterConfig,
  ParsedPipelineConfig,
  InferredSource,
  InferredTarget,
  ParsedDockerCompose,
  ParsedDockerService,
  ParsedK8sManifest,
  ParsedK8sWorkload,
  TrafficAnalysisResult,
  DetectedService,
  DetectedConnection,
  InferredCollector,
  CodeScanResult,
  DetectedSDK,
  InstrumentedService,
  FoundConfigFile,
  AggregatedDetection,
  DetectionConflict,
  ConflictResolution,
  DetectionSummary,
  LayoutOptions,
  LayoutResult,
  NodeLayer,
  LayoutDirection,
  DetectionState,
  CombinedDetectionOptions,
  LanguageScannerPattern,
} from './types';

// YAML Parser
export {
  parseOtelCollectorYaml,
  parseMultiDocumentYaml,
  validateOtelYaml,
} from './yaml-parser';

// Layout Engine
export {
  layoutTopology,
  layoutWithCrossingMinimization,
  centerNodesVertically,
  layoutAndFit,
} from './layout-engine';

// Traffic Analyzer
export {
  analyzeTrafficSnapshot,
  analyzeTrafficRealtime,
} from './traffic-analyzer';

// Constants
export { LANGUAGE_SCANNER_PATTERNS, COLLECTOR_MODE_INDICATORS } from './types';
