'use client';

/**
 * Health Score Panel
 *
 * Displays comprehensive health score with category breakdown,
 * recommendations, and resource estimates.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  EuiIcon,
  EuiText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiProgress,
  EuiCallOut,
  EuiSpacer,
  EuiButtonEmpty,
  EuiLoadingSpinner,
  EuiBadge,
  EuiStat,
} from '@elastic/eui';
import { useHealthScoreStore } from '../../store/healthScoreStore';
import type {
  HealthScore,
  HealthBreakdown,
  ScoredRecommendation,
  ResourceEstimates,
  Assumption,
} from '../../lib/health-score/types';

export function HealthScorePanel(): React.ReactElement {
  const { healthScore, isCalculating, error } = useHealthScoreStore();

  if (error) {
    return (
      <EuiCallOut title="Error calculating health score" color="danger" iconType="error" size="s">
        <EuiText size="xs" color="subdued"><p>{error}</p></EuiText>
      </EuiCallOut>
    );
  }

  if (isCalculating) {
    return (
      <div style={{ textAlign: 'center', padding: 16 }}>
        <EuiLoadingSpinner size="l" />
        <EuiSpacer size="s" />
        <EuiText size="s" color="subdued"><p>Calculating health score...</p></EuiText>
      </div>
    );
  }

  if (!healthScore) {
    return (
      <div style={{ textAlign: 'center', padding: 16 }}>
        <EuiIcon type="info" size="xl" color="subdued" />
        <EuiSpacer size="s" />
        <EuiText size="s" color="subdued"><p>Build a topology to see health score</p></EuiText>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 4 }}>
      {/* Overall Score */}
      <ScoreHeader score={healthScore} />

      {/* Category Breakdown */}
      <CategoryBreakdown breakdown={healthScore.breakdown} />

      {/* Top Recommendations */}
      <RecommendationsList recommendations={healthScore.recommendations.slice(0, 3)} />

      {/* Resource Estimates */}
      <ResourceEstimatesSection estimates={healthScore.estimates} />

      {/* Assumptions */}
      <AssumptionsFooter assumptions={healthScore.assumptions} />
    </div>
  );
}

// ============ Sub-components ============

function ScoreHeader({ score }: { score: HealthScore }): React.ReactElement {
  const gradeColor: Record<string, 'accent' | 'success' | 'primary' | 'warning' | 'danger'> = {
    S: 'accent',
    A: 'success',
    B: 'primary',
    C: 'warning',
    D: 'warning',
    F: 'danger',
  };

  const gradeLabel: Record<string, string> = {
    S: 'Excellent',
    A: 'Good',
    B: 'Fair',
    C: 'Needs Improvement',
    D: 'Poor',
    F: 'Critical',
  };

  return (
    <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" responsive={false}>
      <EuiFlexItem>
        <EuiText size="s"><strong>Health Score</strong></EuiText>
        <EuiText size="xs" color="subdued"><p>Architecture Quality Assessment</p></EuiText>
      </EuiFlexItem>
      <EuiFlexItem grow={false} style={{ textAlign: 'right' }}>
        <EuiText size="s">
          <span style={{ fontSize: 24, fontWeight: 700 }}>{score.overall}</span>
          <span style={{ color: 'var(--euiColorMediumShade)' }}>/100</span>
        </EuiText>
        <EuiBadge color={gradeColor[score.grade]}>
          Grade {score.grade} &bull; {gradeLabel[score.grade]}
        </EuiBadge>
        <EuiText size="xs" color="subdued"><p>{score.confidence} confidence</p></EuiText>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}

function CategoryBreakdown({ breakdown }: { breakdown: HealthBreakdown }): React.ReactElement {
  const categories = [
    { key: 'configuration' as const, iconType: 'gear', label: 'Configuration', color: '#06b6d4' as const },
    { key: 'performance' as const, iconType: 'visArea', label: 'Performance', color: '#3b82f6' as const },
    { key: 'cost' as const, iconType: 'currency', label: 'Cost Efficiency', color: '#10b981' as const },
    { key: 'reliability' as const, iconType: 'shield', label: 'Reliability', color: '#8b5cf6' as const },
    { key: 'observability' as const, iconType: 'eye', label: 'Observability', color: '#f59e0b' as const },
  ];

  return (
    <div>
      <EuiText size="xs"><strong>Category Breakdown</strong></EuiText>
      <EuiSpacer size="xs" />
      {categories.map(({ key, iconType, label, color }) => {
        const cat = breakdown[key];
        const percentage = Math.round((cat.score / cat.maxScore) * 100);

        return (
          <div key={key} style={{ marginBottom: 8 }}>
            <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" gutterSize="s" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiIcon type={iconType} size="s" color={color} />
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiText size="xs"><span>{label}</span></EuiText>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued">
                  <span>{cat.score}/{cat.maxScore}</span>
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiProgress value={percentage} max={100} size="s" color={color as 'primary'} />
          </div>
        );
      })}
    </div>
  );
}

function RecommendationsList({ recommendations }: { recommendations: ScoredRecommendation[] }): React.ReactElement {
  if (recommendations.length === 0) {
    return (
      <EuiCallOut
        title="No major issues found - architecture looks good!"
        color="success"
        iconType="checkInCircleFilled"
        size="s"
      />
    );
  }

  return (
    <div>
      <EuiText size="xs"><strong>Top Recommendations</strong></EuiText>
      <EuiSpacer size="xs" />
      {recommendations.map((rec) => (
        <EuiPanel key={rec.id} paddingSize="s" hasBorder style={{ marginBottom: 8 }}>
          <EuiFlexGroup alignItems="flexStart" justifyContent="spaceBetween" gutterSize="s" responsive={false}>
            <EuiFlexItem>
              <EuiText size="xs"><strong>{rec.title}</strong></EuiText>
              <EuiText size="xs" color="subdued"><p>{rec.description}</p></EuiText>
              {rec.action && (
                <EuiText size="xs" color="primary"><p>&rarr; {rec.action}</p></EuiText>
              )}
            </EuiFlexItem>
            <EuiFlexItem grow={false} style={{ textAlign: 'right' }}>
              <EuiText size="xs" color="primary"><strong>+{rec.scoreImprovement}</strong></EuiText>
              {rec.costSavings && (
                <EuiText size="xs" color="success"><span>-${rec.costSavings}/mo</span></EuiText>
              )}
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPanel>
      ))}
    </div>
  );
}

function ResourceEstimatesSection({ estimates }: { estimates: ResourceEstimates }): React.ReactElement {
  return (
    <div>
      <EuiText size="xs"><strong>Resource Estimates</strong></EuiText>
      <EuiSpacer size="xs" />
      <EuiFlexGroup gutterSize="s" responsive={false}>
        <EuiFlexItem>
          <EstimateCard
            label="Memory"
            value={`${estimates.memory.estimated}MB`}
            range={`${estimates.memory.range.min}-${estimates.memory.range.max}MB`}
            confidence={estimates.memory.confidence}
          />
        </EuiFlexItem>
        <EuiFlexItem>
          <EstimateCard
            label="Monthly Cost"
            value={`$${estimates.cost.monthlyUSD}`}
            range={`$${estimates.cost.range.min}-$${estimates.cost.range.max}`}
            confidence={estimates.cost.confidence}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="xs" />
      <EuiText size="xs" color="subdued">
        <p>
          Based on {estimates.cost.breakdown.volumeGB.toFixed(1)}GB/month &bull;{' '}
          {estimates.cost.breakdown.samplingRate.toFixed(0)}% sampling
        </p>
      </EuiText>
    </div>
  );
}

function EstimateCard({
  label,
  value,
  range,
  confidence,
}: {
  label: string;
  value: string;
  range: string;
  confidence: string;
}): React.ReactElement {
  const confidenceColor: Record<string, 'success' | 'warning' | 'danger'> = {
    high: 'success',
    medium: 'warning',
    low: 'danger',
  };

  return (
    <EuiPanel paddingSize="s" hasBorder>
      <EuiText size="xs" color="subdued"><span>{label}</span></EuiText>
      <EuiText size="s"><strong>{value}</strong></EuiText>
      <EuiText size="xs" color="subdued"><span>{range}</span></EuiText>
      <EuiBadge color={confidenceColor[confidence] || 'default'}>
        {confidence}
      </EuiBadge>
    </EuiPanel>
  );
}

function AssumptionsFooter({ assumptions }: { assumptions: Assumption[] }): React.ReactElement {
  const [showAll, setShowAll] = useState(false);

  return (
    <div style={{ borderTop: '1px solid var(--euiColorLightShade)', paddingTop: 12 }}>
      <EuiButtonEmpty
        size="xs"
        iconType="info"
        onClick={() => setShowAll(!showAll)}
        flush="left"
      >
        {showAll ? 'Hide' : 'View'} calculation assumptions ({assumptions.length})
      </EuiButtonEmpty>
      {showAll && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{ marginTop: 8 }}
        >
          {assumptions.map((a) => (
            <EuiText key={a.key} size="xs" color="subdued">
              <p style={{ marginBottom: 2 }}>
                <strong>{a.key}:</strong> {a.value}
                {a.source && <span style={{ marginLeft: 4 }}>({a.source})</span>}
              </p>
            </EuiText>
          ))}
        </motion.div>
      )}
    </div>
  );
}
