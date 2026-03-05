'use client';

import { memo } from 'react';
import { Handle, Position, NodeResizer, type Node } from '@xyflow/react';
import { motion } from 'framer-motion';
import { EuiIcon } from '@elastic/eui';
import type { K8sDeploymentNodeData } from '../../types';
import { useNodeColors } from '../../hooks/useNodeColors';

interface K8sDeploymentNodeProps {
  data: K8sDeploymentNodeData;
  selected?: boolean;
}

export const K8sDeploymentNode = memo(({ data, selected }: K8sDeploymentNodeProps) => {
  const borderColor = '#326ce5'; // Kubernetes blue
  const nodeColors = useNodeColors();

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`
        infrastructure-node
        relative px-5 py-4 rounded-xl bg-white/90 dark:bg-gray-900/70 backdrop-blur
        border-2 border-dashed
        ${selected ? 'ring-2 ring-blue-400/50 ring-offset-2 ring-offset-white dark:ring-offset-gray-950' : ''}
      `}
      style={{
        borderColor,
        width: '100%',
        height: '100%',
        minWidth: 280,
        minHeight: 200,
        boxShadow: selected
          ? `0 0 20px ${borderColor}40, 0 4px 20px rgba(15,23,42,0.12)`
          : `0 4px 16px rgba(15,23,42,0.08)`,
      }}
    >
      {/* Resize handles - visible when selected */}
      <NodeResizer
        isVisible={selected}
        minWidth={280}
        minHeight={200}
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
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="p-2.5 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${borderColor}20` }}
        >
          <EuiIcon type="logoKubernetes" size="l" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-600 dark:text-gray-500 uppercase tracking-wide">
            Kubernetes Deployment
          </div>
          <div className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">
            {data.name}
          </div>
        </div>
        <div className="px-2 py-1 rounded bg-pink-500/20 text-[13px] font-medium" style={{ color: nodeColors.accent }}>
          For EDOT Gateways
        </div>
      </div>

      {/* Namespace and Replicas */}
      <div className="flex gap-4 mb-2">
        <div className="flex-1">
          <div className="text-sm text-gray-600 dark:text-gray-500">Namespace:</div>
          <div className="text-[15px] text-gray-700 dark:text-gray-300 font-mono">{data.namespace}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-500">Replicas:</div>
          <div className="text-[15px] font-mono font-semibold" style={{ color: nodeColors.accentSecondary }}>{data.replicas}</div>
        </div>
      </div>

      {/* Resources */}
      {data.resources && (
        <div className="mb-3">
          <div className="text-sm text-gray-600 dark:text-gray-500 mb-1">Resources:</div>
          <div className="flex gap-3">
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-[13px]" style={{ color: nodeColors.purple }}>
              CPU: {data.resources.cpu}
            </div>
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-[13px]" style={{ color: nodeColors.purple }}>
              Memory: {data.resources.memory}
            </div>
          </div>
        </div>
      )}

      {/* Container area hint */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-20">
        <div className="text-base text-gray-500 dark:text-gray-600 text-center">
          Drop Collector (Gateway) nodes here
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div className="absolute bottom-2 left-4 right-4 text-sm text-gray-600 dark:text-gray-500">
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

K8sDeploymentNode.displayName = 'K8sDeploymentNode';
