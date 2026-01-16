'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Info, 
  ExternalLink, 
  CheckCircle2, 
  Lightbulb,
  Activity,
  BarChart3,
  FileText
} from 'lucide-react';
import { useFlowStore } from '../../store/flowStore';
import { getComponentHint, type ComponentHint } from '../../data/component-hints';
import type { EDOTComponentType, DeploymentModel } from '../../types';
import { DEPLOYMENT_MODEL_CONFIG } from '../../types';

interface HintTooltipProps {
  componentType: EDOTComponentType;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
}

const TelemetryIcon = ({ type }: { type: 'traces' | 'metrics' | 'logs' }) => {
  switch (type) {
    case 'traces':
      return <Activity size={12} className="text-amber-400" />;
    case 'metrics':
      return <BarChart3 size={12} className="text-blue-400" />;
    case 'logs':
      return <FileText size={12} className="text-emerald-400" />;
  }
};

export const HintTooltip = memo(({ 
  componentType, 
  children, 
  position = 'top',
  disabled = false
}: HintTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [delayedVisible, setDelayedVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { deploymentModel } = useFlowStore();

  const hint = getComponentHint(componentType);
  const deploymentNote = hint?.deploymentNotes[deploymentModel];

  // Delay showing tooltip for better UX
  useEffect(() => {
    if (isVisible && !disabled) {
      timeoutRef.current = setTimeout(() => {
        setDelayedVisible(true);
      }, 500); // 500ms delay before showing
    } else {
      setDelayedVisible(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible, disabled]);

  if (!hint || disabled) {
    return <>{children}</>;
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
    }
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      <AnimatePresence>
        {delayedVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`
              absolute z-[100] w-72 p-3 
              bg-gray-900/98 backdrop-blur-xl 
              rounded-xl border border-gray-700 
              shadow-2xl shadow-black/50
              ${getPositionClasses()}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-2 mb-2">
              <Info size={16} className="text-cyan-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-white text-sm">{hint.title}</h4>
                <p className="text-xs text-gray-400">{hint.description}</p>
              </div>
            </div>

            {/* Purpose */}
            <div className="mb-3 px-2 py-1.5 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-300">{hint.purpose}</p>
            </div>

            {/* Telemetry Types */}
            {hint.telemetryTypes.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500">Telemetry:</span>
                <div className="flex items-center gap-1.5">
                  {hint.telemetryTypes.map((type) => (
                    <span
                      key={type}
                      className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-300"
                    >
                      <TelemetryIcon type={type} />
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Deployment Note */}
            {deploymentNote && (
              <div className="mb-3 p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <Lightbulb size={12} className="text-cyan-400" />
                  <span className="text-[10px] text-cyan-400 font-medium uppercase tracking-wide">
                    {DEPLOYMENT_MODEL_CONFIG[deploymentModel].label}
                  </span>
                </div>
                <p className="text-xs text-cyan-200">{deploymentNote}</p>
              </div>
            )}

            {/* Best Practices */}
            <div className="mb-3">
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1.5">
                Best Practices
              </p>
              <ul className="space-y-1">
                {hint.bestPractices.slice(0, 3).map((practice, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-400">
                    <CheckCircle2 size={10} className="text-green-400 mt-0.5 flex-shrink-0" />
                    <span>{practice}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Docs Link */}
            <a
              href={hint.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} />
              View Documentation
            </a>

            {/* Arrow pointer */}
            <div
              className={`
                absolute w-2 h-2 bg-gray-900 border-gray-700 rotate-45
                ${position === 'top' ? 'top-full -mt-1 left-1/2 -translate-x-1/2 border-b border-r' : ''}
                ${position === 'bottom' ? 'bottom-full -mb-1 left-1/2 -translate-x-1/2 border-t border-l' : ''}
                ${position === 'left' ? 'left-full -ml-1 top-1/2 -translate-y-1/2 border-t border-r' : ''}
                ${position === 'right' ? 'right-full -mr-1 top-1/2 -translate-y-1/2 border-b border-l' : ''}
              `}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

HintTooltip.displayName = 'HintTooltip';

