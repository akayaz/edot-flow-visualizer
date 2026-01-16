'use client';

import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Wifi, WifiOff, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { useTelemetryStore } from '../../store/telemetryStore';

export const TelemetryStatsPanel = memo(() => {
  const { recentEvents, throughputStats, isConnected, isDemoMode, lastEventTime } = useTelemetryStore();
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate aggregate stats
  const aggregateStats = useMemo(() => {
    let totalTraces = 0;
    let totalMetrics = 0;
    let totalLogs = 0;

    throughputStats.forEach((stat) => {
      totalTraces += stat.traces;
      totalMetrics += stat.metrics;
      totalLogs += stat.logs;
    });

    return { totalTraces, totalMetrics, totalLogs };
  }, [throughputStats]);

  // Recent activity indicator
  const isActive = lastEventTime && Date.now() - lastEventTime < 2000;

  // Collapsed state - show minimal badge
  if (!isExpanded) {
    return (
      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        onClick={() => setIsExpanded(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="absolute bottom-44 right-4 z-10 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl px-3 py-2 shadow-lg hover:border-gray-600 transition-all"
        aria-label="Show telemetry stats"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi size={12} className="text-green-400" />
            ) : (
              <WifiOff size={12} className="text-red-400" />
            )}
            {isDemoMode && (
              <span className="px-1 py-0.5 text-[8px] font-medium bg-purple-500/20 text-purple-400 rounded">
                DEMO
              </span>
            )}
          </div>
          {isActive && (
            <div className="flex items-center gap-1">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-amber-500"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-blue-500"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
              />
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
              />
            </div>
          )}
          <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
        </div>
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="absolute bottom-44 right-4 z-10"
    >
      <div className="p-4 bg-gray-900/95 backdrop-blur-xl rounded-xl border border-gray-700 shadow-lg min-w-[200px]">
        {/* Header with connection status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-cyan-400" />
            <span className="text-xs font-medium text-white">Live Stats</span>
          </div>
          <div className="flex items-center gap-2">
            {isDemoMode && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                DEMO
              </span>
            )}
            <div className="flex items-center gap-1">
              {isConnected ? (
                <Wifi size={12} className="text-green-400" />
              ) : (
                <WifiOff size={12} className="text-red-400" />
              )}
              <span className={`text-[10px] ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-500 hover:text-gray-300 transition-colors p-0.5 hover:bg-gray-700/50 rounded"
              aria-label="Collapse panel"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Throughput meters */}
        <div className="space-y-2.5">
          {/* Traces */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2 rounded-full bg-amber-500"
                animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
              <span className="text-xs text-gray-400">Traces</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono font-semibold text-amber-400">
                {aggregateStats.totalTraces}
              </span>
              <span className="text-[10px] text-gray-500">/s</span>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2 rounded-full bg-blue-500"
                animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
              />
              <span className="text-xs text-gray-400">Metrics</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono font-semibold text-blue-400">
                {aggregateStats.totalMetrics}
              </span>
              <span className="text-[10px] text-gray-500">/s</span>
            </div>
          </div>

          {/* Logs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2 rounded-full bg-emerald-500"
                animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
              />
              <span className="text-xs text-gray-400">Logs</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono font-semibold text-emerald-400">
                {aggregateStats.totalLogs}
              </span>
              <span className="text-[10px] text-gray-500">/s</span>
            </div>
          </div>
        </div>

        {/* Total events */}
        <div className="mt-3 pt-3 border-t border-gray-700/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Buffer</span>
            <span className="text-gray-400 font-mono">{recentEvents.length} events</span>
          </div>
        </div>

        {/* Activity indicator */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 flex items-center gap-1.5 text-[10px] text-cyan-400"
            >
              <TrendingUp size={10} />
              <span>Receiving telemetry...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

TelemetryStatsPanel.displayName = 'TelemetryStatsPanel';
