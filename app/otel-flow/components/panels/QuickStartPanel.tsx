'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EuiModal,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiModalBody,
  EuiModalFooter,
  EuiButton,
  EuiButtonEmpty,
  EuiCard,
  EuiFlexGroup,
  EuiFlexItem,
  EuiBadge,
  EuiText,
  EuiCallOut,
  EuiIcon,
  EuiSpacer,
  EuiLink,
} from '@elastic/eui';
import { useFlowStore } from '../../store/flowStore';
import { DEPLOYMENT_MODEL_CONFIG, type DeploymentModel } from '../../types';

interface QuickStartTemplate {
  id: string;
  name: string;
  iconType: string;
  description: string;
  pattern: string;
  recommendedFor: DeploymentModel[];
  notRecommendedFor?: DeploymentModel[];
  warning?: string;
  benefits: string[];
  scenarioId: 'simple' | 'agent' | 'gateway' | 'production' | 'kubernetes';
  docsUrl?: string;
}

const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  {
    id: 'direct-ingest',
    name: 'Direct Ingestion',
    iconType: 'sortRight',
    description: 'SDK sends telemetry directly to Elastic via Managed OTLP Endpoint. Simplest setup - no collectors needed.',
    pattern: 'SDK → Elastic (Managed OTLP Endpoint)',
    recommendedFor: ['serverless', 'ech'],
    notRecommendedFor: ['self-managed'],
    warning: 'Not recommended for Self-Managed. Gateway is required as ingestion layer.',
    benefits: ['Zero infrastructure to manage', 'Fastest time to value', 'Automatic scaling by Elastic'],
    scenarioId: 'simple',
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms',
  },
  {
    id: 'agent-managed',
    name: 'Agent to Managed Endpoint',
    iconType: 'package',
    description: 'Per-host Agent collector provides host metrics and local buffering. Sends to Managed OTLP Endpoint.',
    pattern: 'SDK → Agent → Elastic (Managed OTLP Endpoint)',
    recommendedFor: ['serverless', 'ech'],
    notRecommendedFor: ['self-managed'],
    warning: 'For Self-Managed, Agent should send to Gateway, not directly to Elasticsearch.',
    benefits: ['Host metrics (CPU, memory, disk)', 'Resource attribute enrichment', 'Local buffering for reliability'],
    scenarioId: 'agent',
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/edot-collector/modes',
  },
  {
    id: 'self-managed-full',
    name: 'Full Pipeline (Self-Managed)',
    iconType: 'layers',
    description: 'Complete EDOT pipeline for self-managed. Gateway is REQUIRED as ingestion layer (replaces APM Server).',
    pattern: 'SDK → Agent → Gateway → Elasticsearch',
    recommendedFor: ['self-managed'],
    benefits: ['Gateway replaces APM Server', 'Host metrics from Agent', 'Tail-based sampling at Gateway', 'Single egress point'],
    scenarioId: 'gateway',
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/edot-collector/modes#gateway',
  },
  {
    id: 'self-managed-gateway-only',
    name: 'Gateway Only (Self-Managed)',
    iconType: 'compute',
    description: 'SDK sends directly to Gateway. Use when host metrics come from elsewhere (e.g., containerized apps).',
    pattern: 'SDK → Gateway → Elasticsearch',
    recommendedFor: ['self-managed'],
    benefits: ['Simpler than full pipeline', 'Gateway handles ingestion', 'Good for containers/K8s'],
    scenarioId: 'production',
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/hosts_vms',
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    iconType: 'logoKubernetes',
    description: 'DaemonSet agents on each node collect pod telemetry. Gateway Deployment for centralized processing.',
    pattern: 'Pods → DaemonSet (Agent) → Deployment (Gateway) → Elastic',
    recommendedFor: ['ech', 'self-managed'],
    benefits: ['K8s metadata enrichment (k8sattributes)', 'Per-node collection via DaemonSet', 'Scalable Gateway Deployment'],
    scenarioId: 'kubernetes',
    docsUrl: 'https://www.elastic.co/docs/reference/opentelemetry/architecture/kubernetes',
  },
];

interface QuickStartPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickStartPanel = memo(({ isOpen, onClose }: QuickStartPanelProps): React.ReactElement | null => {
  const { deploymentModel, setScenario, setDeploymentModel } = useFlowStore();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleApplyTemplate = (template: QuickStartTemplate): void => {
    if (!template.recommendedFor.includes(deploymentModel)) {
      setDeploymentModel(template.recommendedFor[0]);
    }
    setScenario(template.scenarioId);
    onClose();
  };

  const sortedTemplates = [...QUICK_START_TEMPLATES].sort((a, b) => {
    const aRecommended = a.recommendedFor.includes(deploymentModel);
    const bRecommended = b.recommendedFor.includes(deploymentModel);
    if (aRecommended && !bRecommended) return -1;
    if (!aRecommended && bRecommended) return 1;
    return 0;
  });

  if (!isOpen) return null;

  return (
    <EuiModal onClose={onClose} maxWidth="900px">
      <EuiModalHeader>
        <EuiModalHeaderTitle>
          <EuiFlexGroup alignItems="center" gutterSize="s">
            <EuiFlexItem grow={false}>
              <EuiIcon type="launch" size="l" color="primary" />
            </EuiFlexItem>
            <EuiFlexItem>
              <span>Quick Start Templates</span>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color="primary">
                {DEPLOYMENT_MODEL_CONFIG[deploymentModel].icon} {DEPLOYMENT_MODEL_CONFIG[deploymentModel].label}
              </EuiBadge>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiModalHeaderTitle>
      </EuiModalHeader>

      <EuiModalBody>
        {/* Deployment guidance */}
        <EuiCallOut
          title={deploymentModel === 'self-managed'
            ? 'Self-Managed: Gateway is required as the ingestion layer'
            : `${DEPLOYMENT_MODEL_CONFIG[deploymentModel].label}: Uses Managed OTLP Endpoint. Gateway is optional.`
          }
          color={deploymentModel === 'self-managed' ? 'warning' : 'primary'}
          iconType="info"
          size="s"
        />
        <EuiSpacer size="m" />

        {/* Templates Grid */}
        <EuiFlexGroup wrap gutterSize="m">
          {sortedTemplates.map((template) => {
            const isRecommended = template.recommendedFor.includes(deploymentModel);
            const isNotRecommended = template.notRecommendedFor?.includes(deploymentModel);
            const isSelected = selectedTemplate === template.id;

            return (
              <EuiFlexItem key={template.id} style={{ minWidth: 260, maxWidth: 300 }}>
                <EuiCard
                  icon={<EuiIcon type={template.iconType} size="xl" color={isRecommended ? 'primary' : isNotRecommended ? 'warning' : 'subdued'} />}
                  title={template.name}
                  description={template.description}
                  betaBadgeProps={
                    isRecommended
                      ? { label: 'Recommended', color: 'accent' as const }
                      : isNotRecommended
                        ? { label: `Not for ${DEPLOYMENT_MODEL_CONFIG[deploymentModel].label}`, color: 'warning' as const }
                        : undefined
                  }
                  selectable={{
                    onClick: () => setSelectedTemplate(isSelected ? null : template.id),
                    isSelected,
                  }}
                  footer={
                    isSelected ? (
                      <div>
                        <EuiText size="xs" color="subdued">
                          <p style={{ fontFamily: 'monospace', marginBottom: 8 }}>{template.pattern}</p>
                        </EuiText>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {template.benefits.map((b, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 4 }}>
                              <EuiIcon type="check" size="s" color="success" />
                              {b}
                            </li>
                          ))}
                        </ul>
                        {isNotRecommended && template.warning && (
                          <>
                            <EuiSpacer size="xs" />
                            <EuiCallOut title="" color="warning" iconType="warning" size="s">
                              <p style={{ fontSize: 11 }}>{template.warning}</p>
                            </EuiCallOut>
                          </>
                        )}
                        <EuiSpacer size="s" />
                        <EuiFlexGroup gutterSize="s">
                          <EuiFlexItem>
                            <EuiButton
                              fill
                              size="s"
                              color={isNotRecommended ? 'warning' : 'primary'}
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                handleApplyTemplate(template);
                              }}
                            >
                              {isNotRecommended ? 'Apply Anyway' : 'Apply Template'}
                            </EuiButton>
                          </EuiFlexItem>
                          {template.docsUrl && (
                            <EuiFlexItem grow={false}>
                              <EuiButtonEmpty
                                size="s"
                                iconType="popout"
                                href={template.docsUrl}
                                target="_blank"
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              >
                                Docs
                              </EuiButtonEmpty>
                            </EuiFlexItem>
                          )}
                        </EuiFlexGroup>
                      </div>
                    ) : undefined
                  }
                />
              </EuiFlexItem>
            );
          })}
        </EuiFlexGroup>
      </EuiModalBody>

      <EuiModalFooter>
        <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
          <EuiFlexItem>
            <EuiText size="xs" color="subdued">
              <p>Templates can be customized after applying. Add or remove components as needed.</p>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiLink href="https://www.elastic.co/docs/reference/opentelemetry" target="_blank" external>
              EDOT Docs
            </EuiLink>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiModalFooter>
    </EuiModal>
  );
});

QuickStartPanel.displayName = 'QuickStartPanel';
