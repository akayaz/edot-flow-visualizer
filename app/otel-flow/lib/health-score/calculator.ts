/**
 * Health Score Calculator
 *
 * Core calculation engine that orchestrates all scorers and estimators
 * to produce a comprehensive health score for EDOT architectures.
 */

import type { ValidationContext } from '../../types';
import type { HealthScore, HealthGrade, ConfidenceLevel, Assumption } from './types';
import { ConfigurationScorer } from './scorers/configuration-scorer';
import { PerformanceScorer } from './scorers/performance-scorer';
import { CostScorer } from './scorers/cost-scorer';
import { ReliabilityScorer } from './scorers/reliability-scorer';
import { ObservabilityScorer } from './scorers/observability-scorer';
import { Recommender } from './recommender';
import { getValidationEngine } from '../validators';

export class HealthScoreCalculator {
  private configScorer: ConfigurationScorer;
  private perfScorer: PerformanceScorer;
  private costScorer: CostScorer;
  private reliabilityScorer: ReliabilityScorer;
  private obsScorer: ObservabilityScorer;
  private recommender: Recommender;

  constructor() {
    this.configScorer = new ConfigurationScorer();
    this.perfScorer = new PerformanceScorer();
    this.costScorer = new CostScorer();
    this.reliabilityScorer = new ReliabilityScorer();
    this.obsScorer = new ObservabilityScorer();
    this.recommender = new Recommender();
  }

  /**
   * Calculate comprehensive health score for a topology
   */
  calculate(context: ValidationContext): HealthScore {
    try {
      // Run existing validation first (we build on top of this)
      const validationEngine = getValidationEngine();
      const validationResults = validationEngine.validate(context);

      // Calculate each category score
      const configScore = this.configScorer.score(context, validationResults);
      const perfScore = this.perfScorer.score(context);
      const costScore = this.costScorer.score(context);
      const reliabilityScore = this.reliabilityScorer.score(context);
      const obsScore = this.obsScorer.score(context);

      // Calculate overall score
      const overall =
        configScore.score +
        perfScore.score +
        costScore.score +
        reliabilityScore.score +
        obsScore.score;

      // Generate recommendations (ranked by impact)
      const recommendations = this.recommender.generate(context, {
        configScore,
        perfScore,
        costScore,
        reliabilityScore,
        obsScore,
      });

      // Calculate resource estimates
      const estimates = {
        memory: this.perfScorer.estimateMemory(context),
        cpu: this.perfScorer.estimateCpu(context),
        cost: this.costScorer.estimateCost(context),
      };

      // Collect assumptions for transparency
      const assumptions = this.collectAssumptions(context);

      return {
        overall,
        grade: this.calculateGrade(overall),
        confidence: this.calculateConfidence(context),
        breakdown: {
          configuration: configScore,
          performance: perfScore,
          cost: costScore,
          reliability: reliabilityScore,
          observability: obsScore,
        },
        recommendations,
        estimates,
        assumptions,
        lastCalculated: Date.now(),
      };
    } catch (error) {
      console.error('Health score calculation error:', error);
      // Return a default score in case of errors
      return this.getDefaultScore();
    }
  }

  /**
   * Calculate letter grade from numeric score
   */
  private calculateGrade(score: number): HealthGrade {
    if (score >= 95) return 'S';
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  /**
   * Calculate confidence level based on topology completeness
   */
  private calculateConfidence(context: ValidationContext): ConfidenceLevel {
    const { nodes, edges } = context;

    // High confidence: sufficient data for accurate calculations
    const hasMultipleComponents = nodes.length >= 3;
    const hasRealisticTopology = edges.length >= 2;
    const hasCollectors = nodes.some(
      (n) =>
        n.data.componentType === 'collector-agent' ||
        n.data.componentType === 'collector-gateway'
    );

    if (hasMultipleComponents && hasRealisticTopology && hasCollectors) {
      return 'high';
    } else if (hasRealisticTopology) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Collect assumptions for transparency
   */
  private collectAssumptions(context: ValidationContext): Assumption[] {
    return [
      {
        key: 'spanSize',
        value: '2KB',
        source: 'OTel benchmarks (typical EDOT span with enrichment)',
        userAdjustable: true,
      },
      {
        key: 'throughputEstimation',
        value: '10K spans/sec per SDK',
        source: 'Conservative estimate for demo mode',
        userAdjustable: true,
      },
      {
        key: 'elasticPricing',
        value: 'Serverless Observability tiered pricing (Nov 2025)',
        source: 'https://www.elastic.co/pricing/serverless-observability',
        userAdjustable: false,
      },
      {
        key: 'safetyMargin',
        value: '25%',
        source: 'Added to resource estimates for production stability',
        userAdjustable: true,
      },
    ];
  }

  /**
   * Get default score for error cases
   */
  private getDefaultScore(): HealthScore {
    return {
      overall: 0,
      grade: 'F',
      confidence: 'low',
      breakdown: {
        configuration: { score: 0, maxScore: 40, percentage: 0, issues: [], strengths: [] },
        performance: { score: 0, maxScore: 20, percentage: 0, issues: [], strengths: [] },
        cost: { score: 0, maxScore: 15, percentage: 0, issues: [], strengths: [] },
        reliability: { score: 0, maxScore: 15, percentage: 0, issues: [], strengths: [] },
        observability: { score: 0, maxScore: 10, percentage: 0, issues: [], strengths: [] },
      },
      recommendations: [],
      estimates: {
        memory: {
          estimated: 0,
          range: { min: 0, max: 0 },
          breakdown: { base: 0, processors: 0, buffering: 0, safetyMargin: 0 },
          confidence: 'low',
        },
        cpu: { cores: 1, utilization: 0, confidence: 'low' },
        cost: {
          monthlyUSD: 0,
          range: { min: 0, max: 0 },
          breakdown: { volumeGB: 0, spansPerMonth: 0, samplingRate: 0, averageSpanSizeKB: 0 },
          confidence: 'low',
          pricingTier: 'tier1',
        },
      },
      assumptions: [],
      lastCalculated: Date.now(),
    };
  }
}
