'use client';

import { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Code, ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Info, Lock, Loader2 } from 'lucide-react';
import {
  EuiIcon,
  EuiFlyout,
  EuiFlyoutHeader,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiCodeBlock,
  EuiTitle,
  EuiButtonEmpty,
  EuiButton,
  EuiButtonGroup,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
  EuiSpacer,
  EuiCopy,
  EuiConfirmModal,
  EuiBadge,
} from '@elastic/eui';
import { OpenTelemetryLogo } from '../icons/OpenTelemetryLogo';
import { useFlowStore } from '../../store/flowStore';
import { useValidationStore } from '../../store/validationStore';
import { validateCollectorConfig, type ValidationResult } from '../../lib/config-validator';
import { useYamlEditor } from '../../hooks/useYamlEditor';
import { SDK_LANGUAGE_CONFIG, DEPLOYMENT_MODEL_CONFIG } from '../../types';
import type {
  SDKNodeData,
  CollectorNodeData,
  ElasticNodeData,
  EDOTNodeData,
  ReceiverType,
  ProcessorType,
  ExporterType,
  SDKLanguage,
  DeploymentModel,
} from '../../types';

// Monaco editor loaded dynamically (SSR-safe, ~1MB async)
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// EUI icon mappings for collector components
const RECEIVER_ICON_MAP: Record<ReceiverType, string> = {
  otlp: 'logstashInput',
  hostmetrics: 'compute',
  filelog: 'document',
  prometheus: 'logoPrometheus',
  k8s_cluster: 'logoKubernetes',
  kubeletstats: 'kubernetesPod',
  jaeger: 'apmTrace',
  zipkin: 'apmTrace',
  kafka: 'logstashInput',
};

const PROCESSOR_ICON_MAP: Record<ProcessorType, string> = {
  memory_limiter: 'memory',
  batch: 'aggregate',
  resourcedetection: 'crosshairs',
  resource: 'tag',
  k8sattributes: 'logoKubernetes',
  tail_sampling: 'filter',
  transform: 'merge',
  filter: 'filterInCircle',
  attributes: 'tag',
  elasticapm: 'logoObservability',
  spanmetrics: 'stats',
};

const EXPORTER_ICON_MAP: Record<ExporterType, string> = {
  otlp: 'logstashOutput',
  elasticsearch: 'logoElasticsearch',
  debug: 'bug',
  file: 'document',
  logging: 'logstashOutput',
  kafka: 'logstashOutput',
};

// Section header icons
const SECTION_ICONS = {
  receivers: 'logstashInput',
  processors: 'gear',
  exporters: 'logstashOutput',
};

// Component metadata for UI display - all options visible as chips
const RECEIVER_OPTIONS: { type: ReceiverType; label: string; description: string }[] = [
  { type: 'otlp', label: 'OTLP', description: 'gRPC/HTTP telemetry from SDKs' },
  { type: 'hostmetrics', label: 'Host Metrics', description: 'CPU, memory, disk, network' },
  { type: 'filelog', label: 'File Log', description: 'Tail log files' },
  { type: 'prometheus', label: 'Prometheus', description: 'Scrape Prometheus endpoints' },
  { type: 'k8s_cluster', label: 'K8s Cluster', description: 'Kubernetes cluster metrics' },
  { type: 'kubeletstats', label: 'Kubelet Stats', description: 'Pod/container metrics' },
  { type: 'jaeger', label: 'Jaeger', description: 'Legacy Jaeger traces' },
  { type: 'zipkin', label: 'Zipkin', description: 'Legacy Zipkin traces' },
];

const PROCESSOR_OPTIONS: { type: ProcessorType; label: string; description: string; required?: boolean }[] = [
  { type: 'memory_limiter', label: 'Memory Limiter', description: 'Prevent OOM (should be first)', required: true },
  { type: 'batch', label: 'Batch', description: 'Batch for efficiency (should be last)' },
  { type: 'resourcedetection', label: 'Resource Detection', description: 'Auto-detect host/container info' },
  { type: 'resource', label: 'Resource', description: 'Add resource attributes' },
  { type: 'k8sattributes', label: 'K8s Attributes', description: 'Enrich with Kubernetes metadata' },
  { type: 'tail_sampling', label: 'Tail Sampling', description: 'Smart sampling (Gateway only)' },
  { type: 'transform', label: 'Transform', description: 'Modify attributes with OTTL' },
  { type: 'filter', label: 'Filter', description: 'Drop unwanted telemetry' },
  { type: 'attributes', label: 'Attributes', description: 'Add/modify span attributes' },
  { type: 'elasticapm', label: 'Elastic APM', description: 'Process traces for Elastic APM UI (Gateway)' },
  { type: 'spanmetrics', label: 'Span Metrics', description: 'Generate metrics from spans' },
];

const EXPORTER_OPTIONS: { type: ExporterType; label: string; description: string }[] = [
  { type: 'otlp', label: 'OTLP', description: 'Forward to Gateway or managed endpoint' },
  { type: 'elasticsearch', label: 'Elasticsearch', description: 'Direct export to Elastic Observability' },
  { type: 'debug', label: 'Debug', description: 'Console output for testing' },
  { type: 'file', label: 'File', description: 'Write to file' },
  { type: 'logging', label: 'Logging', description: 'Logging exporter for debugging' },
];

const LANGUAGE_OPTIONS: { value: SDKLanguage; icon: string; label: string }[] = [
  { value: 'nodejs', ...SDK_LANGUAGE_CONFIG.nodejs },
  { value: 'python', ...SDK_LANGUAGE_CONFIG.python },
  { value: 'java', ...SDK_LANGUAGE_CONFIG.java },
  { value: 'dotnet', ...SDK_LANGUAGE_CONFIG.dotnet },
  { value: 'go', ...SDK_LANGUAGE_CONFIG.go },
  { value: 'php', ...SDK_LANGUAGE_CONFIG.php },
  { value: 'ruby', ...SDK_LANGUAGE_CONFIG.ruby },
  { value: 'android', ...SDK_LANGUAGE_CONFIG.android },
  { value: 'ios', ...SDK_LANGUAGE_CONFIG.ios },
];

// ============================================
// Chip-Based Component Selector
// ============================================

// ComponentChip - Compact pill-shaped chip for component selection
interface ComponentChipProps {
  iconType: string; // EUI icon type
  label: string;
  description: string;
  enabled: boolean;
  required?: boolean;
  onClick: () => void;
  color: string; // Tailwind color name: 'green', 'blue', 'amber'
}

const ComponentChip = memo(({ iconType, label, description, enabled, required, onClick, color }: ComponentChipProps) => {
  const colorClasses = {
    green: {
      enabled: 'bg-green-500/20 border-green-500/50 text-green-400',
      hover: 'hover:bg-green-500/30',
      iconColor: '#22c55e',
    },
    blue: {
      enabled: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
      hover: 'hover:bg-blue-500/30',
      iconColor: '#3b82f6',
    },
    amber: {
      enabled: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
      hover: 'hover:bg-amber-500/30',
      iconColor: '#f59e0b',
    },
  };

  const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.blue;

  return (
    <motion.button
      layout
      onClick={() => !required && onClick()}
      disabled={required && enabled}
      title={description}
      whileHover={{ scale: required ? 1 : 1.02 }}
      whileTap={{ scale: required ? 1 : 0.98 }}
      className={`
        inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium
        border transition-all duration-150
        ${enabled 
          ? `${colors.enabled} ${!required ? colors.hover : ''}` 
          : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:bg-gray-800 hover:border-gray-600 hover:text-gray-400'
        }
        ${required ? 'cursor-default' : 'cursor-pointer'}
      `}
    >
      <EuiIcon
        type={iconType}
        size="m"
        color={enabled ? colors.iconColor : '#6b7280'}
      />
      <span>{label}</span>
      {required && enabled && (
        <Lock size={12} className="text-amber-400 ml-0.5" />
      )}
    </motion.button>
  );
});

ComponentChip.displayName = 'ComponentChip';

// ChipSection - Collapsible section with header and chip grid
interface ChipSectionProps<T extends string> {
  title: string;
  iconType: string; // EUI icon type for section header
  color: string;
  options: { type: T; label: string; description: string; required?: boolean }[];
  iconMap: Record<T, string>; // Map from type to EUI icon
  isEnabled: (type: T) => boolean;
  onToggle: (type: T) => void;
  defaultOpen?: boolean;
}

function ChipSectionComponent<T extends string>({
  title,
  iconType,
  color,
  options,
  iconMap,
  isEnabled,
  onToggle,
  defaultOpen = false,
}: ChipSectionProps<T>): React.ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const enabledCount = options.filter((opt) => isEnabled(opt.type)).length;

  const colorPalette: Record<string, string> = {
    green: '#22c55e',
    blue: '#3b82f6',
    amber: '#f59e0b',
  };

  return (
    <div className="border border-gray-700/50 rounded-xl overflow-hidden">
      {/* Section Header - Clickable to toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <EuiIcon type={iconType} size="m" color={colorPalette[color]} />
          <span 
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: colorPalette[color] }}
          >
            {title}
          </span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            {enabledCount}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp size={16} className="text-gray-500" />
        ) : (
          <ChevronDown size={16} className="text-gray-500" />
        )}
      </button>

      {/* Collapsible Chip Grid */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-2.5 flex flex-wrap gap-2">
              {options.map((opt) => (
                <ComponentChip
                  key={opt.type}
                  iconType={iconMap[opt.type]}
                  label={opt.label}
                  description={opt.description}
                  enabled={isEnabled(opt.type)}
                  required={opt.required}
                  onClick={() => onToggle(opt.type)}
                  color={color}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ChipSection = memo(ChipSectionComponent) as typeof ChipSectionComponent;

// Validation Messages Component
interface ValidationMessagesProps {
  validation: ValidationResult;
  showInfo?: boolean;
}

const ValidationMessages = memo(({ validation, showInfo = false }: ValidationMessagesProps) => {
  const allIssues = [
    ...validation.errors,
    ...validation.warnings,
    ...(showInfo ? validation.info : []),
  ];

  if (allIssues.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30"
      >
        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
          <span className="text-green-400 text-xs">✓</span>
        </div>
        <span className="text-sm text-green-400">Configuration looks good!</span>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      {validation.errors.map((issue) => (
        <motion.div
          key={issue.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-3 rounded-lg bg-red-500/10 border border-red-500/30"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-400">{issue.message}</p>
              {issue.suggestion && (
                <p className="text-xs text-red-400/70 mt-1">{issue.suggestion}</p>
              )}
            </div>
          </div>
        </motion.div>
      ))}

      {validation.warnings.map((issue) => (
        <motion.div
          key={issue.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-400">{issue.message}</p>
              {issue.suggestion && (
                <p className="text-xs text-amber-400/70 mt-1">{issue.suggestion}</p>
              )}
            </div>
          </div>
        </motion.div>
      ))}

      {showInfo && validation.info.map((issue) => (
        <motion.div
          key={issue.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30"
        >
          <div className="flex items-start gap-2">
            <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-400">{issue.message}</p>
              {issue.suggestion && (
                <p className="text-xs text-blue-400/70 mt-1">{issue.suggestion}</p>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
});

ValidationMessages.displayName = 'ValidationMessages';

// SDK Config Panel
interface SDKConfigProps {
  data: SDKNodeData;
  onUpdate: (data: Partial<SDKNodeData>) => void;
}

const SDKConfig = memo(({ data, onUpdate }: SDKConfigProps) => {
  return (
    <div className="space-y-4">
      {/* Label */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Display Label</label>
        <input
          type="text"
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-base text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          placeholder="My Application"
        />
      </div>

      {/* Service Name */}
      <div>
        <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1.5">Service Name</label>
        <input
          type="text"
          value={data.serviceName}
          onChange={(e) => onUpdate({ serviceName: e.target.value })}
          className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-base text-gray-900 dark:text-white font-mono focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          placeholder="my-service"
        />
        <p className="text-sm text-gray-600 dark:text-gray-500 mt-1">Used for OTEL_SERVICE_NAME</p>
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1.5">Language / Runtime</label>
        <div className="grid grid-cols-5 gap-1.5">
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang.value}
              onClick={() => onUpdate({ language: lang.value })}
              className={`
                flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all
                ${data.language === lang.value
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-gray-300 dark:border-gray-700 bg-gray-100/80 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600'
                }
              `}
            >
              <span className="text-xl">{lang.icon}</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">{lang.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Auto-instrumentation */}
      <div className="flex items-center justify-between p-3.5 bg-gray-100/80 dark:bg-gray-800/50 rounded-lg">
        <div>
          <div className="text-base text-gray-900 dark:text-white">Auto-instrumentation</div>
          <p className="text-sm text-gray-600 dark:text-gray-500">Automatic span creation</p>
        </div>
        <button
          onClick={() => onUpdate({ autoInstrumented: !data.autoInstrumented })}
          className={`
            relative w-10 h-5 rounded-full transition-colors
            ${data.autoInstrumented ? 'bg-green-500' : 'bg-gray-600'}
          `}
        >
          <motion.div
            layout
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
            animate={{ left: data.autoInstrumented ? 22 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>
    </div>
  );
});

SDKConfig.displayName = 'SDKConfig';

// Collector Config Panel
interface CollectorConfigProps {
  data: CollectorNodeData;
  onUpdate: (data: Partial<CollectorNodeData>) => void;
}

const CollectorConfig = memo(({ data, onUpdate }: CollectorConfigProps) => {
  const isGateway = data.componentType === 'collector-gateway';
  const [showValidation, setShowValidation] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  // Real-time validation
  const validation = useMemo(() => validateCollectorConfig(data), [data]);

  // Helper to toggle a component in config
  const toggleReceiver = useCallback((type: ReceiverType) => {
    const receivers = data.config.receivers.map((r) =>
      r.type === type ? { ...r, enabled: !r.enabled } : r
    );
    // Add if not exists
    if (!receivers.find((r) => r.type === type)) {
      receivers.push({ type, enabled: true });
    }
    onUpdate({ config: { ...data.config, receivers } });
  }, [data.config, onUpdate]);

  // Correct processor order for EDOT best practices:
  // memory_limiter (first) → resourcedetection → resource → k8sattributes → batch → elasticapm (last)
  const PROCESSOR_ORDER: ProcessorType[] = [
    'memory_limiter',
    'resourcedetection',
    'resource',
    'k8sattributes',
    'transform',
    'filter',
    'attributes',
    'tail_sampling',
    'spanmetrics',
    'batch',
    'elasticapm', // Must always be LAST for Gateway mode
  ];

  const toggleProcessor = useCallback((type: ProcessorType) => {
    let processors = data.config.processors.map((p) =>
      p.type === type ? { ...p, enabled: !p.enabled } : p
    );
    // Add if not exists
    if (!processors.find((p) => p.type === type)) {
      processors.push({ type, enabled: true });
    }
    
    // Sort processors according to EDOT best practices order
    processors = processors.sort((a, b) => {
      const aIndex = PROCESSOR_ORDER.indexOf(a.type);
      const bIndex = PROCESSOR_ORDER.indexOf(b.type);
      // Unknown processors go at the end (before elasticapm)
      const aOrder = aIndex === -1 ? PROCESSOR_ORDER.length - 2 : aIndex;
      const bOrder = bIndex === -1 ? PROCESSOR_ORDER.length - 2 : bIndex;
      return aOrder - bOrder;
    });
    
    onUpdate({ config: { ...data.config, processors } });
  }, [data.config, onUpdate]);

  const toggleExporter = useCallback((type: ExporterType) => {
    const exporters = data.config.exporters.map((e) =>
      e.type === type ? { ...e, enabled: !e.enabled } : e
    );
    // Add if not exists
    if (!exporters.find((e) => e.type === type)) {
      exporters.push({ type, enabled: true });
    }
    onUpdate({ config: { ...data.config, exporters } });
  }, [data.config, onUpdate]);

  const isReceiverEnabled = (type: ReceiverType): boolean =>
    data.config.receivers.some((r) => r.type === type && r.enabled);

  const isProcessorEnabled = (type: ProcessorType): boolean =>
    data.config.processors.some((p) => p.type === type && p.enabled);

  const isExporterEnabled = (type: ExporterType): boolean =>
    data.config.exporters.some((e) => e.type === type && e.enabled);

  // Validation warnings
  const getProcessorWarning = (type: ProcessorType): string | undefined => {
    if (type === 'tail_sampling' && !isGateway) {
      return 'Tail sampling works best in Gateway mode';
    }
    return undefined;
  };

  return (
    <div className="space-y-4">
      {/* Label */}
      <div>
        <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1.5">Display Label</label>
        <input
          type="text"
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-base text-gray-900 dark:text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        />
      </div>

      {/* Mode indicator */}
      <div className={`
        flex items-center gap-2 p-3 rounded-lg
        ${isGateway ? 'bg-pink-500/10 border border-pink-500/30' : 'bg-cyan-500/10 border border-cyan-500/30'}
      `}>
        <div className="relative">
          <OpenTelemetryLogo size={32} />
          <span 
            className={`absolute -bottom-1 -right-1 text-[10px] bg-white dark:bg-gray-900 rounded-full px-1 border ${isGateway ? 'border-pink-500 text-pink-400' : 'border-cyan-500 text-cyan-400'}`}
          >
            {isGateway ? 'GW' : 'AG'}
          </span>
        </div>
        <div>
          <div className={`text-base font-medium ${isGateway ? 'text-pink-400' : 'text-cyan-400'}`}>
            {isGateway ? 'Gateway Mode' : 'Agent Mode'}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isGateway ? 'Centralized processing & sampling' : 'Per-host collection & forwarding'}
          </p>
        </div>
      </div>

      {/* Receivers - Chip-based selection */}
      <ChipSection<ReceiverType>
        title="Receivers"
        iconType={SECTION_ICONS.receivers}
        color="green"
        options={RECEIVER_OPTIONS}
        iconMap={RECEIVER_ICON_MAP}
        isEnabled={isReceiverEnabled}
        onToggle={toggleReceiver}
      />

      {/* Processors - Chip-based selection */}
      <ChipSection<ProcessorType>
        title="Processors"
        iconType={SECTION_ICONS.processors}
        color="blue"
        options={PROCESSOR_OPTIONS}
        iconMap={PROCESSOR_ICON_MAP}
        isEnabled={isProcessorEnabled}
        onToggle={toggleProcessor}
      />

      {/* Exporters - Chip-based selection */}
      <ChipSection<ExporterType>
        title="Exporters"
        iconType={SECTION_ICONS.exporters}
        color="amber"
        options={EXPORTER_OPTIONS}
        iconMap={EXPORTER_ICON_MAP}
        isEnabled={isExporterEnabled}
        onToggle={toggleExporter}
      />

      {/* Validation Section */}
      <div className="border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowValidation(!showValidation)}
          className="w-full flex items-center justify-between p-3 bg-gray-100/70 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            {validation.errors.length > 0 ? (
              <AlertCircle size={14} className="text-red-400" />
            ) : validation.warnings.length > 0 ? (
              <AlertTriangle size={14} className="text-amber-400" />
            ) : (
              <span className="text-green-400 text-sm">✓</span>
            )}
            <span className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
              Validation
            </span>
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {validation.errors.length + validation.warnings.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showValidation && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInfo(!showInfo);
                }}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  showInfo
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'
                }`}
              >
                Tips
              </button>
            )}
            {showValidation ? (
              <ChevronUp size={14} className="text-gray-600 dark:text-gray-500" />
            ) : (
              <ChevronDown size={14} className="text-gray-600 dark:text-gray-500" />
            )}
          </div>
        </button>
        <AnimatePresence>
          {showValidation && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-3">
                <ValidationMessages validation={validation} showInfo={showInfo} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

CollectorConfig.displayName = 'CollectorConfig';

// Elastic Config Panel (minimal - mostly display)
interface ElasticConfigProps {
  data: ElasticNodeData;
  onUpdate: (data: Partial<ElasticNodeData>) => void;
}

const ElasticConfig = memo(({ data, onUpdate }: ElasticConfigProps) => {
  const features = ['apm', 'logs', 'metrics', 'profiling'] as const;

  return (
    <div className="space-y-4">
      {/* Label */}
      <div>
        <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1.5">Display Label</label>
        <input
          type="text"
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-base text-gray-900 dark:text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        />
      </div>

      {/* Features */}
      <div>
        <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Enabled Features</label>
        <div className="grid grid-cols-2 gap-2">
          {features.map((feature) => {
            const isEnabled = data.features.includes(feature);
            const icons: Record<string, string> = {
              apm: '📊',
              logs: '📝',
              metrics: '📈',
              profiling: '🔬',
            };
            return (
              <button
                key={feature}
                onClick={() => {
                  const newFeatures = isEnabled
                    ? data.features.filter((f) => f !== feature)
                    : [...data.features, feature];
                  onUpdate({ features: newFeatures as typeof data.features });
                }}
                className={`
                  flex items-center gap-2 p-2.5 rounded-lg border transition-all
                  ${isEnabled
                    ? 'border-teal-500 bg-teal-500/10'
                    : 'border-gray-300 dark:border-gray-700 bg-gray-100/80 dark:bg-gray-800/50 opacity-70 hover:opacity-90'
                  }
                `}
              >
                <span>{icons[feature]}</span>
                <span className="text-base text-gray-900 dark:text-white capitalize">{feature}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

ElasticConfig.displayName = 'ElasticConfig';

// ============================================
// YAML Editor — Edit Mode Body
// ============================================
// EuiFlyoutBody wraps content in:
//   .euiFlyoutBody  →  .euiFlyoutBody__overflow  →  .euiFlyoutBody__overflowContent
//
// Only .euiFlyoutBody__overflow has a real computed height (it's a flex child).
// .euiFlyoutBody__overflowContent is content-sized, so `height: 100%` from
// child elements resolves to auto (= 0 for Monaco).
//
// Fix: we place a sentinel ref, walk up to the `.euiFlyoutBody__overflow`
// ancestor, observe its height via ResizeObserver, and feed a concrete px
// height to Monaco.

interface EuiEditModeFlyoutBodyProps {
  editedYaml: string;
  setEditedYaml: (v: string) => void;
  validation: { isValid: boolean; errors: string[]; warnings: string[] };
  isValidating: boolean;
  hasValidationIssues: boolean;
  errorCount: number;
  warningCount: number;
  showValidationDetails: boolean;
  setShowValidationDetails: (v: boolean) => void;
}

const EuiEditModeFlyoutBody = memo(({
  editedYaml,
  setEditedYaml,
  validation,
  isValidating,
  hasValidationIssues,
  errorCount,
  warningCount,
  showValidationDetails,
  setShowValidationDetails,
}: EuiEditModeFlyoutBodyProps) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState(500);

  // Measure available height using the sentinel's viewport position.
  // This is EUI-version-agnostic: we don't rely on any internal class names.
  // The sentinel sits at the top of the flyout body content. We compute:
  //   availableHeight = viewportHeight - sentinelTop - footerHeight
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const FOOTER_HEIGHT_ESTIMATE = 56; // EuiFlyoutFooter approx height

    const measure = (): void => {
      if (!sentinel) return;
      const rect = sentinel.getBoundingClientRect();
      const available = window.innerHeight - rect.top - FOOTER_HEIGHT_ESTIMATE;
      setAvailableHeight(Math.max(available, 200));
    };

    // Measure after a frame to ensure layout is complete
    requestAnimationFrame(measure);

    // Re-measure on window resize
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(sentinel);

    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, []);

  // Reserve space for the validation banner
  const validationBannerHeight =
    hasValidationIssues || isValidating
      ? showValidationDetails ? 180 : 40
      : 0;
  const monacoHeight = Math.max(availableHeight - validationBannerHeight, 200);

  return (
    <EuiFlyoutBody>
      {/* Sentinel for measuring: invisible, 0-height */}
      <div ref={sentinelRef} style={{ height: 0, overflow: 'hidden' }} />

      {/* Monaco Editor with a concrete pixel height */}
      <MonacoEditor
        height={`${monacoHeight}px`}
        language="yaml"
        theme="vs-dark"
        value={editedYaml}
        onChange={(value) => setEditedYaml(value ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          automaticLayout: true,
          tabSize: 2,
          padding: { top: 8 },
        }}
      />

      {/* Validation Banner (edit mode only) */}
      {(hasValidationIssues || isValidating) && (
        <div style={{ borderTop: '1px solid #343741', padding: '8px 12px' }}>
          {isValidating ? (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
              <Loader2 size={12} className="animate-spin" />
              <span>Validating...</span>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowValidationDetails(!showValidationDetails)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {errorCount > 0 ? (
                    <AlertCircle size={14} className="text-red-400" />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-400" />
                  )}
                  <span className={`text-xs font-medium ${errorCount > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {errorCount > 0 && `${errorCount} error${errorCount > 1 ? 's' : ''}`}
                    {errorCount > 0 && warningCount > 0 && ', '}
                    {warningCount > 0 && `${warningCount} warning${warningCount > 1 ? 's' : ''}`}
                  </span>
                </div>
                {showValidationDetails ? (
                  <ChevronUp size={12} className="text-gray-600 dark:text-gray-500" />
                ) : (
                  <ChevronDown size={12} className="text-gray-600 dark:text-gray-500" />
                )}
              </button>
              <AnimatePresence>
                {showValidationDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                      {validation.errors.map((err, i) => (
                        <div key={`err-${i}`} className="flex items-start gap-1.5 text-xs text-red-400">
                          <AlertCircle size={11} className="shrink-0 mt-0.5" />
                          <span>{err}</span>
                        </div>
                      ))}
                      {validation.warnings.map((warn, i) => (
                        <div key={`warn-${i}`} className="flex items-start gap-1.5 text-xs text-amber-400">
                          <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                    {/* Roundtrip caveat */}
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-500">
                      <Info size={11} className="shrink-0 mt-0.5" />
                      <span>
                        Comments and formatting will be lost after Apply — the YAML is regenerated from the
                        parsed configuration. Self-telemetry sections are re-injected automatically.
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}
    </EuiFlyoutBody>
  );
});

EuiEditModeFlyoutBody.displayName = 'EuiEditModeFlyoutBody';

// ============================================
// YAML Editor Flyout (View + Edit modes)
// ============================================

type YamlFlyoutMode = 'view' | 'edit';

interface YamlEditorFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeData: CollectorNodeData;
  deploymentModel: DeploymentModel;
}

const YamlEditorFlyout = memo(({ isOpen, onClose, nodeId, nodeData, deploymentModel }: YamlEditorFlyoutProps) => {
  const [mode, setMode] = useState<YamlFlyoutMode>('view');
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'close' | 'switch-to-view' | null>(null);
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  const {
    editedYaml,
    setEditedYaml,
    isDirty,
    validation,
    isValidating,
    applyChanges,
    resetToGenerated,
    generatedYaml,
  } = useYamlEditor(nodeId, nodeData, deploymentModel);

  const lineCount = useMemo(() => {
    const yaml = mode === 'edit' ? editedYaml : generatedYaml;
    return yaml.split('\n').length;
  }, [mode, editedYaml, generatedYaml]);

  // Download handler (always uses generated YAML)
  const handleDownload = useCallback(() => {
    const yaml = mode === 'edit' ? editedYaml : generatedYaml;
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'otel-collector-config.yaml';
    a.click();
    URL.revokeObjectURL(url);
  }, [mode, editedYaml, generatedYaml]);

  // Unsaved changes guard
  const guardedClose = useCallback(() => {
    if (mode === 'edit' && isDirty) {
      setPendingAction('close');
      setShowDiscardModal(true);
    } else {
      setMode('view');
      onClose();
    }
  }, [mode, isDirty, onClose]);

  const guardedSwitchToView = useCallback(() => {
    if (isDirty) {
      setPendingAction('switch-to-view');
      setShowDiscardModal(true);
    } else {
      setMode('view');
    }
  }, [isDirty]);

  const handleConfirmDiscard = useCallback(() => {
    resetToGenerated();
    setShowDiscardModal(false);
    if (pendingAction === 'close') {
      setMode('view');
      onClose();
    } else if (pendingAction === 'switch-to-view') {
      setMode('view');
    }
    setPendingAction(null);
  }, [pendingAction, resetToGenerated, onClose]);

  const handleCancelDiscard = useCallback(() => {
    setShowDiscardModal(false);
    setPendingAction(null);
  }, []);

  // Apply changes and switch to view mode on success
  const handleApply = useCallback(() => {
    const success = applyChanges();
    if (success) {
      // After applying, the store will update nodeData → generatedYaml recalculates.
      // We switch to view mode so user sees the regenerated (canonical) YAML.
      setMode('view');
    }
  }, [applyChanges]);

  // Mode toggle options
  const modeToggleButtons = [
    { id: 'view', label: 'View', iconType: 'eye' },
    { id: 'edit', label: 'Edit', iconType: 'pencil' },
  ];

  if (!isOpen) return null;

  const copyableYaml = mode === 'edit' ? editedYaml : generatedYaml;
  const errorCount = validation.errors.length;
  const warningCount = validation.warnings.length;
  const hasValidationIssues = errorCount > 0 || warningCount > 0;

  return (
    <>
      <EuiFlyout
        ownFocus={false}
        onClose={guardedClose}
        size="m"
        aria-labelledby="yamlEditorTitle"
        paddingSize="none"
        side="right"
      >
        {/* Header */}
        <EuiFlyoutHeader hasBorder>
          <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiIcon type="document" color="primary" />
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiTitle size="xs">
                    <h2 id="yamlEditorTitle">Collector YAML Config</h2>
                  </EuiTitle>
                </EuiFlexItem>
                {mode === 'edit' && isDirty && (
                  <EuiFlexItem grow={false}>
                    <EuiBadge color="warning">modified</EuiBadge>
                  </EuiFlexItem>
                )}
              </EuiFlexGroup>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButtonGroup
                legend="YAML flyout mode"
                options={modeToggleButtons}
                idSelected={mode}
                onChange={(id) => {
                  if (id === 'view' && mode === 'edit') {
                    guardedSwitchToView();
                  } else {
                    setMode(id as YamlFlyoutMode);
                  }
                }}
                buttonSize="compressed"
                isFullWidth={false}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiSpacer size="xs" />
          <EuiText size="xs" color="subdued">
            <p>
              {mode === 'view'
                ? `Auto-generated from your current node configuration \u00b7 ${lineCount} lines`
                : `Editing YAML directly \u00b7 ${lineCount} lines`}
            </p>
          </EuiText>
        </EuiFlyoutHeader>

        {/* Body */}
        {mode === 'view' ? (
          <EuiFlyoutBody>
            <EuiCodeBlock
              language="yaml"
              fontSize="m"
              paddingSize="m"
              lineNumbers
              isCopyable
              overflowHeight="100%"
            >
              {generatedYaml}
            </EuiCodeBlock>
          </EuiFlyoutBody>
        ) : (
          <EuiEditModeFlyoutBody
            editedYaml={editedYaml}
            setEditedYaml={setEditedYaml}
            validation={validation}
            isValidating={isValidating}
            hasValidationIssues={hasValidationIssues}
            errorCount={errorCount}
            warningCount={warningCount}
            showValidationDetails={showValidationDetails}
            setShowValidationDetails={setShowValidationDetails}
          />
        )}

        {/* Footer */}
        <EuiFlyoutFooter>
          {mode === 'view' ? (
            /* View mode footer: Close | Copy | Download */
            <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty onClick={guardedClose} size="s">
                  Close
                </EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiFlexGroup gutterSize="s" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiCopy textToCopy={copyableYaml}>
                      {(copy) => (
                        <EuiButtonEmpty onClick={copy} iconType="copy" size="s">
                          Copy
                        </EuiButtonEmpty>
                      )}
                    </EuiCopy>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty
                      onClick={handleDownload}
                      iconType="download"
                      size="s"
                      color="primary"
                    >
                      Download .yaml
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiFlexItem>
            </EuiFlexGroup>
          ) : (
            /* Edit mode footer: Cancel | Reset | Apply Changes */
            <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty onClick={guardedClose} size="s">
                  Cancel
                </EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiFlexGroup gutterSize="s" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty
                      onClick={resetToGenerated}
                      iconType="refresh"
                      size="s"
                      isDisabled={!isDirty}
                    >
                      Reset
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButton
                      onClick={handleApply}
                      fill
                      size="s"
                      color="primary"
                      isDisabled={!isDirty || errorCount > 0 || isValidating}
                      iconType="check"
                    >
                      Apply Changes
                    </EuiButton>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiFlexItem>
            </EuiFlexGroup>
          )}
        </EuiFlyoutFooter>
      </EuiFlyout>

      {/* Unsaved changes confirmation modal */}
      {showDiscardModal && (
        <EuiConfirmModal
          title="Discard unsaved changes?"
          onCancel={handleCancelDiscard}
          onConfirm={handleConfirmDiscard}
          cancelButtonText="Keep editing"
          confirmButtonText="Discard changes"
          buttonColor="danger"
          defaultFocusedButton="cancel"
        >
          <p>You have unsaved changes to the YAML configuration. Discarding will revert to the auto-generated version.</p>
        </EuiConfirmModal>
      )}
    </>
  );
});

YamlEditorFlyout.displayName = 'YamlEditorFlyout';

// Main NodeConfigPanel
export const NodeConfigPanel = memo(() => {
  const { nodes, selectedNodeId, updateNodeData, isConfigPanelOpen, deploymentModel } = useFlowStore();
  const { validationResults } = useValidationStore();
  const [showYamlPreview, setShowYamlPreview] = useState(false);
  const [showTopologyValidation, setShowTopologyValidation] = useState(false);

  // Get deployment config for display
  const deploymentConfig = DEPLOYMENT_MODEL_CONFIG[deploymentModel];

  // Find selected node
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  // Get topology validation from the unified validation store
  // This ensures consistency with the ValidationPanel at bottom-right
  // Convert to the format expected by the existing ValidationMessages component
  const topologyValidation: ValidationResult = useMemo(() => {
    const errors = validationResults.filter((r) => r.severity === 'error');
    const warnings = validationResults.filter((r) => r.severity === 'warning');
    const infoResults = validationResults.filter((r) => r.severity === 'info');
    
    return {
      isValid: errors.length === 0,
      errors: errors.map(r => ({
        id: r.id,
        severity: r.severity,
        message: r.message,
        suggestion: r.suggestion,
      })),
      warnings: warnings.map(r => ({
        id: r.id,
        severity: r.severity,
        message: r.message,
        suggestion: r.suggestion,
      })),
      info: infoResults.map(r => ({
        id: r.id,
        severity: r.severity,
        message: r.message,
        suggestion: r.suggestion,
      })),
    };
  }, [validationResults]);

  // No longer need to generate YAML here — YamlEditorFlyout handles it via useYamlEditor

  // Update handler
  const handleUpdate = useCallback(
    (data: Partial<EDOTNodeData>) => {
      if (selectedNodeId) {
        updateNodeData(selectedNodeId, data);
      }
    },
    [selectedNodeId, updateNodeData]
  );

  // Determine node type for rendering appropriate config
  const nodeType = selectedNode?.data.componentType;
  const isCollector = nodeType === 'collector-agent' || nodeType === 'collector-gateway';
  const isSDK = nodeType === 'edot-sdk';
  const isElastic = nodeType === 'elastic-apm';
  const isInfrastructure = nodeType?.startsWith('infrastructure-');

  // Don't show if ConfigExportPanel is open (they would overlap)
  if (isConfigPanelOpen) {
    return null;
  }

  // Don't show for infrastructure nodes (they're containers, not configurable)
  if (!selectedNode || isInfrastructure) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="absolute top-12 right-4 z-20 w-[360px] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-32px)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700/50 shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-cyan-400" />
            <h3 className="text-[18px] font-semibold text-gray-900 dark:text-white">Configure Node</h3>
          </div>
          <button
            onClick={() => useFlowStore.getState().setSelectedNode(null)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Topology Validation Banner (if issues) */}
        {(topologyValidation.errors.length > 0 || topologyValidation.warnings.length > 0) && (
          <div className="border-b border-gray-200 dark:border-gray-700/50">
            <button
              onClick={() => setShowTopologyValidation(!showTopologyValidation)}
              className={`w-full flex items-center justify-between p-3 transition-colors ${
                topologyValidation.errors.length > 0
                  ? 'bg-red-500/10 hover:bg-red-500/15'
                  : 'bg-amber-500/10 hover:bg-amber-500/15'
              }`}
            >
              <div className="flex items-center gap-2">
                {topologyValidation.errors.length > 0 ? (
                  <AlertCircle size={14} className="text-red-400" />
                ) : (
                  <AlertTriangle size={14} className="text-amber-400" />
                )}
                <div className="flex flex-col items-start">
                  <span className={`text-sm font-medium ${
                    topologyValidation.errors.length > 0 ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {topologyValidation.errors.length + topologyValidation.warnings.length} architecture issue{topologyValidation.errors.length + topologyValidation.warnings.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-500">
                    {deploymentConfig.icon} {deploymentConfig.label} deployment
                  </span>
                </div>
              </div>
              {showTopologyValidation ? (
                <ChevronUp size={14} className="text-gray-600 dark:text-gray-500" />
              ) : (
                <ChevronDown size={14} className="text-gray-600 dark:text-gray-500" />
              )}
            </button>
            <AnimatePresence>
              {showTopologyValidation && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 bg-gray-50 dark:bg-gray-900/50">
                    <ValidationMessages validation={topologyValidation} showInfo={false} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {isSDK && (
            <SDKConfig
              data={selectedNode.data as SDKNodeData}
              onUpdate={handleUpdate}
            />
          )}
          {isCollector && (
            <CollectorConfig
              data={selectedNode.data as CollectorNodeData}
              onUpdate={handleUpdate}
            />
          )}
          {isElastic && (
            <ElasticConfig
              data={selectedNode.data as ElasticNodeData}
              onUpdate={handleUpdate}
            />
          )}
        </div>

        {/* YAML Preview button (for collectors only) */}
        {isCollector && (
          <div className="border-t border-gray-200 dark:border-gray-700/50 shrink-0 p-3">
            <button
              onClick={() => setShowYamlPreview(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg transition-colors"
            >
              <Code size={16} className="text-cyan-400" />
              <span className="text-sm font-medium text-cyan-400">View YAML Configuration</span>
            </button>
          </div>
        )}

        {/* YAML Editor Flyout (View + Edit modes) */}
        {isCollector && selectedNode && (
          <YamlEditorFlyout
            isOpen={showYamlPreview}
            onClose={() => setShowYamlPreview(false)}
            nodeId={selectedNode.id}
            nodeData={selectedNode.data as CollectorNodeData}
            deploymentModel={deploymentModel}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
});

NodeConfigPanel.displayName = 'NodeConfigPanel';

