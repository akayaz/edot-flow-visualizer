/**
 * Health Score Type Definitions
 *
 * Comprehensive type system for the Health Score feature that evaluates
 * EDOT architectures across multiple dimensions.
 */

// ============ Main Health Score Types ============

/**
 * Main health score result containing overall score, breakdown by category,
 * recommendations, resource estimates, and transparent assumptions.
 */
export interface HealthScore {
  /** Overall score (0-100) */
  overall: number;
  /** Letter grade (S/A/B/C/D/F) */
  grade: HealthGrade;
  /** Confidence level in calculations */
  confidence: ConfidenceLevel;
  /** Score breakdown by category */
  breakdown: HealthBreakdown;
  /** Ranked recommendations for improvements */
  recommendations: ScoredRecommendation[];
  /** Resource and cost estimates */
  estimates: ResourceEstimates;
  /** Transparent assumptions used in calculations */
  assumptions: Assumption[];
  /** Timestamp of calculation */
  lastCalculated: number;
}

/**
 * Score breakdown by category (total 100 points)
 */
export interface HealthBreakdown {
  /** Configuration quality (40 points max) */
  configuration: CategoryScore;
  /** Performance and resource sizing (20 points max) */
  performance: CategoryScore;
  /** Cost efficiency (15 points max) */
  cost: CategoryScore;
  /** Reliability and HA (15 points max) */
  reliability: CategoryScore;
  /** Observability coverage (10 points max) */
  observability: CategoryScore;
}

/**
 * Individual category score with issues and strengths
 */
export interface CategoryScore {
  /** Points earned in this category */
  score: number;
  /** Maximum possible points */
  maxScore: number;
  /** Percentage (score / maxScore * 100) */
  percentage: number;
  /** Issues that deducted points */
  issues: ScoreIssue[];
  /** Identified strengths */
  strengths: string[];
}

/**
 * Issue that deducted points from a category score
 */
export interface ScoreIssue {
  /** Unique identifier */
  id: string;
  /** Points deducted */
  deduction: number;
  /** Severity level */
  severity: 'critical' | 'major' | 'minor';
  /** Human-readable message */
  message: string;
  /** Suggested fix */
  suggestion: string;
  /** Category this issue belongs to */
  category: string;
}

// ============ Recommendation Types ============

/**
 * Recommendation with impact ranking and effort estimation
 */
export interface ScoredRecommendation {
  /** Unique identifier */
  id: string;
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Impact level */
  impact: RecommendationImpact;
  /** Implementation effort */
  effort: RecommendationEffort;
  /** Points gained if implemented */
  scoreImprovement: number;
  /** Monthly cost savings (USD) if applicable */
  costSavings?: number;
  /** Category this recommendation belongs to */
  category: string;
  /** Specific action to take */
  action?: string;
  /** Link to relevant documentation */
  docsUrl?: string;
}

// ============ Resource Estimate Types ============

/**
 * Resource and cost estimates for the architecture
 */
export interface ResourceEstimates {
  /** Memory estimation */
  memory: MemoryEstimate;
  /** CPU estimation */
  cpu: CpuEstimate;
  /** Cost estimation */
  cost: CostEstimate;
}

/**
 * Memory estimation with breakdown
 */
export interface MemoryEstimate {
  /** Estimated total memory (MB) */
  estimated: number;
  /** Confidence range */
  range: { min: number; max: number };
  /** Breakdown by component */
  breakdown: {
    /** Base collector memory */
    base: number;
    /** Processor overhead */
    processors: number;
    /** Buffering (e.g., tail_sampling) */
    buffering: number;
    /** Safety margin (25%) */
    safetyMargin: number;
  };
  /** Confidence level */
  confidence: ConfidenceLevel;
}

/**
 * CPU estimation
 */
export interface CpuEstimate {
  /** Number of cores needed */
  cores: number;
  /** Expected utilization percentage */
  utilization: number;
  /** Confidence level */
  confidence: ConfidenceLevel;
}

/**
 * Cost estimation with Elastic pricing breakdown
 */
export interface CostEstimate {
  /** Estimated monthly cost (USD) */
  monthlyUSD: number;
  /** Confidence range */
  range: { min: number; max: number };
  /** Detailed breakdown */
  breakdown: {
    /** Monthly data volume (GB) */
    volumeGB: number;
    /** Total spans per month */
    spansPerMonth: number;
    /** Sampling rate percentage */
    samplingRate: number;
    /** Average span size (KB) */
    averageSpanSizeKB: number;
  };
  /** Confidence level */
  confidence: ConfidenceLevel;
  /** Elastic pricing tier */
  pricingTier: 'tier1' | 'tier2' | 'tier3';
}

// ============ Assumption Types ============

/**
 * Transparent assumption used in calculations
 */
export interface Assumption {
  /** Assumption key */
  key: string;
  /** Assumption value */
  value: string | number;
  /** Source or rationale */
  source: string;
  /** Whether user can adjust this */
  userAdjustable: boolean;
}

// ============ Enum Types ============

/**
 * Health grade (S = 95-100, A = 85-94, B = 70-84, C = 55-69, D = 40-54, F = 0-39)
 */
export type HealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Confidence level in calculations
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Recommendation impact level
 */
export type RecommendationImpact = 'high' | 'medium' | 'low';

/**
 * Recommendation effort level
 */
export type RecommendationEffort = 'easy' | 'medium' | 'hard';
