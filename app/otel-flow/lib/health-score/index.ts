/**
 * Health Score Module
 *
 * Main entry point for the Health Score system that evaluates EDOT architectures
 * across 5 dimensions: Configuration, Performance, Cost, Reliability, and Observability.
 *
 * Usage:
 * ```typescript
 * import { calculateHealthScore } from './lib/health-score';
 *
 * const context = { nodes, edges, deploymentModel, scenario };
 * const score = calculateHealthScore(context);
 * ```
 */

import type { ValidationContext } from '../../types';
import type { HealthScore } from './types';
import { HealthScoreCalculator } from './calculator';

// Singleton instance
let calculatorInstance: HealthScoreCalculator | null = null;

/**
 * Get or create the health score calculator singleton
 */
export function getHealthScoreCalculator(): HealthScoreCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new HealthScoreCalculator();
  }
  return calculatorInstance;
}

/**
 * Calculate health score for a topology
 *
 * @param context - Validation context with nodes, edges, and deployment model
 * @returns Complete health score with breakdown, recommendations, and estimates
 */
export function calculateHealthScore(context: ValidationContext): HealthScore {
  const calculator = getHealthScoreCalculator();
  return calculator.calculate(context);
}

// Re-export all types
export * from './types';
