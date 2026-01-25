/**
 * Health Score Store
 *
 * Zustand store for managing health score state and calculations.
 * Integrates with the flow store to automatically recalculate on topology changes.
 */

import { create } from 'zustand';
import type { HealthScore } from '../lib/health-score/types';
import type { ValidationContext } from '../types';
import { calculateHealthScore } from '../lib/health-score';

interface HealthScoreStore {
  // State
  healthScore: HealthScore | null;
  isCalculating: boolean;
  lastCalculatedAt: number | null;
  autoCalculate: boolean;
  error: string | null;

  // Actions
  calculate: (context: ValidationContext) => void;
  setAutoCalculate: (enabled: boolean) => void;
  clear: () => void;
}

export const useHealthScoreStore = create<HealthScoreStore>((set, get) => ({
  // Initial state
  healthScore: null,
  isCalculating: false,
  lastCalculatedAt: null,
  autoCalculate: true,
  error: null,

  // Calculate health score
  calculate: (context: ValidationContext) => {
    set({ isCalculating: true, error: null });

    try {
      console.log('[HealthScore] Calculating for topology:', {
        nodes: context.nodes.length,
        edges: context.edges.length,
        deploymentModel: context.deploymentModel,
      });

      const score = calculateHealthScore(context);

      console.log('[HealthScore] Calculation complete:', {
        overall: score.overall,
        grade: score.grade,
        confidence: score.confidence,
      });

      set({
        healthScore: score,
        isCalculating: false,
        lastCalculatedAt: Date.now(),
      });
    } catch (error) {
      console.error('[HealthScore] Calculation failed:', error);
      set({
        isCalculating: false,
        error: error instanceof Error ? error.message : 'Calculation failed',
      });
    }
  },

  // Toggle auto-calculation
  setAutoCalculate: (enabled: boolean) => {
    set({ autoCalculate: enabled });
  },

  // Clear health score
  clear: () => {
    set({
      healthScore: null,
      lastCalculatedAt: null,
      error: null,
    });
  },
}));
