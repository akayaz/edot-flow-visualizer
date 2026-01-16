'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { nanoid } from 'nanoid';
import { EuiIcon } from '@elastic/eui';
import { useFlowStore } from '../../store/flowStore';
import { OpenTelemetryLogo } from '../icons/OpenTelemetryLogo';
import type { PaletteItem, EDOTNodeData, SDKLanguage } from '../../types';
import { SDK_LANGUAGE_CONFIG } from '../../types';

// Icon components for palette items
const PaletteIcon = ({ type }: { type: string }) => {
  switch (type) {
    // EDOT Components
    case 'edot-sdk':
    case 'collector-agent':
    case 'collector-gateway':
      return <OpenTelemetryLogo size={24} />;
    case 'elastic-apm':
      return <EuiIcon type="logoObservability" size="l" />;
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
        ],
        processors: [
          { type: 'memory_limiter', enabled: true },
          { type: 'batch', enabled: true },
        ],
        exporters: [{ type: 'elasticsearch', enabled: true }],
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
          { type: 'batch', enabled: true },
          { type: 'tail_sampling', enabled: true },
        ],
        exporters: [{ type: 'elasticsearch', enabled: true }],
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

export const ComponentPalette = memo(() => {
  const { isPaletteOpen, togglePalette, addNode, nodes } = useFlowStore();

  // Use DragEvent from global scope, not React's DragEvent, to be compatible with motion.div
  const handleDragStart = (e: DragEvent, item: PaletteItem) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData('application/reactflow', JSON.stringify(item));
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleQuickAdd = (item: PaletteItem, language?: SDKLanguage) => {
    // Calculate position based on existing nodes
    const maxX = Math.max(...nodes.map((n) => n.position.x), 0);
    const avgY =
      nodes.length > 0
        ? nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length
        : 200;

    // Map component type to node type
    const nodeType =
      item.type === 'edot-sdk'
        ? 'edotSdk'
        : item.type === 'elastic-apm'
        ? 'elasticApm'
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
      position: { x: maxX + 250, y: avgY },
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
        className="absolute top-1/2 left-0 z-20 -translate-y-1/2 bg-gray-800/90 backdrop-blur hover:bg-gray-700 p-2 rounded-r-lg border border-l-0 border-gray-700 shadow-lg"
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.95 }}
      >
        {isPaletteOpen ? (
          <ChevronLeft size={16} className="text-gray-400" />
        ) : (
          <ChevronRight size={16} className="text-gray-400" />
        )}
      </motion.button>

      <AnimatePresence>
        {isPaletteOpen && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute top-4 left-4 z-10 w-64 bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-700/50">
              <h3 className="font-semibold text-white text-sm">Components</h3>
              <p className="text-xs text-gray-400 mt-1">
                Drag to canvas or click to add
              </p>
            </div>

            {/* Component list */}
            <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* EDOT Components Section */}
              <div>
                <div className="px-2 py-1.5 text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  EDOT Components
                </div>
                <div className="space-y-1.5">
                  {paletteItems.map((item, index) => (
                    <motion.div
                      key={item.type}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03, type: 'spring', stiffness: 400, damping: 25 }}
                      draggable
                      onDragStart={(e) => handleDragStart(e as unknown as DragEvent, item)}
                      onClick={() => handleQuickAdd(item)}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800/80 cursor-grab active:cursor-grabbing group transition-all duration-200"
                    >
                      <div className="p-2 bg-gray-800 rounded-xl group-hover:bg-gray-700 group-hover:shadow-lg transition-all duration-200 flex items-center justify-center">
                        <PaletteIcon type={item.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white group-hover:text-cyan-50 transition-colors">
                          {item.label}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {item.description}
                        </div>
                      </div>
                      <GripVertical
                        size={14}
                        className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Gradient Divider */}
              <div className="divider-gradient" />

              {/* Infrastructure Section */}
              <div>
                <div className="px-2 py-1.5 text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  Infrastructure
                </div>
                <div className="space-y-1.5">
                  {infrastructureItems.map((item, index) => (
                    <motion.div
                      key={item.type}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (paletteItems.length + index) * 0.03, type: 'spring', stiffness: 400, damping: 25 }}
                      draggable
                      onDragStart={(e) => handleDragStart(e as unknown as DragEvent, item)}
                      onClick={() => handleQuickAdd(item)}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800/80 cursor-grab active:cursor-grabbing group transition-all duration-200"
                    >
                      <div className="p-2 bg-gray-800 rounded-xl group-hover:bg-gray-700 group-hover:shadow-lg transition-all duration-200 flex items-center justify-center">
                        <PaletteIcon type={item.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white group-hover:text-cyan-50 transition-colors">
                          {item.label}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {item.description}
                        </div>
                      </div>
                      <GripVertical
                        size={14}
                        className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* SDK Language Presets */}
            <div className="p-4 border-t border-gray-700/50 bg-gray-800/30">
              <div className="text-xs text-gray-400 mb-3 font-medium flex items-center gap-2">
                <OpenTelemetryLogo size={16} />
                Quick Add SDK
              </div>
              <div className="flex flex-wrap gap-2">
                {languageOptions.map((lang) => (
                  <motion.button
                    key={lang.value}
                    onClick={() => handleQuickAdd(paletteItems[0], lang.value)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs border border-gray-700 hover:border-gray-600 transition-colors"
                    style={{
                      borderColor: `${SDK_LANGUAGE_CONFIG[lang.value].color}30`,
                    }}
                  >
                    <span>{lang.icon}</span>
                    <span className="text-gray-300">{lang.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

ComponentPalette.displayName = 'ComponentPalette';
