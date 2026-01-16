'use client';

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileCode,
  Radio,
  Search,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useFlowStore } from '../../store/flowStore';
import { FileUploader, TrafficMonitor } from '../detection';
import { layoutTopology } from '../../lib/detection';
import type { DetectionResult } from '../../lib/detection/types';

type DetectionMethod = 'yaml' | 'traffic' | 'code' | 'combined';
type WizardStep = 'method' | 'input' | 'preview' | 'complete';

interface DetectionWizardPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const METHOD_OPTIONS: {
  id: DetectionMethod;
  icon: React.ReactNode;
  title: string;
  description: string;
  available: boolean;
}[] = [
  {
    id: 'yaml',
    icon: <FileCode size={24} />,
    title: 'Import YAML',
    description: 'Upload an existing OTel Collector, Docker Compose, or K8s config',
    available: true,
  },
  {
    id: 'traffic',
    icon: <Radio size={24} />,
    title: 'Live Traffic',
    description: 'Analyze incoming OTLP telemetry to detect services',
    available: true,
  },
  {
    id: 'code',
    icon: <Search size={24} />,
    title: 'Scan Repository',
    description: 'Detect SDK instrumentation from GitHub or local repo',
    available: false, // Coming soon
  },
  {
    id: 'combined',
    icon: <Sparkles size={24} />,
    title: 'Auto-Detect All',
    description: 'Combine all methods for the most accurate detection',
    available: false, // Coming soon
  },
];

// Default traffic analysis duration (30 seconds)
const DEFAULT_TRAFFIC_DURATION = 30000;

export const DetectionWizardPanel = memo(({ isOpen, onClose }: DetectionWizardPanelProps) => {
  const { setDetectedTopology } = useFlowStore();

  const [step, setStep] = useState<WizardStep>('method');
  const [selectedMethod, setSelectedMethod] = useState<DetectionMethod | null>(null);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Traffic monitoring state
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [trafficProgress, setTrafficProgress] = useState({
    eventCount: 0,
    serviceCount: 0,
    connectionCount: 0,
    elapsedTime: 0,
  });
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleMethodSelect = useCallback((method: DetectionMethod) => {
    setSelectedMethod(method);
    setStep('input');
    setError(null);
  }, []);

  const handleBack = useCallback(async () => {
    // Stop monitoring if active
    if (isMonitoring) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setIsMonitoring(false);
      await fetch('/api/detection/traffic?action=stop', { method: 'POST' }).catch(() => {});
    }

    if (step === 'input') {
      setStep('method');
      setSelectedMethod(null);
      setDetectionResult(null);
    } else if (step === 'preview') {
      setStep('input');
      setDetectionResult(null);
    }
    setError(null);
  }, [step, isMonitoring]);

  const handleFileParsed = useCallback((result: DetectionResult) => {
    // Apply layout to position nodes
    const layoutResult = layoutTopology(result.nodes, result.edges);

    setDetectionResult({
      ...result,
      nodes: layoutResult.nodes,
      edges: layoutResult.edges,
    });
    setStep('preview');
    setError(null);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  // Traffic monitoring handlers
  const startTrafficMonitoring = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/detection/traffic?action=start', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start traffic analysis');
      }

      setIsMonitoring(true);
      setTrafficProgress({
        eventCount: 0,
        serviceCount: 0,
        connectionCount: 0,
        elapsedTime: 0,
      });

      // Poll for progress updates
      progressIntervalRef.current = setInterval(async () => {
        try {
          const statusResponse = await fetch('/api/detection/traffic');
          if (statusResponse.ok) {
            const data = await statusResponse.json();
            setTrafficProgress({
              eventCount: data.progress.eventCount,
              serviceCount: data.progress.serviceCount,
              connectionCount: data.progress.connectionCount,
              elapsedTime: data.progress.elapsedTime,
            });
          }
        } catch {
          // Ignore polling errors
        }
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start monitoring');
    }
  }, []);

  const stopTrafficMonitoring = useCallback(async () => {
    try {
      // Clear progress polling
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      const response = await fetch('/api/detection/traffic?action=stop', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to stop traffic analysis');
      }

      const data = await response.json();
      setIsMonitoring(false);

      if (data.detection) {
        setDetectionResult(data.detection);
        setStep('preview');
      } else {
        setError('No topology detected. Try enabling demo mode or waiting for real traffic.');
      }
    } catch (err) {
      setIsMonitoring(false);
      setError(err instanceof Error ? err.message : 'Failed to stop monitoring');
    }
  }, []);

  // Cleanup on unmount or panel close
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      // If monitoring was active, stop it
      if (isMonitoring) {
        fetch('/api/detection/traffic?action=stop', { method: 'POST' }).catch(() => {});
      }
    };
  }, [isMonitoring]);

  const handleApplyToCanvas = useCallback(() => {
    if (!detectionResult) return;

    setDetectedTopology(detectionResult.nodes, detectionResult.edges, {
      clearExisting: true,
      fitView: true,
    });

    setStep('complete');

    // Close after a short delay
    setTimeout(() => {
      onClose();
      // Reset state
      setStep('method');
      setSelectedMethod(null);
      setDetectionResult(null);
    }, 1500);
  }, [detectionResult, setDetectedTopology, onClose]);

  const handleClose = useCallback(async () => {
    // Stop monitoring if active
    if (isMonitoring) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setIsMonitoring(false);
      await fetch('/api/detection/traffic?action=stop', { method: 'POST' }).catch(() => {});
    }

    onClose();
    // Reset state after animation
    setTimeout(() => {
      setStep('method');
      setSelectedMethod(null);
      setDetectionResult(null);
      setError(null);
      setTrafficProgress({
        eventCount: 0,
        serviceCount: 0,
        connectionCount: 0,
        elapsedTime: 0,
      });
    }, 300);
  }, [onClose, isMonitoring]);

  const renderStepIndicator = () => {
    const steps = ['method', 'input', 'preview'];
    const currentIndex = steps.indexOf(step);

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                i <= currentIndex ? 'bg-cyan-400' : 'bg-gray-600'
              }`}
            />
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 transition-colors ${
                  i < currentIndex ? 'bg-cyan-400' : 'bg-gray-600'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderMethodSelection = () => (
    <div className="space-y-3">
      <p className="text-gray-400 text-sm text-center mb-4">
        How would you like to detect your topology?
      </p>

      <div className="grid grid-cols-2 gap-3">
        {METHOD_OPTIONS.map((method) => (
          <motion.button
            key={method.id}
            onClick={() => method.available && handleMethodSelect(method.id)}
            disabled={!method.available}
            whileHover={method.available ? { scale: 1.02 } : {}}
            whileTap={method.available ? { scale: 0.98 } : {}}
            className={`
              relative p-4 rounded-xl border text-left transition-all
              ${method.available
                ? 'bg-gray-800/50 border-gray-700 hover:border-cyan-500/50 hover:bg-gray-800 cursor-pointer'
                : 'bg-gray-800/20 border-gray-800 cursor-not-allowed opacity-50'
              }
              ${selectedMethod === method.id ? 'border-cyan-500 bg-cyan-500/10' : ''}
            `}
          >
            <div className={`mb-2 ${method.available ? 'text-cyan-400' : 'text-gray-600'}`}>
              {method.icon}
            </div>
            <h4 className={`font-medium mb-1 ${method.available ? 'text-white' : 'text-gray-500'}`}>
              {method.title}
            </h4>
            <p className={`text-xs ${method.available ? 'text-gray-400' : 'text-gray-600'}`}>
              {method.description}
            </p>

            {!method.available && (
              <span className="absolute top-2 right-2 text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                Soon
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );

  const renderInputStep = () => {
    switch (selectedMethod) {
      case 'yaml':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={handleBack}
                className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft size={16} className="text-gray-400" />
              </button>
              <h4 className="text-white font-medium">Import YAML Configuration</h4>
            </div>

            <FileUploader
              onFileParsed={handleFileParsed}
              onError={handleError}
              acceptedTypes={['.yaml', '.yml']}
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-lg p-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              </motion.div>
            )}
          </div>
        );

      case 'traffic':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={handleBack}
                className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
                disabled={isMonitoring}
              >
                <ArrowLeft size={16} className={isMonitoring ? 'text-gray-600' : 'text-gray-400'} />
              </button>
              <h4 className="text-white font-medium">Live Traffic Analysis</h4>
            </div>

            <TrafficMonitor
              isMonitoring={isMonitoring}
              duration={DEFAULT_TRAFFIC_DURATION}
              onStart={startTrafficMonitoring}
              onStop={stopTrafficMonitoring}
              progress={trafficProgress}
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-lg p-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              </motion.div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-center text-gray-400 py-8">
            <p>This detection method is coming soon.</p>
            <button
              onClick={handleBack}
              className="mt-4 text-cyan-400 hover:text-cyan-300 text-sm"
            >
              ← Go back
            </button>
          </div>
        );
    }
  };

  const renderPreviewStep = () => {
    if (!detectionResult) return null;

    const warningsByType = {
      error: detectionResult.warnings.filter((w) => w.severity === 'error'),
      warning: detectionResult.warnings.filter((w) => w.severity === 'warning'),
      info: detectionResult.warnings.filter((w) => w.severity === 'info'),
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={handleBack}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} className="text-gray-400" />
          </button>
          <h4 className="text-white font-medium">Detection Results</h4>
        </div>

        {/* Summary */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Confidence</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${detectionResult.confidence * 100}%` }}
                  className={`h-full rounded-full ${
                    detectionResult.confidence > 0.7
                      ? 'bg-green-400'
                      : detectionResult.confidence > 0.4
                      ? 'bg-yellow-400'
                      : 'bg-red-400'
                  }`}
                />
              </div>
              <span className="text-white text-sm font-medium">
                {Math.round(detectionResult.confidence * 100)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-xs mb-1">Components</p>
              <p className="text-white text-lg font-semibold">{detectionResult.nodes.length}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Connections</p>
              <p className="text-white text-lg font-semibold">{detectionResult.edges.length}</p>
            </div>
          </div>
        </div>

        {/* Detected nodes list */}
        <div className="bg-gray-800/30 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-3 border-b border-gray-700/50">
            <p className="text-gray-400 text-xs font-medium">Detected Components</p>
          </div>
          <div className="max-h-32 overflow-auto">
            {detectionResult.nodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/30 last:border-0"
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    node.data.componentType === 'edot-sdk'
                      ? 'bg-green-400'
                      : node.data.componentType.includes('collector')
                      ? 'bg-cyan-400'
                      : 'bg-purple-400'
                  }`}
                />
                <span className="text-white text-sm">{node.data.label}</span>
                <span className="text-gray-500 text-xs ml-auto">
                  {node.data.componentType}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Warnings */}
        {detectionResult.warnings.length > 0 && (
          <div className="space-y-2">
            {warningsByType.error.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-red-400" />
                  <span className="text-red-400 text-xs font-medium">
                    {warningsByType.error.length} Error(s)
                  </span>
                </div>
                <ul className="text-red-300 text-xs space-y-1">
                  {warningsByType.error.map((w, i) => (
                    <li key={i}>• {w.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {warningsByType.warning.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-yellow-400" />
                  <span className="text-yellow-400 text-xs font-medium">
                    {warningsByType.warning.length} Warning(s)
                  </span>
                </div>
                <ul className="text-yellow-300 text-xs space-y-1">
                  {warningsByType.warning.slice(0, 3).map((w, i) => (
                    <li key={i}>• {w.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {warningsByType.info.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={14} className="text-blue-400" />
                  <span className="text-blue-400 text-xs font-medium">
                    {warningsByType.info.length} Note(s)
                  </span>
                </div>
                <ul className="text-blue-300 text-xs space-y-1">
                  {warningsByType.info.slice(0, 2).map((w, i) => (
                    <li key={i}>• {w.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Apply button */}
        <motion.button
          onClick={handleApplyToCanvas}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-medium rounded-xl flex items-center justify-center gap-2"
        >
          Apply to Canvas
          <ArrowRight size={16} />
        </motion.button>
      </div>
    );
  };

  const renderCompleteStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
        className="inline-flex p-4 bg-green-500/20 rounded-full mb-4"
      >
        <CheckCircle size={32} className="text-green-400" />
      </motion.div>
      <h4 className="text-white font-medium mb-2">Topology Applied!</h4>
      <p className="text-gray-400 text-sm">
        Your detected topology has been loaded onto the canvas.
      </p>
    </motion.div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute top-4 right-4 z-30 w-[400px] bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-cyan-400" />
              <h3 className="font-semibold text-white">Detect Topology</h3>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {step !== 'complete' && renderStepIndicator()}

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {step === 'method' && renderMethodSelection()}
                {step === 'input' && renderInputStep()}
                {step === 'preview' && renderPreviewStep()}
                {step === 'complete' && renderCompleteStep()}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

DetectionWizardPanel.displayName = 'DetectionWizardPanel';
