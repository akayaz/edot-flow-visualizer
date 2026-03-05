'use client';

import { memo, useState, useCallback } from 'react';
import {
  EuiHeader,
  EuiHeaderSectionItemButton,
  EuiHeaderLogo,
  EuiHeaderLinks,
  EuiHeaderLink,
  EuiPopover,
  EuiToolTip,
  EuiIcon,
  EuiText,
  EuiContextMenuPanel,
  EuiContextMenuItem,
  useEuiTheme,
} from '@elastic/eui';
import { useFlowStore } from '../../store/flowStore';
import { useTelemetryStore } from '../../store/telemetryStore';
import { useThemeStore } from '../../store/themeStore';
import { useValidationStore } from '../../store/validationStore';
import { scenarioList } from '../../data/scenarios';
import { DEPLOYMENT_MODEL_CONFIG } from '../../types';
import type { ScenarioId } from '../../types';
import { DeploymentSelector } from './DeploymentSelector';

interface ControlPanelProps {
  onToggleDemo?: () => void;
  onOpenDetection?: () => void;
  onCopyDiagram?: () => Promise<void>;
}

export const ControlPanel = memo(({ onToggleDemo, onCopyDiagram }: ControlPanelProps): React.ReactElement => {
  const [isDeploymentOpen, setIsDeploymentOpen] = useState(false);
  const [isScenarioOpen, setIsScenarioOpen] = useState(false);
  const { euiTheme } = useEuiTheme();

  const {
    nodes,
    scenario,
    setScenario,
    isAnimating,
    toggleAnimation,
    toggleConfigPanel,
    resetToOriginal,
    deploymentModel,
  } = useFlowStore();

  const { isDemoMode, isConnected } = useTelemetryStore();
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const validationResults = useValidationStore((s) => s.validationResults);

  const hasCollector = nodes.some((n) => n.type === 'collector');
  const hasElastic = nodes.some((n) => n.data?.componentType === 'elastic-apm');
  const hasErrors = validationResults.some((r) => r.severity === 'error');
  const isExportReady = hasCollector && hasElastic && !hasErrors;

  const currentScenario = scenarioList.find((s) => s.id === scenario);
  const currentDeployment = DEPLOYMENT_MODEL_CONFIG[deploymentModel];

  const handleScenarioSelect = useCallback((id: ScenarioId): void => {
    setScenario(id);
    setIsScenarioOpen(false);
  }, [setScenario]);

  // --- Popover trigger buttons using EuiHeaderLink for uniform font/alignment ---

  const deploymentButton = (
    <EuiHeaderLink
      onClick={() => {
        setIsDeploymentOpen(!isDeploymentOpen);
        setIsScenarioOpen(false);
      }}
      aria-label={`Deployment: ${currentDeployment.label}`}
      iconType="cloudSunny"
      color="text"
    >
      {currentDeployment.label}
      {' '}
      <EuiIcon type={isDeploymentOpen ? 'arrowUp' : 'arrowDown'} size="s" />
    </EuiHeaderLink>
  );

  const scenarioButton = (
    <EuiHeaderLink
      onClick={() => {
        setIsScenarioOpen(!isScenarioOpen);
        setIsDeploymentOpen(false);
      }}
      aria-label={currentScenario?.description || 'Select scenario'}
      color="text"
    >
      {currentScenario?.name || 'Scenario'}
      {' '}
      <EuiIcon type={isScenarioOpen ? 'arrowUp' : 'arrowDown'} size="s" />
    </EuiHeaderLink>
  );

  const scenarioMenuItems = scenarioList.map((s) => (
    <EuiContextMenuItem
      key={s.id}
      icon={<span style={{ fontSize: 16 }}>{s.icon}</span>}
      onClick={() => handleScenarioSelect(s.id)}
      style={{
        backgroundColor: scenario === s.id ? `${euiTheme.colors.primary}15` : undefined,
      }}
    >
      <EuiText size="s">
        <strong style={{ color: scenario === s.id ? euiTheme.colors.primary : undefined }}>
          {s.name}
        </strong>
      </EuiText>
      <EuiText size="xs" color="subdued">{s.description}</EuiText>
    </EuiContextMenuItem>
  ));

  return (
    <EuiHeader
      position="fixed"
      theme={resolvedTheme === 'dark' ? 'dark' : 'default'}
      sections={[
        // ---- LEFT SECTION: Logo + Context selectors ----
        {
          items: [
            <EuiHeaderLogo
              key="logo"
              iconType="logoElastic"
              href="/"
            >
              EDOT Flow
            </EuiHeaderLogo>,

            // Deployment popover
            <EuiPopover
              key="deployment"
              button={deploymentButton}
              isOpen={isDeploymentOpen}
              closePopover={() => setIsDeploymentOpen(false)}
              panelPaddingSize="m"
              anchorPosition="downLeft"
            >
              <div style={{ width: 320 }}>
                <EuiText size="xs" color="subdued">
                  <p style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>
                    Deployment Target
                  </p>
                </EuiText>
                <DeploymentSelector />
              </div>
            </EuiPopover>,

            // Scenario popover
            <EuiPopover
              key="scenario"
              button={scenarioButton}
              isOpen={isScenarioOpen}
              closePopover={() => setIsScenarioOpen(false)}
              panelPaddingSize="none"
              anchorPosition="downLeft"
            >
              <EuiContextMenuPanel
                items={scenarioMenuItems}
                style={{ width: 280 }}
                title="Architecture Pattern"
              />
            </EuiPopover>,
          ],
        },

        // ---- RIGHT SECTION: Export + Toggles ----
        {
          items: [
            <EuiHeaderLinks key="actions">
              <EuiHeaderLink
                iconType="exportAction"
                onClick={toggleConfigPanel}
                color={isExportReady ? 'success' : 'primary'}
              >
                Export{isExportReady ? ' ✓' : ''}
              </EuiHeaderLink>
            </EuiHeaderLinks>,

            // Divider between labeled actions and icon toggles
            <span
              key="divider"
              style={{
                borderLeft: `1px solid ${euiTheme.border.color}`,
                height: 24,
                margin: '0 4px',
                alignSelf: 'center',
                opacity: 0.4,
              }}
            />,

            // Copy diagram to clipboard
            <EuiToolTip key="copy-diagram" content="Copy diagram as PNG" position="bottom">
              <EuiHeaderSectionItemButton
                onClick={() => {
                  void onCopyDiagram?.();
                }}
                aria-label="Copy diagram as PNG"
                disabled={nodes.length === 0}
              >
                <EuiIcon type="copyClipboard" size="m" color={nodes.length > 0 ? 'primary' : 'subdued'} />
              </EuiHeaderSectionItemButton>
            </EuiToolTip>,

            // Clear canvas
            <EuiToolTip key="clear" content="Clear canvas" position="bottom">
              <EuiHeaderSectionItemButton
                onClick={resetToOriginal}
                aria-label="Clear canvas"
                disabled={nodes.length === 0}
              >
                <EuiIcon type="eraser" size="m" color={nodes.length > 0 ? 'warning' : 'subdued'} />
              </EuiHeaderSectionItemButton>
            </EuiToolTip>,

            // Demo mode
            <EuiToolTip key="demo" content={isDemoMode ? 'Stop demo data' : 'Start demo data'} position="bottom">
              <EuiHeaderSectionItemButton
                onClick={onToggleDemo}
                aria-label={isDemoMode ? 'Stop demo data' : 'Start demo data'}
                disabled={!isConnected}
                notification={isDemoMode}
              >
                <EuiIcon type={isDemoMode ? 'stopFilled' : 'bolt'} color={isDemoMode ? 'accent' : 'subdued'} size="m" />
              </EuiHeaderSectionItemButton>
            </EuiToolTip>,

            // Animation toggle
            <EuiToolTip key="animation" content={isAnimating ? 'Pause animations' : 'Play animations'} position="bottom">
              <EuiHeaderSectionItemButton onClick={toggleAnimation} aria-label={isAnimating ? 'Pause' : 'Play'}>
                <EuiIcon type={isAnimating ? 'pause' : 'playFilled'} color={isAnimating ? 'success' : 'subdued'} size="m" />
              </EuiHeaderSectionItemButton>
            </EuiToolTip>,

            // Theme toggle
            <EuiToolTip key="theme" content={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'} position="bottom">
              <EuiHeaderSectionItemButton onClick={toggleTheme} aria-label="Toggle theme">
                <EuiIcon type={resolvedTheme === 'dark' ? 'sun' : 'moon'} color="subdued" size="m" />
              </EuiHeaderSectionItemButton>
            </EuiToolTip>,
          ],
        },
      ]}
    />
  );
});

ControlPanel.displayName = 'ControlPanel';
