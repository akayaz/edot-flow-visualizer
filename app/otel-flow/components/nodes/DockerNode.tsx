'use client';

import { memo } from 'react';
import { Handle, Position, NodeResizer, type Node } from '@xyflow/react';
import { motion } from 'framer-motion';
import { EuiIcon } from '@elastic/eui';
import type { DockerNodeData } from '../../types';
import { useNodeColors } from '../../hooks/useNodeColors';

interface DockerNodeProps {
  data: DockerNodeData;
  selected?: boolean;
}

export const DockerNode = memo(({ data, selected }: DockerNodeProps) => {
  const borderColor = '#3b82f6'; // Docker blue
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
        minHeight: 180,
        boxShadow: selected
          ? `0 0 20px ${borderColor}40, 0 4px 20px rgba(15,23,42,0.12)`
          : `0 4px 16px rgba(15,23,42,0.08)`,
      }}
    >
      {/* Resize handles - visible when selected */}
      <NodeResizer
        isVisible={selected}
        minWidth={280}
        minHeight={180}
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
          <EuiIcon type="logoDocker" size="l" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">
            {data.label}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {data.containerName}
          </div>
        </div>
      </div>

      {/* Image info */}
      <div className="mb-3">
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 text-[13px] font-mono" style={{ color: nodeColors.primary }}>
          <EuiIcon type="logoDocker" size="m" />
          {data.imageName}:{data.imageTag}
        </div>
      </div>

      {/* Network mode badge */}
      {data.networkMode && (
        <div className="mb-2">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-[13px]">
            Network: {data.networkMode}
          </div>
        </div>
      )}

      {/* Ports mapping */}
      {data.ports && data.ports.length > 0 && (
        <div className="mb-2">
          <div className="text-sm text-gray-600 dark:text-gray-500 mb-1">Ports:</div>
          <div className="flex flex-wrap gap-1">
            {data.ports.map((port, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-[13px] font-mono"
                style={{ color: nodeColors.primary }}
              >
                {port.host}:{port.container}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Container area hint */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-20">
        <div className="text-base text-gray-500 dark:text-gray-600 text-center">
          Drop EDOT components here
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div className="absolute bottom-2 left-4 right-4 text-sm text-gray-600 dark:text-gray-500 truncate">
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

DockerNode.displayName = 'DockerNode';
