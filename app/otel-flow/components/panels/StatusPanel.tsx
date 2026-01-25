'use client';

import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Cloud,
  Activity,
  Wifi,
  WifiOff,
  TrendingUp,
} from 'lucide-react';
import { useValidationStore } from '../../store/validationStore';
import { useTelemetryStore } from '../../store/telemetryStore';
import { useFlowStore } from '../../store/flowStore';
import { useHealthScoreStore } from '../../store/healthScoreStore';
import { DEPLOYMENT_MODEL_CONFIG } from '../../types';
import type { EnhancedValidationResult, EnhancedValidationSeverity } from '../../types';
import { HealthScorePanel } from './HealthScorePanel';

type StatusTab = 'validation' | 'telemetry' | 'health';

// Severity configuration for styling (dark theme)
const SEVERITY_CONFIG: Record<
  EnhancedValidationSeverity,
  {
    icon: typeof AlertCircle;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  error: {
    icon: AlertCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  info: {
    icon: Info,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
  },
};

/**
 * Individual validation item component
 */
interface ValidationItemProps {
  result: EnhancedValidationResult;
  onDismiss: (id: string) => void;
}

const ValidationItem = memo(({ result, onDismiss }: ValidationItemProps) => {
  const config = SEVERITY_CONFIG[result.severity];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className={`p-2.5 rounded-lg border ${config.bgColor} ${config.borderColor} mb-2`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`w-3.5 h-3.5 ${config.color} flex-shrink-0 mt-0.5`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-200">{result.message}</p>

              {result.suggestion && (
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                  💡 {result.suggestion}
                </p>
              )}
            </div>

            <button
              onClick={() => onDismiss(result.id)}
              className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 p-0.5 hover:bg-gray-700/50 rounded"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {result.docsUrl && (
            <a
              href={result.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[9px] text-cyan-400 hover:text-cyan-300 mt-1.5 hover:underline"
            >
              Docs
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
});

ValidationItem.displayName = 'ValidationItem';

/**
 * Unified Status Panel Component
 *
 * Consolidates validation and telemetry into a single docked panel
 * with tabs for switching between views.
 */
export const StatusPanel = memo(() => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusTab>('validation');

  // Validation store
  const { validationResults, dismissValidation } = useValidationStore();
  const { deploymentModel } = useFlowStore();
  const deploymentConfig = DEPLOYMENT_MODEL_CONFIG[deploymentModel];

  // Telemetry store
  const { recentEvents, throughputStats, isConnected, isDemoMode, lastEventTime } =
    useTelemetryStore();

  // Validation stats
  const validationStats = useMemo(() => {
    const errors = validationResults.filter((r) => r.severity === 'error');
    const warnings = validationResults.filter((r) => r.severity === 'warning');
    const info = validationResults.filter((r) => r.severity === 'info');
    return {
      errors,
      warnings,
      info,
      total: validationResults.length,
      hasIssues: errors.length > 0 || warnings.length > 0,
    };
  }, [validationResults]);

  // Telemetry stats
  const telemetryStats = useMemo(() => {
    let totalTraces = 0;
    let totalMetrics = 0;
    let totalLogs = 0;

    throughputStats.forEach((stat) => {
      totalTraces += stat.traces;
      totalMetrics += stat.metrics;
      totalLogs += stat.logs;
    });

    return { totalTraces, totalMetrics, totalLogs };
  }, [throughputStats]);

  const isActive = lastEventTime && Date.now() - lastEventTime < 2000;

  // Hide entirely when valid and no telemetry activity and collapsed
  if (!isExpanded && !validationStats.hasIssues && !isActive && !isDemoMode) {
    return null;
  }

  // Collapsed state - show minimal badge
  if (!isExpanded) {
    return (
      <motion.button
        onClick={() => setIsExpanded(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="fixed bottom-4 right-4 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl px-3 py-2 shadow-2xl hover:border-gray-600 transition-all z-50"
        aria-label="Show status panel"
      >
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-1">
            {isConnected ? (
              <Wifi size={12} className="text-green-400" />
            ) : (
              <WifiOff size={12} className="text-red-400" />
            )}
          </div>

          {/* Validation status */}
          {validationStats.errors.length > 0 && (
            <span className="flex items-center gap-1 text-red-400 font-medium text-xs">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              {validationStats.errors.length}
            </span>
          )}
          {validationStats.warnings.length > 0 && (
            <span className="flex items-center gap-1 text-amber-400 font-medium text-xs">
              <AlertTriangle className="w-3 h-3" />
              {validationStats.warnings.length}
            </span>
          )}

          {/* Telemetry activity */}
          {isActive && (
            <div className="flex items-center gap-0.5">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-amber-500"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-blue-500"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
              />
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
              />
            </div>
          )}

          {isDemoMode && (
            <span className="px-1 py-0.5 text-[8px] font-medium bg-purple-500/20 text-purple-400 rounded">
              DEMO
            </span>
          )}

          <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
        </div>
      </motion.button>
    );
  }

  // Expanded state - show full panel with tabs
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 right-4 w-80 max-h-[28rem] bg-gray-900/98 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50"
    >
      {/* Header */}
      <div className="bg-gray-800/50 border-b border-gray-700/50 px-3 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Connection status */}
            {isConnected ? (
              <Wifi size={12} className="text-green-400" />
            ) : (
              <WifiOff size={12} className="text-red-400" />
            )}
            {isDemoMode && (
              <span className="px-1 py-0.5 text-[8px] font-medium bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                DEMO
              </span>
            )}
            <span className="text-[10px] text-gray-400 font-medium">
              {deploymentConfig.icon} {deploymentConfig.label}
            </span>
          </div>

          <button
            onClick={() => setIsExpanded(false)}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 hover:bg-gray-700/50 rounded"
            aria-label="Collapse panel"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => setActiveTab('validation')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
              activeTab === 'validation'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            {validationStats.errors.length > 0 ? (
              <AlertCircle className="w-3 h-3 text-red-400" />
            ) : validationStats.warnings.length > 0 ? (
              <AlertTriangle className="w-3 h-3 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-green-400" />
            )}
            Validation
            {validationStats.total > 0 && (
              <span className="px-1 py-0.5 rounded text-[8px] bg-gray-600 text-gray-300">
                {validationStats.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
              activeTab === 'telemetry'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            <Activity className="w-3 h-3 text-cyan-400" />
            Telemetry
            {isActive && (
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
              activeTab === 'health'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            <TrendingUp className="w-3 h-3 text-green-400" />
            Health
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2.5">
        <AnimatePresence mode="wait">
          {activeTab === 'validation' ? (
            <motion.div
              key="validation"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
            >
              {validationStats.total === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500/30" />
                  <p className="text-xs font-medium text-gray-300">No validation issues</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Your topology is valid!
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {validationStats.errors.map((result) => (
                    <ValidationItem
                      key={result.id}
                      result={result}
                      onDismiss={dismissValidation}
                    />
                  ))}
                  {validationStats.warnings.map((result) => (
                    <ValidationItem
                      key={result.id}
                      result={result}
                      onDismiss={dismissValidation}
                    />
                  ))}
                  {validationStats.info.map((result) => (
                    <ValidationItem
                      key={result.id}
                      result={result}
                      onDismiss={dismissValidation}
                    />
                  ))}
                </AnimatePresence>
              )}
            </motion.div>
          ) : activeTab === 'telemetry' ? (
            <motion.div
              key="telemetry"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              {/* Throughput meters */}
              <div className="space-y-2">
                {/* Traces */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50">
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="w-2 h-2 rounded-full bg-amber-500"
                      animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                    <span className="text-xs text-gray-400">Traces</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono font-semibold text-amber-400">
                      {telemetryStats.totalTraces}
                    </span>
                    <span className="text-[10px] text-gray-500">/s</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50">
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="w-2 h-2 rounded-full bg-blue-500"
                      animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
                    />
                    <span className="text-xs text-gray-400">Metrics</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono font-semibold text-blue-400">
                      {telemetryStats.totalMetrics}
                    </span>
                    <span className="text-[10px] text-gray-500">/s</span>
                  </div>
                </div>

                {/* Logs */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50">
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="w-2 h-2 rounded-full bg-emerald-500"
                      animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                    />
                    <span className="text-xs text-gray-400">Logs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono font-semibold text-emerald-400">
                      {telemetryStats.totalLogs}
                    </span>
                    <span className="text-[10px] text-gray-500">/s</span>
                  </div>
                </div>
              </div>

              {/* Buffer info */}
              <div className="pt-2 border-t border-gray-700/50">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">Buffer</span>
                  <span className="text-gray-400 font-mono">{recentEvents.length} events</span>
                </div>
              </div>

              {/* Activity indicator */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-1.5 text-[10px] text-cyan-400"
                  >
                    <TrendingUp size={10} />
                    <span>Receiving telemetry...</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="health"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <HealthScorePanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

StatusPanel.displayName = 'StatusPanel';
