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
import { useNodeColors } from '../../hooks/useNodeColors';

interface EDOTSDKNodeProps {
  data: SDKNodeData;
  selected?: boolean;
}

export const EDOTSDKNode = memo(({ data, selected }: EDOTSDKNodeProps) => {
  const langConfig = SDK_LANGUAGE_CONFIG[data.language] || SDK_LANGUAGE_CONFIG.nodejs;
  const [showHint, setShowHint] = useState(false);
  const { deploymentModel } = useFlowStore();
  const nodeColors = useNodeColors();
  const hint = getComponentHint('edot-sdk');
  const deploymentNote = hint?.deploymentNotes[deploymentModel];

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`
        relative px-6 py-5 rounded-2xl bg-white/90 dark:bg-slate-900/85
        transition-all duration-200
        ${selected ? 'ring-2 ring-blue-400/50 ring-offset-2 ring-offset-white dark:ring-offset-gray-950' : ''}
      `}
      style={{
        border: `2px solid ${langConfig.color}50`,
        backdropFilter: 'blur(12px)',
        width: '100%',
        height: '100%',
        minWidth: 200,
        minHeight: 124,
        boxShadow: selected
          ? `0 0 24px ${langConfig.color}30, 0 8px 32px rgba(0,0,0,0.4)`
          : `0 8px 32px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Resize handles */}
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={124}
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

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-gray-400 dark:bg-gray-600 border-2 border-white dark:border-gray-900 opacity-50"
        style={{ left: -6 }}
      />

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="relative">
          <OpenTelemetryLogo size={34} />
          <span 
            className="absolute -bottom-1 -right-1 text-[11px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-full w-5 h-5 flex items-center justify-center border"
            style={{ borderColor: langConfig.color }}
          >
            {langConfig.icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-gray-900 dark:text-white truncate tracking-wide">
            {data.label}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{langConfig.label}</span>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                color: langConfig.color,
                background: `${langConfig.color}15`,
                border: `1px solid ${langConfig.color}30`,
              }}
            >
              OTel SDK
            </span>
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
              ? 'bg-cyan-500/20' 
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
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
            className="mb-2 p-2 bg-gray-100/80 dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
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

      {/* Service name */}
      <div className="flex items-center gap-1.5 text-sm mb-2.5">
        <span className="text-gray-500 dark:text-gray-500">service:</span>
        <span className="text-gray-700 dark:text-gray-300 font-mono font-medium">{data.serviceName}</span>
      </div>

      {/* Auto-instrumentation badge */}
      {data.autoInstrumented && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/25 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[11px] font-medium" style={{ color: nodeColors.success }}>
            Auto-instrumented
          </span>
        </div>
      )}

      {/* Telemetry type dots */}
      <div className="flex items-center gap-2 mt-1">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]" title="Traces" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" title="Metrics" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]" title="Logs" />
      </div>

      {/* Throughput indicator (when available) */}
      {data.throughput && (
        <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-700/30">
          <div className="flex items-center justify-between text-[11px]">
            <span style={{ color: nodeColors.warning }}>T: {data.throughput.traces}/s</span>
            <span style={{ color: nodeColors.primary }}>M: {data.throughput.metrics}/s</span>
            <span style={{ color: nodeColors.success }}>L: {data.throughput.logs}/s</span>
          </div>
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-white dark:border-gray-900"
        style={{
          backgroundColor: langConfig.color,
          right: -6,
        }}
      />

      {/* Glow effect when selected */}
      {selected && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
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
            background: `radial-gradient(ellipse at center, ${langConfig.color}08 0%, transparent 70%)`,
          }}
        />
      )}
    </motion.div>
  );
});

EDOTSDKNode.displayName = 'EDOTSDKNode';
