'use client';

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EuiFlyout,
  EuiFlyoutHeader,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiTitle,
  EuiStepsHorizontal,
  EuiButton,
  EuiButtonEmpty,
  EuiIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiCallOut,
  EuiSpacer,
  EuiText,
  EuiProgress,
  EuiStat,
} from '@elastic/eui';
import type { EuiStepsHorizontalProps } from '@elastic/eui';
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
  iconType: string;
  title: string;
  description: string;
  available: boolean;
}[] = [
  {
    id: 'yaml',
    iconType: 'document',
    title: 'Import YAML',
    description: 'Upload an existing OTel Collector, Docker Compose, or K8s config',
    available: true,
  },
  {
    id: 'traffic',
    iconType: 'online',
    title: 'Live Traffic',
    description: 'Analyze incoming OTLP telemetry to detect services',
    available: true,
  },
  {
    id: 'code',
    iconType: 'search',
    title: 'Scan Repository',
    description: 'Detect SDK instrumentation from GitHub or local repo',
    available: false,
  },
  {
    id: 'combined',
    iconType: 'sparkles',
    title: 'Auto-Detect All',
    description: 'Combine all methods for the most accurate detection',
    available: false,
  },
];

// Default traffic analysis duration (30 seconds)
const DEFAULT_TRAFFIC_DURATION = 30000;

export const DetectionWizardPanel = memo(({ isOpen, onClose }: DetectionWizardPanelProps) => {
  const { setDetectedTopology, initialDetectionMethod, clearInitialDetectionMethod } = useFlowStore();

  const [step, setStep] = useState<WizardStep>('method');
  const [selectedMethod, setSelectedMethod] = useState<DetectionMethod | null>(null);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle deep-linking: if opened with an initial method, skip to input step
  useEffect(() => {
    if (isOpen && initialDetectionMethod) {
      setSelectedMethod(initialDetectionMethod);
      setStep('input');
      setError(null);
      clearInitialDetectionMethod();
    }
  }, [isOpen, initialDetectionMethod, clearInitialDetectionMethod]);

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

  const stepNames = ['method', 'input', 'preview'] as const;
  const currentStepIndex = stepNames.indexOf(step as typeof stepNames[number]);

  const horizontalSteps: EuiStepsHorizontalProps['steps'][number][] = [
    { title: 'Method', status: currentStepIndex > 0 ? 'complete' : currentStepIndex === 0 ? 'current' : 'incomplete', onClick: () => {} },
    { title: 'Input', status: currentStepIndex > 1 ? 'complete' : currentStepIndex === 1 ? 'current' : 'incomplete', onClick: () => {} },
    { title: 'Preview', status: currentStepIndex > 2 ? 'complete' : currentStepIndex === 2 ? 'current' : 'incomplete', onClick: () => {} },
  ];

  const renderMethodSelection = (): React.ReactElement => (
    <div className="space-y-3">
      <EuiText size="s" color="subdued" textAlign="center">
        <p>How would you like to detect your topology?</p>
      </EuiText>
      <EuiSpacer size="s" />
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
                ? 'border-gray-300 dark:border-gray-700 hover:border-cyan-500/50 cursor-pointer'
                : 'border-gray-200 dark:border-gray-800 cursor-not-allowed opacity-50'
              }
              ${selectedMethod === method.id ? 'border-cyan-500 bg-cyan-500/10' : ''}
            `}
          >
            <div style={{ marginBottom: 8 }}>
              <EuiIcon type={method.iconType} size="l" color={method.available ? 'primary' : 'subdued'} />
            </div>
            <EuiText size="xs"><strong>{method.title}</strong></EuiText>
            <EuiText size="xs" color="subdued"><p>{method.description}</p></EuiText>
            {!method.available && (
              <span className="absolute top-2 right-2 text-xs bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded">
                Soon
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );

  const renderInputStep = (): React.ReactElement => {
    switch (selectedMethod) {
      case 'yaml':
        return (
          <div className="space-y-4">
            <EuiFlexGroup alignItems="center" gutterSize="s">
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty size="xs" iconType="arrowLeft" onClick={handleBack}>Back</EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiText size="s"><strong>Import YAML Configuration</strong></EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>

            <FileUploader
              onFileParsed={handleFileParsed}
              onError={handleError}
              acceptedTypes={['.yaml', '.yml']}
            />

            {error && (
              <EuiCallOut title="Error" color="danger" iconType="error" size="s">
                <p>{error}</p>
              </EuiCallOut>
            )}
          </div>
        );

      case 'traffic':
        return (
          <div className="space-y-4">
            <EuiFlexGroup alignItems="center" gutterSize="s">
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty size="xs" iconType="arrowLeft" onClick={handleBack} isDisabled={isMonitoring}>Back</EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiText size="s"><strong>Live Traffic Analysis</strong></EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>

            <TrafficMonitor
              isMonitoring={isMonitoring}
              duration={DEFAULT_TRAFFIC_DURATION}
              onStart={startTrafficMonitoring}
              onStop={stopTrafficMonitoring}
              progress={trafficProgress}
            />

            {error && (
              <EuiCallOut title="Error" color="danger" iconType="error" size="s">
                <p>{error}</p>
              </EuiCallOut>
            )}
          </div>
        );

      default:
        return (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <EuiText color="subdued"><p>This detection method is coming soon.</p></EuiText>
            <EuiSpacer size="m" />
            <EuiButtonEmpty onClick={handleBack} iconType="arrowLeft">Go back</EuiButtonEmpty>
          </div>
        );
    }
  };

  const renderPreviewStep = (): React.ReactElement | null => {
    if (!detectionResult) return null;

    const warningsByType = {
      error: detectionResult.warnings.filter((w) => w.severity === 'error'),
      warning: detectionResult.warnings.filter((w) => w.severity === 'warning'),
      info: detectionResult.warnings.filter((w) => w.severity === 'info'),
    };

    return (
      <div className="space-y-4">
        <EuiFlexGroup alignItems="center" gutterSize="s">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty size="xs" iconType="arrowLeft" onClick={handleBack}>Back</EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText size="s"><strong>Detection Results</strong></EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>

        {/* Summary stats */}
        <EuiFlexGroup gutterSize="l">
          <EuiFlexItem>
            <EuiStat
              title={`${Math.round(detectionResult.confidence * 100)}%`}
              description="Confidence"
              titleSize="s"
              titleColor={detectionResult.confidence > 0.7 ? 'success' : 'warning'}
            />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiStat title={String(detectionResult.nodes.length)} description="Components" titleSize="s" />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiStat title={String(detectionResult.edges.length)} description="Connections" titleSize="s" />
          </EuiFlexItem>
        </EuiFlexGroup>

        {/* Detected nodes list */}
        <div className="max-h-32 overflow-auto">
          {detectionResult.nodes.map((node) => (
            <div
              key={node.id}
              className="flex items-center gap-2 px-3 py-2 border-b border-gray-300/30 dark:border-gray-700/30 last:border-0"
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
              <EuiText size="xs"><span>{node.data.label}</span></EuiText>
              <EuiText size="xs" color="subdued" style={{ marginLeft: 'auto' }}><span>{node.data.componentType}</span></EuiText>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {warningsByType.error.length > 0 && (
          <EuiCallOut title={`${warningsByType.error.length} Error(s)`} color="danger" iconType="error" size="s">
            <ul style={{ fontSize: 12, listStyle: 'disc', paddingLeft: 16 }}>
              {warningsByType.error.map((w, i) => <li key={i}>{w.message}</li>)}
            </ul>
          </EuiCallOut>
        )}
        {warningsByType.warning.length > 0 && (
          <EuiCallOut title={`${warningsByType.warning.length} Warning(s)`} color="warning" iconType="warning" size="s">
            <ul style={{ fontSize: 12, listStyle: 'disc', paddingLeft: 16 }}>
              {warningsByType.warning.slice(0, 3).map((w, i) => <li key={i}>{w.message}</li>)}
            </ul>
          </EuiCallOut>
        )}
        {warningsByType.info.length > 0 && (
          <EuiCallOut title={`${warningsByType.info.length} Note(s)`} color="primary" iconType="info" size="s">
            <ul style={{ fontSize: 12, listStyle: 'disc', paddingLeft: 16 }}>
              {warningsByType.info.slice(0, 2).map((w, i) => <li key={i}>{w.message}</li>)}
            </ul>
          </EuiCallOut>
        )}

        <EuiButton fill fullWidth onClick={handleApplyToCanvas} iconType="check">
          Apply to Canvas
        </EuiButton>
      </div>
    );
  };

  const renderCompleteStep = (): React.ReactElement => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ textAlign: 'center', padding: '32px 0' }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
        style={{ display: 'inline-flex', padding: 16, background: 'rgba(34, 197, 94, 0.2)', borderRadius: '50%', marginBottom: 16 }}
      >
        <EuiIcon type="checkInCircleFilled" size="xl" color="success" />
      </motion.div>
      <EuiText><h4>Topology Applied!</h4></EuiText>
      <EuiText size="s" color="subdued">
        <p>Your detected topology has been loaded onto the canvas.</p>
      </EuiText>
    </motion.div>
  );

  if (!isOpen) return null;

  return (
    <EuiFlyout
      side="right"
      size="m"
      onClose={handleClose}
      aria-labelledby="detectionWizardTitle"
      paddingSize="none"
    >
      <EuiFlyoutHeader hasBorder>
        <EuiFlexGroup alignItems="center" gutterSize="s">
          <EuiFlexItem grow={false}>
            <EuiIcon type="sparkles" color="primary" />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiTitle size="xs">
              <h3 id="detectionWizardTitle">Detect Topology</h3>
            </EuiTitle>
          </EuiFlexItem>
        </EuiFlexGroup>
        {step !== 'complete' && (
          <>
            <EuiSpacer size="s" />
            <EuiStepsHorizontal steps={horizontalSteps} />
          </>
        )}
      </EuiFlyoutHeader>

      <EuiFlyoutBody>
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
      </EuiFlyoutBody>
    </EuiFlyout>
  );
});

DetectionWizardPanel.displayName = 'DetectionWizardPanel';
