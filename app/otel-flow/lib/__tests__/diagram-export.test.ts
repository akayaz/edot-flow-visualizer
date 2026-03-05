import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node } from '@xyflow/react';
import type { EDOTNodeData } from '../../types';
import {
  buildDiagramFileName,
  copyDiagramToClipboard,
  downloadDiagram,
  exportDiagramAsDataUrl,
} from '../diagram-export';

const {
  mockToPng,
  mockToSvg,
  mockToJpeg,
  mockGetNodesBounds,
  mockGetViewportForBounds,
} = vi.hoisted(() => ({
  mockToPng: vi.fn(),
  mockToSvg: vi.fn(),
  mockToJpeg: vi.fn(),
  mockGetNodesBounds: vi.fn(),
  mockGetViewportForBounds: vi.fn(),
}));

vi.mock('html-to-image', () => ({
  toPng: mockToPng,
  toSvg: mockToSvg,
  toJpeg: mockToJpeg,
}));

vi.mock('@xyflow/react', () => ({
  getNodesBounds: mockGetNodesBounds,
  getViewportForBounds: mockGetViewportForBounds,
}));

function makeNode(id: string, x = 0, y = 0): Node<EDOTNodeData> {
  return {
    id,
    type: 'edotSdk',
    position: { x, y },
    data: {
      label: `service-${id}`,
      componentType: 'edot-sdk',
      language: 'nodejs',
      serviceName: `service-${id}`,
      autoInstrumented: true,
    },
  };
}

describe('diagram-export', () => {
  const element = {} as HTMLElement;
  const nodes = [makeNode('a', 10, 20), makeNode('b', 200, 150)];

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetNodesBounds.mockReturnValue({
      x: 10,
      y: 20,
      width: 500,
      height: 300,
    });
    mockGetViewportForBounds.mockReturnValue({
      x: -25,
      y: -10,
      zoom: 1.2,
    });

    mockToPng.mockResolvedValue('data:image/png;base64,mock');
    mockToSvg.mockResolvedValue('data:image/svg+xml;base64,mock');
    mockToJpeg.mockResolvedValue('data:image/jpeg;base64,mock');

    const anchor = { click: vi.fn() } as unknown as HTMLAnchorElement;
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(anchor),
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      blob: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })),
    }));

    class MockClipboardItem {
      public data: Record<string, Blob>;

      public constructor(data: Record<string, Blob>) {
        this.data = data;
      }
    }

    vi.stubGlobal('ClipboardItem', MockClipboardItem);
    vi.stubGlobal('navigator', {
      clipboard: {
        write: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('routes png format to toPng', async () => {
    const result = await exportDiagramAsDataUrl(element, nodes, { format: 'png' });
    expect(result).toBe('data:image/png;base64,mock');
    expect(mockToPng).toHaveBeenCalledTimes(1);
    expect(mockToSvg).not.toHaveBeenCalled();
    expect(mockToJpeg).not.toHaveBeenCalled();
  });

  it('routes svg format to toSvg', async () => {
    await exportDiagramAsDataUrl(element, nodes, { format: 'svg' });
    expect(mockToSvg).toHaveBeenCalledTimes(1);
  });

  it('routes jpeg format to toJpeg with quality', async () => {
    await exportDiagramAsDataUrl(element, nodes, { format: 'jpeg', quality: 0.8 });
    expect(mockToJpeg).toHaveBeenCalledTimes(1);
    const [, options] = mockToJpeg.mock.calls[0];
    expect(options.quality).toBe(0.8);
  });

  it('applies default scale and padding when omitted', async () => {
    await exportDiagramAsDataUrl(element, nodes, { format: 'png' });
    const [, options] = mockToPng.mock.calls[0];
    expect(options.pixelRatio).toBe(2);
    expect(options.width).toBe(600);
    expect(options.height).toBe(400);
    expect(mockGetViewportForBounds).toHaveBeenCalledWith(
      expect.anything(),
      600,
      400,
      0.1,
      2,
      0.1
    );
  });

  it('calculates bounds from top-level nodes when nested nodes exist', async () => {
    const nestedNodes = [
      makeNode('parent', 0, 0),
      {
        ...makeNode('child', 10, 10),
        parentId: 'parent',
      },
    ] as Array<Node<EDOTNodeData>>;

    await exportDiagramAsDataUrl(element, nestedNodes, { format: 'png' });
    expect(mockGetNodesBounds).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'parent' }),
    ]);
  });

  it('uses transparent background when requested', async () => {
    await exportDiagramAsDataUrl(element, nodes, {
      format: 'png',
      backgroundColor: 'transparent',
    });
    const [, options] = mockToPng.mock.calls[0];
    expect(options.backgroundColor).toBe('transparent');
  });

  it('throws a clear error when exporting with no nodes', async () => {
    await expect(exportDiagramAsDataUrl(element, [], { format: 'png' })).rejects.toThrow(
      'Diagram export failed: no nodes to export.'
    );
  });

  it('throws a clear error when viewport element is missing', async () => {
    await expect(exportDiagramAsDataUrl(null as unknown as HTMLElement, nodes, { format: 'png' })).rejects.toThrow(
      'Diagram export failed: missing viewport element.'
    );
  });

  it('downloads using an anchor element', async () => {
    await downloadDiagram(element, nodes, { format: 'png' });
    const createElement = (document.createElement as unknown as ReturnType<typeof vi.fn>);
    const anchor = createElement.mock.results[0]?.value as { click: () => void; download: string };
    expect(createElement).toHaveBeenCalledWith('a');
    expect(anchor.download).toBe('edot-architecture.png');
    expect(anchor.click).toHaveBeenCalledTimes(1);
  });

  it('copies png image to clipboard', async () => {
    await copyDiagramToClipboard(element, nodes, { scale: 2 });
    expect(navigator.clipboard.write).toHaveBeenCalledTimes(1);
  });

  it('builds safe file names', () => {
    expect(buildDiagramFileName('png')).toBe('edot-architecture.png');
    expect(buildDiagramFileName('svg', 'My Diagram 2026')).toBe('my-diagram-2026.svg');
  });
});
