/**
 * Cost Scorer
 *
 * Scores cost efficiency (15 points max).
 * Evaluates sampling configuration, batch efficiency, and unnecessary overhead.
 */

import type { ValidationContext, CollectorNodeData } from '../../../types';
import type { CategoryScore, ScoreIssue, CostEstimate } from '../types';

export class CostScorer {
  /**
   * Calculate cost efficiency score
   */
  score(context: ValidationContext): CategoryScore {
    let score = 15;
    const issues: ScoreIssue[] = [];
    const strengths: string[] = [];

    const gateways = context.nodes.filter((n) => n.data.componentType === 'collector-gateway');
    const sdks = context.nodes.filter((n) => n.data.componentType === 'edot-sdk');

    // Check for missing tail_sampling (major cost optimization)
    const hasTailSampling = gateways.some((g) => {
      const data = g.data as CollectorNodeData;
      return data.config.processors.some((p) => p.enabled && p.type === 'tail_sampling');
    });

    if (gateways.length > 0 && !hasTailSampling && sdks.length > 3) {
      score -= 6;
      issues.push({
        id: 'missing-tail-sampling',
        deduction: 6,
        severity: 'major',
        message: 'Missing tail_sampling for cost optimization',
        suggestion:
          'Enable tail_sampling on Gateway to reduce ingestion costs by 50-90% while preserving errors and slow traces',
        category: 'cost',
      });
    } else if (hasTailSampling) {
      strengths.push('Tail sampling configured for cost optimization');
    }

    // Check for batch processor (network efficiency)
    const collectors = context.nodes.filter(
      (n) =>
        n.data.componentType === 'collector-agent' ||
        n.data.componentType === 'collector-gateway'
    );

    const allHaveBatch = collectors.every((c) => {
      const data = c.data as CollectorNodeData;
      return data.config.processors.some((p) => p.enabled && p.type === 'batch');
    });

    if (!allHaveBatch && collectors.length > 0) {
      score -= 3;
      issues.push({
        id: 'missing-batch',
        deduction: 3,
        severity: 'minor',
        message: 'Some collectors missing batch processor',
        suggestion: 'Enable batch processor for reduced network overhead and better cost efficiency',
        category: 'cost',
      });
    } else if (allHaveBatch) {
      strengths.push('Batch processing enabled for network efficiency');
    }

    return {
      score: Math.max(0, score),
      maxScore: 15,
      percentage: (score / 15) * 100,
      issues,
      strengths,
    };
  }

  /**
   * Estimate monthly cost
   */
  estimateCost(context: ValidationContext): CostEstimate {
    const sdks = context.nodes.filter((n) => n.data.componentType === 'edot-sdk');
    const gateways = context.nodes.filter((n) => n.data.componentType === 'collector-gateway');

    // Estimate throughput
    const estimatedSpansPerSec = sdks.length * 10000; // 10K spans/sec per SDK

    // Check sampling rate
    const hasTailSampling = gateways.some((g) => {
      const data = g.data as CollectorNodeData;
      return data.config.processors.some((p) => p.enabled && p.type === 'tail_sampling');
    });

    const samplingRate = hasTailSampling ? 0.1 : 1.0; // 10% if sampled, 100% otherwise

    // Calculate monthly volume
    const SECONDS_PER_MONTH = 30 * 24 * 60 * 60;
    const SPAN_SIZE_KB = 2;
    const sampledSpansPerSec = estimatedSpansPerSec * samplingRate;
    const monthlyGB = (sampledSpansPerSec * SECONDS_PER_MONTH * SPAN_SIZE_KB) / (1024 * 1024);

    // Apply Elastic tiered pricing
    const monthlyCost = this.calculateTieredCost(monthlyGB);

    return {
      monthlyUSD: Math.round(monthlyCost),
      range: {
        min: Math.round(monthlyCost * 0.8),
        max: Math.round(monthlyCost * 1.2),
      },
      breakdown: {
        volumeGB: Math.round(monthlyGB * 10) / 10,
        spansPerMonth: Math.round(sampledSpansPerSec * SECONDS_PER_MONTH),
        samplingRate: samplingRate * 100,
        averageSpanSizeKB: SPAN_SIZE_KB,
      },
      confidence: monthlyGB < 1 ? 'low' : monthlyGB < 100 ? 'medium' : 'high',
      pricingTier: monthlyGB < 50 ? 'tier1' : monthlyGB < 100 ? 'tier2' : 'tier3',
    };
  }

  private calculateTieredCost(volumeGB: number): number {
    const PRICING = {
      tier1: { maxGB: 50, pricePerGB: 0.6 },
      tier2: { maxGB: 100, pricePerGB: 0.33 },
      tier3: { maxGB: Infinity, pricePerGB: 0.15 },
    };

    let cost = 0;
    let remaining = volumeGB;

    // Tier 1
    if (remaining > 0) {
      const tier1GB = Math.min(remaining, PRICING.tier1.maxGB);
      cost += tier1GB * PRICING.tier1.pricePerGB;
      remaining -= tier1GB;
    }

    // Tier 2
    if (remaining > 0) {
      const tier2GB = Math.min(remaining, PRICING.tier2.maxGB - PRICING.tier1.maxGB);
      cost += tier2GB * PRICING.tier2.pricePerGB;
      remaining -= tier2GB;
    }

    // Tier 3
    if (remaining > 0) {
      cost += remaining * PRICING.tier3.pricePerGB;
    }

    return cost;
  }
}
