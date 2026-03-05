'use client';

import { memo, useCallback } from 'react';
import {
  EuiButtonGroup,
  EuiText,
  EuiLink,
  EuiBadge,
  EuiIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiPanel,
} from '@elastic/eui';
import { useFlowStore } from '../../store/flowStore';
import { DEPLOYMENT_MODEL_CONFIG, type DeploymentModel } from '../../types';

const DEPLOYMENT_ICON_MAP: Record<DeploymentModel, string> = {
  serverless: 'logoCloud',
  ech: 'logoElasticStack',
  'self-managed': 'wrench',
};

const buttonOptions = (Object.keys(DEPLOYMENT_MODEL_CONFIG) as DeploymentModel[]).map(
  (model) => ({
    id: model,
    label: DEPLOYMENT_MODEL_CONFIG[model].label,
    iconType: DEPLOYMENT_ICON_MAP[model],
  })
);

/**
 * DeploymentSelector Component
 *
 * Allows users to select the target Elastic deployment model.
 * This affects validation rules and connectivity patterns:
 * - Serverless/ECH: Direct OTLP to Managed Endpoint is valid
 * - Self-Managed: Gateway collector is recommended
 */
export const DeploymentSelector = memo((): React.ReactElement => {
  const { deploymentModel, setDeploymentModel } = useFlowStore();
  const currentConfig = DEPLOYMENT_MODEL_CONFIG[deploymentModel];

  const handleChange = useCallback(
    (id: string) => {
      setDeploymentModel(id as DeploymentModel);
    },
    [setDeploymentModel]
  );

  return (
    <div>
      {/* Selector buttons */}
      <EuiButtonGroup
        legend="Select deployment model"
        options={buttonOptions}
        idSelected={deploymentModel}
        onChange={handleChange}
        buttonSize="compressed"
        isFullWidth
      />

      <EuiSpacer size="s" />

      {/* Info panel */}
      <EuiPanel paddingSize="s" hasBorder color="transparent">
        <EuiFlexGroup gutterSize="s" responsive={false} alignItems="flexStart">
          <EuiFlexItem grow={false}>
            <EuiIcon type="info" color="primary" size="s" style={{ marginTop: 2 }} />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText size="xs">
              <p>{currentConfig.description}</p>
            </EuiText>

            <EuiSpacer size="xs" />

            <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
              {currentConfig.features.managedOtlpEndpoint && (
                <EuiFlexItem grow={false}>
                  <EuiBadge color="success">Managed OTLP Endpoint</EuiBadge>
                </EuiFlexItem>
              )}
              {currentConfig.features.gatewayRequired && (
                <EuiFlexItem grow={false}>
                  <EuiBadge color="warning">Gateway Required</EuiBadge>
                </EuiFlexItem>
              )}
              {currentConfig.features.supportsKafkaTier && (
                <EuiFlexItem grow={false}>
                  <EuiBadge color="accent">Kafka HA Tier</EuiBadge>
                </EuiFlexItem>
              )}
            </EuiFlexGroup>

            <EuiSpacer size="xs" />

            <EuiLink href={currentConfig.docsUrl} target="_blank" external>
              View EDOT Docs
            </EuiLink>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    </div>
  );
});

DeploymentSelector.displayName = 'DeploymentSelector';
