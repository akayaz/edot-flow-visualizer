'use client';

import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Square, Activity, Users, ArrowRightLeft, Clock, AlertCircle } from 'lucide-react';

interface TrafficMonitorProps {
  isMonitoring: boolean;
  duration: number; // Target duration in ms
  onStart: () => void;
  onStop: () => void;
  progress: {
    eventCount: number;
    serviceCount: number;
    connectionCount: number;
    elapsedTime: number;
  };
}

export const TrafficMonitor = memo(({
  isMonitoring,
  duration,
  onStart,
  onStop,
  progress,
}: TrafficMonitorProps) => {
  const [countdown, setCountdown] = useState(duration / 1000);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update countdown
  useEffect(() => {
    if (isMonitoring) {
      setCountdown(Math.max(0, (duration - progress.elapsedTime) / 1000));
    } else {
      setCountdown(duration / 1000);
    }
  }, [isMonitoring, duration, progress.elapsedTime]);

  // Auto-stop when duration reached
  useEffect(() => {
    if (isMonitoring && progress.elapsedTime >= duration) {
      onStop();
    }
  }, [isMonitoring, progress.elapsedTime, duration, onStop]);

  const progressPercent = Math.min(100, (progress.elapsedTime / duration) * 100);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="space-y-4">
      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isMonitoring ? (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-green-400"
            />
          ) : (
            <div className="w-3 h-3 rounded-full bg-gray-500" />
          )}
          <span className={`text-sm font-medium ${isMonitoring ? 'text-green-400' : 'text-gray-400'}`}>
            {isMonitoring ? 'Listening for traffic...' : 'Ready to analyze'}
          </span>
        </div>

        {isMonitoring && (
          <div className="flex items-center gap-1 text-gray-400">
            <Clock size={14} />
            <span className="text-sm font-mono">{formatTime(countdown)}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-purple-500"
        />
        {isMonitoring && (
          <motion.div
            animate={{ x: ['0%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} className="text-cyan-400" />
            <span className="text-xs text-gray-400">Events</span>
          </div>
          <motion.p
            key={progress.eventCount}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-xl font-bold text-white"
          >
            {progress.eventCount}
          </motion.p>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-green-400" />
            <span className="text-xs text-gray-400">Services</span>
          </div>
          <motion.p
            key={progress.serviceCount}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-xl font-bold text-white"
          >
            {progress.serviceCount}
          </motion.p>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <ArrowRightLeft size={14} className="text-purple-400" />
            <span className="text-xs text-gray-400">Connections</span>
          </div>
          <motion.p
            key={progress.connectionCount}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-xl font-bold text-white"
          >
            {progress.connectionCount}
          </motion.p>
        </div>
      </div>

      {/* Action button */}
      <motion.button
        onClick={isMonitoring ? onStop : onStart}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`
          w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2
          transition-all
          ${isMonitoring
            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
            : 'bg-cyan-500 hover:bg-cyan-400 text-white'
          }
        `}
      >
        {isMonitoring ? (
          <>
            <Square size={16} />
            Stop Analysis
          </>
        ) : (
          <>
            <Radio size={16} />
            Start Listening
          </>
        )}
      </motion.button>

      {/* Help text */}
      <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-400 space-y-1">
            <p>
              {isMonitoring
                ? 'Analyzing incoming OTLP telemetry. More data = better detection.'
                : 'Click to start listening for OTLP telemetry on the configured endpoints.'
              }
            </p>
            {!isMonitoring && (
              <p className="text-gray-500">
                Tip: Enable demo mode first if you don&apos;t have real traffic.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

TrafficMonitor.displayName = 'TrafficMonitor';
