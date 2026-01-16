'use client';

import { memo, useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Code, ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Info, Plus } from 'lucide-react';
import { OpenTelemetryLogo } from '../icons/OpenTelemetryLogo';
import { useFlowStore } from '../../store/flowStore';
import { useValidationStore } from '../../store/validationStore';
import { generateCollectorYAML } from '../../lib/yaml-generator';
import { validateCollectorConfig, type ValidationIssue, type ValidationResult } from '../../lib/config-validator';
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
} from '../../types';

// Component metadata for UI display
const RECEIVER_OPTIONS: { type: ReceiverType; icon: string; label: string; description: string }[] = [
  { type: 'otlp', icon: '📥', label: 'OTLP', description: 'gRPC/HTTP telemetry from SDKs' },
  { type: 'hostmetrics', icon: '💻', label: 'Host Metrics', description: 'CPU, memory, disk, network' },
  { type: 'filelog', icon: '📄', label: 'File Log', description: 'Tail log files' },
  { type: 'prometheus', icon: '📊', label: 'Prometheus', description: 'Scrape Prometheus endpoints' },
  { type: 'k8s_cluster', icon: '☸️', label: 'K8s Cluster', description: 'Kubernetes cluster metrics' },
  { type: 'kubeletstats', icon: '📦', label: 'Kubelet Stats', description: 'Pod/container metrics' },
  { type: 'jaeger', icon: '🔷', label: 'Jaeger', description: 'Legacy Jaeger traces' },
  { type: 'zipkin', icon: '🔶', label: 'Zipkin', description: 'Legacy Zipkin traces' },
];

const PROCESSOR_OPTIONS: { type: ProcessorType; icon: string; label: string; description: string; required?: boolean }[] = [
  { type: 'memory_limiter', icon: '🛡️', label: 'Memory Limiter', description: 'Prevent OOM (should be first)', required: true },
  { type: 'resourcedetection', icon: '🔍', label: 'Resource Detection', description: 'Auto-detect host/container info' },
  { type: 'resource', icon: '🏷️', label: 'Resource', description: 'Add resource attributes' },
  { type: 'k8sattributes', icon: '☸️', label: 'K8s Attributes', description: 'Enrich with Kubernetes metadata' },
  { type: 'batch', icon: '📦', label: 'Batch', description: 'Batch for efficiency (should be last)' },
  { type: 'tail_sampling', icon: '🎯', label: 'Tail Sampling', description: 'Smart sampling (Gateway only)' },
  { type: 'transform', icon: '🔄', label: 'Transform', description: 'Modify attributes with OTTL' },
  { type: 'filter', icon: '🔍', label: 'Filter', description: 'Drop unwanted telemetry' },
  { type: 'attributes', icon: '🏷️', label: 'Attributes', description: 'Add/modify span attributes' },
];

const EXPORTER_OPTIONS: { type: ExporterType; icon: string; label: string; description: string }[] = [
  { type: 'elasticsearch', icon: '⚡', label: 'Elasticsearch', description: 'Send to Elastic Observability' },
  { type: 'otlp', icon: '📤', label: 'OTLP', description: 'Generic OTLP endpoint' },
  { type: 'debug', icon: '🐛', label: 'Debug', description: 'Console output for testing' },
  { type: 'file', icon: '💾', label: 'File', description: 'Write to file' },
  { type: 'logging', icon: '📋', label: 'Logging', description: 'Logging exporter for debugging' },
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

// Toggle component for receivers/processors/exporters
interface ToggleItemProps {
  icon: string;
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  required?: boolean;
  warning?: string;
}

const ToggleItem = memo(({ icon, label, description, enabled, onChange, required, warning }: ToggleItemProps) => (
  <motion.div
    layout
    className={`
      flex items-center gap-3 p-2.5 rounded-lg transition-colors cursor-pointer
      ${enabled ? 'bg-gray-800/80' : 'bg-gray-800/30 opacity-60'}
      hover:bg-gray-800
    `}
    onClick={() => !required && onChange(!enabled)}
  >
    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-700/50">
      <span className="text-base">{icon}</span>
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">{label}</span>
        {required && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Required</span>
        )}
      </div>
      <p className="text-xs text-gray-500 truncate">{description}</p>
      {warning && enabled && (
        <p className="text-xs text-amber-400 mt-1">⚠️ {warning}</p>
      )}
    </div>
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!required) onChange(!enabled);
      }}
      disabled={required}
      className={`
        relative w-10 h-5 rounded-full transition-colors
        ${enabled ? 'bg-cyan-500' : 'bg-gray-600'}
        ${required ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <motion.div
        layout
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
        animate={{ left: enabled ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  </motion.div>
));

ToggleItem.displayName = 'ToggleItem';

// Section component with collapsible header
interface SectionProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Section = memo(({ title, icon, color, children, defaultOpen = true }: SectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
            {title}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp size={14} className="text-gray-500" />
        ) : (
          <ChevronDown size={14} className="text-gray-500" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-2 space-y-1.5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

Section.displayName = 'Section';

// Compact badge for enabled items (progressive disclosure)
interface CompactBadgeProps {
  icon: string;
  label: string;
  onRemove: () => void;
  required?: boolean;
}

const CompactBadge = memo(({ icon, label, onRemove, required }: CompactBadgeProps) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    className={`
      inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs
      ${required ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-gray-700/80 border border-gray-600/50'}
    `}
  >
    <span className="text-sm">{icon}</span>
    <span className="text-white font-medium">{label}</span>
    {!required && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 p-0.5 hover:bg-gray-600 rounded transition-colors"
      >
        <X size={10} className="text-gray-400" />
      </button>
    )}
    {required && (
      <span className="text-[8px] text-amber-400">req</span>
    )}
  </motion.div>
));

CompactBadge.displayName = 'CompactBadge';

// Progressive disclosure section
interface ProgressiveSectionProps<T extends string> {
  title: string;
  icon: string;
  color: string;
  options: { type: T; icon: string; label: string; description: string; required?: boolean }[];
  enabledTypes: T[];
  onToggle: (type: T) => void;
  isEnabled: (type: T) => boolean;
}

function ProgressiveSectionComponent<T extends string>({
  title,
  icon,
  color,
  options,
  enabledTypes,
  onToggle,
  isEnabled,
}: ProgressiveSectionProps<T>): React.ReactElement {
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  const enabledOptions = options.filter((opt) => isEnabled(opt.type));
  const disabledOptions = options.filter((opt) => !isEnabled(opt.type));

  return (
    <div className="border border-gray-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-2.5 bg-gray-800/50">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
            {title}
          </span>
          <span className="text-[10px] text-gray-500">({enabledOptions.length})</span>
        </div>
      </div>

      {/* Enabled items as compact badges */}
      <div className="p-2">
        <div className="flex flex-wrap gap-1.5 mb-2">
          <AnimatePresence mode="popLayout">
            {enabledOptions.map((opt) => (
              <CompactBadge
                key={opt.type}
                icon={opt.icon}
                label={opt.label}
                onRemove={() => onToggle(opt.type)}
                required={opt.required}
              />
            ))}
          </AnimatePresence>
          {enabledOptions.length === 0 && (
            <span className="text-xs text-gray-500 italic">None enabled</span>
          )}
        </div>

        {/* Add button with dropdown */}
        {disabledOptions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <Plus size={12} />
              Add {title.slice(0, -1).toLowerCase()}
              <ChevronDown size={10} className={`transition-transform ${showAddDropdown ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showAddDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute left-0 top-full mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-10 max-h-48 overflow-auto"
                >
                  {disabledOptions.map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => {
                        onToggle(opt.type);
                        setShowAddDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-gray-700 transition-colors text-left"
                    >
                      <span className="text-sm">{opt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white">{opt.label}</div>
                        <div className="text-[10px] text-gray-500 truncate">{opt.description}</div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

const ProgressiveSection = memo(ProgressiveSectionComponent) as typeof ProgressiveSectionComponent;

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
        <label className="block text-xs text-gray-400 mb-1.5">Display Label</label>
        <input
          type="text"
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          placeholder="My Application"
        />
      </div>

      {/* Service Name */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Service Name</label>
        <input
          type="text"
          value={data.serviceName}
          onChange={(e) => onUpdate({ serviceName: e.target.value })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          placeholder="my-service"
        />
        <p className="text-xs text-gray-500 mt-1">Used for OTEL_SERVICE_NAME</p>
      </div>

      {/* Language */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Language / Runtime</label>
        <div className="grid grid-cols-5 gap-1.5">
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang.value}
              onClick={() => onUpdate({ language: lang.value })}
              className={`
                flex flex-col items-center gap-1 p-2 rounded-lg border transition-all
                ${data.language === lang.value
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600'
                }
              `}
            >
              <span className="text-lg">{lang.icon}</span>
              <span className="text-[10px] text-gray-400">{lang.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Auto-instrumentation */}
      <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
        <div>
          <div className="text-sm text-white">Auto-instrumentation</div>
          <p className="text-xs text-gray-500">Automatic span creation</p>
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

  const toggleProcessor = useCallback((type: ProcessorType) => {
    const processors = data.config.processors.map((p) =>
      p.type === type ? { ...p, enabled: !p.enabled } : p
    );
    // Add if not exists
    if (!processors.find((p) => p.type === type)) {
      processors.push({ type, enabled: true });
    }
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
        <label className="block text-xs text-gray-400 mb-1.5">Display Label</label>
        <input
          type="text"
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        />
      </div>

      {/* Mode indicator */}
      <div className={`
        flex items-center gap-2 p-2.5 rounded-lg
        ${isGateway ? 'bg-pink-500/10 border border-pink-500/30' : 'bg-cyan-500/10 border border-cyan-500/30'}
      `}>
        <div className="relative">
          <OpenTelemetryLogo size={28} />
          <span 
            className={`absolute -bottom-1 -right-1 text-[8px] bg-gray-900 rounded-full px-1 border ${isGateway ? 'border-pink-500 text-pink-400' : 'border-cyan-500 text-cyan-400'}`}
          >
            {isGateway ? 'GW' : 'AG'}
          </span>
        </div>
        <div>
          <div className={`text-sm font-medium ${isGateway ? 'text-pink-400' : 'text-cyan-400'}`}>
            {isGateway ? 'Gateway Mode' : 'Agent Mode'}
          </div>
          <p className="text-xs text-gray-400">
            {isGateway ? 'Centralized processing & sampling' : 'Per-host collection & forwarding'}
          </p>
        </div>
      </div>

      {/* Receivers - Progressive Disclosure */}
      <ProgressiveSection<ReceiverType>
        title="Receivers"
        icon="📥"
        color="#22c55e"
        options={RECEIVER_OPTIONS}
        enabledTypes={data.config.receivers.filter(r => r.enabled).map(r => r.type)}
        onToggle={toggleReceiver}
        isEnabled={isReceiverEnabled}
      />

      {/* Processors - Progressive Disclosure */}
      <ProgressiveSection<ProcessorType>
        title="Processors"
        icon="⚙️"
        color="#3b82f6"
        options={PROCESSOR_OPTIONS}
        enabledTypes={data.config.processors.filter(p => p.enabled).map(p => p.type)}
        onToggle={toggleProcessor}
        isEnabled={isProcessorEnabled}
      />

      {/* Exporters - Progressive Disclosure */}
      <ProgressiveSection<ExporterType>
        title="Exporters"
        icon="📤"
        color="#f59e0b"
        options={EXPORTER_OPTIONS}
        enabledTypes={data.config.exporters.filter(e => e.enabled).map(e => e.type)}
        onToggle={toggleExporter}
        isEnabled={isExporterEnabled}
      />

      {/* Validation Section */}
      <div className="border border-gray-700/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowValidation(!showValidation)}
          className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            {validation.errors.length > 0 ? (
              <AlertCircle size={14} className="text-red-400" />
            ) : validation.warnings.length > 0 ? (
              <AlertTriangle size={14} className="text-amber-400" />
            ) : (
              <span className="text-green-400 text-sm">✓</span>
            )}
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">
              Validation
            </span>
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400">
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
                    : 'bg-gray-700 text-gray-500 hover:text-gray-400'
                }`}
              >
                Tips
              </button>
            )}
            {showValidation ? (
              <ChevronUp size={14} className="text-gray-500" />
            ) : (
              <ChevronDown size={14} className="text-gray-500" />
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
        <label className="block text-xs text-gray-400 mb-1.5">Display Label</label>
        <input
          type="text"
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        />
      </div>

      {/* Features */}
      <div>
        <label className="block text-xs text-gray-400 mb-2">Enabled Features</label>
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
                    : 'border-gray-700 bg-gray-800/50 opacity-50 hover:opacity-75'
                  }
                `}
              >
                <span>{icons[feature]}</span>
                <span className="text-sm text-white capitalize">{feature}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

ElasticConfig.displayName = 'ElasticConfig';

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

  // Generate YAML preview for collectors
  const yamlPreview = useMemo(() => {
    if (!selectedNode) return '';
    if (
      selectedNode.data.componentType !== 'collector-agent' &&
      selectedNode.data.componentType !== 'collector-gateway'
    ) {
      return '';
    }
    return generateCollectorYAML(selectedNode.data as CollectorNodeData);
  }, [selectedNode]);

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
        className="absolute top-4 right-4 z-20 w-[320px] bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-32px)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50 shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-cyan-400" />
            <h3 className="font-semibold text-white">Configure Node</h3>
          </div>
          <button
            onClick={() => useFlowStore.getState().setSelectedNode(null)}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Topology Validation Banner (if issues) */}
        {(topologyValidation.errors.length > 0 || topologyValidation.warnings.length > 0) && (
          <div className="border-b border-gray-700/50">
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
                  <span className={`text-xs font-medium ${
                    topologyValidation.errors.length > 0 ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {topologyValidation.errors.length + topologyValidation.warnings.length} architecture issue{topologyValidation.errors.length + topologyValidation.warnings.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {deploymentConfig.icon} {deploymentConfig.label} deployment
                  </span>
                </div>
              </div>
              {showTopologyValidation ? (
                <ChevronUp size={14} className="text-gray-500" />
              ) : (
                <ChevronDown size={14} className="text-gray-500" />
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
                  <div className="p-3 bg-gray-900/50">
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

        {/* YAML Preview (for collectors only) */}
        {isCollector && (
          <div className="border-t border-gray-700/50 shrink-0">
            <button
              onClick={() => setShowYamlPreview(!showYamlPreview)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Code size={14} className="text-cyan-400" />
                <span className="text-xs font-medium text-gray-400">YAML Preview</span>
              </div>
              {showYamlPreview ? (
                <ChevronDown size={14} className="text-gray-500" />
              ) : (
                <ChevronUp size={14} className="text-gray-500" />
              )}
            </button>
            <AnimatePresence>
              {showYamlPreview && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 200, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <pre className="p-3 text-[10px] text-gray-400 font-mono overflow-auto h-[200px] bg-gray-950/50">
                    {yamlPreview}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

NodeConfigPanel.displayName = 'NodeConfigPanel';

