'use client';

import { memo, useState } from 'react';
import { Handle, Position, type Node } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, ExternalLink, CheckCircle2, Lightbulb } from 'lucide-react';
import { EuiIcon } from '@elastic/eui';
import type { ElasticNodeData } from '../../types';
import { DEPLOYMENT_MODEL_CONFIG } from '../../types';
import { useFlowStore } from '../../store/flowStore';
import { getComponentHint } from '../../data/component-hints';
import { useNodeColors } from '../../hooks/useNodeColors';

interface ElasticNodeProps {
  data: ElasticNodeData;
  selected?: boolean;
}

type FeatureType = 'apm' | 'logs' | 'metrics' | 'profiling';

const FEATURE_CONFIG: Record<FeatureType, {
  iconType: string;
  label: string;
  subtitle: string;
  dotColor: string;
}> = {
  apm: {
    iconType: 'apmTrace',
    label: 'APM',
    subtitle: 'Traces',
    dotColor: '#60a5fa', // blue-400
  },
  metrics: {
    iconType: 'stats',
    label: 'Metrics',
    subtitle: 'Time Series',
    dotColor: '#34d399', // emerald-400
  },
  logs: {
    iconType: 'logstashOutput',
    label: 'Logs',
    subtitle: 'Records',
    dotColor: '#fbbf24', // amber-400
  },
  profiling: {
    iconType: 'inspect',
    label: 'Profiling',
    subtitle: 'Flamegraphs',
    dotColor: '#c084fc', // purple-400
  },
};

export const ElasticNode = memo(({ data, selected }: ElasticNodeProps) => {
  const [showHint, setShowHint] = useState(false);
  const { deploymentModel } = useFlowStore();
  const nodeColors = useNodeColors();
  const hint = getComponentHint('elastic-apm');
  const deploymentNote = hint?.deploymentNotes[deploymentModel];

  // Determine protocol label based on deployment
  const isManagedEndpoint = deploymentModel === 'serverless' || deploymentModel === 'ech';
  const protocolLabel = isManagedEndpoint ? 'via OTLP' : 'via Elasticsearch';

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`
        relative rounded-2xl min-w-[210px] bg-white/90 dark:bg-slate-900/85
        transition-all duration-200
        ${selected ? 'ring-2 ring-blue-400/50 ring-offset-2 ring-offset-white dark:ring-offset-gray-950' : ''}
      `}
      style={{
        backdropFilter: 'blur(12px)',
        border: '2px solid transparent',
        backgroundClip: 'padding-box',
        padding: '18px 22px',
        boxShadow: selected
          ? '0 0 30px rgba(0,191,179,0.3), 0 8px 32px rgba(0,0,0,0.4)'
          : '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      {/* Gradient border overlay */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          padding: '2px',
          background: 'linear-gradient(135deg, #00bfb3 0%, #0077cc 100%)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-4 h-4 border-2 border-white dark:border-gray-900"
        style={{
          background: 'linear-gradient(135deg, #00bfb3 0%, #0077cc 100%)',
          left: -8,
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <motion.div
            className="absolute inset-0 rounded-lg"
            animate={{
              boxShadow: [
                '0 0 8px rgba(0,191,179,0.4)',
                '0 0 16px rgba(0,191,179,0.6)',
                '0 0 8px rgba(0,191,179,0.4)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="relative w-11 h-11 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#00bfb3] to-[#0077cc]">
            <EuiIcon type="logoObservability" size="l" color="ghost" />
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-gray-900 dark:text-white tracking-wide">{data.label}</div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Observability</div>
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
              ? 'bg-cyan-500/20' 
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'
            }
          `}
          style={showHint ? { color: nodeColors.accentSecondary } : undefined}
        >
          <Info size={16} />
        </button>
      </div>

      {/* Contextual Hint Panel */}
      <AnimatePresence>
        {showHint && hint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 p-2 bg-gray-100/80 dark:bg-black/30 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden"
          >
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1.5">{hint.purpose}</p>
            {deploymentNote && (
              <div className="flex items-start gap-1.5 p-1.5 bg-cyan-500/10 rounded border border-cyan-500/20 mb-1.5">
                <Lightbulb size={10} className="mt-0.5 flex-shrink-0" style={{ color: nodeColors.accentSecondary }} />
                <p className="text-[10px]" style={{ color: nodeColors.accentSecondary }}>{deploymentNote}</p>
              </div>
            )}
            <ul className="space-y-0.5 mb-1.5">
              {hint.bestPractices.slice(0, 2).map((practice, i) => (
                <li key={i} className="flex items-start gap-1 text-[10px] text-gray-600 dark:text-gray-500">
                  <CheckCircle2 size={8} className="mt-0.5 flex-shrink-0" style={{ color: nodeColors.success }} />
                  <span>{practice}</span>
                </li>
              ))}
            </ul>
            <a
              href={hint.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px]"
              style={{ color: nodeColors.accentSecondary }}
            >
              <ExternalLink size={10} />
              Documentation
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feature sections — stacked rows */}
      <div className="space-y-1.5">
        {data.features.map((feature, index) => {
          const cfg = FEATURE_CONFIG[feature];
          if (!cfg) return null;
          return (
            <motion.div
              key={feature}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
              style={{
                background: `${cfg.dotColor}10`,
                border: `1px solid ${cfg.dotColor}25`,
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: cfg.dotColor,
                  boxShadow: `0 0 6px ${cfg.dotColor}80`,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{cfg.label}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">{cfg.subtitle}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Protocol indicator */}
      <div className="mt-3 text-center">
        <span className="text-[11px] text-gray-600 dark:text-gray-500 italic">{protocolLabel}</span>
      </div>

      {/* Throughput indicator */}
      {data.throughput && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-white/10">
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Ingestion Rate</div>
          <div className="flex items-center justify-between text-[11px]">
            <span style={{ color: nodeColors.warning }}>
              {data.throughput.traces + data.throughput.metrics + data.throughput.logs}/s total
            </span>
          </div>
        </div>
      )}

      {/* Animated background particles */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-cyan-400/20"
            initial={{
              x: Math.random() * 180,
              y: Math.random() * 150,
            }}
            animate={{
              x: [null, Math.random() * 180],
              y: [null, Math.random() * 150],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  );
});

ElasticNode.displayName = 'ElasticNode';
