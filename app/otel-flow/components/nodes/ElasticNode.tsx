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

interface ElasticNodeProps {
  data: ElasticNodeData;
  selected?: boolean;
}

type FeatureType = 'apm' | 'logs' | 'metrics' | 'profiling';

// EUI icon types for each feature
const featureIconTypes: Record<FeatureType, string> = {
  apm: 'apmTrace',
  logs: 'logsApp',
  metrics: 'visAreaStacked',
  profiling: 'visBarVerticalStacked',
};

const featureLabels: Record<FeatureType, string> = {
  apm: 'APM',
  logs: 'Logs',
  metrics: 'Metrics',
  profiling: 'Profiling',
};

export const ElasticNode = memo(({ data, selected }: ElasticNodeProps) => {
  const [showHint, setShowHint] = useState(false);
  const { deploymentModel } = useFlowStore();
  const hint = getComponentHint('elastic-apm');
  const deploymentNote = hint?.deploymentNotes[deploymentModel];

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`
        relative px-4 py-4 rounded-xl shadow-lg min-w-[200px]
        transition-all duration-200
        ${selected ? 'ring-2 ring-blue-400/50 ring-offset-2 ring-offset-gray-950' : ''}
      `}
      style={{
        background: 'linear-gradient(135deg, rgba(0,191,179,0.15) 0%, rgba(0,119,204,0.15) 100%)',
        border: '2px solid transparent',
        backgroundClip: 'padding-box',
        boxShadow: selected
          ? '0 0 30px rgba(0,191,179,0.3), 0 4px 20px rgba(0,0,0,0.3)'
          : '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      {/* Gradient border overlay */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
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
        className="w-4 h-4 border-2 border-gray-900"
        style={{
          background: 'linear-gradient(135deg, #00bfb3 0%, #0077cc 100%)',
          left: -8,
        }}
      />

      {/* Header with Elastic branding */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          {/* Animated glow ring */}
          <motion.div
            className="absolute inset-0 rounded-lg"
            animate={{
              boxShadow: [
                '0 0 10px rgba(0,191,179,0.5)',
                '0 0 20px rgba(0,191,179,0.8)',
                '0 0 10px rgba(0,191,179,0.5)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div
            className="relative w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#00bfb3] to-[#0077cc]"
          >
            {/* Elastic Observability Logo from EUI */}
            <EuiIcon type="logoObservability" size="l" color="ghost" />
          </div>
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">{data.label}</div>
          <div className="text-xs text-gray-400">Observability Platform</div>
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
              : 'text-gray-500 hover:text-cyan-400 hover:bg-white/10'
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
            className="mb-3 p-2 bg-black/30 rounded-lg border border-white/10 overflow-hidden"
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

      {/* Feature badges with EUI icons */}
      <div className="grid grid-cols-2 gap-1.5">
        {data.features.map((feature, index) => {
          const iconType = featureIconTypes[feature];
          return (
            <motion.div
              key={feature}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <EuiIcon type={iconType} size="s" color="#22d3ee" />
              <span className="text-[10px] text-gray-300 font-medium">
                {featureLabels[feature]}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Throughput indicator */}
      {data.throughput && (
        <div className="mt-3 pt-2 border-t border-white/10">
          <div className="text-[10px] text-gray-400 mb-1">Ingestion Rate</div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-amber-400">
              {data.throughput.traces + data.throughput.metrics + data.throughput.logs}/s total
            </span>
          </div>
        </div>
      )}

      {/* Animated background particles */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-cyan-400/30"
            initial={{
              x: Math.random() * 200,
              y: Math.random() * 100,
            }}
            animate={{
              x: [null, Math.random() * 200],
              y: [null, Math.random() * 100],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* No output handle - Elastic is the sink */}
    </motion.div>
  );
});

ElasticNode.displayName = 'ElasticNode';
