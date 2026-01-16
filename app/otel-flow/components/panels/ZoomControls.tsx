'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;

export const ZoomControls = memo(() => {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const viewport = useViewport();
  const [zoomPercent, setZoomPercent] = useState(100);

  // Update zoom percentage when viewport changes
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
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Cmd/Ctrl + Plus: Zoom in
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoomIn();
      }
      // Cmd/Ctrl + Minus: Zoom out
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      }
      // Cmd/Ctrl + 0: Reset zoom
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      }
      // Cmd/Ctrl + 1: Fit view
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        handleFitView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetZoom, handleFitView]);

  const isMinZoom = viewport.zoom <= MIN_ZOOM;
  const isMaxZoom = viewport.zoom >= MAX_ZOOM;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="fixed bottom-6 left-1/3 -translate-x-1/2 z-40 flex items-center gap-1 p-1 rounded-xl bg-gray-900/95 backdrop-blur-md border border-gray-700/50 shadow-xl"
    >
      {/* Zoom Out */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleZoomOut}
        disabled={isMinZoom}
        className={`
          p-2 rounded-lg transition-colors
          ${isMinZoom 
            ? 'text-gray-600 cursor-not-allowed' 
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }
        `}
        title="Zoom out (⌘-)"
      >
        <ZoomOut size={18} />
      </motion.button>

      {/* Zoom Percentage */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleResetZoom}
        className="min-w-[60px] px-2 py-1.5 rounded-lg text-xs font-mono font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
        title="Reset to 100% (⌘0)"
      >
        {zoomPercent}%
      </motion.button>

      {/* Zoom In */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleZoomIn}
        disabled={isMaxZoom}
        className={`
          p-2 rounded-lg transition-colors
          ${isMaxZoom 
            ? 'text-gray-600 cursor-not-allowed' 
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }
        `}
        title="Zoom in (⌘+)"
      >
        <ZoomIn size={18} />
      </motion.button>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-700/50 mx-1" />

      {/* Fit View */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleFitView}
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        title="Fit to view (⌘1)"
      >
        <Maximize2 size={18} />
      </motion.button>
    </motion.div>
  );
});

ZoomControls.displayName = 'ZoomControls';

