'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { nanoid } from 'nanoid';
import {
  EuiIcon,
  EuiPanel,
  EuiTitle,
  EuiText,
  EuiToolTip,
  EuiHorizontalRule,
  EuiFlexGroup,
  EuiFlexItem,
  EuiBadge,
  EuiSpacer,
} from '@elastic/eui';
import { useFlowStore } from '../../store/flowStore';
import { OpenTelemetryLogo } from '../icons/OpenTelemetryLogo';
import type { PaletteItem, EDOTNodeData, SDKLanguage } from '../../types';
import { SDK_LANGUAGE_CONFIG } from '../../types';

// Icon components for palette items
const PaletteIcon = ({ type }: { type: string }): React.ReactElement | null => {
  switch (type) {
    // EDOT Components
    case 'edot-sdk':
    case 'collector-agent':
    case 'collector-gateway':
      return <OpenTelemetryLogo size={22} />;
    case 'elastic-apm':
      return <EuiIcon type="logoObservability" size="l" />;
    // Kafka
    case 'kafka-broker':
      return <EuiIcon type="logstashQueue" size="l" />;
    // Infrastructure Components
    case 'infrastructure-host':
      return <EuiIcon type="compute" size="l" />;
    case 'infrastructure-docker':
      return <EuiIcon type="logoDocker" size="l" />;
    case 'infrastructure-k8s-namespace':
    case 'infrastructure-k8s-daemonset':
    case 'infrastructure-k8s-deployment':
      return <EuiIcon type="logoKubernetes" size="l" />;
    default:
      return null;
  }
};

const paletteItems: PaletteItem[] = [
  {
    type: 'edot-sdk',
    label: 'EDOT SDK',
    icon: '📦',
    description: 'Instrumented application',
    defaultData: {
      componentType: 'edot-sdk',
      language: 'nodejs',
      serviceName: 'my-service',
      autoInstrumented: true,
    },
  },
  {
    type: 'collector-agent',
    label: 'Collector Agent',
    icon: '📡',
    description: 'Per-host collection',
    defaultData: {
      componentType: 'collector-agent',
      config: {
        receivers: [
          { type: 'otlp', enabled: true },
          { type: 'hostmetrics', enabled: true },
          { type: 'filelog', enabled: true },
        ],
        processors: [
          { type: 'memory_limiter', enabled: true },
          { type: 'resourcedetection', enabled: true },
          { type: 'batch', enabled: true },
        ],
        exporters: [
          { type: 'otlp', enabled: true },
          { type: 'elasticsearch', enabled: false },
        ],
      },
    },
  },
  {
    type: 'collector-gateway',
    label: 'Collector Gateway',
    icon: '🌐',
    description: 'Central processing',
    defaultData: {
      componentType: 'collector-gateway',
      config: {
        receivers: [{ type: 'otlp', enabled: true }],
        processors: [
          { type: 'memory_limiter', enabled: true },
          { type: 'resourcedetection', enabled: true },
          { type: 'batch', enabled: true },
          { type: 'elasticapm', enabled: true },
        ],
        exporters: [
          { type: 'otlp', enabled: false },
          { type: 'elasticsearch', enabled: true },
        ],
      },
    },
  },
  {
    type: 'elastic-apm',
    label: 'Elastic Observability',
    icon: '⚡',
    description: 'Observability backend',
    defaultData: {
      componentType: 'elastic-apm',
      features: ['apm', 'logs', 'metrics', 'profiling'],
    },
  },
];

const infrastructureItems: PaletteItem[] = [
  {
    type: 'infrastructure-host',
    label: 'Host',
    icon: '🖥️',
    description: 'Physical/Virtual machine',
    defaultData: {
      componentType: 'infrastructure-host',
      hostname: 'server-01',
      os: 'linux',
    },
  },
  {
    type: 'infrastructure-docker',
    label: 'Docker Container',
    icon: '🐳',
    description: 'Container runtime',
    defaultData: {
      componentType: 'infrastructure-docker',
      containerName: 'my-app',
      imageName: 'my-app',
      imageTag: 'latest',
      networkMode: 'bridge',
    },
  },
  {
    type: 'kafka-broker',
    label: 'Kafka Broker',
    icon: '📨',
    description: 'Message queue for HA tier',
    defaultData: {
      componentType: 'kafka-broker',
      clusterName: 'otel-kafka',
      brokers: ['kafka-0:9092'],
      topics: {
        traces: 'otlp_spans',
        metrics: 'otlp_metrics',
        logs: 'otlp_logs',
      },
      securityProtocol: 'PLAINTEXT',
    },
  },
  {
    type: 'infrastructure-k8s-namespace',
    label: 'K8s Namespace',
    icon: '☸️',
    description: 'Kubernetes namespace',
    defaultData: {
      componentType: 'infrastructure-k8s-namespace',
      name: 'observability',
    },
  },
  {
    type: 'infrastructure-k8s-daemonset',
    label: 'K8s DaemonSet',
    icon: '📋',
    description: 'K8s DaemonSet (Agents)',
    defaultData: {
      componentType: 'infrastructure-k8s-daemonset',
      name: 'edot-agent',
      namespace: 'observability',
    },
  },
  {
    type: 'infrastructure-k8s-deployment',
    label: 'K8s Deployment',
    icon: '🚀',
    description: 'K8s Deployment (Gateways)',
    defaultData: {
      componentType: 'infrastructure-k8s-deployment',
      name: 'edot-gateway',
      namespace: 'observability',
      replicas: 3,
    },
  },
];

const languageOptions: { value: SDKLanguage; icon: string; label: string }[] = [
  { value: 'nodejs', ...SDK_LANGUAGE_CONFIG.nodejs },
  { value: 'python', ...SDK_LANGUAGE_CONFIG.python },
  { value: 'java', ...SDK_LANGUAGE_CONFIG.java },
  { value: 'dotnet', ...SDK_LANGUAGE_CONFIG.dotnet },
  { value: 'go', ...SDK_LANGUAGE_CONFIG.go },
];

/** Shared palette item row — uses plain elements for text to avoid EuiText width overhead */
const PaletteItemRow = memo(({
  item,
  index,
  onDragStart,
  onClick,
}: {
  item: PaletteItem;
  index: number;
  onDragStart: (e: DragEvent, item: PaletteItem) => void;
  onClick: (item: PaletteItem) => void;
}): React.ReactElement => (
  <motion.div
    key={item.type}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.03, type: 'spring', stiffness: 400, damping: 25 }}
    draggable
    onDragStart={(e) => onDragStart(e as unknown as DragEvent, item)}
    onClick={() => onClick(item)}
    whileHover={{ scale: 1.02, x: 4 }}
    whileTap={{ scale: 0.98 }}
    className="flex items-center gap-3.5 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/80 cursor-grab active:cursor-grabbing group transition-all duration-200"
  >
    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors flex items-center justify-center flex-shrink-0">
      <PaletteIcon type={item.type} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[15px] font-medium leading-5 text-gray-900 dark:text-white truncate">{item.label}</div>
      <div className="text-[13px] leading-5 text-gray-500 dark:text-gray-400 truncate">{item.description}</div>
    </div>
    <GripVertical
      size={16}
      className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
    />
  </motion.div>
));

PaletteItemRow.displayName = 'PaletteItemRow';

export const ComponentPalette = memo((): React.ReactElement => {
  const { isPaletteOpen, togglePalette, addNode, nodes } = useFlowStore();

  const handleDragStart = (e: DragEvent, item: PaletteItem): void => {
    if (e.dataTransfer) {
      e.dataTransfer.setData('application/reactflow', JSON.stringify(item));
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleQuickAdd = (item: PaletteItem, language?: SDKLanguage): void => {
    const maxX = Math.max(...nodes.map((n) => n.position.x), 0);
    const avgY =
      nodes.length > 0
        ? nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length
        : 200;
    const yStagger = nodes.length % 2 === 0 ? -30 : 30;

    const nodeType =
      item.type === 'edot-sdk'
        ? 'edotSdk'
        : item.type === 'elastic-apm'
        ? 'elasticApm'
        : item.type === 'kafka-broker'
        ? 'kafkaBroker'
        : item.type === 'infrastructure-host'
        ? 'infrastructureHost'
        : item.type === 'infrastructure-docker'
        ? 'infrastructureDocker'
        : item.type === 'infrastructure-k8s-namespace'
        ? 'infrastructureK8sNamespace'
        : item.type === 'infrastructure-k8s-daemonset'
        ? 'infrastructureK8sDaemonSet'
        : item.type === 'infrastructure-k8s-deployment'
        ? 'infrastructureK8sDeployment'
        : 'collector';

    const nodeData = language
      ? { ...item.defaultData, language, serviceName: `${language}-service` }
      : item.defaultData;

    const newNode = {
      id: nanoid(),
      type: nodeType,
      position: { x: maxX + 350, y: avgY + yStagger },
      data: {
        label: language
          ? `${SDK_LANGUAGE_CONFIG[language].label} App`
          : `${item.label} ${nodes.filter((n) => n.type === nodeType).length + 1}`,
        ...nodeData,
      } as EDOTNodeData,
    };

    addNode(newNode);
  };

  return (
    <>
      {/* Toggle button */}
      <motion.button
        onClick={togglePalette}
        className="absolute top-1/2 left-0 z-20 -translate-y-1/2"
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.95 }}
        style={{
          padding: '10px 6px',
          borderRadius: '0 6px 6px 0',
          border: 'none',
          cursor: 'pointer',
          background: 'var(--rf-controls-bg)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <EuiIcon
          type={isPaletteOpen ? 'arrowLeft' : 'arrowRight'}
          size="m"
          color="subdued"
        />
      </motion.button>

      <AnimatePresence>
        {isPaletteOpen && (
          <motion.div
            initial={{ x: -340, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -340, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute top-12 left-4 z-10"
            style={{ width: 290 }}
          >
            <EuiPanel hasBorder hasShadow paddingSize="none" style={{ overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--euiColorLightShade, rgba(255,255,255,0.1))' }}>
                <EuiTitle size="xxxs">
                  <h3>Components</h3>
                </EuiTitle>
                <EuiSpacer size="xs" />
                <EuiText size="xs" color="subdued">
                  Drag to canvas or click to add
                </EuiText>
              </div>

              {/* Component list */}
              <div style={{ padding: '4px 6px', maxHeight: '60vh', overflowY: 'auto' }}>
                {/* EDOT Components Section */}
                <div className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  EDOT Components
                </div>
                {paletteItems.map((item, index) => (
                  <PaletteItemRow
                    key={item.type}
                    item={item}
                    index={index}
                    onDragStart={handleDragStart}
                    onClick={handleQuickAdd}
                  />
                ))}

                <EuiHorizontalRule margin="s" />

                {/* Infrastructure Section */}
                <div className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  Infrastructure
                </div>
                {infrastructureItems.map((item, index) => (
                  <PaletteItemRow
                    key={item.type}
                    item={item}
                    index={paletteItems.length + index}
                    onDragStart={handleDragStart}
                    onClick={handleQuickAdd}
                  />
                ))}
              </div>

              {/* SDK Language Presets */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--euiColorLightShade, rgba(255,255,255,0.1))' }}>
                <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <OpenTelemetryLogo size={16} />
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Quick Add SDK</span>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="s" />
                <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
                  {languageOptions.map((lang) => (
                    <EuiFlexItem key={lang.value} grow={false}>
                      <EuiToolTip content={`Add ${lang.label} SDK`} position="bottom">
                        <EuiBadge
                          color="hollow"
                          onClick={() => handleQuickAdd(paletteItems[0], lang.value)}
                          onClickAriaLabel={`Add ${lang.label} SDK`}
                          style={{
                            cursor: 'pointer',
                            borderColor: `${SDK_LANGUAGE_CONFIG[lang.value].color}40`,
                          }}
                        >
                          <span style={{ marginRight: 4 }}>{lang.icon}</span>
                          {lang.label}
                        </EuiBadge>
                      </EuiToolTip>
                    </EuiFlexItem>
                  ))}
                </EuiFlexGroup>
              </div>
            </EuiPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

ComponentPalette.displayName = 'ComponentPalette';
