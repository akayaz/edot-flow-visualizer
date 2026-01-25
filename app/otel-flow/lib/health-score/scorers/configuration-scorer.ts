/**
 * Configuration Scorer
 *
 * Scores the quality of collector and topology configuration (40 points max).
 * Leverages existing validation results to assess configuration correctness.
 *
 * Scoring:
 * - Start with 40 points (perfect score)
 * - Errors: -10 points each (critical issues)
 * - Warnings: -4 points each (best practice violations)
 * - Info: -1 point each (minor suggestions)
 */

import type { ValidationContext, EnhancedValidationResult, CollectorNodeData } from '../../../types';
import type { CategoryScore, ScoreIssue } from '../types';

export class ConfigurationScorer {
  /**
   * Calculate configuration score based on validation results
   */
  score(
    context: ValidationContext,
    validationResults: EnhancedValidationResult[]
  ): CategoryScore {
    let score = 40; // Start with perfect score
    const issues: ScoreIssue[] = [];
    const strengths: string[] = [];

    // Deduct points based on validation severity
    for (const result of validationResults) {
      let deduction = 0;
      let severity: 'critical' | 'major' | 'minor';

      if (result.severity === 'error') {
        deduction = 10;
        severity = 'critical';
      } else if (result.severity === 'warning') {
        deduction = 4;
        severity = 'major';
      } else {
        // info
        deduction = 1;
        severity = 'minor';
      }

      score -= deduction;
      issues.push({
        id: result.id,
        deduction,
        severity,
        message: result.message,
        suggestion: result.suggestion || '',
        category: result.category,
      });
    }

    // Identify strengths (things configured well)
    this.identifyStrengths(context, validationResults, strengths);

    // Can't go below 0
    score = Math.max(0, score);

    return {
      score,
      maxScore: 40,
      percentage: (score / 40) * 100,
      issues,
      strengths,
    };
  }

  /**
   * Identify configuration strengths
   */
  private identifyStrengths(
    context: ValidationContext,
    validationResults: EnhancedValidationResult[],
    strengths: string[]
  ): void {
    // No critical errors
    if (validationResults.filter((r) => r.severity === 'error').length === 0) {
      strengths.push('No critical configuration errors');
    }

    // Collectors properly configured
    const collectorNodes = context.nodes.filter(
      (n) =>
        n.data.componentType === 'collector-agent' ||
        n.data.componentType === 'collector-gateway'
    );

    if (collectorNodes.length > 0) {
      const allHaveConfig = collectorNodes.every((n) => {
        const data = n.data as CollectorNodeData;
        return (
          data.config &&
          data.config.receivers.some((r) => r.enabled) &&
          data.config.processors.some((p) => p.enabled) &&
          data.config.exporters.some((e) => e.enabled)
        );
      });

      if (allHaveConfig) {
        strengths.push('All collectors have complete pipeline configuration');
      }
    }

    // Memory limiter configured
    const hasMemoryLimiter = collectorNodes.some((n) => {
      const data = n.data as CollectorNodeData;
      return data.config.processors.some((p) => p.enabled && p.type === 'memory_limiter');
    });

    if (hasMemoryLimiter) {
      strengths.push('Memory limiter enabled for OOM protection');
    }

    // Batch processor configured
    const hasBatch = collectorNodes.some((n) => {
      const data = n.data as CollectorNodeData;
      return data.config.processors.some((p) => p.enabled && p.type === 'batch');
    });

    if (hasBatch) {
      strengths.push('Batch processor enabled for efficiency');
    }

    // Proper deployment model fit
    const { deploymentModel } = context;
    const gateways = collectorNodes.filter((n) => n.data.componentType === 'collector-gateway');

    if (deploymentModel === 'self-managed' && gateways.length > 0) {
      strengths.push('Gateway collector configured for self-managed deployment');
    }
  }
}
