'use client';

import { memo } from 'react';
import { Handle, Position, NodeResizer, type Node } from '@xyflow/react';
import { motion } from 'framer-motion';
import { EuiIcon } from '@elastic/eui';
import type { K8sNamespaceNodeData } from '../../types';

interface K8sNamespaceNodeProps {
  data: K8sNamespaceNodeData;
  selected?: boolean;
}

export const K8sNamespaceNode = memo(({ data, selected }: K8sNamespaceNodeProps) => {
  const borderColor = '#326ce5'; // Kubernetes blue

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`
        infrastructure-node
        relative px-4 py-3 rounded-xl bg-gray-900/60 backdrop-blur
        border-2 border-dashed
        ${selected ? 'ring-2 ring-blue-400/50 ring-offset-2 ring-offset-gray-950' : ''}
      `}
      style={{
        borderColor,
        width: '100%',
        height: '100%',
        minWidth: 500,
        minHeight: 350,
        boxShadow: selected
          ? `0 0 20px ${borderColor}40, 0 4px 20px rgba(0,0,0,0.3)`
          : `0 4px 20px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Resize handles - visible when selected */}
      <NodeResizer
        isVisible={selected}
        minWidth={500}
        minHeight={350}
        color={borderColor}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 2,
          backgroundColor: borderColor,
          border: 'none',
        }}
        lineStyle={{
          borderColor: borderColor,
          borderWidth: 1,
        }}
      />
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="p-2 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${borderColor}20` }}
        >
          <EuiIcon type="logoKubernetes" size="l" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            Kubernetes Namespace
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {data.name}
          </div>
        </div>
      </div>

      {/* Labels */}
      {data.labels && Object.keys(data.labels).length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Labels:</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(data.labels).map(([key, value]) => (
              <div
                key={key}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-mono"
              >
                {key}={value}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Container area hint */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-24">
        <div className="text-sm text-gray-600 text-center">
          ☸️ Drop K8s resources here (DaemonSets, Deployments)
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div className="absolute bottom-2 left-4 right-4 text-xs text-gray-500">
          {data.description}
        </div>
      )}

      {/* No handles - children will handle connections */}

      {/* Glow effect when selected */}
      {selected && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: `radial-gradient(ellipse at center, ${borderColor}10 0%, transparent 70%)`,
          }}
        />
      )}
    </motion.div>
  );
});

K8sNamespaceNode.displayName = 'K8sNamespaceNode';
