'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import {
  EuiButtonIcon,
  EuiPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
  EuiToolTip,
} from '@elastic/eui';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;

export const ZoomControls = memo((): React.ReactElement => {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const viewport = useViewport();
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    setZoomPercent(Math.round(viewport.zoom * 100));
  }, [viewport.zoom]);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 });
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView({ duration: 300, padding: 0.3, maxZoom: 1 });
  }, [fitView]);

  const handleResetZoom = useCallback(() => {
    setViewport({ x: viewport.x, y: viewport.y, zoom: 1 }, { duration: 200 });
  }, [setViewport, viewport.x, viewport.y]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoomIn();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        handleFitView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetZoom, handleFitView]);

  return (
    <EuiPanel
      paddingSize="xs"
      borderRadius="m"
      hasShadow
      style={{
        position: 'fixed',
        bottom: 24,
        left: '33%',
        transform: 'translateX(-50%)',
        zIndex: 40,
      }}
    >
      <EuiFlexGroup alignItems="center" gutterSize="xs" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiToolTip content="Reset to 100% (⌘0)" position="top">
            <button
              onClick={handleResetZoom}
              style={{ minWidth: 50, textAlign: 'center', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 8px' }}
            >
              <EuiText size="xs"><strong>{zoomPercent}%</strong></EuiText>
            </button>
          </EuiToolTip>
        </EuiFlexItem>

        <EuiFlexItem grow={false}>
          <div style={{ width: 1, height: 24, background: 'var(--rf-handle-border)' }} />
        </EuiFlexItem>

        <EuiFlexItem grow={false}>
          <EuiToolTip content="Fit to view (⌘1)" position="top">
            <EuiButtonIcon
              iconType="expand"
              onClick={handleFitView}
              aria-label="Fit to view"
              size="s"
            />
          </EuiToolTip>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
});

ZoomControls.displayName = 'ZoomControls';
