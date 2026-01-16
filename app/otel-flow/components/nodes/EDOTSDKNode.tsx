'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeResizer, type Node } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, ExternalLink, CheckCircle2, Lightbulb } from 'lucide-react';
import { OpenTelemetryLogo } from '../icons/OpenTelemetryLogo';
import type { SDKNodeData } from '../../types';
import { SDK_LANGUAGE_CONFIG, DEPLOYMENT_MODEL_CONFIG } from '../../types';
import { useFlowStore } from '../../store/flowStore';
import { getComponentHint } from '../../data/component-hints';

interface EDOTSDKNodeProps {
  data: SDKNodeData;
  selected?: boolean;
}

export const EDOTSDKNode = memo(({ data, selected }: EDOTSDKNodeProps) => {
  const langConfig = SDK_LANGUAGE_CONFIG[data.language] || SDK_LANGUAGE_CONFIG.nodejs;
  const [showHint, setShowHint] = useState(false);
  const { deploymentModel } = useFlowStore();
  const hint = getComponentHint('edot-sdk');
  const deploymentNote = hint?.deploymentNotes[deploymentModel];

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`
        relative px-4 py-3 rounded-xl bg-gray-900/90 backdrop-blur
        border-2 shadow-lg
        transition-all duration-200
        ${selected ? 'ring-2 ring-blue-400/50 ring-offset-2 ring-offset-gray-950' : ''}
      `}
      style={{
        borderColor: langConfig.color,
        width: '100%',
        height: '100%',
        minWidth: 160,
        minHeight: 100,
        boxShadow: selected
          ? `0 0 20px ${langConfig.color}40, 0 4px 20px rgba(0,0,0,0.3)`
          : `0 4px 20px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Resize handles - visible when selected */}
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={100}
        color={langConfig.color}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: langConfig.color,
          border: 'none',
        }}
        lineStyle={{
          borderColor: langConfig.color,
          borderWidth: 1,
        }}
      />

      {/* Input handle - hidden for SDK (it's typically the source) */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-gray-600 border-2 border-gray-900 opacity-50"
        style={{ left: -6 }}
      />

      {/* Header with OpenTelemetry logo and label */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative">
          <OpenTelemetryLogo size={32} />
          {/* Language badge overlay */}
          <span 
            className="absolute -bottom-1 -right-1 text-xs bg-gray-900 rounded-full w-4 h-4 flex items-center justify-center border"
            style={{ borderColor: langConfig.color }}
          >
            {langConfig.icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {data.label}
          </div>
          <div className="text-xs text-gray-400">{langConfig.label} SDK</div>
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

      {/* Service name */}
      <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
        <span className="opacity-60">service:</span>
        <span className="text-gray-300 font-mono">{data.serviceName}</span>
      </div>

      {/* Auto-instrumentation badge */}
      {data.autoInstrumented && (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400 font-medium">
            Auto-instrumented
          </span>
        </div>
      )}

      {/* Throughput indicator (when available) */}
      {data.throughput && (
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-amber-400">
              T: {data.throughput.traces}/s
            </span>
            <span className="text-blue-400">
              M: {data.throughput.metrics}/s
            </span>
            <span className="text-emerald-400">
              L: {data.throughput.logs}/s
            </span>
          </div>
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-gray-900"
        style={{
          backgroundColor: langConfig.color,
          right: -6,
        }}
      />

      {/* Glow effect when selected with breathing animation */}
      {selected && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            boxShadow: [
              `0 0 20px ${langConfig.color}20`,
              `0 0 30px ${langConfig.color}30`,
              `0 0 20px ${langConfig.color}20`
            ]
          }}
          transition={{ 
            opacity: { duration: 0.2 },
            boxShadow: { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }}
          style={{
            background: `radial-gradient(ellipse at center, ${langConfig.color}10 0%, transparent 70%)`,
          }}
        />
      )}
    </motion.div>
  );
});

EDOTSDKNode.displayName = 'EDOTSDKNode';
