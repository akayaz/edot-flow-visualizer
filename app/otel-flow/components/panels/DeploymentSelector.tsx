'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Cloud, Building2, Wrench, Info, ExternalLink } from 'lucide-react';
import { useFlowStore } from '../../store/flowStore';
import { DEPLOYMENT_MODEL_CONFIG, type DeploymentModel } from '../../types';

const DEPLOYMENT_ICONS: Record<DeploymentModel, typeof Cloud> = {
  serverless: Cloud,
  ech: Building2,
  'self-managed': Wrench,
};

/**
 * DeploymentSelector Component
 * 
 * Allows users to select the target Elastic deployment model.
 * This affects validation rules and connectivity patterns:
 * - Serverless/ECH: Direct OTLP to Managed Endpoint is valid
 * - Self-Managed: Gateway collector is recommended
 */
export const DeploymentSelector = memo(() => {
  const { deploymentModel, setDeploymentModel } = useFlowStore();
  const currentConfig = DEPLOYMENT_MODEL_CONFIG[deploymentModel];

  return (
    <div className="flex flex-col gap-2">
      {/* Selector buttons */}
      <div className="flex items-center gap-1 p-1 bg-gray-800/50 rounded-xl">
        {(Object.keys(DEPLOYMENT_MODEL_CONFIG) as DeploymentModel[]).map((model) => {
          const config = DEPLOYMENT_MODEL_CONFIG[model];
          const Icon = DEPLOYMENT_ICONS[model];
          const isActive = deploymentModel === model;

          return (
            <motion.button
              key={model}
              onClick={() => setDeploymentModel(model)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                transition-all duration-200
                ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }
              `}
              title={config.description}
            >
              <Icon size={14} />
              <span>{config.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Info tooltip */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        key={deploymentModel}
        className="flex items-start gap-2 p-2.5 bg-gray-800/30 rounded-lg border border-gray-700/50"
      >
        <Info size={14} className="text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-300 leading-relaxed">
            {currentConfig.description}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {currentConfig.features.managedOtlpEndpoint && (
              <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-[10px] font-medium border border-green-500/20">
                Managed OTLP Endpoint
              </span>
            )}
            {currentConfig.features.gatewayRequired && (
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px] font-medium border border-amber-500/20">
                Gateway Required
              </span>
            )}
            {currentConfig.features.supportsKafkaTier && (
              <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[10px] font-medium border border-purple-500/20">
                Kafka HA Tier
              </span>
            )}
          </div>
          <a
            href={currentConfig.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 mt-2 hover:underline"
          >
            View EDOT Docs
            <ExternalLink size={10} />
          </a>
        </div>
      </motion.div>
    </div>
  );
});

DeploymentSelector.displayName = 'DeploymentSelector';

