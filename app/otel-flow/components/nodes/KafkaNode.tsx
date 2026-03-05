'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { EuiIcon } from '@elastic/eui';
import type { KafkaNodeData, KafkaAuthType } from '../../types';
import { useFlowStore } from '../../store/flowStore';
import { useThemeStore } from '../../store/themeStore';
import { DEPLOYMENT_MODEL_CONFIG } from '../../types';
import { useNodeColors } from '../../hooks/useNodeColors';

interface KafkaNodeProps {
  data: KafkaNodeData;
  selected?: boolean;
}

const KAFKA_COLOR = '#7B42BC';

const AUTH_LABELS: Record<KafkaAuthType, string> = {
  'none': 'No Auth',
  'sasl-plain': 'SASL/PLAIN',
  'sasl-scram256': 'SCRAM-256',
  'sasl-scram512': 'SCRAM-512',
  'tls': 'mTLS',
  'kerberos': 'Kerberos',
};

const KafkaLogo = ({ size = 24 }: { size?: number }): JSX.Element => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Kafka-style logo: simplified streaming lines */}
    <circle cx="12" cy="8" r="2.5" fill={KAFKA_COLOR} opacity="0.9" />
    <circle cx="7" cy="16" r="2.5" fill={KAFKA_COLOR} opacity="0.9" />
    <circle cx="17" cy="16" r="2.5" fill={KAFKA_COLOR} opacity="0.9" />
    <line x1="12" y1="10.5" x2="8.5" y2="14" stroke={KAFKA_COLOR} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="10.5" x2="15.5" y2="14" stroke={KAFKA_COLOR} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="9.5" y1="16" x2="14.5" y2="16" stroke={KAFKA_COLOR} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const KafkaNode = memo(({ data, selected }: KafkaNodeProps) => {
  const { deploymentModel } = useFlowStore();
  const { resolvedTheme } = useThemeStore();
  const nodeColors = useNodeColors();
  const deploymentConfig = DEPLOYMENT_MODEL_CONFIG[deploymentModel];
  const supportsKafka = deploymentConfig.features.supportsKafkaTier;

  const brokerCount = data.brokers?.length || 1;
  const hasAuth = data.auth !== 'none';

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`
        relative px-5 py-4 rounded-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur
        border-2 shadow-lg min-w-[240px] max-w-[320px]
        transition-all duration-200
        ${selected ? 'ring-2 ring-purple-400/50 ring-offset-2 ring-offset-white dark:ring-offset-gray-950' : ''}
      `}
      style={{
        borderColor: KAFKA_COLOR,
        boxShadow: selected
          ? (resolvedTheme === 'dark'
            ? `0 0 20px ${KAFKA_COLOR}40, 0 4px 20px rgba(0,0,0,0.3)`
            : `0 0 20px ${KAFKA_COLOR}26, 0 4px 16px rgba(15,23,42,0.12)`)
          : (resolvedTheme === 'dark' ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.08)'),
      }}
    >
      {/* Input handle - receives from kafkaexporter */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 border-2 border-white dark:border-gray-900"
        style={{ backgroundColor: '#22c55e', left: -6 }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <div
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: `${KAFKA_COLOR}20` }}
          >
            <KafkaLogo size={32} />
          </div>
          {/* Broker count badge */}
          <span
            className="absolute -bottom-1 -right-1 text-[11px] bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-full px-1.5 border font-medium"
            style={{ borderColor: KAFKA_COLOR, color: nodeColors.purple }}
          >
            {brokerCount}B
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">
            {data.label}
          </div>
          <div
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium mt-0.5"
            style={{
              backgroundColor: `${KAFKA_COLOR}15`,
              color: nodeColors.purple,
            }}
          >
            Kafka Broker
          </div>
        </div>
      </div>

      {/* Kafka Details */}
      <div className="space-y-2.5">
        {/* Cluster Info */}
        <div className="bg-gray-100/70 dark:bg-gray-800/50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <EuiIcon type="compute" size="m" color={nodeColors.purple} />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: nodeColors.purple }}>
              Cluster
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 cursor-default"
              title={`Cluster: ${data.clusterName}`}
            >
              <EuiIcon type="database" size="m" color={nodeColors.purple} />
              <span className="text-[10px] font-medium" style={{ color: nodeColors.purple }}>{data.clusterName}</span>
            </motion.div>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 cursor-default"
              title={`${brokerCount} broker(s): ${data.brokers?.join(', ')}`}
            >
              <EuiIcon type="compute" size="m" color={nodeColors.purple} />
              <span className="text-[10px] font-medium" style={{ color: nodeColors.purple }}>{brokerCount} broker{brokerCount !== 1 ? 's' : ''}</span>
            </motion.div>
            {hasAuth && (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 cursor-default"
                title={`Authentication: ${AUTH_LABELS[data.auth]}`}
              >
                <EuiIcon type="lock" size="m" color={nodeColors.success} />
                <span className="text-[10px] font-medium" style={{ color: nodeColors.success }}>{AUTH_LABELS[data.auth]}</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Topics Section */}
        <div className="bg-gray-100/70 dark:bg-gray-800/50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <EuiIcon type="layers" size="m" color={nodeColors.purple} />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: nodeColors.purple }}>
              Topics
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 cursor-default"
              title={`Traces topic: ${data.topics?.traces}`}
            >
              <span className="text-[10px] font-medium" style={{ color: nodeColors.warning }}>T: {data.topics?.traces || 'otlp_spans'}</span>
            </motion.div>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 cursor-default"
              title={`Metrics topic: ${data.topics?.metrics}`}
            >
              <span className="text-[10px] font-medium" style={{ color: nodeColors.primary }}>M: {data.topics?.metrics || 'otlp_metrics'}</span>
            </motion.div>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 cursor-default"
              title={`Logs topic: ${data.topics?.logs}`}
            >
              <span className="text-[10px] font-medium" style={{ color: nodeColors.success }}>L: {data.topics?.logs || 'otlp_logs'}</span>
            </motion.div>
          </div>
        </div>

        {/* Encoding & Compression */}
        <div className="flex items-center gap-1.5 px-2">
          <span
            className="text-[10px] px-2 py-0.5 rounded font-medium"
            style={{
              backgroundColor: `${KAFKA_COLOR}15`,
              color: nodeColors.purple,
            }}
          >
            {data.encoding || 'otlp_proto'}
          </span>
          {data.compression && data.compression !== 'none' && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium">
              {data.compression}
            </span>
          )}
        </div>
      </div>

      {/* Throughput indicator */}
      {data.throughput && (data.throughput.traces + data.throughput.metrics + data.throughput.logs > 0) && (
        <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center justify-between text-[11px]">
            <span style={{ color: nodeColors.warning }}>T: {data.throughput.traces}/s</span>
            <span style={{ color: nodeColors.primary }}>M: {data.throughput.metrics}/s</span>
            <span style={{ color: nodeColors.success }}>L: {data.throughput.logs}/s</span>
          </div>
        </div>
      )}

      {/* Output handle - sends to kafkareceiver */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-white dark:border-gray-900"
        style={{ backgroundColor: KAFKA_COLOR, right: -6 }}
      />

      {/* Glow effect on selection */}
      {selected && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            boxShadow: `0 0 25px ${KAFKA_COLOR}28`,
          }}
          transition={{
            opacity: { duration: 0.2 },
            boxShadow: { duration: 0.3 },
          }}
          style={{
            background: `radial-gradient(ellipse at center, ${KAFKA_COLOR}10 0%, transparent 70%)`,
          }}
        />
      )}
    </motion.div>
  );
});

KafkaNode.displayName = 'KafkaNode';
