'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EuiPanel,
  EuiTabs,
  EuiTab,
  EuiIcon,
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
  EuiBadge,
  EuiCallOut,
  EuiToolTip,
  EuiNotificationBadge,
  EuiSpacer,
} from '@elastic/eui';
import { useValidationStore } from '../../store/validationStore';
import { useTelemetryStore } from '../../store/telemetryStore';
import { useFlowStore } from '../../store/flowStore';
import { useHealthScoreStore } from '../../store/healthScoreStore';
import { DEPLOYMENT_MODEL_CONFIG } from '../../types';
import type { EnhancedValidationResult, EnhancedValidationSeverity } from '../../types';
import { HealthScorePanel } from './HealthScorePanel';

type StatusTab = 'validation' | 'telemetry' | 'health';

// Map severities to EUI icon and color
const SEVERITY_EUI: Record<
  EnhancedValidationSeverity,
  { iconType: string; color: 'danger' | 'warning' | 'primary' }
> = {
  error: { iconType: 'error', color: 'danger' },
  warning: { iconType: 'warning', color: 'warning' },
  info: { iconType: 'info', color: 'primary' },
};

/**
 * Individual validation item component
 */
interface ValidationItemProps {
  result: EnhancedValidationResult;
  onDismiss: (id: string) => void;
}

const ValidationItem = memo(({ result, onDismiss }: ValidationItemProps): React.ReactElement => {
  const config = SEVERITY_EUI[result.severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      style={{ marginBottom: 8 }}
    >
      <EuiCallOut
        size="s"
        color={config.color}
        iconType={config.iconType}
        title={
          <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" gutterSize="s" responsive={false}>
            <EuiFlexItem>
              <EuiText size="xs"><span>{result.message}</span></EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButtonIcon
                iconType="cross"
                size="xs"
                color="text"
                onClick={() => onDismiss(result.id)}
                aria-label="Dismiss"
              />
            </EuiFlexItem>
          </EuiFlexGroup>
        }
      >
        {result.suggestion && (
          <EuiText size="xs" color="subdued">
            <p style={{ fontSize: 10 }}>💡 {result.suggestion}</p>
          </EuiText>
        )}
        {result.docsUrl && (
          <a
            href={result.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            Docs <EuiIcon type="popout" size="s" />
          </a>
        )}
      </EuiCallOut>
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
export const StatusPanel = memo((): React.ReactElement | null => {
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

  const handleExpand = useCallback(() => setIsExpanded(true), []);
  const handleCollapse = useCallback(() => setIsExpanded(false), []);

  // Hide entirely when valid and no telemetry activity (demo indicator is now in ControlPanel)
  if (!isExpanded && !validationStats.hasIssues && !isActive) {
    return null;
  }

  // Collapsed state - show minimal badge
  if (!isExpanded) {
    return (
      <EuiPanel
        paddingSize="s"
        hasShadow
        borderRadius="m"
        style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 50, cursor: 'pointer' }}
        onClick={handleExpand}
        aria-label="Show status panel"
      >
        <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
          {/* Connection status */}
          <EuiFlexItem grow={false}>
            <EuiIcon
              type={isConnected ? 'online' : 'offline'}
              color={isConnected ? 'success' : 'danger'}
              size="s"
            />
          </EuiFlexItem>

          {/* Validation status */}
          {validationStats.errors.length > 0 && (
            <EuiFlexItem grow={false}>
              <EuiNotificationBadge color="accent">
                {validationStats.errors.length}
              </EuiNotificationBadge>
            </EuiFlexItem>
          )}
          {validationStats.warnings.length > 0 && (
            <EuiFlexItem grow={false}>
              <EuiFlexGroup alignItems="center" gutterSize="xs" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiIcon type="warning" color="warning" size="s" />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiText size="xs"><span>{validationStats.warnings.length}</span></EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
          )}

          {/* Telemetry activity dots (canvas zone animation - keep motion) */}
          {isActive && (
            <EuiFlexItem grow={false}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <motion.div
                  style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f59e0b' }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
                <motion.div
                  style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#3b82f6' }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
                />
                <motion.div
                  style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                />
              </div>
            </EuiFlexItem>
          )}

          {isDemoMode && (
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow">DEMO</EuiBadge>
            </EuiFlexItem>
          )}

          <EuiFlexItem grow={false}>
            <EuiIcon type="arrowUp" size="s" color="subdued" />
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    );
  }

  // Expanded state - show full panel with tabs
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ position: 'fixed', bottom: 16, right: 16, width: 320, maxHeight: '28rem', zIndex: 50 }}
    >
      <EuiPanel paddingSize="none" hasShadow borderRadius="m" style={{ display: 'flex', flexDirection: 'column', maxHeight: '28rem', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--euiColorLightShade)' }}>
          <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" gutterSize="s" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiIcon
                    type={isConnected ? 'online' : 'offline'}
                    color={isConnected ? 'success' : 'danger'}
                    size="s"
                  />
                </EuiFlexItem>
                {isDemoMode && (
                  <EuiFlexItem grow={false}>
                    <EuiBadge color="hollow">DEMO</EuiBadge>
                  </EuiFlexItem>
                )}
                <EuiFlexItem grow={false}>
                  <EuiText size="xs" color="subdued">
                    <span>{deploymentConfig.icon} {deploymentConfig.label}</span>
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>

            <EuiFlexItem grow={false}>
              <EuiButtonIcon
                iconType="arrowDown"
                size="xs"
                color="text"
                onClick={handleCollapse}
                aria-label="Collapse panel"
              />
            </EuiFlexItem>
          </EuiFlexGroup>

          {/* Tabs */}
          <EuiSpacer size="xs" />
          <EuiTabs size="s" bottomBorder={false}>
            <EuiTab
              isSelected={activeTab === 'validation'}
              onClick={() => setActiveTab('validation')}
              prepend={
                <EuiIcon
                  type={
                    validationStats.errors.length > 0
                      ? 'error'
                      : validationStats.warnings.length > 0
                      ? 'warning'
                      : 'checkInCircleFilled'
                  }
                  color={
                    validationStats.errors.length > 0
                      ? 'danger'
                      : validationStats.warnings.length > 0
                      ? 'warning'
                      : 'success'
                  }
                  size="s"
                />
              }
              append={
                validationStats.total > 0 ? (
                  <EuiNotificationBadge>{validationStats.total}</EuiNotificationBadge>
                ) : undefined
              }
            >
              Validation
            </EuiTab>
            <EuiTab
              isSelected={activeTab === 'telemetry'}
              onClick={() => setActiveTab('telemetry')}
              prepend={<EuiIcon type="visArea" color="primary" size="s" />}
              append={
                isActive ? (
                  <motion.div
                    style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#06b6d4' }}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                ) : undefined
              }
            >
              Telemetry
            </EuiTab>
            <EuiTab
              isSelected={activeTab === 'health'}
              onClick={() => setActiveTab('health')}
              prepend={<EuiIcon type="heart" color="success" size="s" />}
            >
              Health
            </EuiTab>
          </EuiTabs>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
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
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <EuiIcon type="checkInCircleFilled" color="success" size="xl" />
                    <EuiSpacer size="s" />
                    <EuiText size="s"><p>No validation issues</p></EuiText>
                    <EuiText size="xs" color="subdued"><p>Your topology is valid!</p></EuiText>
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
              >
                {/* Throughput meters - keep telemetry animation dots */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Traces */}
                  <EuiPanel paddingSize="s" hasBorder color="transparent">
                    <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" gutterSize="s" responsive={false}>
                      <EuiFlexItem grow={false}>
                        <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                          <EuiFlexItem grow={false}>
                            <motion.div
                              style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b' }}
                              animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                              transition={{ duration: 0.5, repeat: Infinity }}
                            />
                          </EuiFlexItem>
                          <EuiFlexItem grow={false}>
                            <EuiText size="xs" color="subdued"><span>Traces</span></EuiText>
                          </EuiFlexItem>
                        </EuiFlexGroup>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiText size="s">
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f59e0b' }}>
                            {telemetryStats.totalTraces}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--euiColorMediumShade)' }}>/s</span>
                        </EuiText>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </EuiPanel>

                  {/* Metrics */}
                  <EuiPanel paddingSize="s" hasBorder color="transparent">
                    <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" gutterSize="s" responsive={false}>
                      <EuiFlexItem grow={false}>
                        <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                          <EuiFlexItem grow={false}>
                            <motion.div
                              style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6' }}
                              animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                              transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
                            />
                          </EuiFlexItem>
                          <EuiFlexItem grow={false}>
                            <EuiText size="xs" color="subdued"><span>Metrics</span></EuiText>
                          </EuiFlexItem>
                        </EuiFlexGroup>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiText size="s">
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#3b82f6' }}>
                            {telemetryStats.totalMetrics}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--euiColorMediumShade)' }}>/s</span>
                        </EuiText>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </EuiPanel>

                  {/* Logs */}
                  <EuiPanel paddingSize="s" hasBorder color="transparent">
                    <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" gutterSize="s" responsive={false}>
                      <EuiFlexItem grow={false}>
                        <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                          <EuiFlexItem grow={false}>
                            <motion.div
                              style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }}
                              animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                              transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                            />
                          </EuiFlexItem>
                          <EuiFlexItem grow={false}>
                            <EuiText size="xs" color="subdued"><span>Logs</span></EuiText>
                          </EuiFlexItem>
                        </EuiFlexGroup>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiText size="s">
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#10b981' }}>
                            {telemetryStats.totalLogs}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--euiColorMediumShade)' }}>/s</span>
                        </EuiText>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </EuiPanel>
                </div>

                {/* Buffer info */}
                <EuiSpacer size="s" />
                <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" gutterSize="none" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiText size="xs" color="subdued"><span>Buffer</span></EuiText>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiText size="xs" color="subdued">
                      <span style={{ fontFamily: 'monospace' }}>{recentEvents.length} events</span>
                    </EuiText>
                  </EuiFlexItem>
                </EuiFlexGroup>

                {/* Activity indicator */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}
                    >
                      <EuiIcon type="visArea" size="s" color="primary" />
                      <EuiText size="xs" color="primary"><span>Receiving telemetry...</span></EuiText>
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
      </EuiPanel>
    </motion.div>
  );
});

StatusPanel.displayName = 'StatusPanel';
