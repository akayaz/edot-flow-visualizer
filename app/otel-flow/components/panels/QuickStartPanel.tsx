'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Rocket, 
  X, 
  Cloud, 
  Building2, 
  HardDrive,
  ArrowRight,
  CheckCircle2,
  Info,
  ExternalLink,
  Layers,
  Box,
  Server,
  AlertTriangle
} from 'lucide-react';
import { useFlowStore } from '../../store/flowStore';
import { DEPLOYMENT_MODEL_CONFIG, type DeploymentModel } from '../../types';
import { DEPLOYMENT_ARCHITECTURES } from '../../data/edot-reference-architecture';

interface QuickStartTemplate {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  pattern: string;
  recommendedFor: DeploymentModel[];
  notRecommendedFor?: DeploymentModel[];
  warning?: string;
  benefits: string[];
  scenarioId: 'simple' | 'agent' | 'gateway' | 'production' | 'kubernetes';
  docsUrl?: string;
}

/**
 * Quick Start Templates based on EDOT Reference Architecture
 * Source: https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms
 * 
 * Key Rules:
 * - Serverless/ECH: Direct SDK→Elastic is valid (Managed OTLP Endpoint)
 * - Serverless/ECH: Gateway is OPTIONAL (for advanced processing)
 * - Self-Managed: Gateway is REQUIRED (replaces APM Server as ingestion layer)
 * - Self-Managed: Agent should send to Gateway, not directly to ES
 */
const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  // ============ SERVERLESS / ECH PATTERNS ============
  {
    id: 'direct-ingest',
    name: 'Direct Ingestion',
    icon: <ArrowRight size={20} />,
    description: 'SDK sends telemetry directly to Elastic via Managed OTLP Endpoint. Simplest setup - no collectors needed.',
    pattern: 'SDK → Elastic (Managed OTLP Endpoint)',
    recommendedFor: ['serverless', 'ech'],
    notRecommendedFor: ['self-managed'],
    warning: 'Not recommended for Self-Managed. Gateway is required as ingestion layer.',
    benefits: [
      'Zero infrastructure to manage',
      'Fastest time to value',
      'Automatic scaling by Elastic',
    ],
    scenarioId: 'simple',
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms',
  },
  {
    id: 'agent-managed',
    name: 'Agent to Managed Endpoint',
    icon: <Box size={20} />,
    description: 'Per-host Agent collector provides host metrics and local buffering. Sends to Managed OTLP Endpoint.',
    pattern: 'SDK → Agent → Elastic (Managed OTLP Endpoint)',
    recommendedFor: ['serverless', 'ech'],
    notRecommendedFor: ['self-managed'],
    warning: 'For Self-Managed, Agent should send to Gateway, not directly to Elasticsearch.',
    benefits: [
      'Host metrics (CPU, memory, disk)',
      'Resource attribute enrichment',
      'Local buffering for reliability',
    ],
    scenarioId: 'agent',
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/edot-collector/modes',
  },
  
  // ============ SELF-MANAGED PATTERNS (Gateway Required) ============
  {
    id: 'self-managed-full',
    name: 'Full Pipeline (Self-Managed)',
    icon: <Layers size={20} />,
    description: 'Complete EDOT pipeline for self-managed. Gateway is REQUIRED as ingestion layer (replaces APM Server).',
    pattern: 'SDK → Agent → Gateway → Elasticsearch',
    recommendedFor: ['self-managed'],
    benefits: [
      'Gateway replaces APM Server',
      'Host metrics from Agent',
      'Tail-based sampling at Gateway',
      'Single egress point',
    ],
    scenarioId: 'gateway',
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/edot-collector/modes#gateway',
  },
  {
    id: 'self-managed-gateway-only',
    name: 'Gateway Only (Self-Managed)',
    icon: <Server size={20} />,
    description: 'SDK sends directly to Gateway. Use when host metrics come from elsewhere (e.g., containerized apps).',
    pattern: 'SDK → Gateway → Elasticsearch',
    recommendedFor: ['self-managed'],
    benefits: [
      'Simpler than full pipeline',
      'Gateway handles ingestion',
      'Good for containers/K8s',
    ],
    scenarioId: 'production',
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms',
  },
  
  // ============ KUBERNETES PATTERN ============
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    icon: <Cloud size={20} />,
    description: 'DaemonSet agents on each node collect pod telemetry. Gateway Deployment for centralized processing.',
    pattern: 'Pods → DaemonSet (Agent) → Deployment (Gateway) → Elastic',
    recommendedFor: ['ech', 'self-managed'],
    benefits: [
      'K8s metadata enrichment (k8sattributes)',
      'Per-node collection via DaemonSet',
      'Scalable Gateway Deployment',
    ],
    scenarioId: 'kubernetes',
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/kubernetes',
  },
];

interface QuickStartPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickStartPanel = memo(({ isOpen, onClose }: QuickStartPanelProps) => {
  const { deploymentModel, setScenario, setDeploymentModel } = useFlowStore();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleApplyTemplate = (template: QuickStartTemplate) => {
    // If template is not recommended for current deployment, switch to first recommended
    if (!template.recommendedFor.includes(deploymentModel)) {
      setDeploymentModel(template.recommendedFor[0]);
    }
    setScenario(template.scenarioId);
    onClose();
  };

  const getDeploymentIcon = (model: DeploymentModel) => {
    switch (model) {
      case 'serverless': return <Cloud size={12} />;
      case 'ech': return <Building2 size={12} />;
      case 'self-managed': return <HardDrive size={12} />;
    }
  };

  // Sort templates: recommended for current deployment first
  const sortedTemplates = [...QUICK_START_TEMPLATES].sort((a, b) => {
    const aRecommended = a.recommendedFor.includes(deploymentModel);
    const bRecommended = b.recommendedFor.includes(deploymentModel);
    if (aRecommended && !bRecommended) return -1;
    if (!aRecommended && bRecommended) return 1;
    return 0;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-10 lg:inset-20 bg-gray-900/98 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl">
                  <Rocket size={24} className="text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Quick Start Templates</h2>
                  <p className="text-sm text-gray-400">
                    Choose an architecture pattern for {DEPLOYMENT_MODEL_CONFIG[deploymentModel].label}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Current Deployment Info */}
            <div className="px-6 py-3 bg-gray-800/50 border-b border-gray-800">
              <div className="flex items-center gap-2 text-sm">
                <Info size={14} className="text-cyan-400" />
                <span className="text-gray-400">Current deployment:</span>
                <span className="flex items-center gap-1 px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-full text-xs font-medium">
                  {getDeploymentIcon(deploymentModel)}
                  {DEPLOYMENT_MODEL_CONFIG[deploymentModel].label}
                </span>
                <span className="text-gray-500">• Templates are sorted by compatibility</span>
              </div>
            </div>

            {/* Templates Grid */}
            <div className="flex-1 overflow-auto p-6">
              {/* Deployment-specific guidance */}
              <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    {deploymentModel === 'self-managed' ? (
                      <p className="text-gray-300">
                        <span className="text-amber-400 font-medium">Self-Managed:</span> Gateway collector is <span className="text-amber-400">required</span> as the ingestion layer (replaces APM Server). 
                        Choose a template with Gateway.
                      </p>
                    ) : (
                      <p className="text-gray-300">
                        <span className="text-cyan-400 font-medium">{DEPLOYMENT_MODEL_CONFIG[deploymentModel].label}:</span> Uses Managed OTLP Endpoint. 
                        Gateway is <span className="text-green-400">optional</span> (only needed for advanced processing like tail sampling).
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedTemplates.map((template) => {
                  const isRecommended = template.recommendedFor.includes(deploymentModel);
                  const isNotRecommended = template.notRecommendedFor?.includes(deploymentModel);
                  const isSelected = selectedTemplate === template.id;

                  return (
                    <motion.div
                      key={template.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setSelectedTemplate(isSelected ? null : template.id)}
                      className={`
                        relative p-4 rounded-xl border cursor-pointer transition-all
                        ${isRecommended 
                          ? 'bg-gray-800/50 border-gray-700 hover:border-cyan-500/50' 
                          : isNotRecommended
                            ? 'bg-amber-900/10 border-amber-500/30 opacity-80'
                            : 'bg-gray-800/30 border-gray-800 opacity-70 hover:opacity-100'
                        }
                        ${isSelected ? 'ring-2 ring-cyan-500 border-cyan-500' : ''}
                      `}
                    >
                      {/* Recommended Badge */}
                      {isRecommended && (
                        <div className="absolute -top-2 -right-2">
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-[10px] font-medium border border-green-500/30">
                            <CheckCircle2 size={10} />
                            Recommended
                          </span>
                        </div>
                      )}

                      {/* Not Recommended Badge */}
                      {isNotRecommended && (
                        <div className="absolute -top-2 -right-2">
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-medium border border-amber-500/30">
                            <AlertTriangle size={10} />
                            Not for {DEPLOYMENT_MODEL_CONFIG[deploymentModel].label}
                          </span>
                        </div>
                      )}

                      {/* Template Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${
                          isRecommended ? 'bg-cyan-500/10 text-cyan-400' : 
                          isNotRecommended ? 'bg-amber-500/10 text-amber-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {template.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{template.name}</h3>
                          <p className="text-xs text-gray-500 font-mono">{template.pattern}</p>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-400 mb-3">
                        {template.description}
                      </p>

                      {/* Warning for not recommended */}
                      {isNotRecommended && template.warning && (
                        <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 mb-3">
                          <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-300">{template.warning}</p>
                        </div>
                      )}

                      {/* Compatible Deployments */}
                      <div className="flex items-center flex-wrap gap-1 mb-3">
                        <span className="text-xs text-gray-500">Recommended for:</span>
                        {template.recommendedFor.map((model) => (
                          <span
                            key={model}
                            className={`
                              flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
                              ${model === deploymentModel 
                                ? 'bg-cyan-500/20 text-cyan-400' 
                                : 'bg-gray-700 text-gray-400'
                              }
                            `}
                          >
                            {getDeploymentIcon(model)}
                            {DEPLOYMENT_MODEL_CONFIG[model].label}
                          </span>
                        ))}
                      </div>

                      {/* Expanded Benefits (when selected) */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-3 border-t border-gray-700"
                          >
                            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Benefits</p>
                            <ul className="space-y-1 mb-3">
                              {template.benefits.map((benefit, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                                  <CheckCircle2 size={12} className="text-green-400 flex-shrink-0" />
                                  {benefit}
                                </li>
                              ))}
                            </ul>

                            <div className="flex items-center gap-2">
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApplyTemplate(template);
                                }}
                                className={`flex-1 py-2 font-medium rounded-lg transition-colors ${
                                  isNotRecommended 
                                    ? 'bg-amber-500 hover:bg-amber-400 text-black' 
                                    : 'bg-cyan-500 hover:bg-cyan-400 text-black'
                                }`}
                              >
                                {isNotRecommended ? 'Apply Anyway' : 'Apply Template'}
                              </motion.button>
                              {template.docsUrl && (
                                <a
                                  href={template.docsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                                  title="View documentation"
                                >
                                  <ExternalLink size={16} />
                                </a>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-800 bg-gray-800/30">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  💡 Tip: Templates can be customized after applying. Add or remove components as needed.
                </p>
                <a
                  href="https://www.elastic.co/docs/reference/opentelemetry"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  <ExternalLink size={12} />
                  EDOT Documentation
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

QuickStartPanel.displayName = 'QuickStartPanel';

