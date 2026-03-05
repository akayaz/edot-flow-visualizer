import {
  getNodesBounds,
  getViewportForBounds,
  type Node,
} from '@xyflow/react';
import { toJpeg, toPng, toSvg } from 'html-to-image';
import type { EDOTNodeData } from '../types';

export interface DiagramExportOptions {
  format: 'png' | 'svg' | 'jpeg';
  scale?: number;
  backgroundColor?: string;
  padding?: number;
  quality?: number;
  fileName?: string;
}

interface ExportDimensions {
  width: number;
  height: number;
}

const DEFAULT_SCALE = 2;
const DEFAULT_PADDING = 50;
const DEFAULT_BACKGROUND = '#030712';
const MIN_BOUND_SIZE = 1;
const MIN_FIT_PADDING_RATIO = 0;
const MAX_FIT_PADDING_RATIO = 0.4;

function resolveDimensionsAndViewport(
  nodes: Array<Node<EDOTNodeData>>,
  padding: number
): { dimensions: ExportDimensions; transformStyle: string } {
  // Use top-level nodes for export framing so nested parent/child structures
  // do not inflate the bounds and make the rendered diagram appear tiny.
  const topLevelNodes = nodes.filter((node) => !node.parentId);
  const nodesForBounds = topLevelNodes.length > 0 ? topLevelNodes : nodes;
  const bounds = getNodesBounds(nodesForBounds);
  const width = Math.max(MIN_BOUND_SIZE, Math.ceil(bounds.width + padding * 2));
  const height = Math.max(MIN_BOUND_SIZE, Math.ceil(bounds.height + padding * 2));
  const maxDimension = Math.max(bounds.width, bounds.height, MIN_BOUND_SIZE);
  const fitPaddingRatio = Math.min(
    MAX_FIT_PADDING_RATIO,
    Math.max(MIN_FIT_PADDING_RATIO, padding / maxDimension)
  );
  const viewport = getViewportForBounds(bounds, width, height, 0.1, 2, fitPaddingRatio);

  return {
    dimensions: { width, height },
    transformStyle: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
  };
}

export function buildDiagramFileName(
  format: DiagramExportOptions['format'],
  baseName = 'edot-architecture'
): string {
  const safeBaseName = baseName.trim().replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').toLowerCase();
  return `${safeBaseName || 'edot-architecture'}.${format}`;
}

export async function exportDiagramAsDataUrl(
  element: HTMLElement,
  nodes: Array<Node<EDOTNodeData>>,
  options: DiagramExportOptions
): Promise<string> {
  if (!element) {
    throw new Error('Diagram export failed: missing viewport element.');
  }

  if (nodes.length === 0) {
    throw new Error('Diagram export failed: no nodes to export.');
  }

  const padding = options.padding ?? DEFAULT_PADDING;
  const pixelRatio = options.scale ?? DEFAULT_SCALE;
  const backgroundColor = options.backgroundColor ?? DEFAULT_BACKGROUND;
  const { dimensions, transformStyle } = resolveDimensionsAndViewport(nodes, padding);

  const commonOptions = {
    width: dimensions.width,
    height: dimensions.height,
    pixelRatio,
    backgroundColor,
    style: {
      width: `${dimensions.width}px`,
      height: `${dimensions.height}px`,
      transform: transformStyle,
      transformOrigin: 'top left',
    },
  };

  switch (options.format) {
    case 'svg':
      return toSvg(element, commonOptions);
    case 'jpeg':
      return toJpeg(element, { ...commonOptions, quality: options.quality ?? 0.95 });
    case 'png':
    default:
      return toPng(element, commonOptions);
  }
}

export async function downloadDiagram(
  element: HTMLElement,
  nodes: Array<Node<EDOTNodeData>>,
  options: DiagramExportOptions
): Promise<void> {
  const dataUrl = await exportDiagramAsDataUrl(element, nodes, options);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = options.fileName ?? buildDiagramFileName(options.format);
  link.click();
}

export async function copyDiagramToClipboard(
  element: HTMLElement,
  nodes: Array<Node<EDOTNodeData>>,
  options?: Omit<DiagramExportOptions, 'format'>
): Promise<void> {
  const clipboard = navigator.clipboard;
  if (!clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('Clipboard API is not available in this browser.');
  }

  const dataUrl = await exportDiagramAsDataUrl(element, nodes, {
    ...options,
    format: 'png',
  });

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  await clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
