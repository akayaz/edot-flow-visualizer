/**
 * Recommendation Engine
 *
 * Generates ranked, actionable recommendations based on scoring results.
 * Prioritizes recommendations by impact (score improvement + cost savings).
 */

import type { ValidationContext, CollectorNodeData } from '../../types';
import type { ScoredRecommendation, CategoryScore, ScoreIssue } from './types';

export class Recommender {
  /**
   * Generate ranked recommendations from scoring results
   */
  generate(
    context: ValidationContext,
    scores: {
      configScore: CategoryScore;
      perfScore: CategoryScore;
      costScore: CategoryScore;
      reliabilityScore: CategoryScore;
      obsScore: CategoryScore;
    }
  ): ScoredRecommendation[] {
    const recommendations: ScoredRecommendation[] = [];

    // Convert issues to recommendations
    for (const issue of scores.configScore.issues) {
      recommendations.push(this.issueToRecommendation(issue, 'configuration'));
    }
    for (const issue of scores.perfScore.issues) {
      recommendations.push(this.issueToRecommendation(issue, 'performance'));
    }
    for (const issue of scores.costScore.issues) {
      recommendations.push(this.issueToRecommendation(issue, 'cost'));
    }
    for (const issue of scores.reliabilityScore.issues) {
      recommendations.push(this.issueToRecommendation(issue, 'reliability'));
    }
    for (const issue of scores.obsScore.issues) {
      recommendations.push(this.issueToRecommendation(issue, 'observability'));
    }

    // Add proactive recommendations
    recommendations.push(...this.generateProactiveRecommendations(context, scores));

    // Sort by impact (score improvement × cost impact)
    return recommendations.sort((a, b) => {
      const impactA = a.scoreImprovement + (a.costSavings || 0) / 10;
      const impactB = b.scoreImprovement + (b.costSavings || 0) / 10;
      return impactB - impactA;
    });
  }

  /**
   * Convert a score issue to a recommendation
   */
  private issueToRecommendation(issue: ScoreIssue, category: string): ScoredRecommendation {
    return {
      id: issue.id,
      title: issue.message,
      description: issue.suggestion,
      impact: issue.severity === 'critical' ? 'high' : issue.severity === 'major' ? 'medium' : 'low',
      effort: 'easy', // Most config changes are easy
      scoreImprovement: issue.deduction,
      category,
    };
  }

  /**
   * Generate proactive recommendations based on topology patterns
   */
  private generateProactiveRecommendations(
    context: ValidationContext,
    scores: any
  ): ScoredRecommendation[] {
    const recommendations: ScoredRecommendation[] = [];

    const gateways = context.nodes.filter((n) => n.data.componentType === 'collector-gateway');
    const sdks = context.nodes.filter((n) => n.data.componentType === 'edot-sdk');

    // Check for missing tail_sampling (high-impact cost optimization)
    const hasTailSampling = gateways.some((g) => {
      const data = g.data as CollectorNodeData;
      return data.config.processors.some((p) => p.enabled && p.type === 'tail_sampling');
    });

    if (gateways.length > 0 && !hasTailSampling && sdks.length > 3) {
      // Estimate cost savings
      const estimatedCostEstimate = scores.costScore?.estimateCost?.(context);
      const currentCost = estimatedCostEstimate?.monthlyUSD || 0;
      const estimatedSavings = Math.round(currentCost * 0.9); // 90% reduction potential

      recommendations.push({
        id: 'add-tail-sampling',
        title: 'Add tail_sampling for cost optimization',
        description:
          'Tail sampling can reduce ingestion costs by 50-90% while preserving errors and slow traces',
        impact: 'high',
        effort: 'easy',
        scoreImprovement: 6,
        costSavings: estimatedSavings,
        category: 'cost',
        action: 'Enable tail_sampling processor on Gateway',
        docsUrl: 'https://www.elastic.co/docs/reference/edot-collector/config/tail-based-sampling',
      });
    }

    // Check for missing resourcedetection
    const collectors = context.nodes.filter(
      (n) =>
        n.data.componentType === 'collector-agent' ||
        n.data.componentType === 'collector-gateway'
    );

    const hasResourceDetection = collectors.some((c) => {
      const data = c.data as CollectorNodeData;
      return data.config.processors.some((p) => p.enabled && p.type === 'resourcedetection');
    });

    if (!hasResourceDetection && collectors.length > 0) {
      recommendations.push({
        id: 'add-resource-detection',
        title: 'Enable resourcedetection processor',
        description:
          'Automatically enriches telemetry with host, cloud, and container metadata for better debugging',
        impact: 'medium',
        effort: 'easy',
        scoreImprovement: 3,
        category: 'observability',
        action: 'Add resourcedetection processor to collectors',
        docsUrl: 'https://www.elastic.co/docs/reference/edot-collector/components',
      });
    }

    return recommendations;
  }
}
