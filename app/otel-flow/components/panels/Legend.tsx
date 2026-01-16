'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

const telemetryItems = [
  { type: 'Traces', abbrev: 'T', color: '#f59e0b', description: 'Distributed tracing data' },
  { type: 'Metrics', abbrev: 'M', color: '#3b82f6', description: 'Application & infra metrics' },
  { type: 'Logs', abbrev: 'L', color: '#10b981', description: 'Log records' },
];

const protocolItems = [
  { 
    protocol: 'gRPC', 
    color: '#60a5fa', 
    description: 'OTLP over gRPC (port 4317)',
    endpoint: ':4317'
  },
  { 
    protocol: 'HTTP', 
    color: '#34d399', 
    description: 'OTLP over HTTP (port 4318)',
    endpoint: ':4318'
  },
];

const animationSpeedInfo = [
  { speed: 'Fast', description: 'High throughput (>10/s)' },
  { speed: 'Normal', description: 'Normal throughput (5-10/s)' },
  { speed: 'Slow', description: 'Low throughput (<5/s)' },
];

export const Legend = memo(() => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="absolute bottom-4 left-4 z-10"
    >
      <div className="p-3 bg-gray-900/95 backdrop-blur-xl rounded-xl border border-gray-700 shadow-lg min-w-[200px]">
        {/* Header with expand/collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-xs text-gray-400 font-medium mb-2 hover:text-gray-300 transition-colors"
        >
          <span>Data Flow Legend</span>
          {isExpanded ? (
            <ChevronDown size={14} className="text-gray-500" />
          ) : (
            <ChevronUp size={14} className="text-gray-500" />
          )}
        </button>

        {/* Telemetry Types - Always visible */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Telemetry</div>
          {telemetryItems.map((item) => (
            <div key={item.type} className="flex items-center gap-2">
              <div className="relative flex items-center gap-1.5">
                {/* Animated dot */}
                <motion.div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                  animate={{
                    boxShadow: [
                      `0 0 4px ${item.color}`,
                      `0 0 8px ${item.color}`,
                      `0 0 4px ${item.color}`,
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                {/* Badge letter */}
                <div 
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border"
                  style={{ 
                    borderColor: item.color, 
                    color: item.color,
                    backgroundColor: 'rgba(31, 41, 55, 0.8)'
                  }}
                >
                  {item.abbrev}
                </div>
              </div>
              <span className="text-xs text-gray-300">{item.type}</span>
            </div>
          ))}
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* Divider */}
              <div className="border-t border-gray-700/50 my-3" />

              {/* Protocols */}
              <div className="space-y-1.5 mb-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Protocols</div>
                {protocolItems.map((item) => (
                  <div key={item.protocol} className="flex items-center gap-2">
                    <div 
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
                      style={{ 
                        color: item.color,
                        backgroundColor: item.protocol === 'gRPC' ? '#1e3a5f' : '#1e3a3f',
                        border: `1px solid ${item.color}40`
                      }}
                    >
                      {item.protocol}
                    </div>
                    <span className="text-[10px] text-gray-400">{item.endpoint}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-700/50 my-3" />

              {/* Animation Speed */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Particle Speed</div>
                {animationSpeedInfo.map((item) => (
                  <div key={item.speed} className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {/* Speed indicator dots */}
                      {item.speed === 'Fast' && (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        </>
                      )}
                      {item.speed === 'Normal' && (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                        </>
                      )}
                      {item.speed === 'Slow' && (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                        </>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">{item.description}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-700/50 my-3" />

              {/* Edge hints */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Edge Info</div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-gray-500 rounded" />
                  <span className="text-[10px] text-gray-400">Normal connection</span>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-0.5 rounded"
                    style={{ 
                      background: 'repeating-linear-gradient(90deg, #f59e0b 0, #f59e0b 3px, transparent 3px, transparent 5px)'
                    }}
                  />
                  <span className="text-[10px] text-gray-400">Warning (hover for details)</span>
                </div>
              </div>

              {/* Tip */}
              <div className="mt-3 pt-2 border-t border-gray-700/30">
                <p className="text-[10px] text-gray-500 italic">
                  💡 Hover over edges to see protocol details
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

Legend.displayName = 'Legend';
