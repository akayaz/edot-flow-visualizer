'use client';

import { memo } from 'react';
import {
  EuiEmptyPrompt,
  EuiButton,
  EuiText,
  EuiCode,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiBadge,
  EuiSpacer,
  EuiPanel,
} from '@elastic/eui';
import { useFlowStore } from '../../store/flowStore';
import { DEPLOYMENT_MODEL_CONFIG } from '../../types';

interface EmptyStateProps {
  onOpenQuickStart: () => void;
}

export const EmptyState = memo(({ onOpenQuickStart }: EmptyStateProps): React.ReactElement => {
  const { deploymentModel } = useFlowStore();
  const deploymentConfig = DEPLOYMENT_MODEL_CONFIG[deploymentModel];

  const getRecommendedPattern = (): string => {
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
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 5 }}>
      <div style={{ pointerEvents: 'auto', maxWidth: 560 }}>
        <EuiPanel hasBorder paddingSize="none" style={{ overflow: 'hidden' }}>
          <EuiEmptyPrompt
            iconType="layers"
            iconColor="primary"
            layout="vertical"
            title={<h2>Design Your EDOT Architecture</h2>}
            body={
              <>
                <p>Build observability pipelines visually with Elastic&apos;s OpenTelemetry distribution</p>
                <EuiSpacer size="m" />
                <EuiPanel color="subdued" paddingSize="m" hasBorder={false}>
                  <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiBadge color="primary" iconType="cloudSunny" iconSide="left">
                        {deploymentConfig.label}
                      </EuiBadge>
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText size="xs" color="subdued"><span>deployment selected</span></EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                  <EuiSpacer size="s" />
                  <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiIcon type="beaker" color="warning" size="m" />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText size="xs">
                        <strong>Recommended:</strong>{' '}
                        <EuiCode transparentBackground>{getRecommendedPattern()}</EuiCode>
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiPanel>
              </>
            }
            actions={
              <EuiButton fill iconType="launch" onClick={onOpenQuickStart}>
                Quick Start Templates
              </EuiButton>
            }
            footer={
              <EuiFlexGroup justifyContent="center" gutterSize="l" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiBadge color="hollow">⌘Z</EuiBadge>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="xs" color="subdued">Undo</EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiBadge color="hollow">Del</EuiBadge>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="xs" color="subdued">Remove</EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiText size="xs" color="subdued">
                    Drag from palette to build
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            }
          />
        </EuiPanel>
      </div>
    </div>
  );
});

EmptyState.displayName = 'EmptyState';
