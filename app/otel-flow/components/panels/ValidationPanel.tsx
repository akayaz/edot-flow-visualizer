'use client';

import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, AlertTriangle, Info, X, ExternalLink, ChevronDown, ChevronUp, CheckCircle2, Cloud } from 'lucide-react';
import { useValidationStore } from '../../store/validationStore';
import { useFlowStore } from '../../store/flowStore';
import { DEPLOYMENT_MODEL_CONFIG } from '../../types';
import type { EnhancedValidationResult, EnhancedValidationSeverity } from '../../types';

// Severity configuration for styling (dark theme)
const SEVERITY_CONFIG: Record<
  EnhancedValidationSeverity,
  {
    icon: typeof AlertCircle;
    color: string;
    bgColor: string;
    borderColor: string;
    badgeColor: string;
    badgeText: string;
  }
> = {
  error: {
    icon: AlertCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    badgeColor: 'bg-red-500/20',
    badgeText: 'text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    badgeColor: 'bg-amber-500/20',
    badgeText: 'text-amber-400',
  },
  info: {
    icon: Info,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    badgeColor: 'bg-cyan-500/20',
    badgeText: 'text-cyan-400',
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
      className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor} mb-2`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 ${config.color} flex-shrink-0 mt-0.5`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className={`text-sm font-medium text-gray-200`}>
                {result.message}
              </p>

              {result.suggestion && (
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  💡 {result.suggestion}
                </p>
              )}

              {result.component && (
                <p className="text-[10px] text-gray-500 mt-1">
                  {result.component.componentType || 'node'}
                  {result.component.componentName && ` → ${result.component.componentName}`}
                </p>
              )}
            </div>

            <button
              onClick={() => onDismiss(result.id)}
              className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 p-1 hover:bg-gray-700/50 rounded"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {result.docsUrl && (
            <a
              href={result.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 mt-2 hover:underline"
            >
              View EDOT Documentation
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
});

ValidationItem.displayName = 'ValidationItem';

/**
 * Validation Panel Component
 *
 * Displays real-time validation results in a collapsible panel.
 * Shows errors, warnings, and info messages with dismiss functionality.
 * Now includes deployment model context for EDOT architecture validation.
 */
export const ValidationPanel = memo(() => {
  const {
    validationResults,
    showValidationPanel,
    toggleValidationPanel,
    dismissValidation,
  } = useValidationStore();

  const { deploymentModel } = useFlowStore();
  const deploymentConfig = DEPLOYMENT_MODEL_CONFIG[deploymentModel];

  // Derive grouped results from validationResults state
  const grouped = useMemo(() => {
    const errors = validationResults.filter((r) => r.severity === 'error');
    const warnings = validationResults.filter((r) => r.severity === 'warning');
    const info = validationResults.filter((r) => r.severity === 'info');
    return {
      errors,
      warnings,
      info,
      total: validationResults.length,
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
    };
  }, [validationResults]);
  
  const { errors, warnings, info, total } = grouped;

  // Hide entirely when valid and collapsed (less visual clutter)
  if (!showValidationPanel && total === 0) {
    return null;
  }

  // Collapsed state - show floating badge (only when there are issues)
  if (!showValidationPanel) {
    return (
      <motion.button
        onClick={toggleValidationPanel}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="fixed bottom-4 right-4 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl px-4 py-2.5 shadow-2xl hover:border-gray-600 transition-all z-50"
        aria-label="Show validation panel"
      >
        <div className="flex items-center gap-3">
          {errors.length > 0 && (
            <span className="flex items-center gap-1.5 text-red-400 font-medium text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              {errors.length}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="flex items-center gap-1.5 text-amber-400 font-medium text-sm">
              <AlertTriangle className="w-4 h-4" />
              {warnings.length}
            </span>
          )}
          {info.length > 0 && (
            <span className="flex items-center gap-1.5 text-cyan-400 font-medium text-sm">
              <Info className="w-4 h-4" />
              {info.length}
            </span>
          )}
          <ChevronUp className="w-4 h-4 text-gray-500" />
        </div>
      </motion.button>
    );
  }

  // Expanded state - show full panel
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 right-4 w-96 max-h-[32rem] bg-gray-900/98 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50"
    >
      {/* Header */}
      <div className="bg-gray-800/50 border-b border-gray-700/50 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-white text-sm">Architecture Validation</h3>
          </div>

          <button
            onClick={toggleValidationPanel}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 hover:bg-gray-700/50 rounded"
            aria-label="Hide validation panel"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Deployment model indicator */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-700/50 rounded-lg">
            <Cloud className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] text-gray-300 font-medium">
              {deploymentConfig.icon} {deploymentConfig.label}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5">
            {errors.length > 0 && (
              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-medium border border-red-500/30">
                {errors.length} error{errors.length !== 1 && 's'}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-medium border border-amber-500/30">
                {warnings.length} warning{warnings.length !== 1 && 's'}
              </span>
            )}
            {info.length > 0 && (
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-[10px] font-medium border border-cyan-500/30">
                {info.length} tip{info.length !== 1 && 's'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-3">
        {total === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500/30" />
            <p className="text-sm font-medium text-gray-300">No validation issues</p>
            <p className="text-xs text-gray-500 mt-1">
              Your {deploymentConfig.label} topology is valid!
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {/* Errors first */}
            {errors.map((result) => (
              <ValidationItem
                key={result.id}
                result={result}
                onDismiss={dismissValidation}
              />
            ))}
            {/* Then warnings */}
            {warnings.map((result) => (
              <ValidationItem
                key={result.id}
                result={result}
                onDismiss={dismissValidation}
              />
            ))}
            {/* Finally info */}
            {info.map((result) => (
              <ValidationItem
                key={result.id}
                result={result}
                onDismiss={dismissValidation}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer with deployment hint */}
      {total > 0 && (
        <div className="px-3 py-2 border-t border-gray-700/50 bg-gray-800/30">
          <p className="text-[10px] text-gray-500 text-center">
            Validating for <span className="text-cyan-400">{deploymentConfig.label}</span> deployment
            {deploymentConfig.features.gatewayRequired && (
              <span className="text-amber-400"> (Gateway required)</span>
            )}
          </p>
        </div>
      )}
    </motion.div>
  );
});

ValidationPanel.displayName = 'ValidationPanel';
