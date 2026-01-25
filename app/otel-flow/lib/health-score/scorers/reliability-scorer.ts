/**
 * Reliability Scorer
 *
 * Scores reliability and high availability (15 points max).
 * Evaluates HA setup, health checks, and resilience patterns.
 */

import type { ValidationContext, CollectorNodeData } from '../../../types';
import type { CategoryScore, ScoreIssue } from '../types';

export class ReliabilityScorer {
  /**
   * Calculate reliability score
   */
  score(context: ValidationContext): CategoryScore {
    let score = 15;
    const issues: ScoreIssue[] = [];
    const strengths: string[] = [];

    const gateways = context.nodes.filter((n) => n.data.componentType === 'collector-gateway');
    const sdks = context.nodes.filter((n) => n.data.componentType === 'edot-sdk');

    // Check for single gateway bottleneck (HA concern)
    if (gateways.length === 1 && sdks.length > 5) {
      score -= 6;
      issues.push({
        id: 'single-gateway-spof',
        deduction: 6,
        severity: 'major',
        message: 'Single Gateway is a single point of failure',
        suggestion: 'Deploy multiple Gateway collectors with load balancing for high availability',
        category: 'reliability',
      });
    } else if (gateways.length > 1) {
      strengths.push('Multiple Gateways for high availability');
    }

    // Check for batch processor (provides buffering)
    const collectors = context.nodes.filter(
      (n) =>
        n.data.componentType === 'collector-agent' ||
        n.data.componentType === 'collector-gateway'
    );

    const hasBatch = collectors.some((c) => {
      const data = c.data as CollectorNodeData;
      return data.config.processors.some((p) => p.enabled && p.type === 'batch');
    });

    if (hasBatch) {
      strengths.push('Batch processor provides buffering for transient failures');
    }

    // Check deployment model alignment
    if (context.deploymentModel === 'self-managed' && gateways.length > 0) {
      strengths.push('Gateway deployed for self-managed reliability');
    }

    return {
      score: Math.max(0, score),
      maxScore: 15,
      percentage: (score / 15) * 100,
      issues,
      strengths,
    };
  }
}
