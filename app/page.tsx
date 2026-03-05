'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  EuiPageTemplate,
  EuiTitle,
  EuiText,
  EuiCard,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiBadge,
  EuiSpacer,
  EuiLink,
  EuiButtonGroup,
  EuiHeader,
  EuiHeaderLogo,
  EuiHeaderSection,
  EuiHeaderSectionItem,
  EuiButtonIcon,
  EuiPanel,
  EuiToolTip,
} from '@elastic/eui';
import { useFlowStore } from './otel-flow/store/flowStore';
import { useThemeStore } from './otel-flow/store/themeStore';
import { DEPLOYMENT_MODEL_CONFIG, type DeploymentModel } from './otel-flow/types';

// Shorter labels for the button group to prevent truncation
const DEPLOYMENT_BUTTON_LABELS: Record<DeploymentModel, string> = {
  serverless: 'Serverless',
  ech: 'Cloud Hosted',
  'self-managed': 'Self-Managed',
};

const DEPLOYMENT_ICON_MAP: Record<DeploymentModel, string> = {
  serverless: 'logoCloud',
  ech: 'logoElasticStack',
  'self-managed': 'wrench',
};

const deploymentOptions = (Object.keys(DEPLOYMENT_MODEL_CONFIG) as DeploymentModel[]).map(
  (model) => ({
    id: model,
    label: DEPLOYMENT_BUTTON_LABELS[model],
    iconType: DEPLOYMENT_ICON_MAP[model],
  })
);

const workflowTiles = [
  {
    id: 'design',
    iconType: 'grid',
    title: 'Design Your Architecture',
    description: 'Drag and drop EDOT components to build your telemetry pipeline visually',
    href: '/otel-flow?quickstart=true',
    tags: ['5 templates', 'Drag & drop', 'Auto-validation'],
    color: 'primary' as const,
  },
  {
    id: 'import',
    iconType: 'importAction',
    title: 'Import Configuration',
    description: 'Upload existing Collector YAML, Docker Compose, or K8s manifests',
    href: '/otel-flow?panel=detection&method=yaml',
    tags: ['.yaml', 'Docker Compose', 'K8s manifests'],
    color: 'success' as const,
  },
  {
    id: 'detect',
    iconType: 'online',
    title: 'Detect Live Traffic',
    description: 'Analyze incoming OTLP telemetry to auto-discover your topology',
    href: '/otel-flow?panel=detection&method=traffic',
    tags: ['Auto-discovery', 'Services', 'Connections'],
    color: 'accent' as const,
  },
];

const capabilities = [
  { iconType: 'crosshairs', label: 'Health Scoring' },
  { iconType: 'exportAction', label: 'Multi-format Export' },
  { iconType: 'bolt', label: 'Live Data Flow' },
];

export default function HomePage(): React.ReactElement {
  const router = useRouter();
  const { deploymentModel, setDeploymentModel } = useFlowStore();
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const currentConfig = DEPLOYMENT_MODEL_CONFIG[deploymentModel];

  const handleDeploymentChange = useCallback(
    (id: string) => {
      setDeploymentModel(id as DeploymentModel);
    },
    [setDeploymentModel]
  );

  const handleTileClick = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header (minimal — just theme toggle) ── */}
      <EuiHeader
        position="fixed"
        theme="dark"
        sections={[
          {
            items: [
              <EuiHeaderLogo key="logo" iconType="logoElastic" href="/">
                EDOT
              </EuiHeaderLogo>,
            ],
          },
          {
            items: [
              <EuiHeaderSection key="actions">
                <EuiHeaderSectionItem>
                  <EuiToolTip content={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                    <EuiButtonIcon
                      iconType={resolvedTheme === 'dark' ? 'sun' : 'moon'}
                      onClick={toggleTheme}
                      aria-label="Toggle theme"
                      color="text"
                      size="s"
                    />
                  </EuiToolTip>
                </EuiHeaderSectionItem>
              </EuiHeaderSection>,
            ],
          },
        ]}
      />

      {/* ── Main Content ── */}
      <EuiPageTemplate
        paddingSize="l"
        style={{ flex: 1 }}
        offset={48}
      >
        <EuiPageTemplate.Section alignment="center" grow>
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}
          >
            <EuiSpacer size="l" />

            <EuiFlexGroup justifyContent="center" alignItems="center" gutterSize="m" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiIcon type="logoElastic" size="xl" />
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiTitle size="l">
                  <h1 style={{ fontWeight: 700 }}>
                    EDOT Flow Visualizer
                  </h1>
                </EuiTitle>
              </EuiFlexItem>
            </EuiFlexGroup>

            <EuiSpacer size="s" />

            <EuiText color="subdued">
              <p>Design your OTel architecture</p>
            </EuiText>
          </motion.div>

          <EuiSpacer size="xl" />

          {/* Deployment Selector */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            style={{ maxWidth: 500, margin: '0 auto' }}
          >
            <EuiPanel color="subdued" paddingSize="m" hasBorder={false}>
              <EuiText size="xs" color="subdued" style={{ textAlign: 'center' }}>
                <strong>Deployment target</strong>
              </EuiText>
              <EuiSpacer size="s" />
              <EuiButtonGroup
                legend="Deployment model"
                options={deploymentOptions}
                idSelected={deploymentModel}
                onChange={handleDeploymentChange}
                buttonSize="compressed"
                isFullWidth
              />
              <EuiSpacer size="xs" />
              <EuiText size="xs" color="subdued" style={{ textAlign: 'center' }}>
                <p>{currentConfig.description}</p>
              </EuiText>
            </EuiPanel>
          </motion.div>

          <EuiSpacer size="xl" />

          {/* Workflow Tiles */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            style={{ maxWidth: 960, margin: '0 auto' }}
          >
            <EuiFlexGroup gutterSize="l" alignItems="stretch">
              {workflowTiles.map((tile, index) => (
                <EuiFlexItem key={tile.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.08 }}
                    whileHover={{ y: -3, transition: { duration: 0.15 } }}
                    style={{ height: '100%' }}
                  >
                    <EuiCard
                      icon={<EuiIcon type={tile.iconType} size="xl" color={tile.color} />}
                      title={tile.title}
                      description={tile.description}
                      paddingSize="l"
                      onClick={() => handleTileClick(tile.href)}
                      hasBorder
                      style={{ cursor: 'pointer', height: '100%' }}
                      footer={
                        <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
                          {tile.tags.map((tag) => (
                            <EuiFlexItem key={tag} grow={false}>
                              <EuiBadge color="hollow">{tag}</EuiBadge>
                            </EuiFlexItem>
                          ))}
                        </EuiFlexGroup>
                      }
                    />
                  </motion.div>
                </EuiFlexItem>
              ))}
            </EuiFlexGroup>
          </motion.div>

          <EuiSpacer size="xl" />

          {/* Capabilities — lightweight horizontal strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.35 }}
            style={{ maxWidth: 640, margin: '0 auto' }}
          >
            <EuiFlexGroup justifyContent="center" gutterSize="l" responsive={false}>
              {capabilities.map((cap) => (
                <EuiFlexItem key={cap.label} grow={false}>
                  <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiIcon type={cap.iconType} color="subdued" size="m" />
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="xs" color="subdued">
                        <span>{cap.label}</span>
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
              ))}
            </EuiFlexGroup>
          </motion.div>

          <EuiSpacer size="xl" />

          {/* Footer */}
          <div style={{ textAlign: 'center' }}>
            <EuiText size="xs" color="subdued">
              <p>
                Powered by{' '}
                <EuiLink
                  href="https://www.elastic.co/docs/reference/opentelemetry"
                  target="_blank"
                  external
                >
                  Elastic Distribution of OpenTelemetry
                </EuiLink>
              </p>
            </EuiText>
          </div>

          <EuiSpacer size="l" />
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    </div>
  );
}
