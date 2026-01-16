'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  Rocket, 
  Plus, 
  Lightbulb,
  ArrowRight,
  Cloud,
  Building2,
  HardDrive
} from 'lucide-react';
import { useFlowStore } from '../../store/flowStore';
import { DEPLOYMENT_MODEL_CONFIG } from '../../types';

interface EmptyStateProps {
  onOpenQuickStart: () => void;
}

export const EmptyState = memo(({ onOpenQuickStart }: EmptyStateProps) => {
  const { deploymentModel } = useFlowStore();
  const deploymentConfig = DEPLOYMENT_MODEL_CONFIG[deploymentModel];

  const getDeploymentIcon = () => {
    switch (deploymentModel) {
      case 'serverless': return <Cloud size={16} />;
      case 'ech': return <Building2 size={16} />;
      case 'self-managed': return <HardDrive size={16} />;
    }
  };

  const getRecommendedPattern = () => {
    switch (deploymentModel) {
      case 'serverless':
        return 'SDK → Elastic (direct via Managed OTLP Endpoint)';
      case 'ech':
        return 'SDK → Agent → Elastic (with host metrics)';
      case 'self-managed':
        return 'SDK → Agent → Gateway → Elastic (full pipeline)';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-5"
    >
      <div className="max-w-lg text-center pointer-events-auto">
        {/* Main Card with pattern background */}
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700 p-8 shadow-elevated pattern-dots relative overflow-hidden"
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          {/* Icon */}
          <motion.div
            animate={{ 
              y: [0, -8, 0],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="inline-flex p-4 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-2xl mb-6"
          >
            <Rocket size={40} className="text-cyan-400" />
          </motion.div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-2">
            Design Your EDOT Architecture
          </h2>
          <p className="text-gray-400 mb-6">
            Build observability pipelines visually with Elastic's OpenTelemetry distribution
          </p>

          {/* Current Deployment Context */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm font-medium">
                {getDeploymentIcon()}
                {deploymentConfig.label}
              </span>
              <span className="text-gray-500 text-sm">deployment selected</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Lightbulb size={14} className="text-amber-400" />
              <span className="text-gray-400">Recommended pattern:</span>
            </div>
            <p className="text-white font-mono text-sm mt-1 pl-5">
              {getRecommendedPattern()}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onOpenQuickStart}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
            >
              <Rocket size={18} />
              Quick Start Templates
              <ArrowRight size={16} />
            </motion.button>

            <div className="flex items-center gap-3">
              <div className="flex-1 divider-gradient" />
              <span className="text-xs text-gray-500">or</span>
              <div className="flex-1 divider-gradient" />
            </div>

            <p className="text-sm text-gray-500">
              <Plus size={14} className="inline mr-1" />
              Drag components from the left palette to start building
            </p>
          </div>
        </motion.div>

        {/* Helpful Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500"
        >
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">⌘</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">Z</kbd>
            <span>Undo</span>
          </span>
          <span className="text-gray-700">•</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">Del</kbd>
            <span>Remove</span>
          </span>
          <span className="text-gray-700">•</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">Click</kbd>
            <span>to connect</span>
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
});

EmptyState.displayName = 'EmptyState';

