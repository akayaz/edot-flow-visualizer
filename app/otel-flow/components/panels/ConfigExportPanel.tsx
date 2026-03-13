'use client';

import { memo, useState, useMemo, useCallback, useEffect } from 'react';
import {
  EuiFlyout,
  EuiFlyoutHeader,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiTitle,
  EuiTabs,
  EuiTab,
  EuiCodeBlock,
  EuiButton,
  EuiButtonEmpty,
  EuiText,
  EuiIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiFieldText,
  EuiSelect,
  EuiSpacer,
  EuiSwitch,
  EuiCallOut,
} from '@elastic/eui';
import { useFlowStore } from '../../store/flowStore';
import { generateCollectorYAML } from '../../lib/yaml-generator';
import {
  generateDockerCompose,
  downloadDockerCompose,
} from '../../lib/docker-compose-generator';
import {
  generateK8sManifests,
  downloadK8sManifests,
} from '../../lib/k8s-manifest-generator';
import {
  downloadConfigBundle,
  previewBundleContents,
} from '../../lib/config-bundle-generator';
import type { CollectorNodeData, SDKNodeData } from '../../types';
import type { DiagramExportOptions } from '../../lib/diagram-export';

type ExportType = 'collector' | 'deployment' | 'bundle' | 'diagram';
type DeploymentSubType = 'docker' | 'kubernetes';
type DiagramFormat = 'png' | 'svg' | 'jpeg';

interface ConfigExportPanelProps {
  getViewportElement: () => HTMLElement | null;
  onDownloadDiagram: (options: DiagramExportOptions) => Promise<void>;
  onCopyDiagram: (options?: Omit<DiagramExportOptions, 'format'>) => Promise<void>;
}

export const ConfigExportPanel = memo(({
  getViewportElement,
  onDownloadDiagram,
  onCopyDiagram,
}: ConfigExportPanelProps) => {
  const { isConfigPanelOpen, toggleConfigPanel, nodes, edges, deploymentModel } = useFlowStore();
  const [copied, setCopied] = useState(false);
  const [selectedCollector, setSelectedCollector] = useState<string | null>(null);
  const [exportType, setExportType] = useState<ExportType>('collector');
  const [deploymentSubType, setDeploymentSubType] = useState<DeploymentSubType>('docker');
  const [isDownloadingBundle, setIsDownloadingBundle] = useState(false);
  const [showYAMLPreview, setShowYAMLPreview] = useState(false);
  const [k8sNamespace, setK8sNamespace] = useState('observability');
  const [diagramFormat, setDiagramFormat] = useState<DiagramFormat>('png');
  const [diagramScale, setDiagramScale] = useState('2');
  const [transparentBg, setTransparentBg] = useState(false);
  const [diagramPreviewUrl, setDiagramPreviewUrl] = useState<string | null>(null);
  const [isGeneratingDiagramPreview, setIsGeneratingDiagramPreview] = useState(false);
  const [isExportingDiagram, setIsExportingDiagram] = useState(false);
  const [isCopyingDiagram, setIsCopyingDiagram] = useState(false);

  // Find all collectors in the topology
  const collectors = useMemo(
    () =>
      nodes.filter(
        (n) =>
          n.data.componentType === 'collector-agent' ||
          n.data.componentType === 'collector-gateway'
      ),
    [nodes]
  );

  // Find all SDK nodes
  const sdkNodes = useMemo(
    () => nodes.filter((n) => n.data.componentType === 'edot-sdk') as { data: SDKNodeData; id: string }[],
    [nodes]
  );

  // Check if topology has enough components for Docker/K8s export
  const hasComponents = useMemo(
    () => nodes.some((n) => n.data.componentType === 'edot-sdk' || 
                           n.data.componentType === 'collector-agent' ||
                           n.data.componentType === 'collector-gateway'),
    [nodes]
  );

  // Docker project file tree preview
  const dockerProjectPreview = useMemo(() => {
    if (exportType !== 'deployment' || deploymentSubType !== 'docker' || !hasComponents) return [];
    const items: { path: string; type: 'file' | 'dir' }[] = [];

    // Apps
    for (const sdk of sdkNodes) {
      const name = (sdk.data.serviceName || sdk.data.label).toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      items.push({ path: `apps/${name}/Dockerfile`, type: 'file' });
      items.push({ path: `apps/${name}/(source files)`, type: 'file' });
    }

    // Configs
    for (const collector of collectors) {
      const name = collector.data.label.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      items.push({ path: `configs/${name}-config.yaml`, type: 'file' });
    }

    items.push({ path: 'docker-compose.yml', type: 'file' });
    items.push({ path: '.env.example', type: 'file' });
    items.push({ path: 'Makefile', type: 'file' });
    items.push({ path: 'README.md', type: 'file' });

    return items;
  }, [exportType, deploymentSubType, hasComponents, sdkNodes, collectors]);

  // K8s manifest preview items
  const k8sPreviewItems = useMemo(() => {
    if (exportType !== 'deployment' || deploymentSubType !== 'kubernetes' || !hasComponents) return [];
    const items: string[] = [];

    const agentNodes = nodes.filter((n) => n.data.componentType === 'collector-agent');
    const gatewayNodes = nodes.filter((n) => n.data.componentType === 'collector-gateway');

    items.push('Namespace');
    items.push('ServiceAccount + RBAC');
    items.push('Secret Template');

    for (const agent of agentNodes) {
      items.push(`DaemonSet: ${agent.data.label}`);
      items.push(`ConfigMap: ${agent.data.label}`);
    }

    for (const gw of gatewayNodes) {
      items.push(`Deployment: ${gw.data.label}`);
      items.push(`Service: ${gw.data.label}`);
      items.push(`ConfigMap: ${gw.data.label}`);
    }

    for (const sdk of sdkNodes) {
      items.push(`Deployment: ${sdk.data.serviceName || sdk.data.label}`);
      items.push(`Service: ${sdk.data.serviceName || sdk.data.label}`);
    }

    return items;
  }, [exportType, deploymentSubType, hasComponents, nodes, sdkNodes]);

  // Preview bundle contents
  const bundlePreview = useMemo(() => {
    if (exportType !== 'bundle') return [];
    return previewBundleContents(nodes, edges, deploymentModel);
  }, [exportType, nodes, edges, deploymentModel]);

  // Generate content based on export type
  const exportContent = useMemo(() => {
    switch (exportType) {
      case 'deployment':
        if (showYAMLPreview) {
          return deploymentSubType === 'docker'
            ? generateDockerCompose(nodes, edges, deploymentModel)
            : generateK8sManifests(nodes, edges, { namespace: k8sNamespace, deploymentModel });
        }
        return '';
      case 'bundle':
        return `# Configuration Bundle Preview
# Click "Download Bundle" to get all files as a ZIP

Files included:
${bundlePreview.map((f) => `- ${f.path} (${formatBytes(f.size)})`).join('\n')}

Total: ${bundlePreview.length} files
`;
      case 'collector':
      default:
        const collectorId = selectedCollector || collectors[0]?.id;
        const collector = nodes.find((n) => n.id === collectorId);

        if (!collector) {
          return '# No collector found in topology\n# Add a Collector Agent or Gateway to generate config';
        }

        return generateCollectorYAML(collector.data as CollectorNodeData, { deploymentModel });
    }
  }, [exportType, deploymentSubType, selectedCollector, collectors, nodes, edges, deploymentModel, bundlePreview, showYAMLPreview, k8sNamespace]);

  const handleCopy = useCallback(async () => {
    let contentToCopy = exportContent;
    if (exportType === 'deployment' && !showYAMLPreview) {
      contentToCopy = deploymentSubType === 'docker'
        ? generateDockerCompose(nodes, edges, deploymentModel)
        : generateK8sManifests(nodes, edges, { namespace: k8sNamespace, deploymentModel });
    }
    await navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportContent, exportType, deploymentSubType, showYAMLPreview, nodes, edges, deploymentModel, k8sNamespace]);

  const handleDownload = useCallback(() => {
    switch (exportType) {
      case 'deployment':
        if (deploymentSubType === 'docker') {
          downloadDockerCompose(generateDockerCompose(nodes, edges, deploymentModel));
        } else {
          downloadK8sManifests(generateK8sManifests(nodes, edges, { namespace: k8sNamespace, deploymentModel }));
        }
        break;
      case 'collector':
      default:
        const blob = new Blob([exportContent], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'otel-collector-config.yaml';
        a.click();
        URL.revokeObjectURL(url);
    }
  }, [exportType, deploymentSubType, exportContent, nodes, edges, deploymentModel, k8sNamespace]);

  const handleDownloadBundle = useCallback(async () => {
    setIsDownloadingBundle(true);
    try {
      await downloadConfigBundle(nodes, edges, deploymentModel);
    } catch (error) {
      console.error('Failed to download bundle:', error);
    } finally {
      setIsDownloadingBundle(false);
    }
  }, [nodes, edges, deploymentModel]);

  const handleDownloadDockerProject = useCallback(async () => {
    setIsDownloadingBundle(true);
    try {
      await downloadConfigBundle(nodes, edges, deploymentModel);
    } catch (error) {
      console.error('Failed to download Docker project:', error);
    } finally {
      setIsDownloadingBundle(false);
    }
  }, [nodes, edges, deploymentModel]);

  const diagramBackgroundColor = useMemo(() => {
    if (transparentBg && diagramFormat !== 'jpeg') {
      return 'transparent';
    }
    return '#030712';
  }, [diagramFormat, transparentBg]);

  const buildDiagramOptions = useCallback((): DiagramExportOptions => {
    const scale = Number(diagramScale);
    return {
      format: diagramFormat,
      scale: Number.isNaN(scale) ? 2 : scale,
      backgroundColor: diagramBackgroundColor,
      fileName: `edot-architecture.${diagramFormat}`,
    };
  }, [diagramBackgroundColor, diagramFormat, diagramScale]);

  const handleDiagramDownload = useCallback(async (): Promise<void> => {
    setIsExportingDiagram(true);
    try {
      await onDownloadDiagram(buildDiagramOptions());
    } finally {
      setIsExportingDiagram(false);
    }
  }, [buildDiagramOptions, onDownloadDiagram]);

  const handleDiagramCopy = useCallback(async (): Promise<void> => {
    setIsCopyingDiagram(true);
    setCopied(false);
    try {
      const scale = Number(diagramScale);
      await onCopyDiagram({
        scale: Number.isNaN(scale) ? 2 : scale,
        backgroundColor: diagramBackgroundColor,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setIsCopyingDiagram(false);
    }
  }, [diagramBackgroundColor, diagramScale, onCopyDiagram]);

  useEffect(() => {
    if (exportType !== 'diagram' || nodes.length === 0) {
      setDiagramPreviewUrl(null);
      return;
    }

    const viewport = getViewportElement();
    if (!viewport) {
      setDiagramPreviewUrl(null);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsGeneratingDiagramPreview(true);
      try {
        const { exportDiagramAsDataUrl } = await import('../../lib/diagram-export');
        const previewUrl = await exportDiagramAsDataUrl(viewport, nodes, {
          ...buildDiagramOptions(),
          format: 'png',
          scale: 1,
          padding: 20,
        });
        if (!cancelled) {
          setDiagramPreviewUrl(previewUrl);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to generate diagram preview:', error);
          setDiagramPreviewUrl(null);
        }
      } finally {
        if (!cancelled) {
          setIsGeneratingDiagramPreview(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [buildDiagramOptions, exportType, getViewportElement, nodes]);

  if (!isConfigPanelOpen) return null;

  const tabs: { id: ExportType; name: string; disabled?: boolean }[] = [
    { id: 'collector', name: 'Collector' },
    { id: 'deployment', name: 'Deployment', disabled: !hasComponents },
    { id: 'bundle', name: 'Bundle' },
    { id: 'diagram', name: 'Diagram' },
  ];

  const yamlContent =
    exportType === 'collector' ? exportContent :
    exportType === 'deployment' && deploymentSubType === 'docker' ? generateDockerCompose(nodes, edges, deploymentModel) :
    exportType === 'deployment' && deploymentSubType === 'kubernetes' ? generateK8sManifests(nodes, edges, { namespace: k8sNamespace, deploymentModel }) :
    exportContent;

  return (
    <EuiFlyout
      side="right"
      size="m"
      onClose={toggleConfigPanel}
      aria-labelledby="configExportTitle"
      paddingSize="none"
    >
      <EuiFlyoutHeader hasBorder>
        <EuiFlexGroup alignItems="center" gutterSize="s">
          <EuiFlexItem grow={false}>
            <EuiIcon type="exportAction" color="primary" />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiTitle size="xs">
              <h3 id="configExportTitle">Export Configuration</h3>
            </EuiTitle>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="s" />
        <EuiTabs size="s" bottomBorder={false}>
          {tabs.map((tab) => (
            <EuiTab
              key={tab.id}
              isSelected={exportType === tab.id}
              disabled={tab.disabled}
              onClick={() => { setExportType(tab.id); setShowYAMLPreview(false); }}
            >
              {tab.name}
            </EuiTab>
          ))}
        </EuiTabs>
      </EuiFlyoutHeader>

      <EuiFlyoutBody>
        {/* Collector selector */}
        {exportType === 'collector' && collectors.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <EuiFormRow label="Select Collector" fullWidth>
              <EuiSelect
                value={selectedCollector || collectors[0]?.id}
                onChange={(e) => setSelectedCollector(e.target.value)}
                options={collectors.map((c) => ({
                  value: c.id,
                  text: `${c.data.label} (${c.data.componentType})`,
                }))}
                compressed
                fullWidth
              />
            </EuiFormRow>
          </div>
        )}

        {/* Deployment tab — Docker / K8s sub-selector */}
        {exportType === 'deployment' && hasComponents && (
          <div>
            {/* Sub-selector: Docker vs K8s */}
            <EuiFlexGroup gutterSize="s" style={{ marginBottom: 12 }}>
              <EuiFlexItem>
                <EuiButton
                  size="s"
                  fullWidth
                  color={deploymentSubType === 'docker' ? 'primary' : 'text'}
                  fill={deploymentSubType === 'docker'}
                  onClick={() => { setDeploymentSubType('docker'); setShowYAMLPreview(false); }}
                  iconType="logoDocker"
                >
                  Docker
                </EuiButton>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiButton
                  size="s"
                  fullWidth
                  color={deploymentSubType === 'kubernetes' ? 'primary' : 'text'}
                  fill={deploymentSubType === 'kubernetes'}
                  onClick={() => { setDeploymentSubType('kubernetes'); setShowYAMLPreview(false); }}
                  iconType="logoKubernetes"
                >
                  Kubernetes
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>

            {/* Docker project preview */}
            {deploymentSubType === 'docker' && !showYAMLPreview && (
              <>
                <EuiFlexGroup alignItems="center" gutterSize="s">
                  <EuiFlexItem grow={false}><EuiIcon type="folderOpen" /></EuiFlexItem>
                  <EuiFlexItem><EuiText size="s"><strong>Docker Project Files</strong></EuiText></EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty size="xs" onClick={() => setShowYAMLPreview(true)} iconType="eye">
                      View YAML
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="s" />
                <EuiCodeBlock language="text" fontSize="s" paddingSize="s" overflowHeight={200}>
                  {dockerProjectPreview.map((item) => item.path).join('\n')}
                </EuiCodeBlock>
                <EuiSpacer size="s" />
                <EuiButton
                  fill
                  fullWidth
                  iconType="download"
                  onClick={handleDownloadDockerProject}
                  isLoading={isDownloadingBundle}
                >
                  {isDownloadingBundle ? 'Generating Project...' : 'Download Docker Project (.zip)'}
                </EuiButton>
              </>
            )}

            {/* Docker YAML preview */}
            {deploymentSubType === 'docker' && showYAMLPreview && (
              <>
                <EuiFlexGroup alignItems="center">
                  <EuiFlexItem><EuiText size="s"><strong>docker-compose.yml</strong></EuiText></EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty size="xs" onClick={() => setShowYAMLPreview(false)} iconType="eyeClosed">
                      Project View
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="s" />
              </>
            )}

            {/* Kubernetes resources preview */}
            {deploymentSubType === 'kubernetes' && !showYAMLPreview && (
              <>
                <EuiFlexGroup alignItems="center" gutterSize="s">
                  <EuiFlexItem><EuiText size="s"><strong>K8s Resources</strong></EuiText></EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty size="xs" onClick={() => setShowYAMLPreview(true)} iconType="eye">
                      View YAML
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="s" />
                <div style={{ marginBottom: 12 }}>
                  <EuiFormRow label="Namespace" fullWidth>
                    <EuiFieldText
                      value={k8sNamespace}
                      onChange={(e) => setK8sNamespace(e.target.value)}
                      placeholder="observability"
                      compressed
                      fullWidth
                    />
                  </EuiFormRow>
                </div>
                <EuiCodeBlock language="text" fontSize="s" paddingSize="s" overflowHeight={200}>
                  {k8sPreviewItems.join('\n')}
                </EuiCodeBlock>
                <EuiSpacer size="s" />
                <EuiButton fill fullWidth iconType="download" onClick={() => handleDownload()}>
                  Download Manifests
                </EuiButton>
              </>
            )}

            {/* K8s YAML preview mode */}
            {deploymentSubType === 'kubernetes' && showYAMLPreview && (
              <>
                <EuiFlexGroup alignItems="center">
                  <EuiFlexItem><EuiText size="s"><strong>k8s-manifests.yaml</strong></EuiText></EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty size="xs" onClick={() => setShowYAMLPreview(false)} iconType="eyeClosed">
                      Resources View
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="s" />
              </>
            )}
          </div>
        )}

        {/* Bundle preview */}
        {exportType === 'bundle' && (
          <div>
            <EuiFlexGroup alignItems="center" gutterSize="s">
              <EuiFlexItem grow={false}><EuiIcon type="package" color="accent" /></EuiFlexItem>
              <EuiFlexItem><EuiText size="s"><strong>Bundle Contents</strong></EuiText></EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued"><span>{bundlePreview.length} files</span></EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="s" />
            <EuiCodeBlock language="text" fontSize="s" paddingSize="s" overflowHeight={200}>
              {bundlePreview.map((f) => `${f.path}  (${formatBytes(f.size)})`).join('\n')}
            </EuiCodeBlock>
            <EuiSpacer size="s" />
            <EuiButton
              fill
              fullWidth
              iconType="download"
              onClick={handleDownloadBundle}
              isLoading={isDownloadingBundle}
            >
              {isDownloadingBundle ? 'Generating Bundle...' : 'Download Config Bundle (.zip)'}
            </EuiButton>
          </div>
        )}

        {/* Diagram export */}
        {exportType === 'diagram' && (
          <div>
            <EuiFormRow label="Image Format" fullWidth>
              <EuiFlexGroup gutterSize="s">
                <EuiFlexItem>
                  <EuiButton
                    size="s"
                    fullWidth
                    color={diagramFormat === 'png' ? 'primary' : 'text'}
                    fill={diagramFormat === 'png'}
                    onClick={() => setDiagramFormat('png')}
                  >
                    PNG
                  </EuiButton>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiButton
                    size="s"
                    fullWidth
                    color={diagramFormat === 'svg' ? 'primary' : 'text'}
                    fill={diagramFormat === 'svg'}
                    onClick={() => setDiagramFormat('svg')}
                  >
                    SVG
                  </EuiButton>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiButton
                    size="s"
                    fullWidth
                    color={diagramFormat === 'jpeg' ? 'primary' : 'text'}
                    fill={diagramFormat === 'jpeg'}
                    onClick={() => setDiagramFormat('jpeg')}
                  >
                    JPEG
                  </EuiButton>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFormRow>

            <EuiFormRow label="Scale" fullWidth>
              <EuiSelect
                value={diagramScale}
                onChange={(e) => setDiagramScale(e.target.value)}
                options={[
                  { value: '1', text: '1x (standard)' },
                  { value: '2', text: '2x (retina)' },
                  { value: '3', text: '3x (high detail)' },
                ]}
                compressed
                fullWidth
              />
            </EuiFormRow>

            <EuiFormRow fullWidth>
              <EuiSwitch
                label="Transparent background"
                checked={transparentBg}
                onChange={(e) => setTransparentBg(e.target.checked)}
                disabled={diagramFormat === 'jpeg'}
                compressed
              />
            </EuiFormRow>

            <EuiSpacer size="s" />

            <EuiText size="s">
              <strong>Preview</strong>
            </EuiText>
            <EuiSpacer size="s" />
            <div
              style={{
                border: '1px solid var(--euiBorderColor)',
                borderRadius: 8,
                padding: 8,
                minHeight: 160,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: transparentBg ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%) 50% / 16px 16px' : 'var(--euiColorEmptyShade)',
              }}
            >
              {diagramPreviewUrl ? (
                <img
                  src={diagramPreviewUrl}
                  alt="Diagram preview"
                  style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 6 }}
                />
              ) : (
                <EuiText size="xs" color="subdued">
                  {isGeneratingDiagramPreview ? 'Generating preview...' : 'Preview unavailable.'}
                </EuiText>
              )}
            </div>

            <EuiSpacer size="m" />

            {nodes.length === 0 && (
              <>
                <EuiCallOut
                  size="s"
                  iconType="warning"
                  title="Add at least one component before exporting your diagram."
                />
                <EuiSpacer size="m" />
              </>
            )}

            <EuiFlexGroup gutterSize="s">
              <EuiFlexItem>
                <EuiButton
                  fill
                  fullWidth
                  iconType="download"
                  onClick={() => {
                    void handleDiagramDownload();
                  }}
                  isLoading={isExportingDiagram}
                  disabled={nodes.length === 0}
                >
                  Download {diagramFormat.toUpperCase()}
                </EuiButton>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiButton
                  fullWidth
                  iconType={copied ? 'check' : 'copyClipboard'}
                  color={copied ? 'success' : 'text'}
                  onClick={() => {
                    void handleDiagramCopy();
                  }}
                  isLoading={isCopyingDiagram}
                  disabled={nodes.length === 0}
                >
                  {copied ? 'Copied to clipboard' : 'Copy to Clipboard'}
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          </div>
        )}

        {/* YAML code block */}
        {(exportType === 'collector' || showYAMLPreview) && (
          <>
            <EuiSpacer size="s" />
            <EuiCodeBlock
              language="yaml"
              fontSize="s"
              paddingSize="m"
              overflowHeight={400}
              isCopyable
              lineNumbers
            >
              {yamlContent}
            </EuiCodeBlock>
          </>
        )}
      </EuiFlyoutBody>

      <EuiFlyoutFooter>
        <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
          <EuiFlexItem>
            <EuiText size="xs" color="subdued">
              {exportType === 'collector' && (
                <p>Replace <code>$&#123;ELASTIC_APM_ENDPOINT&#125;</code> and <code>$&#123;ELASTIC_APM_SECRET_TOKEN&#125;</code> with your credentials.</p>
              )}
              {exportType === 'deployment' && deploymentSubType === 'docker' && (
                <p>Run <code>docker-compose up -d --build</code> to start.</p>
              )}
              {exportType === 'deployment' && deploymentSubType === 'kubernetes' && (
                <p>Includes DaemonSets, Deployments, ConfigMaps, and RBAC.</p>
              )}
              {exportType === 'bundle' && (
                <p>Complete bundle: Docker, K8s, configs, sample apps, docs.</p>
              )}
              {exportType === 'diagram' && (
                <p>Export your architecture diagram for presentations or documentation.</p>
              )}
            </EuiText>
          </EuiFlexItem>
          {(exportType === 'collector' || showYAMLPreview) && (
            <EuiFlexItem grow={false}>
              <EuiButton size="s" iconType="download" onClick={handleDownload}>
                Download
              </EuiButton>
            </EuiFlexItem>
          )}
        </EuiFlexGroup>
      </EuiFlyoutFooter>
    </EuiFlyout>
  );
});

ConfigExportPanel.displayName = 'ConfigExportPanel';

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
