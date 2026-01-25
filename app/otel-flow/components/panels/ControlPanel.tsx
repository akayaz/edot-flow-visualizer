'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, FileCode, Zap, ZapOff, Sparkles, Cloud, ChevronDown } from 'lucide-react';
import { useFlowStore } from '../../store/flowStore';
import { useTelemetryStore } from '../../store/telemetryStore';
import { useBreakpoint } from '../../lib/useBreakpoint';
import { scenarioList } from '../../data/scenarios';
import { DEPLOYMENT_MODEL_CONFIG } from '../../types';
import type { ScenarioId, DeploymentModel } from '../../types';
import { DeploymentSelector } from './DeploymentSelector';

interface ControlPanelProps {
  onToggleDemo?: () => void;
  onOpenDetection?: () => void;
}

export const ControlPanel = memo(({ onToggleDemo, onOpenDetection }: ControlPanelProps) => {
  const [showDeploymentDropdown, setShowDeploymentDropdown] = useState(false);
  const [showScenarioDropdown, setShowScenarioDropdown] = useState(false);

  // Responsive breakpoints
  const { isSmall, isLarge } = useBreakpoint();

  const {
    nodes,
    scenario,
    setScenario,
    isAnimating,
    toggleAnimation,
    toggleConfigPanel,
    resetToOriginal,
    deploymentModel,
    setDeploymentModel,
  } = useFlowStore();

  const { isDemoMode, isConnected } = useTelemetryStore();

  const currentScenario = scenarioList.find((s) => s.id === scenario);
  const currentDeployment = DEPLOYMENT_MODEL_CONFIG[deploymentModel];

  // Close dropdowns when clicking outside
  const handleScenarioSelect = (id: ScenarioId) => {
    setScenario(id);
    setShowScenarioDropdown(false);
  };

  // Hide labels on small screens to save space
  const showLabels = !isSmall;

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-10"
    >
      <div className="flex items-center gap-2 p-2 bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-2xl">
        {/* Deployment Model Selector */}
        <div className="relative">
          <motion.button
            onClick={() => {
              setShowDeploymentDropdown(!showDeploymentDropdown);
              setShowScenarioDropdown(false);
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
              transition-all border
              ${showDeploymentDropdown 
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' 
                : 'bg-gray-800/50 text-gray-300 border-gray-700 hover:border-gray-600'
              }
            `}
            title={`Select deployment: ${currentDeployment.label}`}
          >
            <Cloud size={16} />
            {showLabels && <span>{currentDeployment.icon} {currentDeployment.label}</span>}
            {!showLabels && <span>{currentDeployment.icon}</span>}
            <ChevronDown 
              size={14} 
              className={`transition-transform ${showDeploymentDropdown ? 'rotate-180' : ''}`}
            />
          </motion.button>

          {/* Deployment Dropdown */}
          <AnimatePresence>
            {showDeploymentDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-2 w-80 p-3 bg-gray-900/98 backdrop-blur-xl rounded-xl border border-gray-700 shadow-2xl z-50"
              >
                <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
                  Deployment Target
                </div>
                <DeploymentSelector />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-700" />

        {/* Scenario Selector - Compact Dropdown */}
        <div className="relative">
          <motion.button
            onClick={() => {
              setShowScenarioDropdown(!showScenarioDropdown);
              setShowDeploymentDropdown(false);
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
              transition-all border
              ${showScenarioDropdown 
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' 
                : 'bg-gray-800/50 text-gray-300 border-gray-700 hover:border-gray-600'
              }
            `}
            title={currentScenario?.description || 'Select scenario'}
          >
            <span>{currentScenario?.icon || '📋'}</span>
            {showLabels && <span>{currentScenario?.name || 'Scenario'}</span>}
            <ChevronDown 
              size={14} 
              className={`transition-transform ${showScenarioDropdown ? 'rotate-180' : ''}`}
            />
          </motion.button>

          {/* Scenario Dropdown */}
          <AnimatePresence>
            {showScenarioDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-2 w-72 p-2 bg-gray-900/98 backdrop-blur-xl rounded-xl border border-gray-700 shadow-2xl z-50"
              >
                <div className="text-xs text-gray-400 mb-2 px-2 font-medium uppercase tracking-wide">
                  Architecture Pattern
                </div>
                <div className="space-y-1">
                  {scenarioList.map((s) => (
                    <motion.button
                      key={s.id}
                      onClick={() => handleScenarioSelect(s.id)}
                      whileHover={{ x: 2 }}
                      className={`
                        w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all
                        ${scenario === s.id 
                          ? 'bg-cyan-500/20 border border-cyan-500/30' 
                          : 'hover:bg-gray-800'
                        }
                      `}
                    >
                      <span className="text-lg mt-0.5">{s.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${scenario === s.id ? 'text-cyan-400' : 'text-white'}`}>
                          {s.name}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                          {s.description}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider - Context | View */}
        <div className="w-px h-8 bg-gray-700" />

        {/* VIEW GROUP: Demo + Animation toggles */}
        <div className="flex items-center gap-1">
          {/* Demo mode toggle */}
          <motion.button
            onClick={onToggleDemo}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
              p-2 rounded-lg transition-all relative
              ${
                isDemoMode
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-gray-400 hover:text-purple-400 hover:bg-gray-800'
              }
            `}
            title={isDemoMode ? 'Stop demo data' : 'Start demo data'}
            disabled={!isConnected}
          >
            {isDemoMode ? <ZapOff size={16} /> : <Zap size={16} />}
            {isDemoMode && (
              <motion.span
                className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-purple-400"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </motion.button>

          {/* Animation toggle */}
          <motion.button
            onClick={toggleAnimation}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
              p-2 rounded-lg transition-all
              ${
                isAnimating
                  ? 'bg-green-500/20 text-green-400'
                  : 'text-gray-400 hover:text-green-400 hover:bg-gray-800'
              }
            `}
            title={isAnimating ? 'Pause animations' : 'Play animations'}
          >
            {isAnimating ? <Pause size={16} /> : <Play size={16} />}
          </motion.button>
        </div>

        {/* Divider - View | Edit */}
        <div className="w-px h-8 bg-gray-700" />

        {/* EDIT GROUP: Clear Canvas (isolated as destructive) */}
        <motion.button
          onClick={resetToOriginal}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`
            p-2 rounded-lg transition-colors
            ${
              nodes.length > 0
                ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                : 'text-gray-500 cursor-not-allowed'
            }
          `}
          title="Clear canvas"
          disabled={nodes.length === 0}
        >
          <RotateCcw size={16} />
        </motion.button>

        {/* Divider - Edit | Output */}
        <div className="w-px h-8 bg-gray-700" />

        {/* OUTPUT GROUP: Export + Detect (primary actions) */}
        <div className="flex items-center gap-1.5">
          {/* Export config button - Primary action with conditional label */}
          <motion.button
            onClick={toggleConfigPanel}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              flex items-center gap-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 
              hover:bg-cyan-500/20 transition-colors border border-cyan-500/20
              ${showLabels ? 'px-3 py-1.5' : 'p-2'}
            `}
            title="Export Collector YAML (⌘E)"
          >
            <FileCode size={14} />
            {showLabels && <span className="text-xs font-medium">Export</span>}
          </motion.button>

          {/* Detect topology button - Primary action with conditional label */}
          <motion.button
            onClick={onOpenDetection}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500/10 to-cyan-500/10 
              text-cyan-400 hover:from-purple-500/20 hover:to-cyan-500/20 transition-all border border-cyan-500/20
              ${showLabels ? 'px-3 py-1.5' : 'p-2'}
            `}
            title="Detect topology from config (⌘D)"
          >
            <Sparkles size={14} />
            {showLabels && <span className="text-xs font-medium">Detect</span>}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
});

ControlPanel.displayName = 'ControlPanel';
