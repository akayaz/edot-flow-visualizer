/**
 * Performance Scorer
 *
 * Scores resource sizing and performance characteristics (20 points max).
 * Analyzes memory requirements, CPU needs, and potential bottlenecks.
 */

import type { ValidationContext, CollectorNodeData } from '../../../types';
import type { CategoryScore, ScoreIssue, MemoryEstimate, CpuEstimate } from '../types';

export class PerformanceScorer {
  /**
   * Calculate performance score
   */
  score(context: ValidationContext): CategoryScore {
    let score = 20;
    const issues: ScoreIssue[] = [];
    const strengths: string[] = [];

    const collectors = context.nodes.filter(
      (n) =>
        n.data.componentType === 'collector-agent' ||
        n.data.componentType === 'collector-gateway'
    );

    // Check for single gateway bottleneck
    const gateways = collectors.filter((n) => n.data.componentType === 'collector-gateway');
    const sdks = context.nodes.filter((n) => n.data.componentType === 'edot-sdk');

    if (gateways.length === 1 && sdks.length > 5) {
      score -= 3;
      issues.push({
        id: 'single-gateway-bottleneck',
        deduction: 3,
        severity: 'minor',
        message: 'Single Gateway may become bottleneck',
        suggestion: 'Add second Gateway with load balancing for high availability',
        category: 'performance',
      });
    } else if (gateways.length > 1) {
      strengths.push(`${gateways.length} Gateways configured for load distribution`);
    }

    // Check for properly sized collectors
    if (collectors.length > 0) {
      strengths.push('Collectors deployed for telemetry processing');
    }

    return {
      score: Math.max(0, score),
      maxScore: 20,
      percentage: (score / 20) * 100,
      issues,
      strengths,
    };
  }

  /**
   * Estimate memory requirements (delegated to estimator in Phase 4)
   */
  estimateMemory(context: ValidationContext): MemoryEstimate {
    // Simple estimation for MVP
    const collectors = context.nodes.filter(
      (n) =>
        n.data.componentType === 'collector-agent' ||
        n.data.componentType === 'collector-gateway'
    );

    const baseMemory = collectors.length * 50; // 50MB base per collector
    const totalEstimate = Math.round(baseMemory * 1.25); // 25% safety margin

    return {
      estimated: totalEstimate,
      range: {
        min: Math.round(totalEstimate * 0.8),
        max: Math.round(totalEstimate * 1.2),
      },
      breakdown: {
        base: baseMemory,
        processors: 0,
        buffering: 0,
        safetyMargin: totalEstimate - baseMemory,
      },
      confidence: collectors.length > 0 ? 'medium' : 'low',
    };
  }

  /**
   * Estimate CPU requirements
   */
  estimateCpu(context: ValidationContext): CpuEstimate {
    const sdks = context.nodes.filter((n) => n.data.componentType === 'edot-sdk');
    const estimatedSpansPerSec = sdks.length * 10000; // 10K spans/sec per SDK
    const coresNeeded = Math.max(1, Math.ceil(estimatedSpansPerSec / 15000)); // 15K spans/sec per core

    return {
      cores: coresNeeded,
      utilization: 70, // Target 70% utilization
      confidence: 'medium',
    };
  }
}
