'use client';

import { memo, useState } from 'react';
import { Handle, Position, type Node } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownToLine, Cpu, ArrowUpFromLine, Info, ExternalLink, CheckCircle2, Lightbulb } from 'lucide-react';
import { EuiIcon } from '@elastic/eui';
import { OpenTelemetryLogo } from '../icons/OpenTelemetryLogo';
import type { CollectorNodeData, ReceiverConfig, ProcessorConfig, ExporterConfig } from '../../types';
import { DEPLOYMENT_MODEL_CONFIG } from '../../types';
import { useFlowStore } from '../../store/flowStore';
import { getComponentHint } from '../../data/component-hints';

interface CollectorNodeProps {
  data: CollectorNodeData;
  selected?: boolean;
}

// EDOT-specific component icons (EUI icon types) and descriptions
const RECEIVER_INFO: Record<string, { iconType: string; label: string; description: string }> = {
  otlp: { iconType: 'logstashInput', label: 'OTLP', description: 'gRPC/HTTP telemetry' },
  hostmetrics: { iconType: 'compute', label: 'Host Metrics', description: 'CPU, memory, disk' },
  filelog: { iconType: 'document', label: 'File Log', description: 'Log file tailing' },
  prometheus: { iconType: 'logoPrometheus', label: 'Prometheus', description: 'Metrics scraping' },
  k8s_cluster: { iconType: 'logoKubernetes', label: 'K8s Cluster', description: 'Cluster metrics' },
  kubeletstats: { iconType: 'kubernetesPod', label: 'Kubelet', description: 'Pod/container metrics' },
  jaeger: { iconType: 'apmTrace', label: 'Jaeger', description: 'Legacy Jaeger' },
  zipkin: { iconType: 'apmTrace', label: 'Zipkin', description: 'Legacy Zipkin' },
};

const PROCESSOR_INFO: Record<string, { iconType: string; label: string; description: string }> = {
  memory_limiter: { iconType: 'memory', label: 'Memory Limiter', description: 'OOM protection' },
  resourcedetection: { iconType: 'crosshairs', label: 'Resource Detection', description: 'Auto-detect host info' },
  resource: { iconType: 'tag', label: 'Resource', description: 'Add resource attrs' },
  k8sattributes: { iconType: 'logoKubernetes', label: 'K8s Attributes', description: 'K8s metadata' },
  batch: { iconType: 'aggregate', label: 'Batch', description: 'Efficient batching' },
  tail_sampling: { iconType: 'filter', label: 'Tail Sampling', description: 'Smart sampling' },
  transform: { iconType: 'merge', label: 'Transform', description: 'Modify attributes' },
  filter: { iconType: 'filterInCircle', label: 'Filter', description: 'Drop unwanted data' },
  attributes: { iconType: 'tag', label: 'Attributes', description: 'Add/modify attrs' },
  elasticapm: { iconType: 'logoObservability', label: 'Elastic APM', description: 'Process traces for APM UI' },
  spanmetrics: { iconType: 'stats', label: 'Span Metrics', description: 'RED metrics' },
};

const EXPORTER_INFO: Record<string, { iconType: string; label: string; description: string }> = {
  otlp: { iconType: 'logstashOutput', label: 'OTLP', description: 'Forward to Gateway' },
  elasticsearch: { iconType: 'logoElasticsearch', label: 'Elasticsearch', description: 'Direct to Elastic' },
  debug: { iconType: 'bug', label: 'Debug', description: 'Console output' },
  file: { iconType: 'document', label: 'File', description: 'File export' },
  logging: { iconType: 'logstashOutput', label: 'Logging', description: 'Logging output' },
};

export const CollectorNode = memo(({ data, selected }: CollectorNodeProps) => {
  const isGateway = data.componentType === 'collector-gateway';
  const borderColor = isGateway ? '#ec4899' : '#06b6d4';
  const [showHint, setShowHint] = useState(false);
  const { deploymentModel } = useFlowStore();
  const hint = getComponentHint(data.componentType);
  const deploymentNote = hint?.deploymentNotes[deploymentModel];

  const enabledReceivers = data.config?.receivers?.filter((r) => r.enabled) || [];
  const enabledProcessors = data.config?.processors?.filter((p) => p.enabled) || [];
  const enabledExporters = data.config?.exporters?.filter((e) => e.enabled) || [];

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`
        relative px-4 py-3 rounded-xl bg-gray-900/95 backdrop-blur
        border-2 shadow-lg min-w-[220px] max-w-[280px]
        transition-all duration-200
        ${selected ? 'ring-2 ring-blue-400/50 ring-offset-2 ring-offset-gray-950' : ''}
      `}
      style={{
        borderColor,
        boxShadow: selected
          ? `0 0 20px ${borderColor}40, 0 4px 20px rgba(0,0,0,0.3)`
          : `0 4px 20px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 border-2 border-gray-900"
        style={{ backgroundColor: '#22c55e', left: -6 }}
      />

      {/* Header with OpenTelemetry logo */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <div
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: `${borderColor}20` }}
          >
            <OpenTelemetryLogo size={28} />
          </div>
          {/* Type badge overlay */}
          <span 
            className="absolute -bottom-1 -right-1 text-[10px] bg-gray-900 rounded-full px-1 border"
            style={{ borderColor, color: borderColor }}
          >
            {isGateway ? 'GW' : 'AG'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {data.label}
          </div>
          <div
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium mt-0.5"
            style={{
              backgroundColor: `${borderColor}15`,
              color: borderColor,
            }}
          >
            {isGateway ? 'Gateway' : 'Agent'}
          </div>
        </div>
        {/* Info button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowHint(!showHint);
          }}
          className={`
            p-1 rounded-md transition-colors
            ${showHint 
              ? 'bg-cyan-500/20 text-cyan-400' 
              : 'text-gray-500 hover:text-cyan-400 hover:bg-gray-800'
            }
          `}
        >
          <Info size={14} />
        </button>
      </div>

      {/* Contextual Hint Panel */}
      <AnimatePresence>
        {showHint && hint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 p-2 bg-gray-800/80 rounded-lg border border-gray-700 overflow-hidden"
          >
            <p className="text-[10px] text-gray-400 mb-1.5">{hint.purpose}</p>
            
            {/* Deployment-specific note */}
            {deploymentNote && (
              <div className="flex items-start gap-1.5 p-1.5 bg-cyan-500/10 rounded border border-cyan-500/20 mb-1.5">
                <Lightbulb size={10} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-cyan-300">{deploymentNote}</p>
              </div>
            )}

            {/* Best practices preview */}
            <ul className="space-y-0.5 mb-1.5">
              {hint.bestPractices.slice(0, 2).map((practice, i) => (
                <li key={i} className="flex items-start gap-1 text-[10px] text-gray-500">
                  <CheckCircle2 size={8} className="text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{practice}</span>
                </li>
              ))}
            </ul>

            {/* Docs link */}
            <a
              href={hint.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300"
            >
              <ExternalLink size={10} />
              Documentation
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDOT Components - Always Visible */}
      <div className="space-y-2.5">
        {/* Receivers Section */}
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowDownToLine size={10} className="text-green-400" />
            <span className="text-[9px] font-semibold text-green-400 uppercase tracking-wide">
              Receivers
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {enabledReceivers.map((receiver) => {
              const info = RECEIVER_INFO[receiver.type] || { iconType: 'logstashInput', label: receiver.type };
              return (
                <motion.div
                  key={receiver.type}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 group cursor-default"
                  title={info.description}
                >
                  <EuiIcon type={info.iconType} size="s" color="#22c55e" />
                  <span className="text-[9px] text-green-400 font-medium">{info.label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Processors Section */}
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Cpu size={10} className="text-blue-400" />
            <span className="text-[9px] font-semibold text-blue-400 uppercase tracking-wide">
              Processors
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {enabledProcessors.map((processor, index) => {
              const info = PROCESSOR_INFO[processor.type] || { iconType: 'gear', label: processor.type };
              return (
                <motion.div
                  key={processor.type}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 cursor-default"
                  title={info.description}
                >
                  <EuiIcon type={info.iconType} size="s" color="#3b82f6" />
                  <span className="text-[9px] text-blue-400 font-medium">{info.label}</span>
                </motion.div>
              );
            })}
          </div>
          {/* Processing order indicator */}
          <div className="mt-1.5 flex items-center gap-0.5 text-[8px] text-gray-500">
            <span>Pipeline:</span>
            {enabledProcessors.map((p, i) => {
              const info = PROCESSOR_INFO[p.type] || { iconType: 'gear' };
              return (
                <span key={p.type} className="flex items-center">
                  {i > 0 && <span className="mx-0.5">→</span>}
                  <EuiIcon type={info.iconType} size="s" color="#9ca3af" />
                </span>
              );
            })}
          </div>
        </div>

        {/* Exporters Section */}
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowUpFromLine size={10} className="text-amber-400" />
            <span className="text-[9px] font-semibold text-amber-400 uppercase tracking-wide">
              Exporters
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {enabledExporters.map((exporter) => {
              const info = EXPORTER_INFO[exporter.type] || { iconType: 'logstashOutput', label: exporter.type };
              return (
                <motion.div
                  key={exporter.type}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 cursor-default"
                  title={info.description}
                >
                  <EuiIcon type={info.iconType} size="s" color="#f59e0b" />
                  <span className="text-[9px] text-amber-400 font-medium">{info.label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Throughput indicator */}
      {data.throughput && (
        <div className="mt-2.5 pt-2 border-t border-gray-700/50">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-amber-400">T: {data.throughput.traces}/s</span>
            <span className="text-blue-400">M: {data.throughput.metrics}/s</span>
            <span className="text-emerald-400">L: {data.throughput.logs}/s</span>
          </div>
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-gray-900"
        style={{ backgroundColor: borderColor, right: -6 }}
      />

      {/* Glow effect with breathing animation */}
      {selected && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            boxShadow: [
              `0 0 20px ${borderColor}20`,
              `0 0 30px ${borderColor}30`,
              `0 0 20px ${borderColor}20`
            ]
          }}
          transition={{ 
            opacity: { duration: 0.2 },
            boxShadow: { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }}
          style={{
            background: `radial-gradient(ellipse at center, ${borderColor}10 0%, transparent 70%)`,
          }}
        />
      )}
    </motion.div>
  );
});

CollectorNode.displayName = 'CollectorNode';
