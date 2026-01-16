'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Download, FileCode, Package, FolderArchive, Loader2 } from 'lucide-react';
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
import type { CollectorNodeData } from '../../types';

type ExportType = 'collector' | 'docker' | 'kubernetes' | 'bundle';

export const ConfigExportPanel = memo(() => {
  const { isConfigPanelOpen, toggleConfigPanel, nodes, edges, deploymentModel } = useFlowStore();
  const [copied, setCopied] = useState(false);
  const [selectedCollector, setSelectedCollector] = useState<string | null>(null);
  const [exportType, setExportType] = useState<ExportType>('collector');
  const [isDownloadingBundle, setIsDownloadingBundle] = useState(false);

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

  // Check if topology has infrastructure nodes
  const hasDocker = useMemo(
    () => nodes.some((n) => n.type === 'infrastructureDocker') ||
          nodes.some((n) => n.data.componentType === 'edot-sdk' || 
                           n.data.componentType === 'collector-agent' ||
                           n.data.componentType === 'collector-gateway'),
    [nodes]
  );
  const hasK8s = useMemo(
    () =>
      nodes.some(
        (n) =>
          n.type === 'infrastructureK8sNamespace' ||
          n.type === 'infrastructureK8sDaemonSet' ||
          n.type === 'infrastructureK8sDeployment'
      ),
    [nodes]
  );

  // Preview bundle contents
  const bundlePreview = useMemo(() => {
    if (exportType !== 'bundle') return [];
    return previewBundleContents(nodes, edges, deploymentModel);
  }, [exportType, nodes, edges, deploymentModel]);

  // Generate content based on export type
  const exportContent = useMemo(() => {
    switch (exportType) {
      case 'docker':
        return generateDockerCompose(nodes, edges, deploymentModel);
      case 'kubernetes':
        return generateK8sManifests(nodes);
      case 'bundle':
        // For bundle, show preview instead
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

        return generateCollectorYAML(collector.data as CollectorNodeData);
    }
  }, [exportType, selectedCollector, collectors, nodes, edges, deploymentModel, bundlePreview]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(exportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportContent]);

  const handleDownload = useCallback(() => {
    switch (exportType) {
      case 'docker':
        downloadDockerCompose(exportContent);
        break;
      case 'kubernetes':
        downloadK8sManifests(exportContent);
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
  }, [exportType, exportContent]);

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

  return (
    <AnimatePresence>
      {isConfigPanelOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute top-4 right-4 z-20 w-[520px] bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
            <div className="flex items-center gap-2">
              <FileCode size={18} className="text-cyan-400" />
              <h3 className="font-semibold text-white">Export Configuration</h3>
            </div>
            <button
              onClick={toggleConfigPanel}
              className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Export type selector */}
          <div className="p-4 border-b border-gray-700/50">
            <label className="text-xs text-gray-400 mb-2 block">
              Export Format
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setExportType('collector')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  exportType === 'collector'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Collector
              </button>
              <button
                onClick={() => setExportType('docker')}
                disabled={!hasDocker}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  exportType === 'docker'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : hasDocker
                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                🐳 Docker
              </button>
              <button
                onClick={() => setExportType('kubernetes')}
                disabled={!hasK8s}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  exportType === 'kubernetes'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : hasK8s
                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                ☸️ K8s
              </button>
              <button
                onClick={() => setExportType('bundle')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                  exportType === 'bundle'
                    ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-400 border border-pink-500/30'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Package size={14} />
                Bundle
              </button>
            </div>
          </div>

          {/* Collector selector (if multiple and collector export) */}
          {exportType === 'collector' && collectors.length > 1 && (
            <div className="p-4 border-b border-gray-700/50">
              <label className="text-xs text-gray-400 mb-2 block">
                Select Collector
              </label>
              <select
                value={selectedCollector || collectors[0]?.id}
                onChange={(e) => setSelectedCollector(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              >
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.data.label} ({c.data.componentType})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bundle preview */}
          {exportType === 'bundle' && (
            <div className="p-4 border-b border-gray-700/50">
              <div className="flex items-center gap-2 mb-3">
                <FolderArchive size={16} className="text-pink-400" />
                <span className="text-sm font-medium text-white">Bundle Contents</span>
                <span className="text-xs text-gray-500 ml-auto">{bundlePreview.length} files</span>
              </div>
              <div className="bg-gray-950/50 rounded-lg p-3 max-h-[200px] overflow-auto">
                <div className="space-y-1">
                  {bundlePreview.map((file) => (
                    <div key={file.path} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300 font-mono">{file.path}</span>
                      <span className="text-gray-500">{formatBytes(file.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Download Bundle Button */}
              <motion.button
                onClick={handleDownloadBundle}
                disabled={isDownloadingBundle}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full mt-3 px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-600 rounded-lg font-medium text-white flex items-center justify-center gap-2 transition-all"
              >
                {isDownloadingBundle ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating Bundle...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Download Config Bundle (.zip)
                  </>
                )}
              </motion.button>
            </div>
          )}

          {/* YAML/Config content (not shown for bundle) */}
          {exportType !== 'bundle' && (
            <div className="relative">
              <pre className="p-4 text-xs text-gray-300 font-mono overflow-auto max-h-[400px] bg-gray-950/50 yaml-preview">
                {exportContent}
              </pre>

              {/* Action buttons */}
              <div className="absolute top-2 right-2 flex gap-2">
                <motion.button
                  onClick={handleCopy}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 bg-gray-800/90 hover:bg-gray-700 rounded-lg border border-gray-700"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Copy size={14} className="text-gray-400" />
                  )}
                </motion.button>
                <motion.button
                  onClick={handleDownload}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 bg-gray-800/90 hover:bg-gray-700 rounded-lg border border-gray-700"
                  title="Download YAML file"
                >
                  <Download size={14} className="text-gray-400" />
                </motion.button>
              </div>
            </div>
          )}

          {/* Help text */}
          <div className="p-4 border-t border-gray-700/50 bg-gray-800/30">
            {exportType === 'collector' && (
              <p className="text-xs text-gray-400">
                Generated EDOT Collector configuration. Replace{' '}
                <code className="text-cyan-400 bg-gray-800 px-1 rounded">
                  $&#123;ELASTIC_APM_ENDPOINT&#125;
                </code>{' '}
                and{' '}
                <code className="text-cyan-400 bg-gray-800 px-1 rounded">
                  $&#123;ELASTIC_APM_SECRET_TOKEN&#125;
                </code>{' '}
                with your Elastic Cloud credentials.
              </p>
            )}
            {exportType === 'docker' && (
              <p className="text-xs text-gray-400">
                Generated Docker Compose configuration. Set environment variables
                and run{' '}
                <code className="text-cyan-400 bg-gray-800 px-1 rounded">
                  docker-compose up -d
                </code>{' '}
                to start your services.
              </p>
            )}
            {exportType === 'kubernetes' && (
              <p className="text-xs text-gray-400">
                Generated Kubernetes manifests. Create the secret first, then
                apply with{' '}
                <code className="text-cyan-400 bg-gray-800 px-1 rounded">
                  kubectl apply -f k8s-manifests.yaml
                </code>
                .
              </p>
            )}
            {exportType === 'bundle' && (
              <p className="text-xs text-gray-400">
                Complete configuration bundle with all files needed to deploy your EDOT infrastructure.
                Includes README, environment template, and documentation.
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
